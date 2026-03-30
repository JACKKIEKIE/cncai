import { Capacitor } from '@capacitor/core';

const NATIVE_RUNTIME_CACHE_KEY = 'native-runtime-cache-reset-v2';

declare global {
  interface Window {
    __LINGUACNC_NATIVE_SHELL__?: boolean;
    webkit?: {
      messageHandlers?: Record<string, { postMessage: (payload: unknown) => void }>;
    };
  }
}

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function isNativeIOSApp() {
  return isNativeApp() && Capacitor.getPlatform() === 'ios';
}

export function isNativeAndroidApp() {
  return isNativeApp() && Capacitor.getPlatform() === 'android';
}

export function hasNativeIOSShell() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  return isNativeIOSApp() && (Boolean(window.__LINGUACNC_NATIVE_SHELL__) || document.documentElement.dataset.nativeShell === 'ios');
}

export function postNativeShellMessage(payload: Record<string, unknown>) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.webkit?.messageHandlers?.linguacncShell?.postMessage(payload);
  } catch (error) {
    console.warn('Failed to post native shell message.', error);
  }
}

function applyDocumentRuntimeState() {
  if (typeof document === 'undefined') {
    return;
  }

  const platform = isNativeApp() ? Capacitor.getPlatform() : 'web';
  document.documentElement.dataset.nativePlatform = platform;
  document.body.dataset.nativePlatform = platform;
}

async function unregisterServiceWorkers() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(registrations.map((registration) => registration.unregister()));
  } catch (error) {
    console.warn('Failed to unregister stale service workers in native shell.', error);
  }
}

async function clearBrowserCaches() {
  if (!('caches' in window)) {
    return;
  }

  try {
    const cacheKeys = await window.caches.keys();
    await Promise.allSettled(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
  } catch (error) {
    console.warn('Failed to clear stale cache storage in native shell.', error);
  }
}

export async function prepareNativeWebRuntime() {
  if (typeof window === 'undefined') {
    return;
  }

  applyDocumentRuntimeState();

  if (!isNativeApp()) {
    return;
  }

  await Promise.all([unregisterServiceWorkers(), clearBrowserCaches()]);

  try {
    window.localStorage.setItem(NATIVE_RUNTIME_CACHE_KEY, String(Date.now()));
  } catch {
    // Ignore storage errors in privacy-restricted contexts.
  }
}
