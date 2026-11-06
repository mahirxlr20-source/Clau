import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, it } from 'node:test';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db.js';
import { createSslCommerzClient } from '../src/sslcommerz.js';

// A stand-in for sandbox.sslcommerz.com that speaks the same HTTP API, so the real
// client code (request encoding, URLs, response parsing) is exercised end to end.
const seen = { init: null, validate: null };
const sessions = new Map(); // tran_id -> amount

const fakeGateway = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (body) => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body));
  if (req.method === 'POST' && url.pathname === '/gwprocess/v4/api.php') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const form = Object.fromEntries(new URLSearchParams(raw));
    seen.init = { contentType: req.headers['content-type'], form };
    if (form.store_passwd !== 'secret') return json({ status: 'FAILED', failedreason: 'Store Credential Error' });
    sessions.set(form.tran_id, form.total_amount);
    return json({ status: 'SUCCESS', sessionkey: 'SK1', GatewayPageURL: `https://gw.test/pay/${form.tran_id}` });
  }
  if (url.pathname === '/validator/api/validationserverAPI.php') {
    seen.validate = Object.fromEntries(url.searchParams);
    const tranId = url.searchParams.get('val_id').replace(/^VAL-/, '');
    if (!sessions.has(tranId)) return json({ status: 'INVALID_TRANSACTION' });
    return json({
      status: 'VALID',
      tran_id: tranId,
      val_id: `VAL-${tranId}`,
      amount: sessions.get(tranId),
      currency: 'BDT',
      currency_type: 'BDT',
      currency_amount: sessions.get(tranId),
      risk_level: '0',
    });
  }
  res.writeHead(404).end();
});

let api;
let gatewayUrl;
let server;

before(async () => {
  await new Promise((r) => fakeGateway.listen(0, r));
  gatewayUrl = `http://127.0.0.1:${fakeGateway.address().port}`;
  const config = loadConfig({ JWT_SECRET: 't', PUBLIC_BASE_URL: 'https://api.test' });
  const gateway = createSslCommerzClient({ storeId: 'store1', storePassword: 'secret', baseUrl: gatewayUrl });
  server = createApp({ db: openDatabase(':memory:'), config, gateway }).listen(0);
  await new Promise((r) => server.once('listening', r));
  api = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  fakeGateway.close();
});

it('runs a full checkout through the real SSLCommerz client', async () => {
  const reg = await fetch(`${api}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'pay@example.com', name: 'Payer', password: 'password123' }),
  }).then((r) => r.json());
  const auth = { authorization: `Bearer ${reg.accessToken}`, 'content-type': 'application/json' };

  const checkout = await fetch(`${api}/subscriptions/checkout`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ planId: 'yearly', phone: '01711111111', appRedirectUrl: 'tabula://payment-result' }),
  }).then((r) => r.json());
  assert.match(checkout.gatewayUrl, /^https:\/\/gw\.test\/pay\//);
  assert.equal(seen.init.contentType, 'application/x-www-form-urlencoded');
  assert.equal(seen.init.form.store_id, 'store1');
  assert.equal(seen.init.form.total_amount, '1999.00');
  assert.equal(seen.init.form.product_profile, 'non-physical-goods');

  // The customer's browser is sent to success_url with a form POST.
  const page = await fetch(`${api}/payments/sslcommerz/success`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ tran_id: checkout.tranId, val_id: `VAL-${checkout.tranId}`, status: 'VALID' }),
  }).then((r) => r.text());
  assert.match(page, /Payment successful/);
  assert.equal(seen.validate.store_id, 'store1');
  assert.equal(seen.validate.format, 'json');

  const status = await fetch(`${api}/subscriptions/payments/${checkout.tranId}`, { headers: auth }).then((r) => r.json());
  assert.equal(status.payment.status, 'PAID');
  assert.equal(status.subscription.active, true);
  assert.equal(status.subscription.planId, 'yearly');
});

it('surfaces gateway errors from session init', async () => {
  const client = createSslCommerzClient({ storeId: 'store1', storePassword: 'wrong', baseUrl: gatewayUrl });
  await assert.rejects(client.initPayment({ tran_id: 'X', total_amount: '1' }), /Store Credential Error/);
});
