import { isNativeAndroidApp } from './nativeRuntimeService';

const ANDROID_PERMISSION_BOOTSTRAP_KEY = 'android-native-permission-bootstrap-v1';

function hasBootstrappedPermissions() {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.localStorage.getItem(ANDROID_PERMISSION_BOOTSTRAP_KEY) !== null;
}

function markPermissionsBootstrapped() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ANDROID_PERMISSION_BOOTSTRAP_KEY, String(Date.now()));
}

export async function bootstrapNativePermissions() {
  if (!isNativeAndroidApp() || hasBootstrappedPermissions()) {
    return;
  }

  markPermissionsBootstrapped();

  if (!navigator.mediaDevices?.getUserMedia) {
    return;
  }

  window.setTimeout(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });

      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      console.warn('Android 首次媒体权限预热失败', error);
    }
  }, 900);
}
