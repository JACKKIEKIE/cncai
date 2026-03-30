import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  ChatSession,
  ModelOption,
  PrimaryAppMode,
  SessionSummary,
  StockDimensions,
  Tool,
  ToolType,
  WorkspacePreferences
} from '../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'linguacnc.sqlite');

const DEFAULT_TOOLS: Tool[] = [
  { id: 'T1', name: 'Precision End Mill', type: ToolType.END_MILL, diameter: 10, description: 'General roughing and side milling.' },
  { id: 'T2', name: 'Ball Finish Cutter', type: ToolType.BALL_MILL, diameter: 6, description: 'Fine finishing and contoured surfaces.' },
  { id: 'T3', name: 'Drill Bit', type: ToolType.DRILL, diameter: 8, description: 'Standard drilling tool for pilot holes.' }
];

const DEFAULT_PREFERENCES: WorkspacePreferences = {
  defaultModel: 'auto',
  defaultMode: 'GENERATE'
};

const DEFAULT_STOCK: StockDimensions = {
  shape: 'RECTANGULAR',
  width: 100,
  length: 100,
  height: 20,
  diameter: 0,
  material: 'Aluminum'
};

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    preview TEXT NOT NULL,
    operation_count INTEGER NOT NULL DEFAULT 0,
    mode TEXT,
    provider TEXT,
    payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    diameter REAL NOT NULL,
    description TEXT DEFAULT '',
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function createSessionSummary(session: ChatSession): SessionSummary {
  const messages = Array.isArray(session.messages) ? session.messages : [];
  const operations = Array.isArray(session.operations) ? session.operations : session.cncData?.operations || [];
  const firstUserMessage = messages.find((message) => message.role === 'user');
  const previewSource = firstUserMessage?.text || session.cncData?.explanation || 'Ready for a new machining task.';

  return {
    id: session.id,
    title: session.title || 'Untitled machining flow',
    timestamp: session.timestamp || Date.now(),
    preview: previewSource.slice(0, 140),
    operationCount: operations.length,
    mode: session.mode,
    provider: session.provider
  };
}

function normalizeSessionForStorage(session: ChatSession, savedAt: number): ChatSession {
  const messages = Array.isArray(session.messages) ? session.messages : [];
  const operations = Array.isArray(session.operations) ? session.operations : session.cncData?.operations || [];
  const stock = session.stock || session.cncData?.stock || DEFAULT_STOCK;

  return {
    ...session,
    title: session.title || 'Untitled machining flow',
    timestamp: session.timestamp || savedAt,
    messages,
    operations,
    stock,
    cncData: session.cncData
      ? {
          ...session.cncData,
          operations,
          stock
        }
      : null,
    mode: session.mode || DEFAULT_PREFERENCES.defaultMode,
    lastSavedAt: savedAt
  };
}

function getNextToolId() {
  const rows = db.prepare('SELECT id FROM tools').all() as Array<{ id: string }>;
  const highestNumericId = rows.reduce((currentMax, row) => {
    const numericPart = Number.parseInt(row.id.replace(/^\D+/g, ''), 10);
    return Number.isFinite(numericPart) ? Math.max(currentMax, numericPart) : currentMax;
  }, 0);

  return `T${highestNumericId + 1}`;
}

function seedDefaults() {
  const toolCount = db.prepare('SELECT COUNT(1) as count FROM tools').get() as { count: number };
  if (toolCount.count === 0) {
    const insertTool = db.prepare(`
      INSERT INTO tools (id, name, type, diameter, description, updated_at)
      VALUES (@id, @name, @type, @diameter, @description, @updated_at)
    `);
    const timestamp = Date.now();
    const transaction = db.transaction((tools: Tool[]) => {
      tools.forEach((tool) => insertTool.run({ ...tool, updated_at: timestamp }));
    });
    transaction(DEFAULT_TOOLS);
  }

  const prefCount = db.prepare('SELECT COUNT(1) as count FROM preferences').get() as { count: number };
  if (prefCount.count === 0) {
    const insertPreference = db.prepare(`
      INSERT INTO preferences (key, value, updated_at)
      VALUES (@key, @value, @updated_at)
    `);
    const timestamp = Date.now();
    insertPreference.run({ key: 'defaultModel', value: JSON.stringify(DEFAULT_PREFERENCES.defaultModel), updated_at: timestamp });
    insertPreference.run({ key: 'defaultMode', value: JSON.stringify(DEFAULT_PREFERENCES.defaultMode), updated_at: timestamp });
  }
}

seedDefaults();

export function getDatabasePath() {
  return DB_PATH;
}

export function listSessionSummaries(): SessionSummary[] {
  const rows = db.prepare(`
    SELECT id, title, timestamp, preview, operation_count as operationCount, mode, provider
    FROM sessions
    ORDER BY timestamp DESC
  `).all() as Array<{
    id: string;
    title: string;
    timestamp: number;
    preview: string;
    operationCount: number;
    mode: PrimaryAppMode | null;
    provider: ChatSession['provider'] | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    timestamp: row.timestamp,
    preview: row.preview,
    operationCount: row.operationCount,
    mode: row.mode || undefined,
    provider: row.provider || undefined
  }));
}

export function getSessionById(id: string): ChatSession | null {
  const row = db.prepare('SELECT payload FROM sessions WHERE id = ?').get(id) as { payload: string } | undefined;
  if (!row) {
    return null;
  }

  try {
    return JSON.parse(row.payload) as ChatSession;
  } catch {
    return null;
  }
}

export function upsertSession(session: ChatSession): SessionSummary {
  const now = Date.now();
  const normalizedSession = normalizeSessionForStorage(session, now);
  const summary = createSessionSummary(normalizedSession);

  db.prepare(`
    INSERT INTO sessions (id, title, timestamp, preview, operation_count, mode, provider, payload, updated_at)
    VALUES (@id, @title, @timestamp, @preview, @operation_count, @mode, @provider, @payload, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      timestamp = excluded.timestamp,
      preview = excluded.preview,
      operation_count = excluded.operation_count,
      mode = excluded.mode,
      provider = excluded.provider,
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `).run({
    id: normalizedSession.id,
    title: summary.title,
    timestamp: summary.timestamp,
    preview: summary.preview,
    operation_count: summary.operationCount,
    mode: summary.mode || null,
    provider: summary.provider || null,
    payload: JSON.stringify(normalizedSession),
    updated_at: now
  });

  return summary;
}

export function deleteSession(id: string) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

export function listTools(): Tool[] {
  return db.prepare(`
    SELECT id, name, type, diameter, description
    FROM tools
    ORDER BY id ASC
  `).all() as Tool[];
}

export function createTool(tool: Partial<Tool>): Tool {
  const nextTool: Tool = {
    id: tool.id?.trim() || getNextToolId(),
    name: tool.name?.trim() || 'Unnamed Tool',
    type: tool.type || ToolType.END_MILL,
    diameter: Number.isFinite(tool.diameter) ? Number(tool.diameter) : 0,
    description: tool.description?.trim() || ''
  };

  db.prepare(`
    INSERT INTO tools (id, name, type, diameter, description, updated_at)
    VALUES (@id, @name, @type, @diameter, @description, @updated_at)
  `).run({
    ...nextTool,
    updated_at: Date.now()
  });

  return nextTool;
}

export function updateTool(id: string, patch: Partial<Tool>): Tool | null {
  const current = db.prepare(`
    SELECT id, name, type, diameter, description
    FROM tools
    WHERE id = ?
  `).get(id) as Tool | undefined;

  if (!current) {
    return null;
  }

  const next: Tool = {
    ...current,
    ...patch,
    id
  };

  db.prepare(`
    UPDATE tools
    SET name = @name,
        type = @type,
        diameter = @diameter,
        description = @description,
        updated_at = @updated_at
    WHERE id = @id
  `).run({
    ...next,
    description: next.description || '',
    updated_at: Date.now()
  });

  return next;
}

export function deleteTool(id: string) {
  db.prepare('DELETE FROM tools WHERE id = ?').run(id);
}

export function getPreferences(): WorkspacePreferences {
  const rows = db.prepare('SELECT key, value FROM preferences').all() as Array<{ key: string; value: string }>;

  const values = rows.reduce<Record<string, string>>((accumulator, row) => {
    accumulator[row.key] = row.value;
    return accumulator;
  }, {});

  return {
    defaultModel: safeParse<ModelOption>(values.defaultModel || JSON.stringify(DEFAULT_PREFERENCES.defaultModel), DEFAULT_PREFERENCES.defaultModel),
    defaultMode: safeParse<PrimaryAppMode>(values.defaultMode || JSON.stringify(DEFAULT_PREFERENCES.defaultMode), DEFAULT_PREFERENCES.defaultMode)
  };
}

export function setPreference(key: keyof WorkspacePreferences, value: WorkspacePreferences[keyof WorkspacePreferences]) {
  db.prepare(`
    INSERT INTO preferences (key, value, updated_at)
    VALUES (@key, @value, @updated_at)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run({
    key,
    value: JSON.stringify(value),
    updated_at: Date.now()
  });
}
