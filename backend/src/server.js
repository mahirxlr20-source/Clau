import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db.js';
import { createSslCommerzClient } from './sslcommerz.js';

const config = loadConfig();
const db = openDatabase(config.databasePath);
const gateway = createSslCommerzClient(config.sslcommerz);

if (!gateway.configured) {
  console.warn('SSLCommerz credentials are not set; checkout will be disabled.');
}

createApp({ db, config, gateway }).listen(config.port, () => {
  console.log(
    `Clau API on :${config.port} (public ${config.publicBaseUrl}, SSLCommerz ${config.sslcommerz.sandbox ? 'sandbox' : 'LIVE'})`,
  );
});
