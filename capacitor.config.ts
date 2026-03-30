import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.linguacnc.app',
  appName: '灵语智造',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'ionic'
  },
  ios: {
    contentInset: 'always',
    scrollEnabled: true
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#eef4ff',
      showSpinner: true,
      spinnerColor: '#0a84ff'
    }
  }
};

export default config;
