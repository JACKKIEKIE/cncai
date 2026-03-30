export enum MachineOperationType {
  CIRCULAR_POCKET = 'CIRCULAR_POCKET',
  RECTANGULAR_POCKET = 'RECTANGULAR_POCKET',
  BOSS_MILLING = 'BOSS_MILLING',
  DRILL = 'DRILL',
  FACE_MILL = 'FACE_MILL',
  CONTOUR = 'CONTOUR',
  GENERAL_CHAT = 'GENERAL_CHAT',
  RUN_MYSCREEN = 'RUN_MYSCREEN',
  UNKNOWN = 'UNKNOWN'
}

export enum ToolType {
  END_MILL = 'END_MILL',
  BALL_MILL = 'BALL_MILL',
  DRILL = 'DRILL',
  FACE_MILL = 'FACE_MILL'
}

export type SegmentType = 'LINE' | 'ARC_CW' | 'ARC_CCW';
export type PrimaryAppMode = 'GENERATE' | 'OPTIMIZE';
export type AppMode = 'GENERATE' | 'OPTIMIZE' | 'OMNI' | 'SCREEN';
export type ProviderKey = 'gemini' | 'qwen' | 'mimo';
export type SyncState = 'idle' | 'saving' | 'saved' | 'error';
export type WorkspaceView = 'task' | 'overview' | 'sim' | 'code';
export type SimulationMode = 'LOCAL' | 'CLOUD';
export type ModelOption =
  | 'auto'
  | 'gemini-2.5-pro'
  | 'qwen-max'
  | 'qwen-plus'
  | 'qwen-turbo'
  | 'mimo-v2-flash'
  | 'qwen-max-latest'
  | 'qwen-plus-latest'
  | 'qwen-turbo-latest'
  | 'qwen3.5-plus'
  | 'qwen3.5-flash'
  | 'gemini-2.5-flash';

export interface Tool {
  id: string;
  name: string;
  type: ToolType;
  diameter: number;
  description?: string;
}

export interface PathSegment {
  type: SegmentType;
  x: number;
  y: number;
  cx?: number;
  cy?: number;
  radius?: number;
}

export interface StockDimensions {
  shape: 'RECTANGULAR' | 'CYLINDRICAL';
  width: number;
  length: number;
  height: number;
  diameter: number;
  material: string;
}

export interface OperationParams {
  type: MachineOperationType;
  x: number;
  y: number;
  z_start: number;
  z_depth: number;
  diameter?: number;
  width?: number;
  length?: number;
  path_segments?: PathSegment[];
  feed_rate: number;
  spindle_speed: number;
  tool_diameter: number;
  tool_type: ToolType;
  step_down: number;
  corner_radius?: number;
  boss_shape?: 'RECTANGULAR' | 'CYLINDRICAL';
}

export interface SafetyIssue {
  severity: 'critical' | 'warning' | 'info';
  line?: number;
  message: string;
  suggestion?: string;
}

export interface SafetyAuditResult {
  passed: boolean;
  score: number;
  issues: SafetyIssue[];
}

export interface CNCOutput {
  gcode: string;
  explanation: string;
  operations: OperationParams[];
  stock: StockDimensions;
  isScreen?: boolean;
  audit?: SafetyAuditResult;
}

export interface ChatMessageMeta {
  provider?: ProviderKey | 'system';
  providerLabel?: string;
  mode?: AppMode;
  latencyMs?: number;
  timestamp?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  attachment?: string;
  attachmentName?: string;
  cncResult?: CNCOutput;
  meta?: ChatMessageMeta;
}

export interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
  messages: ChatMessage[];
  cncData: CNCOutput | null;
  operations: OperationParams[];
  stock: StockDimensions;
  mode?: PrimaryAppMode;
  provider?: ProviderKey | 'system';
  lastSavedAt?: number;
}

export interface SessionSummary {
  id: string;
  title: string;
  timestamp: number;
  preview: string;
  operationCount: number;
  mode?: PrimaryAppMode;
  provider?: ProviderKey | 'system';
}

export interface ProviderStatus {
  key: ProviderKey;
  label: string;
  description: string;
  enabled: boolean;
  recommendedModels: ModelOption[];
}

export interface WorkspacePreferences {
  defaultModel: ModelOption;
  defaultMode: PrimaryAppMode;
}

export interface BootstrapPayload {
  serverTime: number;
  health: {
    status: 'ok';
    database: 'connected';
    version: string;
  };
  providers: ProviderStatus[];
  sessions: SessionSummary[];
  tools: Tool[];
  preferences: WorkspacePreferences;
  features: {
    liveBeta: boolean;
    screenStudioBeta: boolean;
    cloudSimulationBeta: boolean;
  };
  live: {
    enabled: boolean;
    wsProxyBaseUrl: string;
    httpBaseUrl: string;
  };
}

export interface AnalyzeResultPayload {
  stock: StockDimensions;
  operation: OperationParams;
  explanation: string;
  optimized_gcode?: string;
  screen_code?: string;
  [key: string]: unknown;
}

export interface AnalyzeResponse {
  analysis: AnalyzeResultPayload;
  provider: ProviderKey;
  providerLabel: string;
  latencyMs: number;
}

export interface AuditResponse {
  result: SafetyAuditResult;
  auditedAt: number;
}

export interface LiveConfigResponse {
  enabled: boolean;
  wsProxyBaseUrl: string;
  httpBaseUrl: string;
}
