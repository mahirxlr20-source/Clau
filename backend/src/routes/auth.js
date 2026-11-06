import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { hashPassword, issueTokens, requireAuth, sha256, verifyPassword } from '../auth.js';
import { transaction } from '../db.js';
import { getSubscription } from '../subscriptions.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.created_at };
}

export function authRouter({ db, config }) {
  const router = Router();
  const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 50, standardHeaders: 'draft-8', legacyHeaders: false });

  router.post('/register', limiter, async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const name = String(req.body?.name || '').trim();
    const password = String(req.body?.password || '');
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
    if (!name || name.length > 100) return res.status(400).json({ error: 'Enter your name' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    const passwordHash = await hashPassword(password);
    const user = transaction(db, () => {
      const { lastInsertRowid } = db
        .prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)')
        .run(email, name, passwordHash);
      return db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
    });
    res.status(201).json({ user: publicUser(user), ...issueTokens(db, config, user.id) });
  });

  router.post('/login', limiter, async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }
    res.json({ user: publicUser(user), ...issueTokens(db, config, user.id) });
  });

  // Exchanges a refresh token for a new pair. The old refresh token is consumed (rotation).
  router.post('/refresh', limiter, (req, res) => {
    const token = String(req.body?.refreshToken || '');
    const hash = sha256(token);
    const row = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(hash);
    if (!row) return res.status(401).json({ error: 'Session expired, please log in again' });
    db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hash);
    if (new Date(row.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Session expired, please log in again' });
    }
    res.json(issueTokens(db, config, row.user_id));
  });

  router.post('/logout', (req, res) => {
    const token = String(req.body?.refreshToken || '');
    if (token) db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(sha256(token));
    res.status(204).end();
  });

  router.get('/me', requireAuth(config), (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.status(404).json({ error: 'Account not found' });
    res.json({ user: publicUser(user), subscription: getSubscription(db, user.id) });
  });

  return router;
}
