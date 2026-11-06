import express, { Router } from 'express';
import { markPaymentClosed, validateAndSettle } from '../subscriptions.js';

// Endpoints SSLCommerz calls. success/fail/cancel are reached by the customer's
// browser (a form POST); ipn is a server-to-server notification. None of the
// posted fields are trusted: a payment only counts once the Order Validation API
// confirms the val_id, the transaction id, the amount and the currency.

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function withParams(base, params) {
  const sep = base.includes('?') ? '&' : '?';
  return base + sep + new URLSearchParams(params).toString();
}

const MESSAGES = {
  PAID: ['Payment successful', 'Premium is on for your tabula account.'],
  REVIEW: ['Payment received', 'Your payment is being reviewed. Premium will activate once it is approved.'],
  PENDING: ['Payment processing', 'We are confirming your payment. Return to the app to check its status.'],
  FAILED: ['Payment failed', 'Your payment did not go through. No subscription was activated.'],
  CANCELLED: ['Payment cancelled', 'You cancelled the payment.'],
};

// A small page that sends the user back to the app. A plain 303 to a custom scheme
// is blocked by some Android browsers after a POST, so we also offer a button.
function resultPage(res, payment, status) {
  const [title, body] = MESSAGES[status] || MESSAGES.PENDING;
  const target = payment?.app_redirect
    ? withParams(payment.app_redirect, { status: status.toLowerCase(), tranId: payment.tran_id })
    : null;
  const t = target ? escapeHtml(target) : '';
  res
    .status(200)
    .type('html')
    .set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'")
    .send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>body{font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px;background:#F7F2E8;color:#2B2520}
main{max-width:420px;text-align:center}h1{font-family:Georgia,"Times New Roman",serif;font-size:30px;letter-spacing:-.01em;margin:0 0 6px}.ul{width:110px;height:5px;margin:0 auto 16px;border-radius:3px;background:#F2A900}p{line-height:1.5}.brand{font-family:Georgia,serif;font-weight:700;font-size:20px;margin-bottom:28px}a{display:inline-block;margin-top:16px;padding:12px 22px;border-radius:999px;background:#2B2520;color:#fff;text-decoration:none;font-weight:600}</style>
</head><body><main><div class="brand">tabula</div><h1>${escapeHtml(title)}</h1><div class="ul"></div><p>${escapeHtml(body)}</p>
${target ? `<a href="${t}">Return to the app</a><script>setTimeout(function(){location.href=${JSON.stringify(target).replace(/</g, '\\u003c')}},300)</script>` : ''}
</main></body></html>`);
}

export function paymentsRouter(deps) {
  const { db } = deps;
  const router = Router();
  router.use(express.urlencoded({ extended: false, limit: '64kb' }));

  const findPayment = (tranId) => db.prepare('SELECT * FROM payments WHERE tran_id = ?').get(String(tranId || ''));

  router.post('/success', async (req, res) => {
    const payment = findPayment(req.body?.tran_id);
    if (!payment) return res.status(404).send('Unknown transaction');
    let status = payment.status;
    if (req.body?.val_id) {
      try {
        status = (await validateAndSettle(deps, payment.tran_id, String(req.body.val_id))) ?? status;
      } catch (err) {
        console.error(`[payments] validation of ${payment.tran_id} failed: ${err.message}`);
      }
    }
    resultPage(res, payment, status);
  });

  for (const [path, closed] of [
    ['fail', 'FAILED'],
    ['cancel', 'CANCELLED'],
  ]) {
    router.post(`/${path}`, (req, res) => {
      const payment = findPayment(req.body?.tran_id);
      if (!payment) return res.status(404).send('Unknown transaction');
      markPaymentClosed(db, payment.tran_id, closed, req.body?.error || req.body?.failedreason);
      resultPage(res, payment, findPayment(payment.tran_id).status);
    });
  }

  router.post('/ipn', async (req, res) => {
    const payment = findPayment(req.body?.tran_id);
    if (!payment) return res.status(404).json({ error: 'Unknown transaction' });
    const gatewayStatus = String(req.body?.status || '');
    try {
      if (req.body?.val_id && ['VALID', 'VALIDATED'].includes(gatewayStatus)) {
        await validateAndSettle(deps, payment.tran_id, String(req.body.val_id));
      } else if (gatewayStatus === 'FAILED') {
        markPaymentClosed(db, payment.tran_id, 'FAILED', req.body?.error);
      } else if (gatewayStatus === 'CANCELLED') {
        markPaymentClosed(db, payment.tran_id, 'CANCELLED');
      }
      res.json({ received: true });
    } catch (err) {
      console.error(`[payments] IPN for ${payment.tran_id} failed: ${err.message}`);
      // Non-2xx makes SSLCommerz retry the IPN later.
      res.status(500).json({ error: 'Could not process IPN' });
    }
  });

  return router;
}
