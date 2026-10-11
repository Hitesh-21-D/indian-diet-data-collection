import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    {
      name: "small-mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 320, height: 640 } },
    },
    {
      name: "tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
      },
    },
    { name: "webkit-mobile", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "npm run dev -- --port 5173 --strictPort",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
    env: {
      VITE_FIREBASE_API_KEY: "demo-key",
      VITE_FIREBASE_PROJECT_ID: "demo-diet-study",
      VITE_FIREBASE_APP_ID: "demo-app",
      VITE_FIREBASE_AUTH_DOMAIN: "demo-diet-study.firebaseapp.com",
      VITE_USE_EMULATORS: "true",
    },
  },
});
