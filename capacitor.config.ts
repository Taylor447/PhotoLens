import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.photolens',
  appName: 'PhotoLens',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  plugins: {
    SplashScreen: {
      launchShowDuration: 650,
      launchAutoHide: true,
      backgroundColor: '#080b12',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_INSIDE'
    }
  }
};

export default config;
