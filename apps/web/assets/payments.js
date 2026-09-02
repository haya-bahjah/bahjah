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
      if (!mount) {
        onError('Payment form container not found.');
        return;
      }
      mount.innerHTML = '';
      window.Moyasar.init({
        element: mount,
        amount: config.amount,
        currency: config.currency,
        description: config.description,
        publishable_api_key: config.publishableKey,
        callback_url: config.callbackUrl,
        // Apple Pay rides alongside the card form. The widget validates this
        // block up front -- listing 'applepay' without a complete apple_pay
        // object stops the whole form rendering, card option included -- so
        // the method is only offered when the server actually sent the
        // config for it.
        //
        // On a browser or device without Apple Pay the widget simply does not
        // draw the button; there is nothing to feature-detect here.
        methods: config.applePay ? ['creditcard', 'applepay'] : ['creditcard'],
        ...(config.applePay
          ? {
              apple_pay: {
                country: config.applePay.country,
                label: config.applePay.label,
                validate_merchant_url: config.applePay.validateMerchantUrl,
              },
            }
          : {}),
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
