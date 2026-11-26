import type { Request, Response } from 'express';
import { z } from 'zod';
import { createBookingDraft, lookupBookingByCode } from '../lib/bookingService.js';

const CreateBookingSchema = z.object({
  roomTypeId: z.string().min(1, 'Loại phòng là bắt buộc'),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày nhận phòng không hợp lệ (YYYY-MM-DD)'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày trả phòng không hợp lệ (YYYY-MM-DD)'),
  guestName: z.string().min(2, 'Họ tên khách hàng phải từ 2 ký tự trở lên'),
  phone: z.string().min(8, 'Số điện thoại không hợp lệ'),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  adults: z.number().int().min(1).optional(),
  children: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'POST') {
    try {
      const parsedInput = CreateBookingSchema.parse(req.body);

      const result = await createBookingDraft({
        roomTypeId: parsedInput.roomTypeId,
        checkIn: parsedInput.checkIn,
        checkOut: parsedInput.checkOut,
        guestName: parsedInput.guestName,
        phone: parsedInput.phone,
        email: parsedInput.email || undefined,
        adults: parsedInput.adults,
        children: parsedInput.children,
        notes: parsedInput.notes,
      });

      return res.status(201).json({
        success: true,
        data: result.booking,
        isDemo: result.isDemo,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Dữ liệu không hợp lệ',
          details: err.issues,
        });
      }
      console.error('[API Create Booking Error]:', err);
      return res.status(400).json({
        success: false,
        error: err.message || 'Không thể khởi tạo đơn đặt phòng',
      });
    }
  }

  if (req.method === 'GET') {
    try {
      const { code, contact } = req.query;

      if (!code || !contact) {
        return res.status(400).json({
          success: false,
          error: 'Thiếu mã đơn đặt phòng hoặc số điện thoại/email tra cứu',
        });
      }

      const booking = await lookupBookingByCode(String(code), String(contact));

      if (!booking) {
        return res.status(404).json({
          success: false,
          error: 'Không tìm thấy đơn đặt phòng khớp với thông tin cung cấp',
        });
      }

      return res.status(200).json({
        success: true,
        data: booking,
      });
    } catch (err: any) {
      console.error('[API Lookup Booking Error]:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Lỗi tra cứu đơn đặt phòng',
      });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
