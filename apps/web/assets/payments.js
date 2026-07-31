// Shared Moyasar checkout helper. Loads the moyasar.js widget from Moyasar's
// CDN on demand (only pages that actually show a payment form pay that
// load cost) and wraps the checkout -> confirm round trip so callers just
// hand it a plan id, a mount point, and success/failure callbacks.
//
// The widget itself talks straight to Moyasar with the publishable key --
// our server never sees card details. What our server *does* control is
// the amount (via /api/payments/checkout, keyed only by plan id) and the
// final reconciliation (via /api/payments/confirm, which re-fetches the
// payment from Moyasar by id rather than trusting anything the browser says).
const BahjahPayments = (() => {
  const CDN_JS = 'https://cdn.moyasar.com/mpf/1.16.0/moyasar.js';
  const CDN_CSS = 'https://cdn.moyasar.com/mpf/1.16.0/moyasar.css';
  let assetsPromise = null;

  function loadWidgetAssets() {
    if (assetsPromise) return assetsPromise;
    assetsPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-moyasar-css]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = CDN_CSS;
        link.setAttribute('data-moyasar-css', '1');
        document.head.appendChild(link);
      }
      if (window.Moyasar) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = CDN_JS;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('load-failed'));
      document.head.appendChild(script);
    });
    return assetsPromise;
  }

  async function confirmPayment(token, paymentId) {
    const res = await fetch('/api/payments/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ paymentId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'confirm-failed');
    return data; // { status, user }
  }

  // selector: CSS selector for an (empty) container element already in the
  // DOM -- the widget renders its own form markup inside it.
  async function startCheckout(planId, { selector, token, onSuccess, onError }) {
    try {
      const checkoutRes = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: planId }),
      });
      const config = await checkoutRes.json();
      if (!checkoutRes.ok) {
        onError(config.error?.message || 'Could not start checkout.');
        return;
      }
      await loadWidgetAssets();
      const mount = document.querySelector(selector);
      if (mount) mount.innerHTML = '';
      window.Moyasar.init({
        element: selector,
        amount: config.amount,
        currency: config.currency,
        description: config.description,
        publishable_api_key: config.publishableKey,
        callback_url: config.callbackUrl,
        // Apple Pay requires additional config (label, validateMerchantURL,
        // country) that the current moyasar.js widget validates up front --
        // without it, listing 'applepay' here blocks the whole widget from
        // rendering, card option included. Card-only until that's set up.
        methods: ['creditcard'],
        metadata: config.metadata,
        save_card: config.saveCard,
        on_completed: async (payment) => {
          try {
            const result = await confirmPayment(token, payment.id);
            if (result.status === 'paid') {
              onSuccess(result.user);
            } else {
              onError('Payment did not complete.');
            }
          } catch (err) {
            onError(err.message === 'confirm-failed' ? 'Could not confirm payment.' : 'Network error confirming payment.');
          }
        },
      });
    } catch (err) {
      onError(err.message === 'load-failed' ? 'Could not load the payment form.' : 'Network error — please try again.');
    }
  }

  return { startCheckout, confirmPayment };
})();
