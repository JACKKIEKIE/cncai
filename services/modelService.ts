import { EndSensitivity, GoogleGenAI, Modality, StartSensitivity } from '@google/genai';

import { auditGCode } from './cncGenerator';
import {
  AnalyzeResponse,
  AnalyzeResultPayload,
  AppMode,
  AuditResponse,
  ChatMessage,
  ModelOption,
  OperationParams,
  ProviderKey,
  ProviderStatus,
  Tool
} from '../types';

const env = import.meta.env as Record<string, string | undefined>;

const DEFAULT_GEMINI_BASE_URL = 'https://gemini.oikpig.top';
const DEFAULT_GEMINI_LIVE_WS_URL = 'https://geminiv.oikpig.top';
const DEFAULT_ALIYUN_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DEFAULT_MIMO_API_URL = 'https://api.xiaomimimo.com/v1/chat/completions';
const LIVE_URL_STORAGE_KEY = 'GEMINI_LIVE_URL';

const BASE_INSTRUCTION = `
你是一名资深数控编程工程师，负责为 Siemens、Fanuc、Haas 等 ISO 标准控制系统生成可靠的加工参数。

上下文规则：
- 这是连续对话的一部分。
- 如果用户是在追加工序，只返回这一步新增的工序。

毛坯规则：
- stock 始终表示原始毛坯，不要随着加工步骤缩小。

坐标规则：
- X0 Y0 为工件中心。
- Z0 为工件上表面。

支持的工序：
- FACE_MILL
- CONTOUR
- RECTANGULAR_POCKET
- CIRCULAR_POCKET
- BOSS_MILLING
- DRILL

返回 JSON，结构必须满足：
{
  "stock": { "shape", "width", "length", "height", "diameter", "material" },
  "operation": {
    "type": "CIRCULAR_POCKET" | "RECTANGULAR_POCKET" | "DRILL" | "FACE_MILL" | "CONTOUR" | "BOSS_MILLING" | "GENERAL_CHAT",
    "tool_type": "END_MILL" | "FACE_MILL" | "DRILL" | "BALL_MILL",
    "x": 0,
    "y": 0,
    "z_start": 0,
    "z_depth": 0,
    "tool_diameter": 0,
    "diameter": 0,
    "width": 0,
    "length": 0,
    "feed_rate": 0,
    "spindle_speed": 0,
    "step_down": 0,
    "boss_shape": "RECTANGULAR" | "CYLINDRICAL",
    "corner_radius": 0,
    "path_segments": [
      { "type": "LINE", "x": 10, "y": 10 },
      { "type": "ARC_CW", "x": 20, "y": 0, "cx": 10, "cy": 0 }
    ]
  },
  "explanation": "请用中文简洁解释"
}

只返回 JSON，不要加 Markdown。
`;

const OPTIMIZE_INSTRUCTION = `
你是一名数控代码优化助手。请返回 JSON，包含 "optimized_gcode"、"explanation"、"stock" 和 "operation"。
explanation 必须使用中文，重点说明安全检查、进给优化和主轴设置。
只返回 JSON。
`;

const SCREEN_INSTRUCTION = `
你是一名 HMI 面板代码助手。请返回 JSON，包含 "screen_code" 和 "explanation"。
explanation 必须使用中文，说明界面布局和用途。
只返回 JSON。
`;

const OMNI_INSTRUCTION = `
你是一名数控编程副驾。工件坐标原点在中心，Z0 在上表面。请返回结构化 JSON。
`;

export interface Attachment {
  file: File;
  fileName: string;
  mimeType: string;
  previewUrl?: string | null;
}

export interface OmniRealtimeConfig {
  modalities: ('TEXT' | 'AUDIO')[];
  voice?: string;
  inputAudioFormat?: 'PCM_16000HZ_MONO_16BIT';
  outputAudioFormat?: 'pcm16' | 'pcm24';
  smooth_output?: boolean;
  enableTurnDetection?: boolean;
  enableInputAudioTranscription?: boolean;
  enableOutputAudioTranscription?: boolean;
  instructions?: string;
  silenceDurationMs?: number;
}

interface NormalizedAttachment {
  fileName?: string;
  mimeType: string;
  data: string;
}

let liveProxyBase = '';
let websocketPatched = false;
const LIVE_MODEL = 'gemini-3.1-flash-live-preview';

function getVadSensitivity() {
  return {
    startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
    endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW
  };
}

function cleanEnv(value: string | undefined | null, fallback = '') {
  if (!value) {
    return fallback;
  }

  const normalized = value.replace(/^["']|["']$/g, '').trim();
  if (!normalized || (normalized.startsWith('${') && normalized.endsWith('}'))) {
    return fallback;
  }

  return normalized;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function normalizeLiveWsBase(value: string) {
  const trimmed = trimTrailingSlash(value);
  if (trimmed.startsWith('https://')) {
    return `wss://${trimmed.slice('https://'.length)}`;
  }
  if (trimmed.startsWith('http://')) {
    return `ws://${trimmed.slice('http://'.length)}`;
  }
  return trimmed;
}

function getEnvValue(key: string, fallback = '') {
  return cleanEnv(env[key], fallback);
}

function getGeminiApiKey() {
  return getEnvValue('VITE_GEMINI_API_KEY', '');
}

function getGeminiBaseUrl() {
  return getEnvValue('VITE_GEMINI_BASE_URL', getEnvValue('GEMINI_BASE_URL', DEFAULT_GEMINI_BASE_URL));
}

function getGeminiLiveWsUrl() {
  if (typeof window !== 'undefined') {
    const customUrl = cleanEnv(window.localStorage.getItem(LIVE_URL_STORAGE_KEY), '');
    if (customUrl) {
      return customUrl;
    }
  }

  return getEnvValue('VITE_GEMINI_LIVE_WS_URL', getEnvValue('GEMINI_LIVE_WS_URL', DEFAULT_GEMINI_LIVE_WS_URL));
}

function getAliyunApiKey() {
  return getEnvValue('VITE_ALIYUN_API_KEY', '');
}

function getAliyunApiUrl() {
  return getEnvValue('VITE_ALIYUN_API_URL', DEFAULT_ALIYUN_API_URL);
}

function getMimoApiKey() {
  return getEnvValue('VITE_MIMO_API_KEY', '');
}

function getMimoApiUrl() {
  return getEnvValue('VITE_MIMO_API_URL', DEFAULT_MIMO_API_URL);
}

function parseJsonPayload(value: string): AnalyzeResultPayload {
  const cleaned = value.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1) {
    throw new Error('AI 返回内容不是有效的 JSON。');
  }

  return JSON.parse(cleaned.slice(start, end + 1)) as AnalyzeResultPayload;
}

function getToolPrompt(tools: Tool[]) {
  if (!tools.length) {
    return '';
  }

  const lines = tools.map((tool) => `- ${tool.id}: ${tool.name} / ${tool.type} / D${tool.diameter}mm`);
  return `\n\n可用刀具库：\n${lines.join('\n')}`;
}

function getCurrentOperationPrompt(currentOperations: OperationParams[]) {
  if (!currentOperations.length) {
    return '';
  }

  const currentZ = currentOperations.reduce((accumulator, operation) => accumulator - Math.max(operation.z_depth, 0), 0);
  const lines = currentOperations.map(
    (operation, index) => `${index + 1}. ${operation.type} (z_start=${operation.z_start}, depth=${operation.z_depth})`
  );

  return `\n\n当前工序状态：\n${lines.join('\n')}\n如果用户没有明确要求重新定义毛坯，请优先延续当前加工层位，下一步 z_start 可参考 ${currentZ}。`;
}

function buildSystemInstruction(mode: AppMode, tools: Tool[], currentOperations: OperationParams[]) {
  if (mode === 'OPTIMIZE') {
    return OPTIMIZE_INSTRUCTION;
  }
  if (mode === 'SCREEN') {
    return SCREEN_INSTRUCTION;
  }
  if (mode === 'OMNI') {
    return OMNI_INSTRUCTION;
  }

  return `${BASE_INSTRUCTION}${getToolPrompt(tools)}${getCurrentOperationPrompt(currentOperations)}`;
}

function textifyAttachment(attachment: NormalizedAttachment) {
  const header = `[附件: ${attachment.fileName || 'file'} | ${attachment.mimeType}]`;
  const maxLength = attachment.mimeType === 'application/pdf' ? 80000 : 140000;
  return `${header}\n${attachment.data.slice(0, maxLength)}`;
}

function buildMessageContent(prompt: string, attachment?: NormalizedAttachment | null) {
  if (!attachment) {
    return prompt || '请分析这个加工需求。';
  }

  if (attachment.mimeType.startsWith('image/')) {
    const parts: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> = [];
    if (prompt) {
      parts.push({ type: 'text', text: prompt });
    }
    parts.push({
      type: 'image_url',
      image_url: { url: `data:${attachment.mimeType};base64,${attachment.data}` }
    });
    return parts;
  }

  const attachmentText = textifyAttachment(attachment);
  return prompt ? `${prompt}\n\n${attachmentText}` : attachmentText;
}

function mapHistory(history: ChatMessage[]) {
  return history.slice(-12).map((message) => ({
    role: message.role === 'ai' ? 'assistant' : 'user',
    content: message.text
  }));
}

function detectProvider(model: ModelOption): ProviderKey | 'auto' {
  if (model.startsWith('gemini')) {
    return 'gemini';
  }
  if (model.startsWith('qwen')) {
    return 'qwen';
  }
  if (model.startsWith('mimo')) {
    return 'mimo';
  }
  return 'auto';
}

export function listProviderStatuses(): ProviderStatus[] {
  return [
    {
      key: 'gemini',
      label: 'Google Gemini',
      description: '适合多模态理解、图纸分析和更复杂的工艺规划。',
      enabled: Boolean(getGeminiApiKey()),
      recommendedModels: ['gemini-2.5-pro', 'gemini-2.5-flash']
    },
    {
      key: 'qwen',
      label: '阿里通义千问',
      description: '国内访问更稳定，适合常规加工问答与结构化输出。',
      enabled: Boolean(getAliyunApiKey()),
      recommendedModels: ['qwen-plus', 'qwen3.5-plus']
    },
    {
      key: 'mimo',
      label: '小米 MiMo',
      description: '响应更快，适合短文本和快速草拟。',
      enabled: Boolean(getMimoApiKey()),
      recommendedModels: ['mimo-v2-flash']
    }
  ];
}

function enabledProviders() {
  return listProviderStatuses()
    .filter((provider) => provider.enabled)
    .map((provider) => provider.key);
}

function modelForProvider(provider: ProviderKey, mode: AppMode): ModelOption {
  if (provider === 'gemini') {
    return 'gemini-2.5-flash';
  }
  if (provider === 'qwen') {
    return mode === 'OPTIMIZE' || mode === 'SCREEN' ? 'qwen3.5-plus' : 'qwen-plus';
  }
  return 'mimo-v2-flash';
}

function chooseModel(model: ModelOption, _prompt: string, mode: AppMode, hasAttachment: boolean): { model: ModelOption; provider: ProviderKey } {
  const available = enabledProviders();
  if (!available.length) {
    throw new Error('当前没有可用的 AI Provider，请先在 .env.local 中填写 API Key。');
  }

  const requestedProvider = detectProvider(model);
  if (requestedProvider !== 'auto') {
    if (!available.includes(requestedProvider)) {
      const label = listProviderStatuses().find((item) => item.key === requestedProvider)?.label || requestedProvider;
      throw new Error(`${label} 还没有配置好，请检查 API Key。`);
    }

    return { model, provider: requestedProvider };
  }

  const providerOrder: ProviderKey[] = hasAttachment ? ['gemini', 'qwen', 'mimo'] : ['gemini', 'qwen', 'mimo'];
  const selectedProvider = providerOrder.find((provider) => available.includes(provider)) || available[0];

  return {
    model: modelForProvider(selectedProvider, mode),
    provider: selectedProvider
  };
}

function buildAutoFallbackChain(mode: AppMode, hasAttachment: boolean): Array<{ model: ModelOption; provider: ProviderKey }> {
  const available = enabledProviders();
  const providerOrder: ProviderKey[] = hasAttachment ? ['gemini', 'qwen', 'mimo'] : ['gemini', 'qwen', 'mimo'];
  return providerOrder.filter((provider) => available.includes(provider)).map((provider) => ({
    model: modelForProvider(provider, mode),
    provider
  }));
}

async function readFileAsText(file: File) {
  return file.text();
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('附件读取失败。'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('附件读取失败。'));
    reader.readAsDataURL(file);
  });
}

async function normalizeAttachment(attachment: Attachment | null | undefined): Promise<NormalizedAttachment | null> {
  if (!attachment?.file) {
    return null;
  }

  const extension = attachment.fileName.toLowerCase().split('.').pop() || '';
  const textExtensions = new Set(['txt', 'md', 'dxf', 'step', 'stp', 'igs', 'iges', 'nc', 'tap']);
  const isText = attachment.mimeType.startsWith('text/') || textExtensions.has(extension);

  if (isText) {
    return {
      fileName: attachment.fileName,
      mimeType: attachment.mimeType || 'text/plain',
      data: await readFileAsText(attachment.file)
    };
  }

  const dataUrl = await readFileAsDataUrl(attachment.file);
  return {
    fileName: attachment.fileName,
    mimeType: attachment.mimeType || 'application/octet-stream',
    data: dataUrl.split(',')[1] || ''
  };
}

async function callGemini(model: ModelOption, messages: Array<{ role: string; content: unknown }>, signal?: AbortSignal) {
  const apiKey = getGeminiApiKey();
  const baseUrl = trimTrailingSlash(getGeminiBaseUrl()).replace(/\/v1beta$/, '');
  const systemInstruction = messages.find((message) => message.role === 'system')?.content;
  const requestMessages = messages.filter((message) => message.role !== 'system');
  const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    signal,
    body: JSON.stringify({
      contents: requestMessages.map((message) => {
        const role = message.role === 'assistant' ? 'model' : 'user';
        const content = message.content;
        const parts: Array<Record<string, unknown>> = [];

        if (typeof content === 'string') {
          parts.push({ text: content });
        } else if (Array.isArray(content)) {
          content.forEach((part) => {
            if (part.type === 'text') {
              parts.push({ text: part.text });
            } else if (part.type === 'image_url' && part.image_url?.url) {
              const matches = String(part.image_url.url).match(/^data:(.+);base64,(.+)$/);
              if (matches) {
                parts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
              }
            }
          });
        }

        return { role, parts };
      }),
      system_instruction:
        typeof systemInstruction === 'string' ? { parts: [{ text: systemInstruction }] } : undefined,
      generation_config: {
        response_mime_type: 'application/json',
        temperature: 0.15
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini 请求失败：${await response.text()}`);
  }

  const result = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const payload = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!payload) {
    throw new Error('Gemini 没有返回有效内容。');
  }

  return parseJsonPayload(payload);
}

async function callOpenAiCompatible(
  provider: ProviderKey,
  model: ModelOption,
  messages: Array<{ role: string; content: unknown }>,
  signal?: AbortSignal
) {
  const url = provider === 'qwen' ? getAliyunApiUrl() : getMimoApiUrl();
  const apiKey = provider === 'qwen' ? getAliyunApiKey() : getMimoApiKey();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    signal,
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 4000,
      temperature: 0.15,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    throw new Error(`${provider} 请求失败：${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const payload = data.choices?.[0]?.message?.content;
  if (!payload) {
    throw new Error(`${provider} 没有返回有效内容。`);
  }

  return parseJsonPayload(payload);
}

function ensureLiveWebSocketPatch(proxyBaseUrl: string) {
  liveProxyBase = normalizeLiveWsBase(proxyBaseUrl);
  if (websocketPatched || typeof window === 'undefined' || !liveProxyBase) {
    return;
  }

  const OriginalWebSocket = window.WebSocket;
  const PatchedWebSocket = (function (url: string | URL, protocols?: string | string[]) {
    let finalUrl = url.toString();
    if (finalUrl.includes('generativelanguage.googleapis.com')) {
      const original = new URL(finalUrl);
      finalUrl = `${liveProxyBase}${original.pathname}${original.search}`;
    }
    return new OriginalWebSocket(finalUrl, protocols);
  } as unknown) as typeof WebSocket;

  Object.assign(PatchedWebSocket, OriginalWebSocket);
  PatchedWebSocket.prototype = OriginalWebSocket.prototype;

  Object.defineProperty(window, 'WebSocket', {
    value: PatchedWebSocket,
    writable: true,
    configurable: true
  });

  websocketPatched = true;
}

export async function connectLive(
  callbacks: {
    onopen?: () => void;
    onmessage?: (message: unknown) => void;
    onerror?: (error: unknown) => void;
    onclose?: (event?: CloseEvent) => void;
  },
  config?: OmniRealtimeConfig
) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini Live 未配置，请先在 .env.local 中填写 VITE_GEMINI_API_KEY。');
  }

  const geminiBaseUrl = trimTrailingSlash(getGeminiBaseUrl()).replace(/\/v1beta$/, '');
  const liveWsUrl = getGeminiLiveWsUrl();

  ensureLiveWebSocketPatch(liveWsUrl);

  const aiLiveClient = new GoogleGenAI({
    apiKey,
    httpOptions: geminiBaseUrl ? { baseUrl: geminiBaseUrl } : undefined
  });
  const { startOfSpeechSensitivity, endOfSpeechSensitivity } = getVadSensitivity();

  const session = await aiLiveClient.live.connect({
    model: LIVE_MODEL,
    callbacks: {
      onopen: () => callbacks.onopen?.(),
      onmessage: (message) => callbacks.onmessage?.(message),
      onerror: (error) => callbacks.onerror?.(error),
      onclose: (event) => callbacks.onclose?.(event)
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: config?.voice || 'Aoede'
          }
        }
      },
      inputAudioTranscription: config?.enableInputAudioTranscription ? {} : undefined,
      outputAudioTranscription:
        config?.enableOutputAudioTranscription || config?.modalities?.includes('TEXT') ? {} : undefined,
      sessionResumption: {},
      contextWindowCompression: {
        slidingWindow: {}
      },
      realtimeInputConfig:
        config?.enableTurnDetection === false
          ? {
              automaticActivityDetection: {
                disabled: true
              }
            }
          : {
              automaticActivityDetection: {
                disabled: false,
                startOfSpeechSensitivity,
                endOfSpeechSensitivity,
                prefixPaddingMs: 40,
                silenceDurationMs: Math.max(config?.silenceDurationMs ?? 600, 100)
              }
            },
      systemInstruction: config?.instructions || '你是灵语智造的数控语音助手，请全程使用中文交流。'
    }
  });

  return {
    sendRealtimeInput: (payload: { audio: { data: string; mimeType: string } }) => {
      session.sendRealtimeInput({ audio: payload.audio });
    },
    sendRealtimeVideo: (payload: { video: { data: string; mimeType: string } }) => {
      session.sendRealtimeInput({ video: payload.video });
    },
    signalAudioStreamEnd: () => {
      session.sendRealtimeInput({ audioStreamEnd: true });
    },
    close: () => {
      session.close();
    }
  };
}

export async function analyzeRequest(
  prompt: string,
  attachment: Attachment | null | undefined,
  model: ModelOption,
  mode: AppMode,
  signal?: AbortSignal,
  tools: Tool[] = [],
  history: ChatMessage[] = [],
  currentOperations: OperationParams[] = []
): Promise<AnalyzeResponse> {
  const startedAt = Date.now();
  const normalizedAttachment = await normalizeAttachment(attachment);
  const instruction = buildSystemInstruction(mode, tools, currentOperations);
  const selected = chooseModel(model, prompt, mode, Boolean(normalizedAttachment));

  const messages: Array<{ role: string; content: unknown }> = [{ role: 'system', content: instruction }];
  messages.push(...mapHistory(history));
  messages.push({
    role: 'user',
    content: buildMessageContent(prompt, normalizedAttachment)
  });

  const candidates = model === 'auto' ? buildAutoFallbackChain(mode, Boolean(normalizedAttachment)) : [selected];
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const analysis =
        candidate.provider === 'gemini'
          ? await callGemini(candidate.model, messages, signal)
          : await callOpenAiCompatible(candidate.provider, candidate.model, messages, signal);

      return {
        analysis,
        provider: candidate.provider,
        providerLabel: listProviderStatuses().find((item) => item.key === candidate.provider)?.label || candidate.provider,
        latencyMs: Date.now() - startedAt
      };
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        throw error;
      }
      lastError = error;
      if (model !== 'auto') {
        throw error;
      }
      console.warn(`自动模型回退：${candidate.provider} 失败，尝试下一个可用模型。`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('AI 请求失败。');
}

export async function auditCode(gcode: string): Promise<AuditResponse> {
  return {
    result: auditGCode(gcode),
    auditedAt: Date.now()
  };
}
