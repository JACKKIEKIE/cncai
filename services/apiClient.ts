const DEFAULT_LOCAL_API = 'http://127.0.0.1:3000';

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export function getApiBaseUrl() {
  const explicitBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (explicitBase) {
    return trimTrailingSlash(explicitBase);
  }

  if (typeof window !== 'undefined' && window.location.protocol !== 'file:') {
    return trimTrailingSlash(window.location.origin);
  }

  return DEFAULT_LOCAL_API;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      const text = await response.text();
      if (text) {
        message = text;
      }
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiGet<T>(path: string) {
  const response = await fetch(`${getApiBaseUrl()}${path}`);
  return parseResponse<T>(response);
}

export async function apiDelete(path: string) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'DELETE'
  });
  return parseResponse<void>(response);
}

export async function apiJson<T>(path: string, method: 'POST' | 'PUT', payload: unknown) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  return parseResponse<T>(response);
}

export async function apiForm<T>(path: string, formData: FormData) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'POST',
    body: formData
  });
  return parseResponse<T>(response);
}
