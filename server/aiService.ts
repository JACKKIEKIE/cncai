import fetch from 'node-fetch';

import {
  AnalyzeResultPayload,
  AppMode,
  ChatMessage,
  ModelOption,
  OperationParams,
  ProviderKey,
  ProviderStatus,
  Tool
} from '../types';

const GEMINI_API_KEY = cleanEnv(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY, '');
const GEMINI_BASE_URL = cleanEnv(process.env.GEMINI_BASE_URL || process.env.VITE_GEMINI_BASE_URL, 'https://gemini.oikpig.top');
const ALIYUN_API_KEY = cleanEnv(process.env.ALIYUN_API_KEY || process.env.VITE_ALIYUN_API_KEY, '');
const ALIYUN_API_URL = cleanEnv(
  process.env.ALIYUN_API_URL || process.env.VITE_ALIYUN_API_URL,
  'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
);
const MIMO_API_KEY = cleanEnv(process.env.MIMO_API_KEY || process.env.VITE_MIMO_API_KEY, '');
const MIMO_API_URL = cleanEnv(process.env.MIMO_API_URL || process.env.VITE_MIMO_API_URL, 'https://api.xiaomimimo.com/v1/chat/completions');

const BASE_INSTRUCTION = `
You are an expert CNC programmer for ISO standard G-code compatible with Siemens, Fanuc and Haas controllers.

CONTEXT:
- You are part of a continuous machining conversation.
- If the user asks for a next step, return only the new operation.

STOCK RULES:
- The stock object is always the original raw material size.
- Never reduce stock dimensions after machining steps.

COORDINATE RULES:
- X0 Y0 is the center of the workpiece.
- Z0 is the top surface.

SUPPORTED OPERATIONS:
- FACE_MILL
- CONTOUR
- RECTANGULAR_POCKET
- CIRCULAR_POCKET
- BOSS_MILLING
- DRILL

JSON SHAPE:
{
  "stock": { "shape", "width", "length", "height", "diameter", "material" },
  "operation": {
    "type": "CIRCULAR_POCKET" | "RECTANGULAR_POCKET" | "DRILL" | "FACE_MILL" | "CONTOUR" | "BOSS_MILLING",
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
  "explanation": "Brief response in Chinese"
}

RETURN JSON ONLY.
`;

const OPTIMIZE_INSTRUCTION = `
You are an expert CNC code optimizer.
Return JSON with "optimized_gcode", "explanation", "stock", and "operation".
RETURN JSON ONLY.
`;

const SCREEN_INSTRUCTION = `
You are an expert HMI screen configuration assistant.
Return JSON with "screen_code" and "explanation".
RETURN JSON ONLY.
`;

const OMNI_INSTRUCTION = `
You are a CNC copilot.
Origin is centered on the workpiece and Z0 is top.
RETURN JSON ONLY.
`;

export interface NormalizedAttachment {
  fileName?: string;
  mimeType: string;
  data: string;
}

export interface AnalyzeInput {
  prompt: string;
  model: ModelOption;
  mode: AppMode;
  tools: Tool[];
  history: ChatMessage[];
  currentOperations: OperationParams[];
  attachment?: NormalizedAttachment | null;
}

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

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function parseJsonPayload(value: string): AnalyzeResultPayload {
  const cleaned = value.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1) {
    throw new Error('AI response did not include valid JSON.');
  }

  return JSON.parse(cleaned.slice(start, end + 1)) as AnalyzeResultPayload;
}

function getToolPrompt(tools: Tool[]) {
  if (!tools.length) {
    return '';
  }

  const lines = tools.map((tool) => `- ${tool.id}: ${tool.name}, ${tool.type}, D${tool.diameter}mm`);
  return `\n\nAVAILABLE TOOL LIBRARY:\n${lines.join('\n')}`;
}

function getCurrentOperationPrompt(currentOperations: OperationParams[]) {
  if (!currentOperations.length) {
    return '';
  }

  const currentZ = currentOperations.reduce((accumulator, operation) => accumulator - Math.max(operation.z_depth, 0), 0);
  const lines = currentOperations.map(
    (operation, index) => `${index + 1}. ${operation.type} (z_start=${operation.z_start}, depth=${operation.z_depth})`
  );

  return `\n\nCURRENT MACHINING STATE:\n${lines.join('\n')}\nUse z_start around ${currentZ} for the next cut unless the user explicitly resets the setup.`;
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
  const header = `[ATTACHMENT: ${attachment.fileName || 'file'} | ${attachment.mimeType}]`;
  const maxLength = attachment.mimeType === 'application/pdf' ? 80000 : 140000;
  const payload = attachment.data.slice(0, maxLength);
  return `${header}\n${payload}`;
}

function buildMessageContent(prompt: string, attachment?: NormalizedAttachment | null) {
  if (!attachment) {
    return prompt || 'Analyze the machining request.';
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

  const textContent = textifyAttachment(attachment);
  return prompt ? `${prompt}\n\n${textContent}` : textContent;
}

function mapHistory(history: ChatMessage[]) {
  return history.slice(-12).map((message) => ({
    role: message.role === 'ai' ? 'assistant' : 'user',
    content: message.text
  }));
}

function getProviderStatuses(): ProviderStatus[] {
  return [
    {
      key: 'gemini',
      label: 'Google Gemini',
      description: 'Best for reasoning-heavy CAM planning and multimodal inputs.',
      enabled: Boolean(GEMINI_API_KEY),
      recommendedModels: ['gemini-2.5-pro', 'gemini-2.5-flash']
    },
    {
      key: 'qwen',
      label: 'Qwen',
      description: 'Balanced domestic provider for steady structured responses.',
      enabled: Boolean(ALIYUN_API_KEY),
      recommendedModels: ['qwen-plus', 'qwen3.5-plus']
    },
    {
      key: 'mimo',
      label: 'Xiaomi MiMo',
      description: 'Fast lightweight option for short requests and drafts.',
      enabled: Boolean(MIMO_API_KEY),
      recommendedModels: ['mimo-v2-flash']
    }
  ];
}

export function listProviderStatuses() {
  return getProviderStatuses();
}

function enabledProviderKeys() {
  return getProviderStatuses()
    .filter((provider) => provider.enabled)
    .map((provider) => provider.key);
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

function chooseModel(model: ModelOption, prompt: string, mode: AppMode): { model: ModelOption; provider: ProviderKey } {
  const enabled = enabledProviderKeys();
  if (!enabled.length) {
    throw new Error('No AI provider is configured on the server.');
  }

  const requestedProvider = detectProvider(model);
  if (requestedProvider !== 'auto') {
    if (!enabled.includes(requestedProvider)) {
      throw new Error(`${requestedProvider} is not configured on the server.`);
    }
    return { model, provider: requestedProvider };
  }

  const shortPrompt = prompt.trim().length < 28;
  if ((mode === 'OPTIMIZE' || mode === 'SCREEN') && enabled.includes('gemini')) {
    return { model: 'gemini-2.5-pro', provider: 'gemini' };
  }
  if (!shortPrompt && enabled.includes('gemini')) {
    return { model: 'gemini-2.5-pro', provider: 'gemini' };
  }
  if (shortPrompt && enabled.includes('mimo')) {
    return { model: 'mimo-v2-flash', provider: 'mimo' };
  }
  if (enabled.includes('qwen')) {
    return { model: 'qwen-plus', provider: 'qwen' };
  }

  return {
    model: enabled[0] === 'gemini' ? 'gemini-2.5-flash' : enabled[0] === 'qwen' ? 'qwen-plus' : 'mimo-v2-flash',
    provider: enabled[0]
  };
}

async function callGemini(model: ModelOption, messages: Array<{ role: string; content: unknown }>) {
  const baseUrl = trimTrailingSlash(GEMINI_BASE_URL).replace(/\/v1beta$/, '');
  const systemInstruction = messages.find((message) => message.role === 'system')?.content;
  const requestMessages = messages.filter((message) => message.role !== 'system');
  const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY
    },
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
        temperature: 0.1
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${await response.text()}`);
  }

  const result = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const payload = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!payload) {
    throw new Error('Gemini returned an empty response.');
  }

  return parseJsonPayload(payload);
}

async function callOpenAiCompatible(provider: ProviderKey, model: ModelOption, messages: Array<{ role: string; content: unknown }>) {
  const url = provider === 'qwen' ? ALIYUN_API_URL : MIMO_API_URL;
  const apiKey = provider === 'qwen' ? ALIYUN_API_KEY : MIMO_API_KEY;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 4000,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    throw new Error(`${provider} request failed: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const payload = data.choices?.[0]?.message?.content;
  if (!payload) {
    throw new Error(`${provider} returned an empty response.`);
  }

  return parseJsonPayload(payload);
}

export async function analyzeWithProviders(input: AnalyzeInput): Promise<{
  analysis: AnalyzeResultPayload;
  provider: ProviderKey;
  providerLabel: string;
}> {
  const instruction = buildSystemInstruction(input.mode, input.tools, input.currentOperations);
  const { model, provider } = chooseModel(input.model, input.prompt, input.mode);

  const messages: Array<{ role: string; content: unknown }> = [{ role: 'system', content: instruction }];
  messages.push(...mapHistory(input.history));
  messages.push({
    role: 'user',
    content: buildMessageContent(input.prompt, input.attachment)
  });

  const analysis =
    provider === 'gemini'
      ? await callGemini(model, messages)
      : await callOpenAiCompatible(provider, model, messages);

  const providerLabel = getProviderStatuses().find((item) => item.key === provider)?.label || provider;

  return {
    analysis,
    provider,
    providerLabel
  };
}
