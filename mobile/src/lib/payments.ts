import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { api, Payment, Subscription } from './api';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Polls the backend until the payment leaves PENDING (or we give up).
 * The backend asks SSLCommerz directly for pending payments, so this works
 * even if SSLCommerz's callback hasn't reached the server yet.
 */
export async function waitForPayment(tranId: string, attempts = 6) {
  let last: { payment: Payment; subscription: Subscription } | null = null;
  for (let i = 0; i < attempts; i++) {
    last = await api.payment(tranId);
    if (last.payment.status !== 'PENDING') return last;
    await sleep(2000);
  }
  return last!;
}

/**
 * Runs an SSLCommerz checkout:
 *  1. backend creates the payment session and returns the hosted gateway URL,
 *  2. we open it in the system's secure in-app browser,
 *  3. after paying, SSLCommerz sends the browser to our backend, which validates the
 *     payment and redirects to the app's deep link, closing the browser,
 *  4. we ask the backend for the final status (the source of truth).
 */
export async function payWithSslCommerz(planId: string, phone: string) {
  const redirectUrl = Linking.createURL('payment-result');
  const { tranId, gatewayUrl } = await api.checkout(planId, phone, redirectUrl);
  await WebBrowser.openAuthSessionAsync(gatewayUrl, redirectUrl);
  // Whatever the browser result (success, closed by user, ...), the server decides.
  return waitForPayment(tranId);
}
