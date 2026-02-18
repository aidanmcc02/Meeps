/**
 * Generate VAPID keys for Web Push (mention notifications when app is closed).
 * Run: node scripts/generate-vapid-keys.js
 * Add the output to your backend env as VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.
 */
const webpush = require("web-push");

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log("Add these to your backend environment (e.g. Railway or .env):\n");
console.log("VAPID_PUBLIC_KEY=" + publicKey);
console.log("VAPID_PRIVATE_KEY=" + privateKey);
console.log("\nKeep the private key secret. Do not commit it to the repo.");
