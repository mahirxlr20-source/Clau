import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { PLANS, findPlan } from '../plans.js';
import { getSubscription, newTranId, reconcilePayment } from '../subscriptions.js';

function publicPayment(p) {
  return {
    tranId: p.tran_id,
    planId: p.plan_id,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    failureReason: p.failure_reason,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export function subscriptionsRouter(deps) {
  const { db, config, gateway } = deps;
  const router = Router();

  router.get('/plans', (_req, res) => res.json({ plans: PLANS }));

  router.use(requireAuth(config));

  router.get('/me', (req, res) => res.json({ subscription: getSubscription(db, req.userId) }));

  // Starts an SSLCommerz checkout for a plan. The app opens gatewayUrl in an in-app browser.
  router.post('/checkout', async (req, res) => {
    if (!gateway.configured) {
      return res.status(503).json({ error: 'Payments are not configured on the server' });
    }
    const plan = findPlan(req.body?.planId);
    if (!plan) return res.status(400).json({ error: 'Unknown plan' });

    const phone = String(req.body?.phone || '').replace(/[^\d+]/g, '');
    if (phone.length < 6) return res.status(400).json({ error: 'Enter a valid phone number' });

    const appRedirect = String(req.body?.appRedirectUrl || '');
    if (appRedirect && !config.appRedirectPrefixes.some((prefix) => appRedirect.startsWith(prefix))) {
      return res.status(400).json({ error: 'appRedirectUrl is not allowed' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    const tranId = newTranId();
    db.prepare(
      "INSERT INTO payments (tran_id, user_id, plan_id, amount, currency, status, app_redirect) VALUES (?, ?, ?, ?, ?, 'PENDING', ?)",
    ).run(tranId, user.id, plan.id, plan.amount, plan.currency, appRedirect || null);

    const callback = `${config.publicBaseUrl}/payments/sslcommerz`;
    const d = config.sslcommerz.defaults;
    try {
      const { sessionKey, gatewayUrl } = await gateway.initPayment({
        total_amount: plan.amount,
        currency: plan.currency,
        tran_id: tranId,
        success_url: `${callback}/success`,
        fail_url: `${callback}/fail`,
        cancel_url: `${callback}/cancel`,
        ipn_url: `${callback}/ipn`,
        product_name: plan.name,
        product_category: 'Subscription',
        product_profile: 'non-physical-goods',
        num_of_item: '1',
        shipping_method: 'NO',
        cus_name: user.name,
        cus_email: user.email,
        cus_phone: phone,
        cus_add1: d.address,
        cus_city: d.city,
        cus_postcode: d.postcode,
        cus_country: d.country,
        value_a: String(user.id),
        value_b: plan.id,
      });
      db.prepare('UPDATE payments SET session_key = ? WHERE tran_id = ?').run(sessionKey ?? null, tranId);
      res.status(201).json({ tranId, gatewayUrl });
    } catch (err) {
      db.prepare("UPDATE payments SET status = 'FAILED', failure_reason = ? WHERE tran_id = ?").run(
        String(err.message).slice(0, 500),
        tranId,
      );
      res.status(502).json({ error: `Could not start payment: ${err.message}` });
    }
  });

  router.get('/payments', (req, res) => {
    const rows = db
      .prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
      .all(req.userId);
    res.json({ payments: rows.map(publicPayment) });
  });

  // Returns a payment's status. If it is still pending, asks SSLCommerz directly,
  // so the app gets the right answer even if the server missed the callback.
  router.get('/payments/:tranId', async (req, res) => {
    const find = () =>
      db.prepare('SELECT * FROM payments WHERE tran_id = ? AND user_id = ?').get(req.params.tranId, req.userId);
    let payment = find();
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status === 'PENDING' && gateway.configured) {
      try {
        await reconcilePayment(deps, payment.tran_id);
        payment = find();
      } catch (err) {
        console.warn(`[payments] reconcile ${payment.tran_id} failed: ${err.message}`);
      }
    }
    res.json({ payment: publicPayment(payment), subscription: getSubscription(db, req.userId) });
  });

  return router;
}
