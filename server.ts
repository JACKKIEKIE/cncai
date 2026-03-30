import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import multer from 'multer';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';

import packageJson from './package.json';
import { analyzeWithProviders, listProviderStatuses, NormalizedAttachment } from './server/aiService';
import {
  createTool,
  deleteSession,
  deleteTool,
  getDatabasePath,
  getPreferences,
  getSessionById,
  listSessionSummaries,
  listTools,
  setPreference,
  updateTool,
  upsertSession
} from './server/database';
import { auditGCode } from './services/cncGenerator';
import { AppMode, ChatSession, ModelOption, PrimaryAppMode, Tool, WorkspacePreferences } from './types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

const GEMINI_API_KEY = cleanEnv(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY, '');
const GEMINI_LIVE_WS_URL = cleanEnv(
  process.env.GEMINI_LIVE_WS_URL || process.env.VITE_GEMINI_LIVE_WS_URL,
  'wss://geminiv.oikpig.top'
);
const DEFAULT_STOCK = {
  shape: 'RECTANGULAR',
  width: 100,
  length: 100,
  height: 20,
  diameter: 0,
  material: 'Aluminum'
} as const;

const app = express();
const server = http.createServer(app);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  })
);
app.use(express.json({ limit: '40mb' }));
app.use(express.urlencoded({ extended: true, limit: '40mb' }));

function cleanEnv(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  const next = value.replace(/^["']|["']$/g, '').trim();
  if (!next || (next.startsWith('${') && next.endsWith('}'))) {
    return fallback;
  }

  return next;
}

function getBaseUrl(req: express.Request) {
  const explicitBase = cleanEnv(process.env.PUBLIC_APP_URL, '');
  if (explicitBase) {
    return explicitBase.replace(/\/+$/, '');
  }

  const protoHeader = req.headers['x-forwarded-proto'];
  const protocol = typeof protoHeader === 'string' ? protoHeader.split(',')[0] : req.protocol;
  return `${protocol}://${req.get('host')}`;
}

function getLiveConfig(req: express.Request) {
  const baseUrl = getBaseUrl(req);
  const wsBaseUrl = baseUrl.replace(/^http/, 'ws');
  return {
    enabled: Boolean(GEMINI_API_KEY),
    wsProxyBaseUrl: `${wsBaseUrl}/api/gemini/live`,
    httpBaseUrl: baseUrl
  };
}

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value !== 'string') {
    return value as T;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeAttachment(file?: Express.Multer.File | null): NormalizedAttachment | null {
  if (!file) {
    return null;
  }

  const fileName = file.originalname;
  const extension = path.extname(fileName).toLowerCase();
  const textExtensions = new Set(['.txt', '.md', '.dxf', '.step', '.stp', '.igs', '.iges', '.nc', '.tap']);
  const isText = file.mimetype.startsWith('text/') || textExtensions.has(extension);

  return {
    fileName,
    mimeType: file.mimetype || 'application/octet-stream',
    data: isText ? file.buffer.toString('utf8') : file.buffer.toString('base64')
  };
}

function sanitizeSession(input: Partial<ChatSession>): ChatSession {
  const now = Date.now();
  const messages = Array.isArray(input.messages) ? input.messages : [];
  const operations = Array.isArray(input.operations) ? input.operations : input.cncData?.operations || [];
  const stock = input.stock || input.cncData?.stock || DEFAULT_STOCK;
  const firstUserMessage = messages.find((message) => message.role === 'user');

  return {
    ...input,
    id: input.id || crypto.randomUUID(),
    title: input.title?.trim() || firstUserMessage?.text?.slice(0, 42) || 'Untitled machining flow',
    timestamp: typeof input.timestamp === 'number' ? input.timestamp : now,
    messages,
    cncData: input.cncData
      ? {
          ...input.cncData,
          operations,
          stock
        }
      : null,
    operations,
    stock,
    mode: input.mode || 'GENERATE',
    lastSavedAt: now
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    database: 'connected',
    version: packageJson.version,
    databasePath: getDatabasePath(),
    serverTime: Date.now()
  });
});

app.get('/api/bootstrap', (req, res) => {
  res.json({
    serverTime: Date.now(),
    health: {
      status: 'ok',
      database: 'connected',
      version: packageJson.version
    },
    providers: listProviderStatuses(),
    sessions: listSessionSummaries(),
    tools: listTools(),
    preferences: getPreferences(),
    features: {
      liveBeta: true,
      screenStudioBeta: true,
      cloudSimulationBeta: true
    },
    live: getLiveConfig(req)
  });
});

app.get('/api/live/config', (req, res) => {
  res.json(getLiveConfig(req));
});

app.get('/api/sessions', (_req, res) => {
  res.json({ sessions: listSessionSummaries() });
});

app.get('/api/sessions/:id', (req, res) => {
  const session = getSessionById(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }

  res.json({ session });
});

app.post('/api/sessions', (req, res) => {
  const session = sanitizeSession(req.body as ChatSession);
  const summary = upsertSession(session);
  res.json({ session, summary, savedAt: Date.now() });
});

app.delete('/api/sessions/:id', (req, res) => {
  deleteSession(req.params.id);
  res.status(204).send();
});

app.get('/api/tools', (_req, res) => {
  res.json({ tools: listTools() });
});

app.post('/api/tools', (req, res) => {
  const tool = req.body as Partial<Tool>;
  if (!tool || (!tool.id && !tool.name)) {
    res.status(400).json({ error: 'Provide at least a tool id or a tool name.' });
    return;
  }

  res.status(201).json({ tool: createTool(tool) });
});

app.put('/api/tools/:id', (req, res) => {
  const tool = updateTool(req.params.id, req.body as Partial<Tool>);
  if (!tool) {
    res.status(404).json({ error: 'Tool not found.' });
    return;
  }

  res.json({ tool });
});

app.delete('/api/tools/:id', (req, res) => {
  deleteTool(req.params.id);
  res.status(204).send();
});

app.post('/api/preferences', (req, res) => {
  const patch = req.body as Partial<WorkspacePreferences>;
  if (patch.defaultModel) {
    setPreference('defaultModel', patch.defaultModel);
  }
  if (patch.defaultMode) {
    setPreference('defaultMode', patch.defaultMode as PrimaryAppMode);
  }

  res.json({ preferences: getPreferences() });
});

app.post('/api/code/audit', (req, res) => {
  const gcode = typeof req.body?.gcode === 'string' ? req.body.gcode : '';
  res.json({
    result: auditGCode(gcode),
    auditedAt: Date.now()
  });
});

app.post('/api/ai/analyze', upload.single('file'), async (req, res) => {
  const startedAt = Date.now();

  try {
    const body = req.body as Record<string, unknown>;
    const prompt = typeof body.prompt === 'string' ? body.prompt : '';
    const model = typeof body.model === 'string' ? body.model : 'auto';
    const mode = (typeof body.mode === 'string' ? body.mode : 'GENERATE') as AppMode;
    const tools = parseJsonField<Tool[]>(body.tools, []);
    const history = parseJsonField<ChatSession['messages']>(body.history, []);
    const currentOperations = parseJsonField<ChatSession['operations']>(body.currentOperations, []);
    const attachment = normalizeAttachment(req.file);

    const result = await analyzeWithProviders({
      prompt,
      model: model as ModelOption,
      mode,
      tools,
      history,
      currentOperations,
      attachment
    });

    res.json({
      analysis: result.analysis,
      provider: result.provider,
      providerLabel: result.providerLabel,
      latencyMs: Date.now() - startedAt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI request failed.';
    console.error('Analyze request failed:', message);
    res.status(500).json({ error: message });
  }
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  if (!request.url?.startsWith('/api/gemini/live')) {
    return;
  }

  if (!GEMINI_API_KEY) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (clientSocket) => {
    let targetPath = request.url!.replace('/api/gemini/live', '');
    if (!targetPath.startsWith('/')) {
      targetPath = `/${targetPath}`;
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(targetPath, GEMINI_LIVE_WS_URL);
    } catch (error) {
      console.error('Invalid live proxy URL:', error);
      clientSocket.close(1011, 'Invalid live proxy URL');
      return;
    }

    targetUrl.searchParams.set('key', GEMINI_API_KEY);

    const upstream = new WebSocket(targetUrl.toString());
    const pendingMessages: Array<WebSocket.RawData> = [];

    upstream.on('open', () => {
      while (pendingMessages.length) {
        upstream.send(pendingMessages.shift()!);
      }
    });

    clientSocket.on('message', (message) => {
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.send(message);
      } else if (upstream.readyState === WebSocket.CONNECTING) {
        pendingMessages.push(message);
      }
    });

    upstream.on('message', (message) => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(message);
      }
    });

    upstream.on('close', () => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close();
      }
    });

    clientSocket.on('close', () => {
      if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
        upstream.close();
      }
    });

    upstream.on('error', (error) => {
      console.error('Gemini live upstream error:', error);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close();
      }
    });

    clientSocket.on('error', (error) => {
      console.error('Gemini live client error:', error);
      if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
        upstream.close();
      }
    });
  });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`LinguaCNC server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export default app;
