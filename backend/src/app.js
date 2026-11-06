import express from 'express';
import helmet from 'helmet';
import { authRouter } from './routes/auth.js';
import { paymentsRouter } from './routes/payments.js';
import { progressRouter } from './routes/progress.js';
import { subscriptionsRouter } from './routes/subscriptions.js';

/** Builds the Express app. deps = { db, config, gateway }. */
export function createApp(deps) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  if (deps.config.corsOrigins.length) {
    app.use((req, res, next) => {
      const origin = req.get('origin');
      if (origin && deps.config.corsOrigins.includes(origin)) {
        res.set({
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
          Vary: 'Origin',
        });
        if (req.method === 'OPTIONS') return res.status(204).end();
      }
      next();
    });
  }

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // SSLCommerz callbacks are form-encoded; mount them before the JSON parser.
  app.use('/payments/sslcommerz', paymentsRouter(deps));

  app.use(express.json({ limit: deps.config.maxProgressBytes + 16 * 1024 }));
  app.use('/auth', authRouter(deps));
  app.use('/progress', progressRouter(deps));
  app.use('/subscriptions', subscriptionsRouter(deps));

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
