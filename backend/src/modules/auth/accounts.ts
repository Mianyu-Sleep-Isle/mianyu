import { randomBytes } from 'node:crypto';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { ApiError } from '../../shared/http.ts';
import type { UserService } from '../common/users.ts';
import type { AgeMode } from '../../shared/http.ts';

type Row = Record<string, unknown>;

export interface AccountRow {
  account_id: string;
  username: string | null;
  phone: string | null;
  user_id: string;
  created_at: string;
}

export interface AccountProfile {
  account_id: string;
  username: string | null;
  phone: string | null;
  user_id: string;
  age_mode: AgeMode;
  pin_configured: boolean;
}

export interface AuthToken {
  token: string;
  account_id: string;
  user_id: string;
  expires_at: string; // ISO string, 30 days from now
}

// --- Password hashing (scrypt, same scheme as PIN hashing) ---

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(password, salt, 32).toString('hex')}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const idx = storedHash.indexOf(':');
  if (idx < 0) return false;
  const [saltHex, hashHex] = [storedHash.slice(0, idx), storedHash.slice(idx + 1)];
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(expected, actual);
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function makeExpiry(days = 30): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

// --- Session tokens (stored in a separate table for expiry support) ---

function table(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_token (
      token_hash TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
}

// --- Service ---

export class AuthService {
  private readonly tokens = new Map<string, { account_id: string; user_id: string; expires_at: string }>();

  constructor(
    private readonly db: DatabaseSync,
    private readonly users: UserService,
  ) {
    table(db);
    // Load non-expired tokens from DB into memory on startup
    this.reloadTokens();
  }

  private reloadTokens() {
    this.tokens.clear();
    const rows = this.db.prepare(
      'SELECT token_hash, account_id, user_id, expires_at FROM auth_token WHERE expires_at > ?',
    ).all(new Date().toISOString()) as Array<{ token_hash: string; account_id: string; user_id: string; expires_at: string }>;
    for (const r of rows) this.tokens.set(r.token_hash, { account_id: r.account_id, user_id: r.user_id, expires_at: r.expires_at });
  }

  // ── Register ──────────────────────────────────────────────────────────────

  register(input: {
    username?: string | null;
    phone?: string | null;
    password: string;
    age_mode?: AgeMode;
  }): AccountProfile {
    const { username, phone, password } = input;
    if (!username && !phone) throw new ApiError('VALIDATION', '用户名和手机号至少填写一项', 400);
    if (username && (username.length < 3 || username.length > 32)) throw new ApiError('VALIDATION', '用户名需 3-32 个字符', 400);
    if (phone && !/^1\d{10}$/.test(phone)) throw new ApiError('VALIDATION', '手机号格式不正确', 400);
    if (password.length < 6) throw new ApiError('VALIDATION', '密码至少 6 位', 400);

    // Check uniqueness
    if (username) {
      const existing = this.db.prepare('SELECT 1 FROM account WHERE lower(username) = lower(?)').get(username);
      if (existing) throw new ApiError('CONFLICT', '用户名已被注册', 409);
    }
    if (phone) {
      const existing = this.db.prepare('SELECT 1 FROM account WHERE phone = ?').get(phone);
      if (existing) throw new ApiError('CONFLICT', '该手机号已被注册', 409);
    }

    // Create user profile (anonymous-shaped) first
    const ageMode: AgeMode = input.age_mode ?? 'adult';
    const userProfile = this.users.createAnonymous(ageMode);
    const accountId = randomBytes(16).toString('hex');
    const now = new Date().toISOString();
    const hash = hashPassword(password);

    this.db.prepare(
      'INSERT INTO account(account_id, username, phone, password_hash, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(accountId, username ?? null, phone ?? null, hash, userProfile.user_id, now, now);

    return { account_id: accountId, username: username ?? null, phone: phone ?? null, user_id: userProfile.user_id, age_mode: userProfile.age_mode, pin_configured: userProfile.pin_configured };
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  login(input: { username?: string | null; phone?: string | null; password: string }): AuthToken {
    const username = input.username ?? undefined;
    const phone = input.phone ?? undefined;
    const { password } = input;
    if (!username && !phone) throw new ApiError('VALIDATION', '请输入用户名或手机号', 400);
    if (password.length < 1) throw new ApiError('VALIDATION', '请输入密码', 400);

    const row = this.db.prepare(
      username
        ? 'SELECT * FROM account WHERE lower(username) = lower(?)'
        : 'SELECT * FROM account WHERE phone = ?',
    ).get(username ?? phone ?? '') as Row | undefined;

    if (!row) throw new ApiError('UNAUTHORIZED', '账号不存在', 401);
    if (!verifyPassword(password, String(row.password_hash))) throw new ApiError('UNAUTHORIZED', '密码错误', 401);

    const token = generateToken();
    const expires_at = makeExpiry(30);
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO auth_token(token_hash, account_id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(token, String(row.account_id), String(row.user_id), expires_at, now);
    this.tokens.set(token, { account_id: String(row.account_id), user_id: String(row.user_id), expires_at });

    return { token, account_id: String(row.account_id), user_id: String(row.user_id), expires_at };
  }

  // ── Token validation ──────────────────────────────────────────────────────

  validateToken(token: string): { account_id: string; user_id: string } | null {
    const entry = this.tokens.get(token);
    if (!entry) return null;
    if (new Date(entry.expires_at) < new Date()) {
      this.tokens.delete(token);
      this.db.prepare('DELETE FROM auth_token WHERE token_hash = ?').run(token);
      return null;
    }
    return { account_id: entry.account_id, user_id: entry.user_id };
  }

  // ── Get profile by token ─────────────────────────────────────────────────

  getProfile(token: string): AccountProfile | null {
    const info = this.validateToken(token);
    if (!info) return null;
    const row = this.db.prepare('SELECT * FROM account WHERE account_id = ?').get(info.account_id) as Row | undefined;
    if (!row) return null;
    const profile = this.users.get(info.user_id);
    return {
      account_id: String(row.account_id),
      username: row.username as string | null,
      phone: row.phone as string | null,
      user_id: info.user_id,
      age_mode: profile.age_mode,
      pin_configured: profile.pin_configured,
    };
  }

  // ── Logout ───────────────────────────────────────────────────────────────

  logout(token: string): void {
    this.tokens.delete(token);
    this.db.prepare('DELETE FROM auth_token WHERE token_hash = ?').run(token);
  }

  // ── Link existing anonymous account ──────────────────────────────────────

  linkAccount(userId: string, input: { username?: string | null; phone?: string | null; password: string }): AccountProfile {
    // Attach a username/phone+password to an existing anonymous user profile.
    // Used for "upgrade anonymous → registered".
    const { username, phone, password } = input;
    if (!username && !phone) throw new ApiError('VALIDATION', '用户名和手机号至少填写一项', 400);
    if (password.length < 6) throw new ApiError('VALIDATION', '密码至少 6 位', 400);

    const existing = this.db.prepare('SELECT account_id FROM account WHERE user_id = ?').get(userId);
    if (existing) throw new ApiError('CONFLICT', '该用户已绑定账号', 409);

    if (username) {
      const conflict = this.db.prepare('SELECT 1 FROM account WHERE lower(username) = lower(?)').get(username);
      if (conflict) throw new ApiError('CONFLICT', '用户名已被注册', 409);
    }
    if (phone) {
      const conflict = this.db.prepare('SELECT 1 FROM account WHERE phone = ?').get(phone);
      if (conflict) throw new ApiError('CONFLICT', '该手机号已被注册', 409);
    }

    const accountId = randomBytes(16).toString('hex');
    const now = new Date().toISOString();
    const hash = hashPassword(password);
    this.db.prepare(
      'INSERT INTO account(account_id, username, phone, password_hash, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(accountId, username ?? null, phone ?? null, hash, userId, now, now);

    const profile = this.users.get(userId);
    return { account_id: accountId, username: username ?? null, phone: phone ?? null, user_id: userId, age_mode: profile.age_mode, pin_configured: profile.pin_configured };
  }
}
