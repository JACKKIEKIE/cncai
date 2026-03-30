import {
  BootstrapPayload,
  ChatSession,
  SessionSummary,
  Tool,
  WorkspacePreferences
} from '../types';
import { apiDelete, apiGet, apiJson } from './apiClient';

export async function getBootstrap() {
  return apiGet<BootstrapPayload>('/api/bootstrap');
}

export async function getSession(id: string) {
  const payload = await apiGet<{ session: ChatSession }>(`/api/sessions/${id}`);
  return payload.session;
}

export async function saveSession(session: ChatSession) {
  return apiJson<{ session: ChatSession; summary: SessionSummary; savedAt: number }>('/api/sessions', 'POST', session);
}

export async function removeSession(id: string) {
  return apiDelete(`/api/sessions/${id}`);
}

export async function createToolRecord(tool: Tool) {
  const payload = await apiJson<{ tool: Tool }>('/api/tools', 'POST', tool);
  return payload.tool;
}

export async function updateToolRecord(tool: Tool) {
  const payload = await apiJson<{ tool: Tool }>(`/api/tools/${tool.id}`, 'PUT', tool);
  return payload.tool;
}

export async function deleteToolRecord(id: string) {
  return apiDelete(`/api/tools/${id}`);
}

export async function savePreferences(patch: Partial<WorkspacePreferences>) {
  const payload = await apiJson<{ preferences: WorkspacePreferences }>('/api/preferences', 'POST', patch);
  return payload.preferences;
}
