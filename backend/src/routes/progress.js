import { Router } from 'express';
import { requireAuth } from '../auth.js';

// Each user has one saved-state document (any JSON object). Writes carry the
// version the client last saw; if another device saved in between, the server
// answers 409 with its copy so the client can adopt it instead of clobbering it.
export function progressRouter({ db, config }) {
  const router = Router();
  router.use(requireAuth(config));

  const read = (userId) => {
    const row = db.prepare('SELECT data, version, updated_at FROM progress WHERE user_id = ?').get(userId);
    return row
      ? { data: JSON.parse(row.data), version: row.version, updatedAt: row.updated_at }
      : { data: null, version: 0, updatedAt: null };
  };

  router.get('/', (req, res) => res.json(read(req.userId)));

  router.put('/', (req, res) => {
    const { data, baseVersion } = req.body || {};
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ error: 'data must be a JSON object' });
    }
    if (!Number.isInteger(baseVersion) || baseVersion < 0) {
      return res.status(400).json({ error: 'baseVersion must be a non-negative integer' });
    }
    const json = JSON.stringify(data);
    if (Buffer.byteLength(json) > config.maxProgressBytes) {
      return res.status(413).json({ error: 'Saved progress is too large' });
    }

    const now = new Date().toISOString();
    const nextVersion = baseVersion + 1;
    // Conditional write: only succeeds if nobody else has saved since baseVersion.
    const result =
      baseVersion === 0
        ? db
            .prepare(
              'INSERT INTO progress (user_id, data, version, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO NOTHING',
            )
            .run(req.userId, json, now)
        : db
            .prepare('UPDATE progress SET data = ?, version = ?, updated_at = ? WHERE user_id = ? AND version = ?')
            .run(json, nextVersion, now, req.userId, baseVersion);

    if (result.changes === 0) {
      return res.status(409).json({ error: 'Progress was updated on another device', ...read(req.userId) });
    }
    res.json({ version: nextVersion, updatedAt: now });
  });

  return router;
}
