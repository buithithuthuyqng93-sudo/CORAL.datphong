import type { Request, Response } from 'express';
import { isSupabaseConfigured } from './lib/supabaseServer';

export default async function handler(req: Request, res: Response) {
  return res.status(200).json({
    status: 'ok',
    system: 'Homestay & CAFE CORAL Lý Sơn Booking PMS',
    mode: isSupabaseConfigured() ? 'production' : 'demo',
    timestamp: new Date().toISOString(),
    timezone: process.env.TIMEZONE || 'Asia/Ho_Chi_Minh',
  });
}
