import type { Request, Response } from 'express';
import { getSupabaseServerClient, isSupabaseConfigured, checkSupabaseLiveConnection } from './lib/supabaseServer';
import { sendBookingConfirmationEmail } from './lib/gmailAdapter';
import { syncBookingToGoogleSheet } from './lib/googleSheetsAdapter';

export default async function handler(req: Request, res: Response) {
  const action = req.query.action || req.body?.action;

  // DB STATUS CHECK
  if (action === 'db-status') {
    const status = await checkSupabaseLiveConnection();
    return res.status(200).json({ success: true, ...status });
  }

  // GET ALL BOOKINGS
  if (req.method === 'GET') {
    if (!isSupabaseConfigured()) {
      return res.status(200).json({
        success: true,
        isDemo: true,
        message: 'Demo mode',
      });
    }

    try {
      const supabase = getSupabaseServerClient();
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return res.status(200).json({
        success: true,
        isDemo: false,
        bookings,
      });
    } catch (err: any) {
      console.error('[Admin GET Bookings Error]:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (req.method === 'POST') {
    // 1. RESEND CONFIRMATION EMAIL
    if (action === 'resend-email' || req.path.endsWith('/resend-email')) {
      const { bookingId } = req.body;
      if (!bookingId) {
        return res.status(400).json({ success: false, error: 'Thiếu bookingId' });
      }

      if (!isSupabaseConfigured()) {
        return res.status(200).json({ success: true, message: 'Gửi lại email giả lập thành công (Demo Mode)' });
      }

      try {
        const supabase = getSupabaseServerClient();
        const { data: booking, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', bookingId)
          .single();

        if (error || !booking) {
          return res.status(404).json({ success: false, error: 'Không tìm thấy đơn đặt phòng' });
        }

        if (!booking.guest_email) {
          return res.status(400).json({ success: false, error: 'Đơn đặt phòng này không có địa chỉ email' });
        }

        const emailResult = await sendBookingConfirmationEmail({
          to: booking.guest_email,
          guestName: booking.guest_name,
          bookingCode: booking.temporary_order_code,
          confirmationCode: booking.confirmation_code || booking.temporary_order_code,
          roomTypeName: booking.room_type_name || 'Bungalow Vòm Cliffside',
          checkIn: booking.check_in_date,
          checkOut: booking.check_out_date,
          nights: booking.number_of_nights,
          totalPrice: Number(booking.total_amount),
          depositAmount: Number(booking.required_payment_amount),
          remainingAmount: Number(booking.remaining_amount),
          paymentStatus: booking.status === 'confirmed' ? 'Thanh toán 100%' : 'Đã cọc VietQR',
        });

        await supabase.from('email_logs').insert({
          booking_id: booking.id,
          recipient: booking.guest_email,
          template_type: 'resend_confirmation',
          send_status: emailResult.success ? 'sent' : 'failed',
          provider_message_id: emailResult.messageId || null,
          error_message: emailResult.error || null,
          sent_at: emailResult.success ? new Date().toISOString() : null,
        });

        return res.status(200).json({
          success: emailResult.success,
          message: emailResult.success ? 'Đã gửi lại email xác nhận thành công' : 'Gửi email thất bại',
          error: emailResult.error,
        });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    // 2. RESYNC GOOGLE SHEET
    if (action === 'resync-sheet' || req.path.endsWith('/resync-sheet')) {
      const { bookingId } = req.body;
      if (!bookingId) {
        return res.status(400).json({ success: false, error: 'Thiếu bookingId' });
      }

      if (!isSupabaseConfigured()) {
        return res.status(200).json({ success: true, message: 'Đồng bộ Google Sheets giả lập thành công (Demo Mode)' });
      }

      try {
        const supabase = getSupabaseServerClient();
        const { data: booking, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', bookingId)
          .single();

        if (error || !booking) {
          return res.status(404).json({ success: false, error: 'Không tìm thấy đơn đặt phòng' });
        }

        const sheetResult = await syncBookingToGoogleSheet({
          bookingId: booking.id,
          temporaryOrderCode: booking.temporary_order_code,
          confirmationCode: booking.confirmation_code || '',
          guestName: booking.guest_name,
          phone: booking.guest_phone,
          email: booking.guest_email || '',
          checkIn: booking.check_in_date,
          checkOut: booking.check_out_date,
          nights: booking.number_of_nights,
          roomTypeName: booking.room_type_name || '',
          totalPrice: Number(booking.total_amount),
          depositAmount: Number(booking.required_payment_amount),
          remainingAmount: Number(booking.remaining_amount),
          status: booking.status,
          source: booking.source || 'direct',
          createdAt: booking.created_at,
        });

        await supabase.from('sheet_sync_logs').insert({
          booking_id: booking.id,
          sync_type: 'manual_resync',
          sync_status: sheetResult.success ? 'synced' : 'failed',
          sheet_row_reference: sheetResult.rowRef || null,
          error_message: sheetResult.error || null,
          synced_at: sheetResult.success ? new Date().toISOString() : null,
        });

        return res.status(200).json({
          success: sheetResult.success,
          message: sheetResult.success ? 'Đã đồng bộ đơn lên Google Sheets thành công' : 'Đồng bộ Google Sheets thất bại',
          error: sheetResult.error,
        });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    // 3. BLOCK / UNBLOCK ROOM
    if (action === 'block-room') {
      const { roomId, startDate, endDate, reason } = req.body;
      if (!roomId || !startDate || !endDate) {
        return res.status(400).json({ success: false, error: 'Thiếu thông tin phòng hoặc ngày chặn' });
      }

      if (!isSupabaseConfigured()) {
        return res.status(200).json({ success: true, message: 'Chặn phòng thành công (Demo Mode)' });
      }

      try {
        const supabase = getSupabaseServerClient();
        const { data, error } = await supabase.from('room_blocks').insert({
          room_id: roomId,
          start_date: startDate,
          end_date: endDate,
          reason: reason || 'Bảo trì phòng',
          created_by: 'admin',
        });

        if (error) throw error;

        return res.status(200).json({ success: true, message: 'Đã tạo lịch chặn phòng thành công' });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
