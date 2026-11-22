import crypto from 'crypto';

export type UserRole = 'owner' | 'reception' | 'accountant' | 'housekeeping' | 'coffee_staff';

export interface AdminSession {
  userId: string;
  username: string;
  name: string;
  role: UserRole;
  issuedAt: number;
  expiresAt: number;
}

export interface AuthVerificationResult {
  valid: boolean;
  session?: AdminSession;
  error?: string;
}

// In production, configure ADMIN_SESSION_SECRET in environment. Fallback to a stable runtime salt in dev.
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'sgl-seagull-lyson-sec-hmac-salt-2026-auth';
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours session

// Scrypt KDF parameters (OWASP-safe memory-hard password hashing, zero external deps)
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

/**
 * Hashes a plaintext password using salted scrypt.
 * Format: scrypt$<N>$<r>$<p>$<saltHex>$<derivedKeyHex>
 */
export function hashPassword(plainPassword: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(plainPassword, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash using timing-safe comparison.
 */
export function verifyPassword(plainPassword: string, storedHash?: string | null): boolean {
  if (!plainPassword || !storedHash) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4];
  const expectedHex = parts[5];

  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || !salt || !expectedHex) {
    return false;
  }

  try {
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    const derivedBuf = crypto.scryptSync(plainPassword, salt, expectedBuf.length, { N: n, r, p });
    if (derivedBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derivedBuf, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Normalizes role aliases into canonical RLS roles.
 */
export function normalizeUserRole(raw?: string | null): UserRole | null {
  if (!raw) return null;
  const clean = raw.trim().toLowerCase();
  if (clean === 'owner' || clean === 'admin') return 'owner';
  if (clean === 'reception' || clean === 'receptionist') return 'reception';
  if (clean === 'accountant' || clean === 'manager') return 'accountant';
  if (clean === 'housekeeping') return 'housekeeping';
  if (clean === 'coffee_staff' || clean === 'coffee') return 'coffee_staff';
  return null;
}

/**
 * Normalizes and validates a staff username (3-50 chars, lowercase letters, digits, dot, underscore, dash).
 */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{2,49}$/.test(username);
}

/**
 * Timing-safe string equality helper for signatures.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Creates a full HMAC-SHA256 hex signature for v3 token payloads
 */
function createSignatureV3(payload: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
}

/**
 * Legacy v2 truncated HMAC signature (kept read-only for in-flight token compatibility)
 */
function createSignatureV2(payload: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex').substring(0, 32);
}

/**
 * Generates a cryptographically signed v3 session token preserving individual user identity
 */
export function generateSignedSessionToken(user: { id: string; username: string; name: string; role: UserRole }): {
  token: string;
  session: AdminSession;
} {
  const now = Date.now();
  const expiresAt = now + TOKEN_TTL_MS;
  const payloadObj = {
    uid: user.id,
    u: user.username,
    n: user.name,
    r: user.role,
    iat: now,
    exp: expiresAt,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = createSignatureV3(encodedPayload);
  const token = `sgl_v3_${encodedPayload}_${sig}`;

  const session: AdminSession = {
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    issuedAt: now,
    expiresAt,
  };

  return { token, session };
}

/**
 * Verifies and decodes a signed session token (supports v3 JSON tokens and valid v2 tokens).
 * Prevents tampering, role privilege escalation, and expired sessions.
 */
export function verifySignedSessionToken(rawToken?: string): AuthVerificationResult {
  if (!rawToken) {
    return { valid: false, error: 'Thiếu token xác thực quản trị (Authorization header)' };
  }

  const cleanToken = rawToken.replace(/^Bearer\s+/i, '').trim();

  // Reject all legacy hardcoded or insecure token formats immediately
  if (
    cleanToken === 'sgl-secret-admin-token-2026' ||
    cleanToken.startsWith('sgl-owner-session-') ||
    cleanToken.startsWith('sgl-reception-session-') ||
    cleanToken.startsWith('sgl-housekeeping-session-') ||
    cleanToken.startsWith('sgl_v2_demo_')
  ) {
    return {
      valid: false,
      error: 'Token định dạng cũ không hợp lệ hoặc không có chữ ký số. Vui lòng đăng nhập lại bằng tài khoản nhân sự.',
    };
  }

  // Handle v3 tokens (per-staff identity preserved)
  if (cleanToken.startsWith('sgl_v3_')) {
    const body = cleanToken.slice('sgl_v3_'.length);
    const sepIdx = body.lastIndexOf('_');
    if (sepIdx <= 0) {
      return { valid: false, error: 'Cấu trúc token không đầy đủ' };
    }

    const encodedPayload = body.slice(0, sepIdx);
    const signature = body.slice(sepIdx + 1);
    const expectedSig = createSignatureV3(encodedPayload);

    if (!timingSafeStringEqual(signature, expectedSig)) {
      return { valid: false, error: 'Chữ ký token giả mạo hoặc đã bị chỉnh sửa trái phép (Tampering Detected)' };
    }

    let parsed: { uid?: string; u?: string; n?: string; r?: string; iat?: number; exp?: number };
    try {
      parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    } catch {
      return { valid: false, error: 'Mã hóa token không hợp lệ' };
    }

    const role = normalizeUserRole(parsed.r);
    if (!parsed.uid || !parsed.u || !role || !parsed.exp) {
      return { valid: false, error: 'Dữ liệu phiên đăng nhập không đầy đủ' };
    }

    if (Date.now() > Number(parsed.exp)) {
      return { valid: false, error: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.' };
    }

    return {
      valid: true,
      session: {
        userId: parsed.uid,
        username: parsed.u,
        name: parsed.n || parsed.u,
        role,
        issuedAt: Number(parsed.iat || 0),
        expiresAt: Number(parsed.exp),
      },
    };
  }

  // Handle in-flight signed v2 tokens safely
  if (cleanToken.startsWith('sgl_v2_')) {
    const parts = cleanToken.split('_');
    if (parts.length < 4) {
      return { valid: false, error: 'Cấu trúc token không đầy đủ' };
    }

    const base64Payload = parts[2];
    const signature = parts[3];

    let rawPayload: string;
    try {
      rawPayload = Buffer.from(base64Payload, 'base64url').toString('utf8');
    } catch {
      return { valid: false, error: 'Mã hóa token không hợp lệ' };
    }

    const expectedSig = createSignatureV2(rawPayload);
    if (!timingSafeStringEqual(signature, expectedSig)) {
      return { valid: false, error: 'Chữ ký token giả mạo hoặc đã bị chỉnh sửa trái phép (Tampering Detected)' };
    }

    const [userId, roleRaw, username, issuedAtStr, expiresAtStr] = rawPayload.split(':');
    const role = normalizeUserRole(roleRaw);
    const expiresAt = Number(expiresAtStr);
    const issuedAt = Number(issuedAtStr);

    if (!userId || !role || !username || !Number.isFinite(expiresAt)) {
      return { valid: false, error: 'Nội dung token không hợp lệ' };
    }

    if (Date.now() > expiresAt) {
      return { valid: false, error: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.' };
    }

    return {
      valid: true,
      session: {
        userId,
        username,
        name: getRoleDisplayName(role, username),
        role,
        issuedAt,
        expiresAt,
      },
    };
  }

  return { valid: false, error: 'Định dạng token không hợp lệ' };
}

export function getRoleDisplayName(role: UserRole, username: string): string {
  switch (role) {
    case 'owner':
      return 'Chủ cơ sở (Owner)';
    case 'reception':
      return 'Lễ Tân (Reception)';
    case 'accountant':
      return 'Kế Toán (Accountant)';
    case 'housekeeping':
      return 'Tổ Buồng Phòng (Housekeeping)';
    case 'coffee_staff':
      return 'Quầy Cà Phê (Coffee POS)';
    default:
      return username;
  }
}

/**
 * Checks if a user role has permission to execute an action
 */
export function checkRolePermission(
  role: UserRole,
  action: 
    | 'read_bookings' 
    | 'read_financials' 
    | 'mutate_pricing' 
    | 'mutate_bank_config' 
    | 'cancel_booking' 
    | 'block_room' 
    | 'manage_staff'
    | 'read_stay_records'
    | 'manage_stay_records'
    | 'read_guest_identity'
): { allowed: boolean; reason?: string } {
  // Owner has omni-access
  if (role === 'owner') {
    return { allowed: true };
  }

  // Coffee Staff / POS: Strictly isolated, 0 access to stay records or room management
  if (role === 'coffee_staff') {
    return {
      allowed: false,
      reason: 'Từ chối truy cập: Tài khoản quầy cà phê (Coffee POS) bị cô lập hoàn toàn, không có quyền xem hoặc sửa hồ sơ lưu trú homestay.',
    };
  }

  // Accountant permissions: Financials & bookings only. Strictly NO access to stay guest identity
  if (role === 'accountant') {
    if (action === 'read_stay_records' || action === 'manage_stay_records' || action === 'read_guest_identity') {
      return {
        allowed: false,
        reason: 'Từ chối truy cập: Kế toán chỉ có quyền xem dữ liệu tài chính thu chi, tuyệt đối không được truy cập danh sách giấy tờ và hồ sơ lưu trú của khách.',
      };
    }
    if (action === 'read_financials' || action === 'read_bookings') {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Kế toán chỉ có quyền xem dữ liệu tài chính và danh sách đơn, không có quyền can thiệp giá hoặc phòng.',
    };
  }

  // Reception permissions: Can read/manage stay records & bookings; cannot view financials or mutate bank/pricing
  if (role === 'reception') {
    if (action === 'read_bookings' || action === 'block_room' || action === 'read_stay_records' || action === 'manage_stay_records' || action === 'read_guest_identity') {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Lễ tân không có quyền truy cập Báo cáo Doanh thu chi tiết, Sửa bảng giá hoặc Thay đổi cấu hình ngân hàng. Yêu cầu quyền Chủ cơ sở.',
    };
  }

  // Housekeeping permissions: Room status only
  if (role === 'housekeeping') {
    if (action === 'read_bookings') {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Tổ buồng phòng chỉ được xem lịch xếp phòng để dọn dẹp vệ sinh.',
    };
  }

  return { allowed: false, reason: 'Vai trò người dùng không hợp lệ' };
}

/**
 * Masks sensitive customer phone numbers for non-owner or restricted roles
 * e.g., "0981065065" -> "098***5065"
 * e.g., "+84981065065" -> "+8498***065"
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return '—';
  const clean = phone.trim();
  if (clean.length <= 4) return '***';
  if (clean.length <= 7) return clean.slice(0, 2) + '***' + clean.slice(-1);
  return clean.slice(0, 3) + '***' + clean.slice(-3);
}

/**
 * Masks sensitive customer email addresses
 * e.g., "khachhang@gmail.com" -> "k***g@gmail.com"
 */
export function maskEmail(email?: string | null): string {
  if (!email) return '—';
  const clean = email.trim();
  const atIdx = clean.indexOf('@');
  if (atIdx <= 1) return '***@' + (clean.split('@')[1] || 'domain.com');
  const userPart = clean.substring(0, atIdx);
  const domainPart = clean.substring(atIdx);
  return userPart[0] + '***' + userPart[userPart.length - 1] + domainPart;
}
