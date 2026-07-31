import crypto from 'crypto';

export interface SePayWebhookPayload {
  id: number | string;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  content: string;
  transferType: 'in' | 'out';
  transferAmount: number;
  accumulated?: number;
  referenceCode?: string;
  referenceNum?: string;
  description?: string;
}

export function verifySePaySignature(authHeader?: string, rawSecret?: string): boolean {
  const secret = rawSecret || process.env.SEPAY_WEBHOOK_SECRET;
  // If no secret configured in env, allow test/webhook processing with warning
  if (!secret) {
    console.warn('[SePay Adapter] SEPAY_WEBHOOK_SECRET is not configured in env. Skipping signature check.');
    return true;
  }

  if (!authHeader) {
    return false;
  }

  // Check simple API Key / Bearer token or Apikey prefix
  const token = authHeader.replace(/^(Apikey|Bearer)\s+/i, '').trim();
  return token === secret;
}

/**
 * Extracts order code from bank transfer content string.
 * Supports format: CRL-260731-A8K4 or CRL260731A8K4 or CRL-8921
 */
export function extractBookingCode(content: string): string | null {
  if (!content) return null;
  const uppercaseContent = content.toUpperCase();

  // Pattern 1: CRL-YYMMDD-XXXX (e.g. CRL-260731-A8K4)
  const matchFull = uppercaseContent.match(/CRL-\d{6}-[A-Z0-9]{4}/);
  if (matchFull) return matchFull[0];

  // Pattern 2: CRL260731A8K4
  const matchCompact = uppercaseContent.match(/CRL\d{6}[A-Z0-9]{4}/);
  if (matchCompact) {
    const raw = matchCompact[0];
    return `${raw.substring(0, 3)}-${raw.substring(3, 9)}-${raw.substring(9)}`;
  }

  // Pattern 3: CRL-1234
  const matchSimple = uppercaseContent.match(/CRL-\d{4,6}/);
  if (matchSimple) return matchSimple[0];

  return null;
}

/**
 * Generates unique Confirmation Code after deposit is verified
 * Format: CFM-CORAL-XXXX (e.g. CFM-CORAL-8921)
 */
export function generateConfirmationCode(): string {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `CFM-CORAL-${randomSuffix}`;
}
