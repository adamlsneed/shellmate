import express from 'express';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync } from 'fs';
import { getDistPath } from './utils/paths.js';
import generateRoute from './routes/generate.js';
import filesRoute from './routes/files.js';
import configRoute from './routes/config.js';
import validateRoute from './routes/validate.js';
import chatRoute from './routes/chat.js';
import preflightRoute from './routes/preflight.js';
import capabilitiesRoute from './routes/capabilities.js';
import agentChatRoute from './routes/agentChat.js';
import toolsRoute from './routes/tools.js';
import { registerBuiltins } from './tools/builtins.js';
import { registerMacTools } from './tools/mac/index.js';
import { discoverCLIs } from './tools/discovery.js';
import { loadPlugins, watchPlugins } from './tools/plugins.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createServer() {
  // Initialize tool registry
  registerBuiltins();
  registerMacTools();
  await discoverCLIs();
  await loadPlugins();
  watchPlugins();

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Generate a random auth token for this session
  const authToken = crypto.randomBytes(32).toString('hex');
  app.locals.authToken = authToken;

  // CORS + auth middleware for API routes
  app.use('/api', (req, res, next) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Shellmate-Token');

    if (req.method === 'OPTIONS') return res.sendStatus(204);

    // In dev mode, skip auth (localhost only)
    if (process.env.NODE_ENV === 'development') return next();

    // Require auth token on all API requests
    const token = req.headers['x-shellmate-token'];
    if (token !== authToken) {
      return res.status(403).json({ error: 'Invalid or missing auth token' });
    }

    next();
  });

  // API routes
  app.use('/api/generate', generateRoute);
  app.use('/api', filesRoute);
  app.use('/api', configRoute);
  app.use('/api', validateRoute);
  app.use('/api', chatRoute);
  app.use('/api', preflightRoute);
  app.use('/api', capabilitiesRoute);
  app.use('/api', agentChatRoute);
  app.use('/api', toolsRoute);

  if (process.env.NODE_ENV === 'development') {
    // Vite dev server proxy
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: path.join(__dirname, '../client'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve built client
    const distPath = getDistPath();
    if (!existsSync(path.join(distPath, 'index.html'))) {
      throw new Error(
        'No built client found at dist/index.html. Run "npm run build" first, then start the server.'
      );
    }
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}
