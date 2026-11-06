# Clau

A cross-platform (Android + iOS) app with user accounts, progress that is saved to the account and restored on any device, and a paid Premium subscription through **SSLCommerz**.

```
mobile/    Expo (React Native) app: Android, iOS (and web)
backend/   Node.js API: accounts, saved progress, SSLCommerz payments (SQLite)
```

## What it does

| Feature | How |
| --- | --- |
| **Accounts** | Email + password (scrypt-hashed). Short-lived access token in memory, long-lived refresh token in the iOS Keychain / Android Keystore (`expo-secure-store`). Refresh tokens rotate and are revoked on sign-out. Users stay signed in across app restarts. |
| **Saved progress** | Each user has one JSON progress document on the server. Every change is cached on the device at once (works offline), then uploaded about 1 second later, when the app goes to the background, and retried every 15 seconds while offline. |
| **Pick up where you left off** | On login the server copy is loaded, including the **last screen** the user was on, which the app reopens. A second device that saves an older copy gets a `409` and takes the newer server copy, so nothing is silently overwritten. |
| **Subscription** | Monthly (৳199) and yearly (৳1,999) Premium plans, paid on SSLCommerz's hosted checkout page in a secure in-app browser. The demo gates unlimited tasks behind Premium (free accounts get 5). |

The demo app is a task list plus notes. Replace it with your own screens: put your state in `mobile/src/progress/model.ts` and call `useProgress().update(...)`.

## Run it locally

Requirements: **Node.js 22.13+**, and the **Expo Go** app on your phone (or an Android emulator / iOS simulator).

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env        # add your SSLCommerz sandbox store id/password
npm run dev                 # http://localhost:4000

# 2. App (new terminal)
cd mobile
npm install
npx expo start              # scan the QR code with Expo Go (Android) or the Camera app (iOS)
```

In development the app calls the backend on port 4000 of the computer running `expo start`, so a phone on the same Wi-Fi works without configuration. To use another server, set `EXPO_PUBLIC_API_URL` (see `mobile/.env.example`).

Tests:

```bash
cd backend && npm test          # accounts, progress, payments (incl. a mock SSLCommerz server)
cd mobile && npx tsc --noEmit   # typecheck
```

## SSLCommerz setup

1. Create a **sandbox store** at <https://developer.sslcommerz.com/registration/>. Put the store ID and password in `backend/.env` (`SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`) and keep `SSLCOMMERZ_SANDBOX=true`.
2. SSLCommerz must be able to reach your backend over the internet. Locally, open a tunnel (for example `ngrok http 4000` or `cloudflared tunnel --url http://localhost:4000`) and set `PUBLIC_BASE_URL` to the tunnel's HTTPS URL.
3. In the SSLCommerz merchant panel, set the **IPN URL** to `PUBLIC_BASE_URL/payments/sslcommerz/ipn`. The backend also sends it with every payment.
4. In the app, open **Upgrade to Premium**, pick a plan, enter a phone number and pay with one of SSLCommerz's sandbox test cards.

### Payment flow

```
App ──POST /subscriptions/checkout──▶ Backend ──init session──▶ SSLCommerz
App ◀── gatewayUrl ──────────────────┘
App opens gatewayUrl in an in-app browser ──▶ customer pays on SSLCommerz
SSLCommerz ──POST success_url (browser)──▶ Backend ──Order Validation API──▶ SSLCommerz
SSLCommerz ──POST ipn_url (server)───────▶ Backend   (same validation; whichever arrives first wins)
Backend page redirects to clau://payment-result ──▶ browser closes ──▶ App asks backend for the status
```

Safeguards in `backend/src/subscriptions.js`:

- **Nothing posted to the callbacks is trusted.** A payment counts only after SSLCommerz's Order Validation API returns `VALID`/`VALIDATED` for the same `tran_id`, amount and currency the backend created.
- **Settled exactly once.** The browser callback and the IPN can arrive at the same moment; a conditional update makes sure the subscription is extended only once.
- **Missed callbacks are recovered.** If the app asks about a payment that is still pending, the backend queries SSLCommerz by `tran_id` and settles it.
- **High-risk payments are held.** Payments SSLCommerz flags `risk_level = 1` are marked `REVIEW` and do not activate Premium until you approve them (`SSLCOMMERZ_HOLD_RISKY=false` turns this off).
- A failed or cancelled callback never overrides a payment that later validates.

### About "subscriptions" on SSLCommerz

SSLCommerz's standard payment API has **no automatic recurring debit**. This app sells **prepaid periods**: each payment adds 30 or 365 days, stacked on any time left. Users renew from the Premium screen. If SSLCommerz enables tokenized or recurring billing on your merchant account, you can add auto-renewal in `backend/src/routes/subscriptions.js`.

Plans and prices are defined in `backend/src/plans.js`. The app reads them from the API.

## API

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `POST /auth/register` `{name,email,password}` | – | Create account → user + tokens |
| `POST /auth/login` `{email,password}` | – | Sign in → user + tokens |
| `POST /auth/refresh` `{refreshToken}` | – | Rotate tokens |
| `POST /auth/logout` `{refreshToken}` | – | Revoke the refresh token |
| `GET /auth/me` | ✓ | User + subscription |
| `GET /progress` | ✓ | `{data, version, updatedAt}` |
| `PUT /progress` `{data, baseVersion}` | ✓ | Save; `409` with the server copy if it is stale |
| `GET /subscriptions/plans` | – | Plan list |
| `GET /subscriptions/me` | ✓ | `{active, planId, currentPeriodEnd}` |
| `POST /subscriptions/checkout` `{planId, phone, appRedirectUrl}` | ✓ | Start an SSLCommerz session → `{tranId, gatewayUrl}` |
| `GET /subscriptions/payments[/:tranId]` | ✓ | Payment history or status (reconciles pending payments) |
| `POST /payments/sslcommerz/{success,fail,cancel,ipn}` | SSLCommerz | Gateway callbacks |

## Building for the stores

The app uses only modules included in Expo Go, so no custom development build is needed while developing. To produce installable apps, use EAS Build (no Xcode or Android Studio required):

```bash
cd mobile
npx eas-cli@latest login
# set EXPO_PUBLIC_API_URL for each profile in eas.json first
npx eas-cli@latest build --platform android --profile preview   # APK to share for testing
npx eas-cli@latest build --platform all --profile production    # store builds
npx eas-cli@latest submit --platform all
```

Change `ios.bundleIdentifier` and `android.package` (`com.clau.app`) in `mobile/app.json` to identifiers you own before your first store build.

## Going live checklist

- [ ] `NODE_ENV=production` and a long random `JWT_SECRET`.
- [ ] Serve the backend over **HTTPS** and set `PUBLIC_BASE_URL` to that address.
- [ ] Switch to your live SSLCommerz store credentials and set `SSLCOMMERZ_SANDBOX=false`.
- [ ] Back up the SQLite file (`DATABASE_PATH`), or move to Postgres if you will run more than one server instance.
- [ ] Check with Apple and Google whether your Premium content may be sold through an external payment gateway in the countries you publish to. Their in-app purchase rules apply to digital content, so some apps must offer, or use instead, the stores' own billing.
