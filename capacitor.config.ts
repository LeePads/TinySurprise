import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tinysurprise.app",
  appName: "Tiny Surprise",
  webDir: "out",
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 400,
      backgroundColor: "#fff8f3",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
  },
};

export default config;
