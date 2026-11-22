import https from 'https';
import crypto from 'crypto';

export interface SheetBookingData {
  bookingId: string;
  temporaryOrderCode: string;
  confirmationCode?: string;
  guestName: string;
  phone: string;
  email: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomTypeName: string;
  roomNumber?: string;
  totalPrice: number;
  depositAmount: number;
  remainingAmount: number;
  status: string;
  source: string;
  createdAt: string;
  confirmedAt?: string;
}

/**
 * Creates a JWT token for Google Service Account authentication
 */
function createGoogleServiceAccountJwt(clientEmail: string, privateKeyPem: string): string | null {
  try {
    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const claimSet = {
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    const b64Claim = Buffer.from(JSON.stringify(claimSet)).toString('base64url');
    const signatureInput = `${b64Header}.${b64Claim}`;

    const formattedKey = privateKeyPem.replace(/\\n/g, '\n');
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signatureInput);
    const signature = signer.sign(formattedKey, 'base64url');

    return `${signatureInput}.${signature}`;
  } catch (err) {
    console.error('[Google Sheets Adapter] Error creating JWT:', err);
    return null;
  }
}

/**
 * Gets Access Token for Google Sheets API
 */
async function getGoogleSheetsAccessToken(): Promise<string | null> {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    return null;
  }

  const jwt = createGoogleServiceAccountJwt(clientEmail, privateKey);
  if (!jwt) return null;

  const postData = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
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
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
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
 * Appends or updates booking row in Google Sheets
 */
export async function syncBookingToGoogleSheet(data: SheetBookingData): Promise<{ success: boolean; rowRef?: string; error?: string }> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const accessToken = await getGoogleSheetsAccessToken();

  if (!sheetId || !accessToken) {
    console.warn('[Google Sheets Adapter] Sheet ID or Service Account token missing. Sync skipped.');
    return {
      success: false,
      error: 'GOOGLE_SHEET_ID or Service Account credentials not configured.',
    };
  }

  const rowValues = [
    data.bookingId,
    data.temporaryOrderCode,
    data.confirmationCode || '',
    data.guestName,
    data.phone,
    data.email || '',
    data.checkIn,
    data.checkOut,
    data.nights,
    data.roomTypeName,
    data.roomNumber || '',
    data.totalPrice,
    data.depositAmount,
    data.remainingAmount,
    data.status,
    data.source,
    data.createdAt,
    data.confirmedAt || new Date().toISOString(),
  ];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/BOOKINGS!A:R:append?valueInputOption=USER_ENTERED`;
  const postData = JSON.stringify({
    values: [rowValues],
  });

  return new Promise((resolve) => {
    const req = https.request(
      url,
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
            if (parsed.updates?.updatedRange) {
              resolve({ success: true, rowRef: parsed.updates.updatedRange });
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
