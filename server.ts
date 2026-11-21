import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

// Import API Handlers
import availabilityHandler from './api/availability';
import bookingsHandler from './api/bookings';
import sepayHandler from './api/sepay';
import adminHandler from './api/admin';
import cronHandler from './api/cron';
import healthHandler from './api/health';
import mediaHandler from './api/media';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON and URL-encoded body parser with 15MB limit for image uploads
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ limit: '15mb', extended: true }));

  // API Routes
  app.get('/api/health', healthHandler);
  app.get('/api/availability', availabilityHandler);
  
  app.route('/api/bookings')
    .get(bookingsHandler)
    .post(bookingsHandler);

  app.get('/api/bookings/lookup', bookingsHandler);

  app.post('/api/sepay/webhook', sepayHandler);
  app.post('/api/sepay', sepayHandler);

  app.route('/api/admin')
    .get(adminHandler)
    .post(adminHandler);
  app.post('/api/admin/resend-email', adminHandler);
  app.post('/api/admin/resync-sheet', adminHandler);

  // Media Management API
  app.route('/api/media')
    .get(mediaHandler)
    .post(mediaHandler);
  app.post('/api/media/upload', mediaHandler);
  app.post('/api/media/restore', mediaHandler);

  app.route('/api/cron')
    .get(cronHandler)
    .post(cronHandler);

  app.route('/api/cron/expire-holds')
    .get(cronHandler)
    .post(cronHandler);

  // Serve static images & assets directly before Vite to guarantee binary JPEG/PNG delivery
  app.use('/assets', express.static(path.join(process.cwd(), 'public/assets')));
  app.use('/images', express.static(path.join(process.cwd(), 'public/images')));
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Vite Middleware in development mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Seagull Homestay Server] Running on http://0.0.0.0:${PORT} (20 Rooms Planned)`);
  });
}

startServer().catch((err) => {
  console.error('[Server Startup Error]:', err);
});
