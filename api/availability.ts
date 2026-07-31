import type { Request, Response } from 'express';
import { checkAvailableRooms } from './lib/bookingService';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { roomTypeId, checkIn, checkOut } = req.query;

    const result = await checkAvailableRooms(
      roomTypeId ? String(roomTypeId) : undefined,
      checkIn ? String(checkIn) : undefined,
      checkOut ? String(checkOut) : undefined
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('[API Availability Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Lỗi khi kiểm tra lịch phòng trống',
    });
  }
}
