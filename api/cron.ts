import type { Request, Response } from 'express';
import { expireOverdueHolds } from './lib/bookingService';

export default async function handler(req: Request, res: Response) {
  // Optional protection via CRON_SECRET header or query param
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = req.headers['x-cron-secret'] || req.query.secret;

  if (cronSecret && providedSecret !== cronSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized CRON_SECRET' });
  }

  try {
    const result = await expireOverdueHolds();
    return res.status(200).json({
      success: true,
      message: `Đã giải phóng ${result.expiredCount} đơn giữ phòng hết hạn`,
      expiredCount: result.expiredCount,
    });
  } catch (err: any) {
    console.error('[CRON Expire Holds Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
