import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chatnova.messenger',
  appName: 'ChatNova',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
