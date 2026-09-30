import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { ApiError, type AgeMode } from '../../shared/http.ts';

type Row = Record<string, unknown>;

export interface UserProfile {
  user_id: string;
  age_mode: AgeMode;
  pin_configured: boolean;
  non_medical_accepted: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserUpdate {
  age_mode?: AgeMode | undefined;
  pin?: string | undefined;
  non_medical_accepted?: boolean | undefined;
}

export interface UserDirectory { hasUser(userId: string): boolean }

// Called by DELETE /users/me/data; each module erases only its own tables.
export interface UserDataEraser { module: string; erase(userId: string): number }

const hashPin = (pin: string) => {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(pin, salt, 32).toString('hex')}`;
};

export class UserService implements UserDirectory {
  constructor(private readonly db: DatabaseSync, private readonly erasers: UserDataEraser[] = []) {}

  createAnonymous(ageMode: AgeMode): UserProfile {
    const userId = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare('INSERT INTO user_profile(user_id, age_mode, created_at, updated_at) VALUES (?, ?, ?, ?)').run(userId, ageMode, now, now);
    return this.get(userId);
  }

  hasUser(userId: string): boolean {
    return Boolean(this.db.prepare('SELECT 1 FROM user_profile WHERE user_id = ?').get(userId));
  }

  get(userId: string): UserProfile {
    const row = this.db.prepare('SELECT * FROM user_profile WHERE user_id = ?').get(userId) as Row | undefined;
    if (!row) throw new ApiError('UNAUTHORIZED', '缺少有效的 X-User-Id', 401);
    return {
      user_id: String(row.user_id),
      age_mode: row.age_mode as AgeMode,
      pin_configured: Number(row.pin_configured) === 1,
      non_medical_accepted: Number(row.non_medical_accepted) === 1,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  update(userId: string, input: UserUpdate): UserProfile {
    const current = this.get(userId);
    const pinHash = input.pin === undefined ? undefined : hashPin(input.pin);
    this.db.prepare(`UPDATE user_profile SET
      age_mode = ?,
      non_medical_accepted = ?,
      pin_hash = COALESCE(?, pin_hash),
      pin_configured = CASE WHEN COALESCE(?, pin_hash) IS NULL THEN 0 ELSE 1 END,
      updated_at = ?
      WHERE user_id = ?`).run(
      input.age_mode ?? current.age_mode,
      Number(input.non_medical_accepted ?? current.non_medical_accepted),
      pinHash ?? null,
      pinHash ?? null,
      new Date().toISOString(),
      userId,
    );
    return this.get(userId);
  }

  verifyPin(userId: string, pin: string): boolean {
    this.get(userId);
    const row = this.db.prepare('SELECT pin_hash FROM user_profile WHERE user_id = ?').get(userId) as Row | undefined;
    const stored = typeof row?.pin_hash === 'string' ? row.pin_hash : null;
    if (!stored) return false;
    const [saltHex, hashHex] = stored.split(':');
    if (!saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(pin, Buffer.from(saltHex, 'hex'), expected.length);
    return timingSafeEqual(expected, actual);
  }

  eraseAll(userId: string): { erased: true; modules: Record<string, number> } {
    this.get(userId);
    const modules: Record<string, number> = {};
    for (const eraser of this.erasers) modules[eraser.module] = eraser.erase(userId);
    modules.common = Number(this.db.prepare('DELETE FROM user_profile WHERE user_id = ?').run(userId).changes);
    return { erased: true, modules };
  }
}
