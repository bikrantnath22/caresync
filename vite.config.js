import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import geminiHandler from './api/gemini.js';

/**
 * Dev-server middleware that handles /api/gemini locally during `npm run dev`
 * exactly matching Vercel's serverless function behavior.
 */
function geminiDevProxyPlugin() {
  return {
    name: 'gemini-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/gemini', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
          return;
        }

        let bodyStr = '';
        req.on('data', (chunk) => {
          bodyStr += chunk;
        });

        req.on('end', async () => {
          try {
            const body = bodyStr ? JSON.parse(bodyStr) : {};
            const mockRes = {
              setHeader(key, val) {
                res.setHeader(key, val);
              },
              status(code) {
                res.statusCode = code;
                return {
                  json(data) {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(data));
                  },
                };
              },
            };

            await geminiHandler({ ...req, body }, mockRes);
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Internal proxy error' }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const key = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;
  if (key) {
    process.env.GEMINI_API_KEY = key;
  }
  const model = env.GEMINI_MODEL || env.VITE_GEMINI_MODEL;
  if (model) {
    process.env.GEMINI_MODEL = model;
  }

  return {
    plugins: [react(), geminiDevProxyPlugin()],
    // Restrict exposed client env variables to only VITE_DEMO_
    // Ensures server-side secrets (like GEMINI_API_KEY) are never bundled into client dist/
    envPrefix: ['VITE_DEMO_'],
  };
});
