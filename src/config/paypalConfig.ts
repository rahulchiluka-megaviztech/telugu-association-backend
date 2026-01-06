import paypal from '@paypal/checkout-server-sdk';

/**
 * PayPal SDK Configuration
 * Uses environment variables to determine sandbox vs production mode
 */

// Configure PayPal environment
function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID as string;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET as string;
  const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials are not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env');
  }

  // Determine if sandbox or production based on base URL
  const isSandbox = baseUrl.includes('sandbox');

  if (isSandbox) {
    return new paypal.core.SandboxEnvironment(clientId, clientSecret);
  } else {
    return new paypal.core.LiveEnvironment(clientId, clientSecret);
  }
}

// Create and export PayPal client
export function getPayPalClient() {
  return new paypal.core.PayPalHttpClient(environment());
}
