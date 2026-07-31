import type { Request, Response } from 'express';
import {
  verifySePaySignature,
  extractBookingCode,
  generateConfirmationCode,
  SePayWebhookPayload,
} from './lib/sepayAdapter';
import { getSupabaseServerClient, isSupabaseConfigured } from './lib/supabaseServer';
import { sendBookingConfirmationEmail } from './lib/gmailAdapter';
import { syncBookingToGoogleSheet } from './lib/googleSheetsAdapter';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Verify Authorization Header Signature
  const authHeader = req.headers.authorization || (req.headers['x-sepay-signature'] as string);
  if (!verifySePaySignature(authHeader)) {
    console.error('[SePay Webhook] Unauthorized signature/token');
    return res.status(401).json({ success: false, error: 'Xác thực chữ ký Webhook thất bại' });
  }

  const payload: SePayWebhookPayload = req.body;
  if (!payload || !payload.content) {
    return res.status(400).json({ success: false, error: 'Nội dung Webhook không hợp lệ' });
  }

  // Only process incoming transfers ('in')
  if (payload.transferType && payload.transferType.toLowerCase() === 'out') {
    return res.status(200).json({ success: true, message: 'Bỏ qua giao dịch tiền ra (transferType: out)' });
  }

  const transactionId = String(payload.id || payload.referenceCode || payload.referenceNum || `TX-${Date.now()}`);
  const transferContent = payload.content;
  const transferAmount = Number(payload.transferAmount) || 0;

  console.log(`[SePay Webhook Received] Ref: ${transactionId} | Amount: ${transferAmount} | Content: "${transferContent}"`);

  if (!isSupabaseConfigured()) {
    return res.status(200).json({
      success: true,
      message: 'Demo mode active. Webhook logged.',
      parsedCode: extractBookingCode(transferContent),
    });
  }

  const supabase = getSupabaseServerClient();

  // 2. Idempotency Check via webhook_events table
  const { data: existingEvent } = await supabase
    .from('webhook_events')
    .select('id, processing_status')
    .eq('event_key', transactionId)
    .single();

  if (existingEvent) {
    console.log(`[SePay Webhook] Event key ${transactionId} already processed. Returning idempotency success.`);
    return res.status(200).json({
      success: true,
      message: 'Giao dịch này đã được xử lý trước đó (Idempotent OK)',
    });
  }

  // 3. Extract Booking Code from transfer content
  const bookingCode = extractBookingCode(transferContent);
  if (!bookingCode) {
    // Log unmatched webhook event
    await supabase.from('webhook_events').insert({
      event_key: transactionId,
      provider: 'sepay',
      signature: authHeader || '',
      payload,
      processing_status: 'ignored',
      error_message: 'Không tìm thấy mã đơn đặt phòng trong nội dung chuyển khoản',
    });

    return res.status(200).json({
      success: true,
      message: 'Nội dung chuyển khoản không chứa mã đặt phòng hợp lệ',
    });
  }

  // 4. Find matching booking by temporary_order_code or confirmation_code
  const { data: booking, error: bError } = await supabase
    .from('bookings')
    .select('*')
    .or(`temporary_order_code.eq.${bookingCode.toUpperCase()},confirmation_code.eq.${bookingCode.toUpperCase()}`)
    .single();

  if (bError || !booking) {
    await supabase.from('webhook_events').insert({
      event_key: transactionId,
      provider: 'sepay',
      signature: authHeader || '',
      payload,
      processing_status: 'failed',
      error_message: `Mã đơn đặt phòng ${bookingCode} không tồn tại trong hệ thống`,
    });

    return res.status(200).json({
      success: true,
      message: `Đã nhận webhook nhưng không tìm thấy đơn ${bookingCode}`,
    });
  }

  // Check if booking is already confirmed
  const isAlreadyPaid = booking.status === 'deposit_paid' || booking.status === 'confirmed';
  const confirmationCode = booking.confirmation_code || generateConfirmationCode();

  // 5. Insert Payment Record (Unique constraint on provider_transaction_id)
  const { error: payErr } = await supabase.from('payments').insert({
    booking_id: booking.id,
    provider: 'sepay_vietqr',
    provider_transaction_id: transactionId,
    transfer_content: transferContent,
    amount: transferAmount,
    payment_status: 'completed',
    raw_payload: payload,
  });

  if (payErr && !payErr.message.includes('duplicate key')) {
    console.error('[SePay Payment Insert Error]:', payErr);
  }

  // 6. Update Booking Status
  const requiredAmount = Number(booking.required_payment_amount) || Number(booking.total_amount) * 0.5;
  const newStatus = transferAmount >= Number(booking.total_amount) ? 'confirmed' : 'deposit_paid';
  const updatedRemaining = Math.max(0, Number(booking.remaining_amount) - transferAmount);

  const { error: updateErr } = await supabase
    .from('bookings')
    .update({
      status: newStatus,
      confirmation_code: confirmationCode,
      confirmed_at: booking.confirmed_at || new Date().toISOString(),
      remaining_amount: updatedRemaining,
      updated_at: new Date().toISOString(),
    })
    .eq('id', booking.id);

  if (updateErr) {
    console.error('[SePay Booking Update Error]:', updateErr);
  }

  // Record webhook success event
  await supabase.from('webhook_events').insert({
    event_key: transactionId,
    provider: 'sepay',
    signature: authHeader || '',
    payload,
    processing_status: 'processed',
  });

  // 7. Trigger Gmail API Confirmation Email Asynchronously
  if (booking.guest_email && !isAlreadyPaid) {
    sendBookingConfirmationEmail({
      to: booking.guest_email,
      guestName: booking.guest_name,
      bookingCode: booking.temporary_order_code,
      confirmationCode,
      roomTypeName: booking.room_type_name || 'Bungalow Vòm Cliffside',
      checkIn: booking.check_in_date,
      checkOut: booking.check_out_date,
      nights: booking.number_of_nights,
      totalPrice: Number(booking.total_amount),
      depositAmount: transferAmount,
      remainingAmount: updatedRemaining,
      paymentStatus: newStatus === 'confirmed' ? 'Thanh toán 100%' : 'Đã cọc VietQR',
    })
      .then(async (resEmail) => {
        await supabase.from('email_logs').insert({
          booking_id: booking.id,
          recipient: booking.guest_email,
          template_type: 'confirmation',
          send_status: resEmail.success ? 'sent' : 'failed',
          provider_message_id: resEmail.messageId || null,
          error_message: resEmail.error || null,
          sent_at: resEmail.success ? new Date().toISOString() : null,
        });
      })
      .catch((err) => console.error('[Async Email Error]:', err));
  }

  // 8. Trigger Google Sheets Backup Sync Asynchronously
  syncBookingToGoogleSheet({
    bookingId: booking.id,
    temporaryOrderCode: booking.temporary_order_code,
    confirmationCode,
    guestName: booking.guest_name,
    phone: booking.guest_phone,
    email: booking.guest_email || '',
    checkIn: booking.check_in_date,
    checkOut: booking.check_out_date,
    nights: booking.number_of_nights,
    roomTypeName: booking.room_type_name || '',
    totalPrice: Number(booking.total_amount),
    depositAmount: transferAmount,
    remainingAmount: updatedRemaining,
    status: newStatus,
    source: booking.source || 'direct',
    createdAt: booking.created_at,
  })
    .then(async (resSheet) => {
      await supabase.from('sheet_sync_logs').insert({
        booking_id: booking.id,
        sync_type: 'payment_received',
        sync_status: resSheet.success ? 'synced' : 'failed',
        sheet_row_reference: resSheet.rowRef || null,
        error_message: resSheet.error || null,
        synced_at: resSheet.success ? new Date().toISOString() : null,
      });
    })
    .catch((err) => console.error('[Async Sheet Error]:', err));

  return res.status(200).json({
    success: true,
    message: 'Thanh toán SePay đã được xác nhận và cập nhật đơn đặt phòng thành công',
    confirmationCode,
    bookingId: booking.id,
  });
}
