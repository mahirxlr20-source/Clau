import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';

const scrypt = promisify(scryptCb);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return ['scrypt', salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  const [scheme, saltB64, keyB64] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(expected, actual);
}

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

/** Issues a short-lived access JWT plus a long-lived, rotating, revocable refresh token. */
export function issueTokens(db, config, userId) {
  const accessToken = jwt.sign({ sub: String(userId) }, config.jwtSecret, {
    expiresIn: config.accessTokenTtl,
    algorithm: 'HS256',
  });
  const refreshToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + config.refreshTokenTtlDays * 86_400_000).toISOString();
  db.prepare('INSERT INTO refresh_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    sha256(refreshToken),
    userId,
    expiresAt,
  );
  return { accessToken, refreshToken };
}

export function requireAuth(config) {
  return (req, res, next) => {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing access token' });
    try {
      const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
      req.userId = Number(payload.sub);
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired access token' });
    }
  };
}
