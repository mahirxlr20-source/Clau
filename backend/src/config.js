// Central configuration, read from environment variables (see .env.example).

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function list(value, fallback) {
  if (!value) return fallback;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadConfig(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';
  const jwtSecret = env.JWT_SECRET || (isProduction ? '' : 'dev-only-insecure-secret-change-me');
  if (!jwtSecret) {
    throw new Error('JWT_SECRET must be set in production');
  }

  const sandbox = bool(env.SSLCOMMERZ_SANDBOX, true);
  const port = Number(env.PORT || 4000);

  return {
    isProduction,
    port,
    databasePath: env.DATABASE_PATH || './data/clau.db',
    // Public URL SSLCommerz (and the phone's browser) can reach, e.g. https://api.example.com
    publicBaseUrl: (env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/+$/, ''),
    jwtSecret,
    accessTokenTtl: env.ACCESS_TOKEN_TTL || '15m',
    refreshTokenTtlDays: Number(env.REFRESH_TOKEN_TTL_DAYS || 60),
    maxProgressBytes: Number(env.MAX_PROGRESS_BYTES || 256 * 1024),
    // Only needed for the web build; native apps don't send CORS requests.
    corsOrigins: list(env.CORS_ORIGINS, []),
    // Where the payment result page may send the user back to (the app's deep link scheme).
    appRedirectPrefixes: list(env.APP_REDIRECT_PREFIXES, ['clau://', 'exp://', 'exps://']),
    sslcommerz: {
      storeId: env.SSLCOMMERZ_STORE_ID || '',
      storePassword: env.SSLCOMMERZ_STORE_PASSWORD || '',
      sandbox,
      baseUrl: sandbox ? 'https://sandbox.sslcommerz.com' : 'https://securepay.sslcommerz.com',
      // Payments SSLCommerz flags as high risk (risk_level = 1) are held for manual review
      // instead of activating the subscription automatically.
      holdRiskyPayments: bool(env.SSLCOMMERZ_HOLD_RISKY, true),
      defaults: {
        address: env.CUSTOMER_DEFAULT_ADDRESS || 'N/A',
        city: env.CUSTOMER_DEFAULT_CITY || 'Dhaka',
        postcode: env.CUSTOMER_DEFAULT_POSTCODE || '1000',
        country: env.CUSTOMER_DEFAULT_COUNTRY || 'Bangladesh',
      },
    },
  };
}
