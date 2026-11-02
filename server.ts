import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createExpressApp } from './server/src/app.js';
import { dbStore } from './server/src/config/store.js';
import { initSocketHub } from './server/src/sockets/socketHub.js';

async function bootstrap() {
  const PORT = Number(process.env.PORT || 3000);
  await dbStore.connectMongoIfConfigured();

  const app = createExpressApp();
  const httpServer = http.createServer(app);
  initSocketHub(httpServer);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[NutriSync] Full-stack server + Socket.IO running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[NutriSync] Fatal startup error:', err);
  process.exit(1);
});
