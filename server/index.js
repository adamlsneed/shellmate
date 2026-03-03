import express from 'express';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // API routes
  app.use('/api/generate', generateRoute);
  app.use('/api', filesRoute);
  app.use('/api', configRoute);
  app.use('/api', validateRoute);
  app.use('/api', chatRoute);
  app.use('/api', preflightRoute);
  app.use('/api', capabilitiesRoute);
  app.use('/api', agentChatRoute);

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
