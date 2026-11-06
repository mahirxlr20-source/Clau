import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db.js';

// Fake SSLCommerz: records init calls and answers validation from `validations`.
const gateway = {
  configured: true,
  inits: [],
  validations: new Map(), // val_id -> validation response
  queries: new Map(), // tran_id -> query response
  async initPayment(fields) {
    this.inits.push(fields);
    return { sessionKey: 'SESSION', gatewayUrl: `https://sandbox.example/pay/${fields.tran_id}` };
  },
  async validate(valId) {
    return this.validations.get(valId) ?? { status: 'INVALID_TRANSACTION' };
  },
  async queryByTranId(tranId) {
    return this.queries.get(tranId) ?? { APIConnect: 'DONE', no_of_trans_found: 0, element: [] };
  },
};

let server;
let base;
let db;

before(async () => {
  const config = loadConfig({ JWT_SECRET: 'test-secret', PUBLIC_BASE_URL: 'https://api.test' });
  db = openDatabase(':memory:');
  server = createApp({ db, config, gateway }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
beforeEach(() => {
  gateway.inits.length = 0;
  gateway.validations.clear();
  gateway.queries.clear();
});

async function api(path, { method = 'GET', body, token, form } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(base + path, { method, headers, body: payload });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, body: json, text };
}

let counter = 0;
async function newUser() {
  const email = `user${++counter}@example.com`;
  const res = await api('/auth/register', { method: 'POST', body: { email, name: 'Test User', password: 'password123' } });
  assert.equal(res.status, 201);
  return { email, ...res.body };
}

async function checkout(token, planId = 'monthly') {
  const res = await api('/subscriptions/checkout', {
    method: 'POST',
    token,
    body: { planId, phone: '01700000000', appRedirectUrl: 'tabula://payment-result' },
  });
  assert.equal(res.status, 201, res.text);
  return res.body.tranId;
}

const validFor = (tranId, extra = {}) => ({
  status: 'VALID',
  tran_id: tranId,
  val_id: `VAL-${tranId}`,
  amount: '199.00',
  currency: 'BDT',
  currency_type: 'BDT',
  currency_amount: '199.00',
  risk_level: '0',
  bank_tran_id: 'BANK1',
  card_type: 'VISA-Dutch Bangla',
  ...extra,
});

describe('accounts', () => {
  it('registers, logs in, refreshes and logs out', async () => {
    const { email, refreshToken } = await newUser();
    assert.equal((await api('/auth/login', { method: 'POST', body: { email, password: 'wrong-pass' } })).status, 401);

    const login = await api('/auth/login', { method: 'POST', body: { email: email.toUpperCase(), password: 'password123' } });
    assert.equal(login.status, 200);
    const me = await api('/auth/me', { token: login.body.accessToken });
    assert.equal(me.body.user.email, email);
    assert.equal(me.body.subscription.active, false);

    const refreshed = await api('/auth/refresh', { method: 'POST', body: { refreshToken } });
    assert.equal(refreshed.status, 200);
    // Refresh tokens rotate: the old one is single-use.
    assert.equal((await api('/auth/refresh', { method: 'POST', body: { refreshToken } })).status, 401);

    await api('/auth/logout', { method: 'POST', body: { refreshToken: refreshed.body.refreshToken } });
    assert.equal((await api('/auth/refresh', { method: 'POST', body: { refreshToken: refreshed.body.refreshToken } })).status, 401);
  });

  it('rejects duplicate emails and weak passwords', async () => {
    const { email } = await newUser();
    assert.equal((await api('/auth/register', { method: 'POST', body: { email, name: 'X', password: 'password123' } })).status, 409);
    assert.equal((await api('/auth/register', { method: 'POST', body: { email: 'new@x.io', name: 'X', password: 'short' } })).status, 400);
  });
});

describe('progress', () => {
  it('saves and restores state, rejecting stale writes', async () => {
    const { accessToken: token } = await newUser();
    assert.deepEqual((await api('/progress', { token })).body, { data: null, version: 0, updatedAt: null });

    const first = await api('/progress', { method: 'PUT', token, body: { data: { level: 1 }, baseVersion: 0 } });
    assert.equal(first.body.version, 1);
    const second = await api('/progress', { method: 'PUT', token, body: { data: { level: 2 }, baseVersion: 1 } });
    assert.equal(second.body.version, 2);

    // A second device still on version 1 gets the newer copy back instead of overwriting it.
    const stale = await api('/progress', { method: 'PUT', token, body: { data: { level: 99 }, baseVersion: 1 } });
    assert.equal(stale.status, 409);
    assert.deepEqual(stale.body.data, { level: 2 });
    assert.equal(stale.body.version, 2);

    // Logging in again (new token) resumes from the saved state.
    const login = await api('/auth/login', { method: 'POST', body: { email: `user${counter}@example.com`, password: 'password123' } });
    const restored = await api('/progress', { token: login.body.accessToken });
    assert.deepEqual(restored.body.data, { level: 2 });
  });

  it('requires auth and a JSON object', async () => {
    assert.equal((await api('/progress')).status, 401);
    const { accessToken: token } = await newUser();
    assert.equal((await api('/progress', { method: 'PUT', token, body: { data: [1], baseVersion: 0 } })).status, 400);
  });
});

describe('subscriptions', () => {
  it('starts checkout with the right SSLCommerz fields', async () => {
    const { accessToken: token, email } = await newUser();
    const tranId = await checkout(token);
    const init = gateway.inits[0];
    assert.equal(init.tran_id, tranId);
    assert.equal(init.total_amount, '199.00');
    assert.equal(init.currency, 'BDT');
    assert.equal(init.cus_email, email);
    assert.equal(init.success_url, 'https://api.test/payments/sslcommerz/success');
    assert.equal(init.ipn_url, 'https://api.test/payments/sslcommerz/ipn');
  });

  it('rejects unknown plans and redirect URLs outside the allowlist', async () => {
    const { accessToken: token } = await newUser();
    const bad = (body) => api('/subscriptions/checkout', { method: 'POST', token, body });
    assert.equal((await bad({ planId: 'nope', phone: '01700000000' })).status, 400);
    assert.equal((await bad({ planId: 'monthly', phone: '01700000000', appRedirectUrl: 'https://evil.example' })).status, 400);
  });

  it('activates only after the validation API confirms the payment, exactly once', async () => {
    const { accessToken: token } = await newUser();
    const tranId = await checkout(token);
    gateway.validations.set(`VAL-${tranId}`, validFor(tranId));

    // Browser callback and IPN arrive together.
    const [page] = await Promise.all([
      api('/payments/sslcommerz/success', { method: 'POST', form: { tran_id: tranId, val_id: `VAL-${tranId}`, status: 'VALID' } }),
      api('/payments/sslcommerz/ipn', { method: 'POST', form: { tran_id: tranId, val_id: `VAL-${tranId}`, status: 'VALID' } }),
    ]);
    assert.match(page.text, /Payment successful/);
    assert.match(page.text, /tabula:\/\/payment-result\?status=paid&amp;tranId=/);

    const sub = (await api('/subscriptions/me', { token })).body.subscription;
    assert.equal(sub.active, true);
    const days = (new Date(sub.currentPeriodEnd) - Date.now()) / 86_400_000;
    assert.ok(days > 29.9 && days <= 30, `expected one 30-day period, got ${days}`);
  });

  it('stacks a renewal on top of the remaining period', async () => {
    const { accessToken: token } = await newUser();
    for (let i = 0; i < 2; i++) {
      const tranId = await checkout(token);
      gateway.validations.set(`VAL-${tranId}`, validFor(tranId));
      await api('/payments/sslcommerz/ipn', { method: 'POST', form: { tran_id: tranId, val_id: `VAL-${tranId}`, status: 'VALID' } });
    }
    const sub = (await api('/subscriptions/me', { token })).body.subscription;
    const days = (new Date(sub.currentPeriodEnd) - Date.now()) / 86_400_000;
    assert.ok(days > 59.9 && days <= 60, `expected 60 days, got ${days}`);
  });

  it('ignores forged callbacks and mismatched amounts', async () => {
    const { accessToken: token } = await newUser();
    const tranId = await checkout(token);

    // val_id the gateway doesn't recognise.
    await api('/payments/sslcommerz/success', { method: 'POST', form: { tran_id: tranId, val_id: 'FAKE', status: 'VALID' } });
    // A real validation, but for a cheaper amount.
    gateway.validations.set('CHEAP', validFor(tranId, { val_id: 'CHEAP', currency_amount: '1.00', amount: '1.00' }));
    await api('/payments/sslcommerz/ipn', { method: 'POST', form: { tran_id: tranId, val_id: 'CHEAP', status: 'VALID' } });
    // A real validation belonging to a different transaction.
    gateway.validations.set('OTHER', validFor('SOMEONE-ELSE', { val_id: 'OTHER' }));
    await api('/payments/sslcommerz/ipn', { method: 'POST', form: { tran_id: tranId, val_id: 'OTHER', status: 'VALID' } });

    assert.equal((await api('/subscriptions/me', { token })).body.subscription.active, false);
    assert.equal((await api(`/subscriptions/payments/${tranId}`, { token })).body.payment.status, 'PENDING');
  });

  it('holds high-risk payments for review', async () => {
    const { accessToken: token } = await newUser();
    const tranId = await checkout(token);
    gateway.validations.set(`VAL-${tranId}`, validFor(tranId, { risk_level: '1', risk_title: 'Unsafe' }));
    await api('/payments/sslcommerz/ipn', { method: 'POST', form: { tran_id: tranId, val_id: `VAL-${tranId}`, status: 'VALID' } });
    const res = await api(`/subscriptions/payments/${tranId}`, { token });
    assert.equal(res.body.payment.status, 'REVIEW');
    assert.equal(res.body.subscription.active, false);
  });

  it('marks failed and cancelled payments, but a later valid payment still wins', async () => {
    const { accessToken: token } = await newUser();
    const tranId = await checkout(token);
    const page = await api('/payments/sslcommerz/cancel', { method: 'POST', form: { tran_id: tranId } });
    assert.match(page.text, /Payment cancelled/);
    assert.equal((await api(`/subscriptions/payments/${tranId}`, { token })).body.payment.status, 'CANCELLED');

    gateway.validations.set(`VAL-${tranId}`, validFor(tranId));
    await api('/payments/sslcommerz/ipn', { method: 'POST', form: { tran_id: tranId, val_id: `VAL-${tranId}`, status: 'VALID' } });
    assert.equal((await api(`/subscriptions/payments/${tranId}`, { token })).body.payment.status, 'PAID');
  });

  it('reconciles a pending payment by querying SSLCommerz when no callback arrived', async () => {
    const { accessToken: token } = await newUser();
    const tranId = await checkout(token);
    gateway.queries.set(tranId, { APIConnect: 'DONE', no_of_trans_found: 1, element: [{ status: 'VALID', val_id: `VAL-${tranId}`, tran_id: tranId }] });
    gateway.validations.set(`VAL-${tranId}`, validFor(tranId));

    const res = await api(`/subscriptions/payments/${tranId}`, { token });
    assert.equal(res.body.payment.status, 'PAID');
    assert.equal(res.body.subscription.active, true);
  });

  it("does not show another user's payment", async () => {
    const a = await newUser();
    const b = await newUser();
    const tranId = await checkout(a.accessToken);
    assert.equal((await api(`/subscriptions/payments/${tranId}`, { token: b.accessToken })).status, 404);
  });
});
