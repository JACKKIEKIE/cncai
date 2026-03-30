import {
  ChatSession,
  ModelOption,
  OperationParams,
  PrimaryAppMode,
  SessionSummary,
  StockDimensions,
  Tool,
  ToolType,
  WorkspacePreferences
} from '../types';

const SESSIONS_KEY = 'smart-cnc-sessions';
const TOOLS_KEY = 'smart-cnc-tools';
const PREFERENCES_KEY = 'linguacnc-preferences';

const DEFAULT_STOCK: StockDimensions = {
  shape: 'RECTANGULAR',
  width: 100,
  length: 100,
  height: 20,
  diameter: 0,
  material: '铝合金'
};

const DEFAULT_TOOLS: Tool[] = [
  {
    id: 'T1',
    name: '10mm 平底铣刀',
    type: ToolType.END_MILL,
    diameter: 10,
    description: '适合通用开粗、清角和型腔加工。'
  },
  {
    id: 'T2',
    name: '6mm 球头刀',
    type: ToolType.BALL_MILL,
    diameter: 6,
    description: '适合曲面精加工和圆角过渡。'
  },
  {
    id: 'T3',
    name: '8mm 钻头',
    type: ToolType.DRILL,
    diameter: 8,
    description: '适合标准钻孔和定位孔。'
  }
];

const DEFAULT_PREFERENCES: WorkspacePreferences = {
  defaultModel: 'auto',
  defaultMode: 'GENERATE'
};

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeOperations(session: Partial<ChatSession>) {
  return Array.isArray(session.operations) ? session.operations : session.cncData?.operations || [];
}

function normalizeStock(session: Partial<ChatSession>) {
  return session.stock || session.cncData?.stock || DEFAULT_STOCK;
}

function createSummary(session: ChatSession): SessionSummary {
  const firstUserMessage = session.messages.find((message) => message.role === 'user');
  const previewSource = firstUserMessage?.text || session.cncData?.explanation || '准备开始新的加工任务';

  return {
    id: session.id,
    title: session.title || '未命名任务',
    timestamp: session.timestamp,
    preview: previewSource.slice(0, 120),
    operationCount: session.operations.length,
    mode: session.mode,
    provider: session.provider
  };
}

function normalizeSession(input: Partial<ChatSession>): ChatSession {
  const now = Date.now();
  const operations = normalizeOperations(input);
  const stock = normalizeStock(input);
  const title =
    input.title?.trim() ||
    input.messages?.find((message) => message.role === 'user')?.text?.slice(0, 24) ||
    '未命名任务';

  return {
    id: input.id || crypto.randomUUID(),
    title,
    timestamp: input.timestamp || now,
    messages: Array.isArray(input.messages) ? input.messages : [],
    cncData: input.cncData
      ? {
          ...input.cncData,
          operations,
          stock
        }
      : null,
    operations,
    stock,
    mode: input.mode || DEFAULT_PREFERENCES.defaultMode,
    provider: input.provider,
    lastSavedAt: now
  };
}

function readAllSessions() {
  const sessions = readStorage<ChatSession[]>(SESSIONS_KEY, []);
  return sessions
    .map((session) => normalizeSession(session))
    .sort((left, right) => (right.lastSavedAt || right.timestamp) - (left.lastSavedAt || left.timestamp));
}

export function loadWorkspace() {
  const sessions = readAllSessions();
  const tools = readStorage<Tool[]>(TOOLS_KEY, DEFAULT_TOOLS);
  const preferences = readStorage<WorkspacePreferences>(PREFERENCES_KEY, DEFAULT_PREFERENCES);

  if (typeof window !== 'undefined') {
    if (!window.localStorage.getItem(TOOLS_KEY)) {
      writeStorage(TOOLS_KEY, tools);
    }
    if (!window.localStorage.getItem(PREFERENCES_KEY)) {
      writeStorage(PREFERENCES_KEY, preferences);
    }
  }

  return {
    sessions,
    summaries: sessions.map(createSummary),
    tools,
    preferences
  };
}

export function saveSession(session: Partial<ChatSession>) {
  const nextSession = normalizeSession(session);
  const sessions = readAllSessions();
  const nextSessions = [nextSession, ...sessions.filter((item) => item.id !== nextSession.id)];

  writeStorage(SESSIONS_KEY, nextSessions);

  return {
    session: nextSession,
    summary: createSummary(nextSession),
    savedAt: nextSession.lastSavedAt || Date.now()
  };
}

export function getSession(id: string) {
  return readAllSessions().find((session) => session.id === id) || null;
}

export function listSessionSummaries() {
  return readAllSessions().map(createSummary);
}

export function removeSession(id: string) {
  const sessions = readAllSessions().filter((session) => session.id !== id);
  writeStorage(SESSIONS_KEY, sessions);
}

function nextToolId(tools: Tool[]) {
  const numericIds = tools
    .map((tool) => Number.parseInt(tool.id.replace(/^\D+/g, ''), 10))
    .filter((value) => Number.isFinite(value));

  return `T${Math.max(0, ...numericIds) + 1}`;
}

export function listTools() {
  return readStorage<Tool[]>(TOOLS_KEY, DEFAULT_TOOLS);
}

export function createTool(tool: Partial<Tool>) {
  const tools = listTools();
  const nextTool: Tool = {
    id: tool.id?.trim() || nextToolId(tools),
    name: tool.name?.trim() || '未命名刀具',
    type: tool.type || ToolType.END_MILL,
    diameter: typeof tool.diameter === 'number' ? tool.diameter : 0,
    description: tool.description?.trim() || ''
  };

  writeStorage(
    TOOLS_KEY,
    [...tools.filter((item) => item.id !== nextTool.id), nextTool].sort((left, right) => left.id.localeCompare(right.id))
  );

  return nextTool;
}

export function updateTool(tool: Tool) {
  const tools = listTools();
  writeStorage(
    TOOLS_KEY,
    tools
      .map((item) => (item.id === tool.id ? { ...tool, description: tool.description?.trim() || '' } : item))
      .sort((left, right) => left.id.localeCompare(right.id))
  );

  return tool;
}

export function deleteTool(id: string) {
  writeStorage(
    TOOLS_KEY,
    listTools().filter((tool) => tool.id !== id)
  );
}

export function getPreferences() {
  return readStorage<WorkspacePreferences>(PREFERENCES_KEY, DEFAULT_PREFERENCES);
}

export function savePreferences(patch: Partial<WorkspacePreferences>) {
  const current = getPreferences();
  const next: WorkspacePreferences = {
    defaultModel: (patch.defaultModel || current.defaultModel) as ModelOption,
    defaultMode: (patch.defaultMode || current.defaultMode) as PrimaryAppMode
  };

  writeStorage(PREFERENCES_KEY, next);
  return next;
}

export function buildSessionFromState(input: {
  id?: string | null;
  title: string;
  messages: ChatSession['messages'];
  cncData: ChatSession['cncData'];
  operations: OperationParams[];
  stock: StockDimensions;
  mode: PrimaryAppMode;
  provider?: ChatSession['provider'];
}) {
  return normalizeSession({
    id: input.id || undefined,
    title: input.title,
    messages: input.messages,
    cncData: input.cncData,
    operations: input.operations,
    stock: input.stock,
    mode: input.mode,
    provider: input.provider
  });
}
