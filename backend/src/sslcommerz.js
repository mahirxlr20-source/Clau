// Minimal SSLCommerz v4 client: start a payment session, validate a payment,
// and look a transaction up by our own tran_id.
// Endpoints match SSLCommerz's official Node package (sslcommerz-lts).

export class SslCommerzError extends Error {}

export function createSslCommerzClient({ storeId, storePassword, baseUrl }, fetchImpl = globalThis.fetch) {
  const credentials = { store_id: storeId, store_passwd: storePassword };

  async function getJson(path, params) {
    const url = `${baseUrl}${path}?${new URLSearchParams({ ...params, ...credentials, v: '1', format: 'json' })}`;
    const res = await fetchImpl(url, { method: 'GET' });
    if (!res.ok) throw new SslCommerzError(`SSLCommerz ${path} responded HTTP ${res.status}`);
    return res.json();
  }

  return {
    configured: Boolean(storeId && storePassword),

    /** Creates a hosted checkout session. Returns { sessionKey, gatewayUrl }. */
    async initPayment(fields) {
      const res = await fetchImpl(`${baseUrl}/gwprocess/v4/api.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ ...fields, ...credentials }),
      });
      if (!res.ok) throw new SslCommerzError(`SSLCommerz init responded HTTP ${res.status}`);
      const body = await res.json();
      if (body.status !== 'SUCCESS' || !body.GatewayPageURL) {
        throw new SslCommerzError(body.failedreason || 'SSLCommerz could not start the payment session');
      }
      return { sessionKey: body.sessionkey, gatewayUrl: body.GatewayPageURL };
    },

    /** Order Validation API: the authoritative check for a val_id. */
    validate(valId) {
      return getJson('/validator/api/validationserverAPI.php', { val_id: valId });
    },

    /** Transaction query by our tran_id; used to reconcile payments whose callback never arrived. */
    queryByTranId(tranId) {
      return getJson('/validator/api/merchantTransIDvalidationAPI.php', { tran_id: tranId });
    },
  };
}
