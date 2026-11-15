import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Restrict exposed client env variables to only VITE_DEMO_
  // Ensures server-side secrets (like GEMINI_API_KEY or legacy VITE_ keys in .env) are never bundled into client dist/
  envPrefix: ['VITE_DEMO_'],
});
