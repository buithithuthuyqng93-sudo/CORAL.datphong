import crypto from 'crypto';
import { getSupabaseServerClient, isSupabaseConfigured } from './supabaseServer.js';
import {
  AdminSession,
  UserRole,
  hashPassword,
  verifyPassword,
  normalizeUserRole,
  normalizeUsername,
  isValidUsername,
} from './authService.js';

export interface StaffAccountPublic {
  id: string;
  username: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface AuditLogRecord {
  id: string;
  actorId: string;
  actorType: string;
  action: string;
  entityType: string;
  entityId: string | null;
  previousData: Record<string, any> | null;
  newData: Record<string, any> | null;
  createdAt: string;
}

interface DemoStaffRecord extends StaffAccountPublic {
  passwordHash: string;
}

const LEGACY_BLOCKED_PINS = new Set(['8888', '1234', '5678', '0868011799', '0981065065']);

// In-memory store strictly used ONLY when Supabase is NOT configured (local Demo mode)
let demoStaffStore: DemoStaffRecord[] | null = null;
const demoAuditStore: AuditLogRecord[] = [];

function getDemoStaffStore(): DemoStaffRecord[] {
  if (!demoStaffStore) {
    const now = new Date().toISOString();
    const ownerPass = process.env.ADMIN_OWNER_PASS?.trim() || 'SeagullOwner@2026';
    const receptionPass = process.env.ADMIN_RECEPTION_PASS?.trim() || 'SeagullReception@2026';
    const accountantPass = process.env.ADMIN_ACCOUNTANT_PASS?.trim() || 'SeagullAccountant@2026';

    demoStaffStore = [
      {
        id: 'demo-usr-owner-01',
        username: 'owner',
        email: 'owner@seagull.lyson',
        fullName: 'Mr. Thiện / Ms. Điền',
        phone: '0868011799',
        role: 'owner',
        passwordHash: hashPassword(ownerPass),
        isActive: true,
        lastLoginAt: null,
        createdAt: now,
        createdBy: 'system_demo',
      },
      {
        id: 'demo-usr-reception-01',
        username: 'letan.thuy',
        email: 'letan.thuy@seagull.lyson',
        fullName: 'Lễ Tân Thủy',
        phone: '0981065065',
        role: 'reception',
        passwordHash: hashPassword(receptionPass),
        isActive: true,
        lastLoginAt: null,
        createdAt: now,
        createdBy: 'owner',
      },
      {
        id: 'demo-usr-accountant-01',
        username: 'ketoan.lan',
        email: 'ketoan.lan@seagull.lyson',
        fullName: 'Kế Toán Lan',
        phone: '0905123456',
        role: 'accountant',
        passwordHash: hashPassword(accountantPass),
        isActive: true,
        lastLoginAt: null,
        createdAt: now,
        createdBy: 'owner',
      },
    ];
  }
  return demoStaffStore;
}

function mapDbRowToPublic(row: any): StaffAccountPublic {
  const normalizedRole = normalizeUserRole(row.role) || 'reception';
  const fallbackUsername = row.username || (typeof row.email === 'string' ? row.email.split('@')[0] : 'staff');
  return {
    id: row.id,
    username: fallbackUsername,
    email: row.email || '',
    fullName: row.full_name || fallbackUsername,
    phone: row.phone || '',
    role: normalizedRole,
    isActive: row.is_active !== false,
    lastLoginAt: row.last_login_at || null,
    createdAt: row.created_at || new Date().toISOString(),
    createdBy: row.created_by || null,
  };
}

function isMissingStaffColumnError(error: any): boolean {
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    msg.includes('password_hash') ||
    msg.includes('username') ||
    msg.includes('last_login_at')
  );
}

/**
 * Records an immutable audit trail entry attributed to a specific staff member.
 */
export async function recordAuditEvent(
  actor: {
    userId?: string;
    username?: string;
    name?: string;
    role?: string;
  },
  event: {
    action: string;
    entityType: string;
    entityId?: string | null;
    previousData?: Record<string, any> | null;
    newData?: Record<string, any> | null;
  }
): Promise<void> {
  const actorLabel = actor.username || actor.userId || 'anonymous';
  const enrichedNewData = {
    ...(event.newData || {}),
    actorUserId: actor.userId || null,
    actorUsername: actor.username || null,
    actorName: actor.name || null,
    actorRole: actor.role || null,
  };

  if (!isSupabaseConfigured()) {
    demoAuditStore.unshift({
      id: `audit-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      actorId: actorLabel,
      actorType: actor.role || 'user',
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId || null,
      previousData: event.previousData || null,
      newData: enrichedNewData,
      createdAt: new Date().toISOString(),
    });
    if (demoAuditStore.length > 100) demoAuditStore.length = 100;
    return;
  }

  try {
    const supabase = getSupabaseServerClient();
    await supabase.from('audit_logs').insert({
      actor_id: actorLabel,
      actor_type: actor.role || 'user',
      action: event.action,
      entity_type: event.entityType,
      entity_id: event.entityId || null,
      previous_data: event.previousData || null,
      new_data: enrichedNewData,
    });
  } catch (err) {
    console.error('[Audit Log Insert Error]:', err);
  }
}

/**
 * Authenticates an individual staff member by username or email + personal password.
 * Automatically bootstraps the very first Owner account into public.user_roles if none exists yet.
 */
export async function authenticateStaffAccount(
  rawIdentifier: string,
  rawPassword: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<
  | { ok: true; user: StaffAccountPublic; bootstrapped?: boolean }
  | { ok: false; status: number; errorCode?: string; error: string }
> {
  const identifier = normalizeUsername(rawIdentifier || '');
  const password = (rawPassword || '').trim();

  if (LEGACY_BLOCKED_PINS.has(password) || LEGACY_BLOCKED_PINS.has(identifier)) {
    return {
      ok: false,
      status: 401,
      errorCode: 'LEGACY_PIN_DEPRECATED',
      error: 'Mã PIN cũ (8888, 1234, 5678) đã bị vô hiệu hóa. Vui lòng đăng nhập bằng tài khoản cá nhân.',
    };
  }

  if (!identifier || !password) {
    return {
      ok: false,
      status: 400,
      error: 'Vui lòng nhập đầy đủ Tên đăng nhập (hoặc Email) và Mật khẩu cá nhân.',
    };
  }

  // Demo mode (strictly when Supabase is NOT configured)
  if (!isSupabaseConfigured()) {
    const store = getDemoStaffStore();
    const matched = store.find(
      (u) => u.username.toLowerCase() === identifier || u.email.toLowerCase() === identifier
    );

    if (!matched || !verifyPassword(password, matched.passwordHash)) {
      await recordAuditEvent(
        { username: identifier, role: 'anonymous' },
        {
          action: 'ADMIN_LOGIN_FAILED',
          entityType: 'auth_session',
          newData: { reason: 'invalid_credentials', ip: meta?.ip || null },
        }
      );
      return {
        ok: false,
        status: 401,
        error: 'Sai tên đăng nhập hoặc mật khẩu.',
      };
    }

    if (!matched.isActive) {
      return {
        ok: false,
        status: 403,
        error: 'Tài khoản này đang bị tạm khóa. Vui lòng liên hệ Chủ cơ sở.',
      };
    }

    matched.lastLoginAt = new Date().toISOString();
    const { passwordHash: _ignored, ...publicUser } = matched;

    await recordAuditEvent(
      { userId: publicUser.id, username: publicUser.username, name: publicUser.fullName, role: publicUser.role },
      {
        action: 'ADMIN_LOGIN_SUCCESS',
        entityType: 'auth_session',
        entityId: publicUser.id,
        newData: { ip: meta?.ip || null, userAgent: meta?.userAgent || null },
      }
    );

    return { ok: true, user: publicUser };
  }

  // Production / Live Supabase path
  const supabase = getSupabaseServerClient();

  // Look up account by username or email (case-insensitive)
  const { data: candidates, error: lookupErr } = await supabase
    .from('user_roles')
    .select('id, username, email, full_name, phone, role, password_hash, is_active, last_login_at, created_at, created_by')
    .or(`username.ilike.${identifier},email.ilike.${identifier}`)
    .limit(5);

  if (lookupErr) {
    if (isMissingStaffColumnError(lookupErr)) {
      return {
        ok: false,
        status: 500,
        errorCode: 'SCHEMA_UPGRADE_REQUIRED',
        error:
          'Bảng public.user_roles chưa có cột username/password_hash. Vui lòng chạy đoạn SQL nâng cấp cột cho bảng user_roles trên Supabase SQL Editor.',
      };
    }
    console.error('[Staff Auth Lookup Error]:', lookupErr);
    return {
      ok: false,
      status: 500,
      error: `Lỗi truy vấn tài khoản nhân sự: ${lookupErr.message}`,
    };
  }

  const exactRow = (candidates || []).find(
    (row: any) =>
      String(row.username || '').trim().toLowerCase() === identifier ||
      String(row.email || '').trim().toLowerCase() === identifier
  );

  // If account exists in public.user_roles, verify strictly against its personal scrypt hash
  if (exactRow) {
    if (exactRow.is_active === false) {
      await recordAuditEvent(
        {
          userId: exactRow.id,
          username: exactRow.username || exactRow.email,
          name: exactRow.full_name,
          role: exactRow.role,
        },
        {
          action: 'ADMIN_LOGIN_FAILED',
          entityType: 'auth_session',
          entityId: exactRow.id,
          newData: { reason: 'account_inactive', ip: meta?.ip || null },
        }
      );
      return {
        ok: false,
        status: 403,
        error: 'Tài khoản này đã bị tạm khóa. Vui lòng liên hệ Chủ cơ sở để mở lại.',
      };
    }

    if (!verifyPassword(password, exactRow.password_hash)) {
      await recordAuditEvent(
        {
          userId: exactRow.id,
          username: exactRow.username || exactRow.email,
          name: exactRow.full_name,
          role: exactRow.role,
        },
        {
          action: 'ADMIN_LOGIN_FAILED',
          entityType: 'auth_session',
          entityId: exactRow.id,
          newData: { reason: 'wrong_password', ip: meta?.ip || null },
        }
      );
      return {
        ok: false,
        status: 401,
        error: 'Sai tên đăng nhập hoặc mật khẩu.',
      };
    }

    const nowIso = new Date().toISOString();
    await supabase
      .from('user_roles')
      .update({ last_login_at: nowIso })
      .eq('id', exactRow.id);

    const publicUser = mapDbRowToPublic({ ...exactRow, last_login_at: nowIso });

    await recordAuditEvent(
      {
        userId: publicUser.id,
        username: publicUser.username,
        name: publicUser.fullName,
        role: publicUser.role,
      },
      {
        action: 'ADMIN_LOGIN_SUCCESS',
        entityType: 'auth_session',
        entityId: publicUser.id,
        newData: { ip: meta?.ip || null, userAgent: meta?.userAgent || null },
      }
    );

    return { ok: true, user: publicUser };
  }

  // No matching row found -> Check if initial Owner bootstrap is allowed
  // Bootstrap ONLY runs when there is ZERO active owner account with a password_hash in public.user_roles
  const { data: existingOwners, error: ownerCheckErr } = await supabase
    .from('user_roles')
    .select('id')
    .in('role', ['owner', 'admin'])
    .eq('is_active', true)
    .not('password_hash', 'is', null)
    .limit(1);

  if (!ownerCheckErr && (!existingOwners || existingOwners.length === 0)) {
    const bootstrapUsername = normalizeUsername(process.env.ADMIN_OWNER_USERNAME || 'owner');
    const bootstrapEmail = (process.env.ADMIN_OWNER_EMAIL || `${bootstrapUsername}@seagull.lyson`).trim().toLowerCase();
    const bootstrapPass = (
      process.env.ADMIN_OWNER_PASS ||
      (process.env.NODE_ENV !== 'production' ? 'SeagullOwner@2026' : '')
    ).trim();

    if (!bootstrapPass) {
      return {
        ok: false,
        status: 500,
        errorCode: 'BOOTSTRAP_PASSWORD_NOT_CONFIGURED',
        error:
          'Chưa có tài khoản Chủ cơ sở trong database và biến môi trường ADMIN_OWNER_PASS chưa được thiết lập.',
      };
    }

    const isBootstrapIdentifier = identifier === bootstrapUsername || identifier === bootstrapEmail;
    if (isBootstrapIdentifier && password === bootstrapPass) {
      const nowIso = new Date().toISOString();
      const hashed = hashPassword(bootstrapPass);
      const ownerFullName = process.env.ADMIN_OWNER_NAME || 'Mr. Thiện / Ms. Điền (Chủ cơ sở)';

      const { data: insertedOwner, error: insertErr } = await supabase
        .from('user_roles')
        .insert({
          username: bootstrapUsername,
          email: bootstrapEmail,
          full_name: ownerFullName,
          phone: '0868011799',
          role: 'owner',
          password_hash: hashed,
          is_active: true,
          last_login_at: nowIso,
          created_by: 'system_bootstrap',
        })
        .select('id, username, email, full_name, phone, role, is_active, last_login_at, created_at, created_by')
        .single();

      if (insertErr || !insertedOwner) {
        console.error('[Owner Bootstrap Insert Error]:', insertErr);
        return {
          ok: false,
          status: 500,
          error: `Không thể khởi tạo tài khoản Chủ cơ sở ban đầu: ${insertErr?.message || 'Unknown error'}`,
        };
      }

      const publicUser = mapDbRowToPublic(insertedOwner);

      await recordAuditEvent(
        {
          userId: publicUser.id,
          username: publicUser.username,
          name: publicUser.fullName,
          role: publicUser.role,
        },
        {
          action: 'ADMIN_BOOTSTRAP_OWNER',
          entityType: 'user_roles',
          entityId: publicUser.id,
          newData: {
            message: 'Khởi tạo tài khoản Chủ cơ sở đầu tiên với mật khẩu hash scrypt',
            ip: meta?.ip || null,
          },
        }
      );

      return { ok: true, user: publicUser, bootstrapped: true };
    }
  }

  // Invalid login -> write audit log without storing plaintext password
  await recordAuditEvent(
    { username: identifier, role: 'anonymous' },
    {
      action: 'ADMIN_LOGIN_FAILED',
      entityType: 'auth_session',
      newData: { reason: 'user_not_found', ip: meta?.ip || null },
    }
  );

  return {
    ok: false,
    status: 401,
    error: 'Sai tên đăng nhập hoặc mật khẩu.',
  };
}

/**
 * Lists all staff accounts (strictly excluding password_hash).
 */
export async function listStaffAccounts(): Promise<{
  isDemo: boolean;
  staff: StaffAccountPublic[];
}> {
  if (!isSupabaseConfigured()) {
    return {
      isDemo: true,
      staff: getDemoStaffStore().map(({ passwordHash: _ignored, ...rest }) => rest),
    };
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('user_roles')
    .select('id, username, email, full_name, phone, role, is_active, last_login_at, created_at, created_by')
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingStaffColumnError(error)) {
      throw new Error(
        'Bảng public.user_roles chưa có cột username/password_hash. Vui lòng chạy SQL nâng cấp trên Supabase SQL Editor.'
      );
    }
    throw new Error(error.message);
  }

  return {
    isDemo: false,
    staff: (data || []).map(mapDbRowToPublic),
  };
}

/**
 * Creates a new individual staff account with a salted scrypt password hash.
 */
export async function createStaffAccount(
  input: {
    username: string;
    email?: string;
    fullName: string;
    phone?: string;
    role: string;
    password: string;
  },
  actor: AdminSession
): Promise<StaffAccountPublic> {
  const username = normalizeUsername(input.username || '');
  const fullName = (input.fullName || '').trim();
  const phone = (input.phone || '').trim();
  const role = normalizeUserRole(input.role);
  const password = (input.password || '').trim();

  if (!isValidUsername(username)) {
    throw new Error('Tên đăng nhập phải dài 3–50 ký tự, chỉ gồm chữ thường không dấu, số và dấu chấm/gạch dưới/gạch nối (vd: letan.truc).');
  }
  if (!fullName || fullName.length < 2) {
    throw new Error('Vui lòng nhập họ tên nhân sự đầy đủ.');
  }
  if (!role) {
    throw new Error('Vai trò phân quyền không hợp lệ.');
  }
  if (password.length < 8) {
    throw new Error('Mật khẩu riêng phải có tối thiểu 8 ký tự.');
  }
  if (LEGACY_BLOCKED_PINS.has(password)) {
    throw new Error('Mật khẩu quá yếu hoặc nằm trong danh sách mã PIN bị cấm.');
  }

  const email = (input.email || '').trim().toLowerCase() || `${username}@seagull.lyson`;
  const passwordHash = hashPassword(password);

  if (!isSupabaseConfigured()) {
    const store = getDemoStaffStore();
    if (store.some((u) => u.username === username || u.email === email)) {
      throw new Error(`Tên đăng nhập "${username}" hoặc email "${email}" đã tồn tại.`);
    }
    const created: DemoStaffRecord = {
      id: `demo-usr-${Date.now()}`,
      username,
      email,
      fullName,
      phone,
      role,
      passwordHash,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      createdBy: actor.username,
    };
    store.push(created);

    const { passwordHash: _ignored, ...publicUser } = created;
    await recordAuditEvent(actor, {
      action: 'STAFF_CREATED',
      entityType: 'user_roles',
      entityId: publicUser.id,
      newData: { username, email, fullName, role },
    });
    return publicUser;
  }

  const supabase = getSupabaseServerClient();

  // Check duplicate username or email
  const { data: existing } = await supabase
    .from('user_roles')
    .select('id, username, email')
    .or(`username.ilike.${username},email.ilike.${email}`)
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error(`Tên đăng nhập "${username}" hoặc email "${email}" đã được sử dụng.`);
  }

  const { data, error } = await supabase
    .from('user_roles')
    .insert({
      username,
      email,
      full_name: fullName,
      phone: phone || null,
      role,
      password_hash: passwordHash,
      is_active: true,
      created_by: actor.username,
    })
    .select('id, username, email, full_name, phone, role, is_active, last_login_at, created_at, created_by')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Không thể tạo tài khoản nhân sự mới.');
  }

  const publicUser = mapDbRowToPublic(data);

  await recordAuditEvent(actor, {
    action: 'STAFF_CREATED',
    entityType: 'user_roles',
    entityId: publicUser.id,
    newData: { username, email, fullName, role },
  });

  return publicUser;
}

/**
 * Toggles a staff account's active/inactive status.
 */
export async function toggleStaffAccountActive(
  staffId: string,
  nextActive: boolean,
  actor: AdminSession
): Promise<StaffAccountPublic> {
  if (!staffId) {
    throw new Error('Thiếu mã tài khoản nhân sự.');
  }
  if (staffId === actor.userId && !nextActive) {
    throw new Error('Bạn không thể tự tạm khóa chính tài khoản đang đăng nhập.');
  }

  if (!isSupabaseConfigured()) {
    const store = getDemoStaffStore();
    const target = store.find((u) => u.id === staffId);
    if (!target) throw new Error('Không tìm thấy tài khoản nhân sự.');

    if (target.role === 'owner' && !nextActive) {
      const activeOwners = store.filter((u) => u.role === 'owner' && u.isActive);
      if (activeOwners.length <= 1) {
        throw new Error('Không thể tạm khóa tài khoản Chủ cơ sở đang hoạt động cuối cùng.');
      }
    }

    const prevActive = target.isActive;
    target.isActive = nextActive;
    const { passwordHash: _ignored, ...publicUser } = target;

    await recordAuditEvent(actor, {
      action: 'STAFF_TOGGLED_ACTIVE',
      entityType: 'user_roles',
      entityId: staffId,
      previousData: { isActive: prevActive },
      newData: { username: target.username, fullName: target.fullName, isActive: nextActive },
    });

    return publicUser;
  }

  const supabase = getSupabaseServerClient();
  const { data: target, error: fetchErr } = await supabase
    .from('user_roles')
    .select('id, username, email, full_name, phone, role, is_active')
    .eq('id', staffId)
    .single();

  if (fetchErr || !target) {
    throw new Error('Không tìm thấy tài khoản nhân sự.');
  }

  const targetRole = normalizeUserRole(target.role);
  if (targetRole === 'owner' && !nextActive) {
    const { data: activeOwners } = await supabase
      .from('user_roles')
      .select('id')
      .in('role', ['owner', 'admin'])
      .eq('is_active', true);

    if ((activeOwners || []).length <= 1) {
      throw new Error('Không thể tạm khóa tài khoản Chủ cơ sở đang hoạt động cuối cùng.');
    }
  }

  const { data: updated, error: updateErr } = await supabase
    .from('user_roles')
    .update({ is_active: nextActive })
    .eq('id', staffId)
    .select('id, username, email, full_name, phone, role, is_active, last_login_at, created_at, created_by')
    .single();

  if (updateErr || !updated) {
    throw new Error(updateErr?.message || 'Không thể cập nhật trạng thái tài khoản.');
  }

  const publicUser = mapDbRowToPublic(updated);

  await recordAuditEvent(actor, {
    action: 'STAFF_TOGGLED_ACTIVE',
    entityType: 'user_roles',
    entityId: staffId,
    previousData: { isActive: target.is_active },
    newData: { username: publicUser.username, fullName: publicUser.fullName, isActive: nextActive },
  });

  return publicUser;
}

/**
 * Resets a staff member's password (Owner action).
 */
export async function resetStaffAccountPassword(
  staffId: string,
  newPassword: string,
  actor: AdminSession
): Promise<{ username: string; fullName: string }> {
  const trimmed = (newPassword || '').trim();
  if (!staffId) throw new Error('Thiếu mã tài khoản nhân sự.');
  if (trimmed.length < 8) throw new Error('Mật khẩu mới phải có tối thiểu 8 ký tự.');
  if (LEGACY_BLOCKED_PINS.has(trimmed)) throw new Error('Mật khẩu quá yếu hoặc thuộc danh sách mã PIN bị cấm.');

  const newHash = hashPassword(trimmed);

  if (!isSupabaseConfigured()) {
    const store = getDemoStaffStore();
    const target = store.find((u) => u.id === staffId);
    if (!target) throw new Error('Không tìm thấy tài khoản nhân sự.');
    target.passwordHash = newHash;

    await recordAuditEvent(actor, {
      action: 'STAFF_PASSWORD_RESET',
      entityType: 'user_roles',
      entityId: staffId,
      newData: { targetUsername: target.username, targetName: target.fullName },
    });
    return { username: target.username, fullName: target.fullName };
  }

  const supabase = getSupabaseServerClient();
  const { data: updated, error } = await supabase
    .from('user_roles')
    .update({ password_hash: newHash })
    .eq('id', staffId)
    .select('id, username, email, full_name')
    .single();

  if (error || !updated) {
    throw new Error(error?.message || 'Không thể đặt lại mật khẩu cho nhân sự.');
  }

  const targetUsername = updated.username || updated.email;
  const targetName = updated.full_name || targetUsername;

  await recordAuditEvent(actor, {
    action: 'STAFF_PASSWORD_RESET',
    entityType: 'user_roles',
    entityId: staffId,
    newData: { targetUsername, targetName },
  });

  return { username: targetUsername, fullName: targetName };
}

/**
 * Allows any authenticated staff member to change their own password.
 */
export async function changeOwnStaffPassword(
  currentPassword: string,
  newPassword: string,
  actor: AdminSession
): Promise<void> {
  const cur = (currentPassword || '').trim();
  const next = (newPassword || '').trim();

  if (!cur || !next) throw new Error('Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.');
  if (next.length < 8) throw new Error('Mật khẩu mới phải có tối thiểu 8 ký tự.');
  if (LEGACY_BLOCKED_PINS.has(next)) throw new Error('Mật khẩu quá yếu hoặc thuộc danh sách mã PIN bị cấm.');

  const newHash = hashPassword(next);

  if (!isSupabaseConfigured()) {
    const store = getDemoStaffStore();
    const target = store.find((u) => u.id === actor.userId || u.username === actor.username);
    if (!target || !verifyPassword(cur, target.passwordHash)) {
      throw new Error('Mật khẩu hiện tại không chính xác.');
    }
    target.passwordHash = newHash;
    await recordAuditEvent(actor, {
      action: 'STAFF_PASSWORD_CHANGED',
      entityType: 'user_roles',
      entityId: target.id,
      newData: { selfService: true },
    });
    return;
  }

  const supabase = getSupabaseServerClient();
  const { data: row, error: fetchErr } = await supabase
    .from('user_roles')
    .select('id, password_hash')
    .eq('id', actor.userId)
    .single();

  if (fetchErr || !row) {
    throw new Error('Không tìm thấy hồ sơ tài khoản của bạn.');
  }

  if (!verifyPassword(cur, row.password_hash)) {
    throw new Error('Mật khẩu hiện tại không chính xác.');
  }

  const { error: updateErr } = await supabase
    .from('user_roles')
    .update({ password_hash: newHash })
    .eq('id', actor.userId);

  if (updateErr) {
    throw new Error(updateErr.message);
  }

  await recordAuditEvent(actor, {
    action: 'STAFF_PASSWORD_CHANGED',
    entityType: 'user_roles',
    entityId: actor.userId,
    newData: { selfService: true },
  });
}

/**
 * Lists recent per-staff audit trail records.
 */
export async function listAuditLogs(limit = 50): Promise<{
  isDemo: boolean;
  logs: AuditLogRecord[];
}> {
  if (!isSupabaseConfigured()) {
    return {
      isDemo: true,
      logs: demoAuditStore.slice(0, limit),
    };
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, actor_id, actor_type, action, entity_type, entity_id, previous_data, new_data, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return {
    isDemo: false,
    logs: (data || []).map((r: any) => ({
      id: r.id,
      actorId: r.actor_id || 'system',
      actorType: r.actor_type || 'user',
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id || null,
      previousData: r.previous_data || null,
      newData: r.new_data || null,
      createdAt: r.created_at,
    })),
  };
}
