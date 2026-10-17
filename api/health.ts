import type { Request, Response } from 'express';
import { isSupabaseConfigured, checkSupabaseLiveConnection } from './lib/supabaseServer';

export default async function handler(req: Request, res: Response) {
  const dbHealth = await checkSupabaseLiveConnection();

  return res.status(200).json({
    status: 'ok',
    system: 'Homestay & Cà Phê Seagull Lý Sơn Booking PMS (20 Rooms Planned)',
    mode: dbHealth.connected ? 'production' : 'demo',
    database: {
      isConfigured: dbHealth.isConfigured,
      liveConnected: dbHealth.connected,
      latencyMs: dbHealth.latencyMs,
      statusMessage: dbHealth.message,
      error: dbHealth.error,
    },
    paymentGateway: {
      provider: 'SePay VietQR',
      status: process.env.SEPAY_WEBHOOK_SECRET ? 'configured' : 'waiting_credentials',
    },
    timestamp: new Date().toISOString(),
    timezone: process.env.TIMEZONE || 'Asia/Ho_Chi_Minh',
  });
}
