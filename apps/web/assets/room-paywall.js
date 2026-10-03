// The locked-room paywall: a Day Pass checkout laid over a game lobby.
//
// A host without a Day Pass can still open a room (POST /api/rooms is not
// gated -- see apps/server/src/modules/rooms/routes.ts), but the lobby they
// land in is locked: the room code, QR and copy-link are hidden, the page
// behind is greyed out and inert, and the only thing on it is the checkout.
// Paying unlocks the room in place. The server is what actually enforces
// this -- a locked room cannot start a game (assertHostMayStart) -- so this
// file is the way to pay, not the lock itself.
//
// Apple Pay first: on a device that can use it, the checkout is the single
// Apple Pay button, with the card form one tap away. Everywhere else the card
// form is shown straight away.
//
// Loaded on demand by assets/lobby-room.js and the Mafia live engine, and it
// loads assets/payments.js itself if the page has not, so no lobby page needs
// its own script tag for either.
//
//   BahjahRoomPaywall.lock({ returnPath, onUnlock(user) })
//   BahjahRoomPaywall.unlock()
//   BahjahRoomPaywall.isLocked()
(function (global) {
  'use strict';
  if (global.BahjahRoomPaywall) return;

  var STYLE_ID = 'room-paywall-style';
  var CSS = [
    // Belt and braces under the blur: the code and QR are not just
    // unreadable, they are not drawn at all while the room is locked.
    'html.room-locked .room-code-text, html.room-locked #room-qr, html.room-locked #copy-link-btn,',
    'html.room-locked .mf-jc, html.room-locked .mf-code, html.room-locked .mf-qr-plate{ visibility:hidden !important; }',
    '.rpw{ position:fixed; inset:0; z-index:2000; display:flex; align-items:center; justify-content:center; padding:20px;',
    '  background:rgba(8,9,14,.62); -webkit-backdrop-filter:blur(14px) grayscale(.7); backdrop-filter:blur(14px) grayscale(.7);',
    '  overflow-y:auto; }',
    '.rpw-panel{ box-sizing:border-box; width:100%; max-width:400px; margin:auto; text-align:center;',
    '  background:var(--surface-card,#1B1B26); color:var(--text-primary,#F4F4F8);',
    '  border:1px solid var(--border-subtle,rgba(255,255,255,.1)); border-top:2px solid var(--pixel-green,#39FF88);',
    '  border-radius:var(--radius-lg,16px); box-shadow:var(--shadow-card,0 4px 24px rgba(0,0,0,.45)); padding:28px 24px 22px; }',
    '.rpw-lock{ width:44px; height:44px; margin:0 auto 14px; border-radius:50%; display:flex; align-items:center; justify-content:center;',
    '  background:color-mix(in srgb, var(--pixel-green,#39FF88) 14%, transparent); color:var(--pixel-green,#39FF88); }',
    '.rpw-title{ margin:0; font-family:var(--font-display,system-ui); font-size:22px; font-weight:700; line-height:1.2; }',
    '.rpw-body{ margin:10px auto 0; max-width:320px; font-size:14px; line-height:1.55; color:var(--text-secondary,#A9A9BC); }',
    '.rpw-price{ margin:18px 0 16px; display:flex; align-items:baseline; justify-content:center; gap:8px; flex-wrap:wrap; }',
    '.rpw-amount{ font-family:var(--font-display,system-ui); font-size:30px; font-weight:800; }',
    '.rpw-per{ font-size:13px; font-weight:700; color:var(--text-muted,#8A8A9E); }',
    '.rpw-mount{ min-height:52px; font-size:13px; color:var(--text-muted,#8A8A9E); text-align:start; }',
    '.rpw-mount[data-tone="error"]{ color:var(--danger,#FF2DA6); text-align:center; }',
    '.rpw-links{ margin-top:16px; display:flex; flex-direction:column; gap:10px; align-items:center; font-size:13px; }',
    '.rpw-links button{ background:none; border:0; padding:0; font:inherit; cursor:pointer; color:var(--cyber-cyan,#22D3EE); text-decoration:underline; }',
    '.rpw-links a{ color:var(--text-muted,#8A8A9E); text-decoration:underline; }',
    '.rpw-links a:hover, .rpw-links button:hover{ color:var(--text-primary,#F4F4F8); }',
  ].join('\n');

  var T = {
    title: { en: 'Unlock this room', ar: 'افتح الغرفة' },
    body: {
      en: 'Get a Day Pass to show the room code and start playing.',
      ar: 'احصل على تذكرة يومية لإظهار رمز الغرفة وبدء اللعب.',
    },
    per: { en: function (h) { return h + '-hour access'; }, ar: function (h) { return 'لعب لمدة ' + arNum(h) + ' ساعة'; } },
    loading: { en: 'Loading payment…', ar: 'جارٍ تحميل الدفع…' },
    loadFailed: { en: 'Could not load the payment form.', ar: 'تعذّر تحميل نموذج الدفع.' },
    useCard: { en: 'Pay with card instead', ar: 'الدفع بالبطاقة بدلاً من ذلك' },
    settings: { en: 'Promo code or other plans', ar: 'رمز ترويجي أو باقات أخرى' },
    home: { en: 'Back to home', ar: 'العودة إلى الرئيسية' },
    paid: { en: 'Payment successful!', ar: 'تمت عملية الدفع بنجاح!' },
  };

  var AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  function arNum(n) { return String(n).replace(/\d/g, function (d) { return AR_DIGITS[Number(d)]; }); }
  function lang() { return document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en'; }
  function t(key) { return T[key][lang()]; }

  // Halalas to "15 SAR" / "١٥ ر.س", the way the rest of the site writes it.
  function sar(halalas) {
    var n = halalas / 100;
    var s = n % 1 === 0 ? String(n) : n.toFixed(2).replace(/0$/, '');
    return lang() === 'ar' ? arNum(s).replace('.', '٫') + ' ر.س' : s + ' SAR';
  }

  // session.js and payments.js declare their globals with const, so they are
  // global bindings but not window properties -- typeof is the way to ask.
  function session() { return typeof BahjahSession !== 'undefined' ? BahjahSession : null; }
  function payments() { return typeof BahjahPayments !== 'undefined' ? BahjahPayments : null; }

  var paymentsPromise = null;
  function loadPayments() {
    if (payments()) return Promise.resolve(payments());
    if (!paymentsPromise) {
      paymentsPromise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = '/assets/payments.js';
        s.onload = function () { payments() ? resolve(payments()) : reject(new Error('load-failed')); };
        s.onerror = function () { reject(new Error('load-failed')); };
        document.head.appendChild(s);
      });
    }
    return paymentsPromise;
  }

  // The live Day Pass price, from the same public endpoint the storefront
  // checks itself against. Falls back to the list price if it cannot be read
  // -- the checkout itself is priced by the server regardless.
  var plan = { amount: 1500, durationDays: 1 };
  var planPromise = null;
  function loadPlan() {
    if (!planPromise) {
      planPromise = fetch('/api/payments/plans')
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var p = (d.plans || []).filter(function (x) { return x.id === 'day_pass'; })[0];
          if (p) plan = { amount: p.amount, durationDays: p.durationDays || 1 };
        })
        .catch(function () {});
    }
    return planPromise;
  }

  var state = null; // { overlay, opts, method, hidden: [elements made inert] }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  var LOCK_SVG =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

  function paint() {
    if (!state) return;
    var o = state.overlay;
    o.querySelector('.rpw-title').textContent = t('title');
    o.querySelector('.rpw-body').textContent = t('body');
    o.querySelector('.rpw-amount').textContent = sar(plan.amount);
    o.querySelector('.rpw-per').textContent = T.per[lang()](plan.durationDays * 24);
    var card = o.querySelector('.rpw-card');
    card.textContent = t('useCard');
    card.hidden = state.method !== 'applepay';
    o.querySelector('.rpw-settings').textContent = t('settings');
    o.querySelector('.rpw-home').textContent = t('home');
    var mount = o.querySelector('.rpw-mount');
    if (mount.getAttribute('data-state') === 'loading') mount.textContent = t('loading');
    o.setAttribute('dir', lang() === 'ar' ? 'rtl' : 'ltr');
  }

  function startCheckout() {
    // A fresh container every time: the Moyasar widget will not draw a second
    // form into an element it has already mounted on, which is what switching
    // from Apple Pay to the card form would otherwise ask it to do.
    var old = state.overlay.querySelector('.rpw-mount');
    var mount = document.createElement('div');
    mount.className = 'rpw-mount';
    old.replaceWith(mount);
    mount.setAttribute('data-state', 'loading');
    mount.removeAttribute('data-tone');
    mount.textContent = t('loading');
    var S = session();
    var token = S && S.getToken();
    // A card's 3-D Secure step leaves this page for the bank and comes back
    // through billing-callback.html, which reads this to send the host back
    // to the room instead of to Settings.
    try { sessionStorage.setItem('bahjah_pay_return', state.opts.returnPath); } catch (e) {}
    var current = state;
    loadPayments()
      .then(function (P) {
        if (state !== current) return;
        P.startCheckout('day_pass', {
          selector: '.rpw-mount',
          token: token,
          methods: [state.method],
          onSuccess: function (user) {
            try { sessionStorage.removeItem('bahjah_pay_return'); } catch (e) {}
            if (S && token) S.save(token, user);
            var cb = state && state.opts.onUnlock;
            unlock();
            toast(t('paid'));
            if (cb) cb(user);
          },
          onError: function (message) {
            if (state !== current) return;
            mount.removeAttribute('data-state');
            mount.setAttribute('data-tone', 'error');
            mount.textContent = message || t('loadFailed');
          },
        });
        mount.removeAttribute('data-state');
      })
      .catch(function () {
        if (state !== current) return;
        mount.removeAttribute('data-state');
        mount.setAttribute('data-tone', 'error');
        mount.textContent = t('loadFailed');
      });
  }

  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  function lock(opts) {
    opts = opts || {};
    if (state) { state.opts = Object.assign(state.opts, opts); return; }
    ensureStyle();
    document.documentElement.classList.add('room-locked');

    var overlay = document.createElement('div');
    overlay.className = 'rpw';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'rpw-title');
    overlay.innerHTML =
      '<div class="rpw-panel">' +
      '<div class="rpw-lock">' + LOCK_SVG + '</div>' +
      '<h2 class="rpw-title" id="rpw-title"></h2>' +
      '<p class="rpw-body"></p>' +
      '<div class="rpw-price"><span class="rpw-amount"></span><span class="rpw-per"></span></div>' +
      '<div class="rpw-mount" data-state="loading"></div>' +
      '<div class="rpw-links">' +
      '<button type="button" class="rpw-card"></button>' +
      '<a class="rpw-settings" href="/settings.html"></a>' +
      '<a class="rpw-home" href="/bahjah-landing.html"></a>' +
      '</div></div>';

    // Everything else on the page goes inert -- no tabbing to a hidden code,
    // no pressing Start through the blur.
    var hidden = [];
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el.tagName === 'SCRIPT' || el.id === 'toast' || el.closest('.toast')) return;
      if (!el.inert) { el.inert = true; hidden.push(el); }
    });
    document.body.appendChild(overlay);

    var appleOk = false;
    var P = payments();
    if (P && P.canUseApplePay) appleOk = P.canUseApplePay();
    else {
      try { appleOk = Boolean(global.ApplePaySession && global.ApplePaySession.canMakePayments()); } catch (e) {}
    }

    state = {
      overlay: overlay,
      opts: Object.assign({ returnPath: defaultReturnPath() }, opts),
      method: appleOk ? 'applepay' : 'creditcard',
      hidden: hidden,
    };

    overlay.querySelector('.rpw-card').addEventListener('click', function () {
      state.method = 'creditcard';
      paint();
      startCheckout();
    });

    paint();
    loadPlan().then(paint);
    startCheckout();
  }

  function unlock() {
    if (!state) return;
    state.overlay.remove();
    state.hidden.forEach(function (el) { el.inert = false; });
    document.documentElement.classList.remove('room-locked');
    state = null;
  }

  function defaultReturnPath() {
    return location.pathname.replace(/^\//, '') + location.search;
  }

  // The lobby pages switch language without a reload, by flipping <html lang>.
  new MutationObserver(function () { paint(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  global.BahjahRoomPaywall = {
    lock: lock,
    unlock: unlock,
    isLocked: function () { return Boolean(state); },
  };
})(window);
