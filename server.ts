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
import cmsHandler from './api/cms';

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

  // Generic CMS & Contact API (rooms, services, contact messages)
  app.route('/api/cms')
    .get(cmsHandler)
    .post(cmsHandler);
  app.post('/api/cms/upload-image', cmsHandler);
  app.all('/api/cms/*', cmsHandler);

  app.route('/api/cron')
    .get(cronHandler)
    .post(cronHandler);

  app.route('/api/cron/expire-holds')
    .get(cronHandler)
    .post(cronHandler);

  // Guarantee NO /api/* request ever falls through to Vite SPA HTML (<!doctype html>)
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: `Không tìm thấy API endpoint: ${req.method} ${req.path}`,
    });
  });

  // Guarantee Express errors on /api/* always return valid JSON
  app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[API Error Middleware]:', err);
    res.status(err?.status || 500).json({
      success: false,
      error: err?.message || 'Lỗi máy chủ khi xử lý yêu cầu API.',
    });
  });

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
