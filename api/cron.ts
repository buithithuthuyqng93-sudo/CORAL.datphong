import crypto from 'crypto';
import type { Request, Response } from 'express';
import { expireOverdueHolds } from './lib/bookingService';

function extractProvidedSecret(req: Request): string {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  const headerSecret = req.headers['x-cron-secret'];
  if (typeof headerSecret === 'string' && headerSecret.trim()) {
    return headerSecret.trim();
  }
  if (Array.isArray(headerSecret) && headerSecret[0]?.trim()) {
    return headerSecret[0].trim();
  }

  const querySecret = req.query.secret;
  if (typeof querySecret === 'string' && querySecret.trim()) {
    return querySecret.trim();
  }

  return '';
}

function timingSafeCompare(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const cronSecret = (process.env.CRON_SECRET || '').trim();
  if (!cronSecret) {
    console.error('[CRON Expire Holds] Missing CRON_SECRET environment variable.');
    return res.status(500).json({
      success: false,
      error: 'CRON_SECRET is not configured on the server',
    });
  }

  const providedSecret = extractProvidedSecret(req);
  if (!providedSecret || !timingSafeCompare(providedSecret, cronSecret)) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid CRON_SECRET' });
  }

  try {
    const result = await expireOverdueHolds();
    return res.status(200).json({
      success: true,
      message: `Đã giải phóng ${result.expiredCount} đơn giữ phòng hết hạn`,
      expiredCount: result.expiredCount,
      method: result.method,
      executedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[CRON Expire Holds Error]:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Internal Server Error' });
  }
}
