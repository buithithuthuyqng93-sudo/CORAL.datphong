import https from 'https';

export interface EmailData {
  to: string;
  guestName: string;
  bookingCode: string;
  confirmationCode?: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalPrice: number;
  depositAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  hotline?: string;
}

/**
 * Exchanges Gmail OAuth Refresh Token for a fresh Access Token
 */
async function getGmailAccessToken(): Promise<string | null> {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const postData = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }).toString();

  return new Promise((resolve) => {
    const req = https.request(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.access_token || null);
          } catch {
            resolve(null);
          }
        });
      }
    );

    req.on('error', () => resolve(null));
    req.write(postData);
    req.end();
  });
}

/**
 * Encodes RFC 2822 raw message in base64url format for Gmail API
 */
function createRawEmailMessage(
  senderEmail: string,
  toEmail: string,
  subject: string,
  htmlBody: string
): string {
  const str = [
    `From: Homestay & Cà Phê Seagull Lý Sơn <${senderEmail}>`,
    `To: ${toEmail}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
  ].join('\r\n');

  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sends Email Confirmation via Gmail REST API
 */
export async function sendBookingConfirmationEmail(data: EmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const senderEmail = process.env.GMAIL_SENDER_EMAIL || 'seagull.homestay.lyson@gmail.com';
  const accessToken = await getGmailAccessToken();

  if (!accessToken) {
    console.warn('[Gmail Adapter] Gmail API credentials missing or invalid. Email logged locally.');
    return {
      success: false,
      error: 'GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, or GMAIL_REFRESH_TOKEN not configured.',
    };
  }

  const subject = `[XÁC NHẬN ĐẶT PHÒNG] Homestay & Cà Phê Seagull Lý Sơn - Mã: ${data.confirmationCode || data.bookingCode}`;
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; background-color: #151B17; color: #FAF8F5; padding: 24px; border-radius: 12px; max-width: 600px; margin: 0 auto;">
      <div style="text-align: center; border-bottom: 1px solid #2C3831; padding-bottom: 16px; margin-bottom: 20px;">
        <h1 style="color: #C8A261; margin: 0; font-size: 24px;">HOMESTAY & CÀ PHÊ SEAGULL LÝ SƠN</h1>
        <p style="color: #A39687; font-size: 12px; margin-top: 4px; text-transform: uppercase;">Cliffside Seagull Bungalow Vòm & Coffee - Lý Sơn, Quảng Ngãi</p>
      </div>

      <p style="font-size: 16px;">Kính gửi <strong>${data.guestName}</strong>,</p>
      <p style="color: #D5CBBF;">Cảm ơn Quý khách đã tin tưởng chọn <strong>Homestay & Cà Phê Seagull Lý Sơn</strong> cho kỳ nghỉ của mình. Chúng tôi xin xác nhận đơn đặt phòng của Quý khách như sau:</p>

      <div style="background-color: #1A221D; border: 1px solid #C8A261; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 6px 0; color: #C8A261;"><strong>Mã Đặt Phòng:</strong> <span style="font-size: 18px; color: #FFFFFF;">${data.confirmationCode || data.bookingCode}</span></p>
        <p style="margin: 6px 0;"><strong>Hạng phòng:</strong> ${data.roomTypeName}</p>
        <p style="margin: 6px 0;"><strong>Ngày Nhận Phòng (Check-in):</strong> ${data.checkIn} (sau 14:00)</p>
        <p style="margin: 6px 0;"><strong>Ngày Trả Phòng (Check-out):</strong> ${data.checkOut} (trước 12:00)</p>
        <p style="margin: 6px 0;"><strong>Số đêm lưu trú:</strong> ${data.nights} đêm</p>
        <hr style="border-color: #2C3831; margin: 12px 0;" />
        <p style="margin: 6px 0;"><strong>Tổng giá trị đơn:</strong> ${data.totalPrice.toLocaleString('vi-VN')} VNĐ</p>
        <p style="margin: 6px 0; color: #4ADE80;"><strong>Đã thanh toán (Cọc VietQR):</strong> ${data.depositAmount.toLocaleString('vi-VN')} VNĐ</p>
        <p style="margin: 6px 0; color: #F87171;"><strong>Còn lại cần thanh toán tại nhận phòng:</strong> ${data.remainingAmount.toLocaleString('vi-VN')} VNĐ</p>
      </div>

      <div style="margin-top: 24px; font-size: 13px; color: #A39687;">
        <p><strong>Lưu ý nhận phòng:</strong></p>
        <ul>
          <li>Vui lòng mang theo CCCD/Hộ chiếu để làm thủ tục nhận phòng.</li>
          <li>Hotline / Zalo hỗ trợ đặt phòng & đón cảng An Vĩnh: <strong>${data.hotline || '0868011799 - 0981065065 (Mr Thiện/ Ms Điền)'}</strong></li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 30px; border-top: 1px solid #2C3831; padding-top: 16px; font-size: 12px; color: #A39687;">
        <p>Homestay & Cà Phê Seagull Lý Sơn • Đặc khu Lý Sơn, Quảng Ngãi</p>
      </div>
    </div>
  `;

  const rawMessage = createRawEmailMessage(senderEmail, data.to, subject, htmlContent);

  return new Promise((resolve) => {
    const postData = JSON.stringify({ raw: rawMessage });
    const req = https.request(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (parsed.id) {
              resolve({ success: true, messageId: parsed.id });
            } else {
              resolve({ success: false, error: body });
            }
          } catch (err: any) {
            resolve({ success: false, error: err.message });
          }
        });
      }
    );

    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.write(postData);
    req.end();
  });
}
