import { randomBytes } from 'node:crypto';
import { transaction } from './db.js';
import { findPlan } from './plans.js';

const VALID_STATUSES = new Set(['VALID', 'VALIDATED']);
// A payment in one of these states can still be settled by a validated payment.
const OPEN_STATUSES = ['PENDING', 'FAILED', 'CANCELLED'];

export function getSubscription(db, userId) {
  const row = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId);
  if (!row) return { active: false, planId: null, currentPeriodEnd: null };
  return {
    active: new Date(row.current_period_end) > new Date(),
    planId: row.plan_id,
    currentPeriodEnd: row.current_period_end,
  };
}

export function newTranId() {
  return `TABULA-${Date.now().toString(36)}-${randomBytes(6).toString('hex')}`.toUpperCase();
}

/**
 * Checks an Order Validation API response against the payment we created.
 * Returns { ok: true } or { ok: false, reason }.
 */
export function checkValidation(payment, validation) {
  if (!validation || !VALID_STATUSES.has(validation.status)) {
    return { ok: false, reason: `Gateway status ${validation?.status ?? 'unknown'}` };
  }
  if (validation.tran_id !== payment.tran_id) return { ok: false, reason: 'Transaction id mismatch' };
  // currency_type/currency_amount are what the customer was asked to pay; amount/currency
  // can be the settlement in BDT. Fall back to the latter if the former are absent.
  const currency = validation.currency_type || validation.currency;
  const amount = validation.currency_amount ?? validation.amount;
  if (currency !== payment.currency) return { ok: false, reason: 'Currency mismatch' };
  if (Math.abs(Number(amount) - Number(payment.amount)) > 0.009) return { ok: false, reason: 'Amount mismatch' };
  return { ok: true };
}

/**
 * Applies a validated payment exactly once and extends the user's subscription.
 * Safe to call from both the browser callback and the IPN at the same time.
 * Returns the payment's resulting status.
 */
export function settleValidatedPayment(db, config, tranId, validation) {
  const payment = db.prepare('SELECT * FROM payments WHERE tran_id = ?').get(tranId);
  if (!payment) return null;
  const check = checkValidation(payment, validation);
  if (!check.ok) {
    console.warn(`[payments] ${tranId} rejected: ${check.reason}`);
    return payment.status;
  }
  const risky = String(validation.risk_level) === '1' && config.sslcommerz.holdRiskyPayments;
  const status = risky ? 'REVIEW' : 'PAID';
  const now = new Date();

  return transaction(db, () => {
    const placeholders = OPEN_STATUSES.map(() => '?').join(',');
    const claimed = db
      .prepare(
        `UPDATE payments SET status = ?, val_id = ?, bank_tran_id = ?, card_type = ?, failure_reason = ?, updated_at = ?
         WHERE tran_id = ? AND status IN (${placeholders})`,
      )
      .run(
        status,
        validation.val_id ?? null,
        validation.bank_tran_id ?? null,
        validation.card_type ?? null,
        risky ? `Held for review: ${validation.risk_title || 'high risk'}` : null,
        now.toISOString(),
        tranId,
        ...OPEN_STATUSES,
      );
    if (claimed.changes === 0) {
      // Already settled by the other callback.
      return db.prepare('SELECT status FROM payments WHERE tran_id = ?').get(tranId).status;
    }
    if (status === 'PAID') extendSubscription(db, payment.user_id, payment.plan_id, now);
    return status;
  });
}

function extendSubscription(db, userId, planId, now) {
  const plan = findPlan(planId);
  const existing = db.prepare('SELECT current_period_end FROM subscriptions WHERE user_id = ?').get(userId);
  // Paying early stacks on top of the time already paid for.
  const start = existing && new Date(existing.current_period_end) > now ? new Date(existing.current_period_end) : now;
  const end = new Date(start.getTime() + plan.durationDays * 86_400_000).toISOString();
  db.prepare(
    `INSERT INTO subscriptions (user_id, plan_id, current_period_end, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET plan_id = excluded.plan_id,
       current_period_end = excluded.current_period_end, updated_at = excluded.updated_at`,
  ).run(userId, planId, end, now.toISOString());
}

/** Marks an unpaid payment failed/cancelled. A later validated payment still overrides it. */
export function markPaymentClosed(db, tranId, status, reason) {
  db.prepare(
    "UPDATE payments SET status = ?, failure_reason = ?, updated_at = ? WHERE tran_id = ? AND status = 'PENDING'",
  ).run(status, reason ?? null, new Date().toISOString(), tranId);
}

/** Validates a val_id with SSLCommerz and settles the payment. */
export async function validateAndSettle({ db, config, gateway }, tranId, valId) {
  const validation = await gateway.validate(valId);
  return settleValidatedPayment(db, config, tranId, validation);
}

/**
 * Asks SSLCommerz about a payment by tran_id. Used when the app returns from the
 * browser before (or without) a callback reaching the server.
 */
export async function reconcilePayment({ db, config, gateway }, tranId) {
  const result = await gateway.queryByTranId(tranId);
  const elements = Array.isArray(result?.element) ? result.element : [];
  const valid = elements.find((e) => VALID_STATUSES.has(e.status) && e.val_id);
  if (valid) return validateAndSettle({ db, config, gateway }, tranId, valid.val_id);
  return db.prepare('SELECT status FROM payments WHERE tran_id = ?').get(tranId)?.status ?? null;
}
