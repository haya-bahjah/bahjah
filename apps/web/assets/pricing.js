// What a plan costs, for anything in the browser that shows a price.
//
// MIRRORS apps/server/src/modules/payments/plans.ts. The server is the
// authority -- it is the only thing that ever tells Moyasar an amount, and it
// prices a checkout from its own clock -- but a marketing page should not
// have to wait on a request to paint a number, so the figures are duplicated
// here and the copy is kept honest two ways:
//
//   1. sync() fetches GET /api/payments/plans (public, no auth) and corrects
//      these values if they have drifted, firing 'bahjah:pricing' so whatever
//      is on screen can redraw.
//   2. Nothing else in apps/web hardcodes a riyal figure. If you change a
//      price, change it in plans.ts and here, and every surface follows.
//
// The reason for the belt and braces: the Saudi National Day band shipped
// advertising 9.6 riyals while checkout still charged 15, and nothing in the
// codebase could notice.
(function () {
  'use strict';

  // Halalas, exactly as the server states them.
  var OFFERS = {
    snd_2026: {
      id: 'snd_2026',
      amount: 960,
      // Riyadh time, both bounds -- startsAt inclusive, endsAt exclusive, so
      // the last checkout at the offer price is 23:59:59 on 27 Sep 2026.
      startsAt: '2026-09-12T00:00:00+03:00',
      endsAt: '2026-09-28T00:00:00+03:00',
      label: { en: 'National Day offer', ar: 'عرض اليوم الوطني' },
    },
  };

  var PLANS = {
    day_pass: { amount: 1500, offer: OFFERS.snd_2026 },
    monthly: { amount: 15000, offer: null },
    test_50sar: { amount: 5000, offer: null },
    test_150sar: { amount: 15000, offer: null },
  };

  // Which plan ids the server actually offers, once it has said so. null
  // until the first successful sync -- the difference matters: "not asked
  // yet" is not "offered", and a surface that shows a plan optimistically
  // would flash a staging rehearsal card on a customer's screen before
  // taking it away again.
  var offered = null;

  // Filled by priceFor() below and replaced wholesale by sync().
  var live = {};

  function offerRunning(offer, now) {
    if (!offer) return false;
    var t = (now || new Date()).getTime();
    return t >= Date.parse(offer.startsAt) && t < Date.parse(offer.endsAt);
  }

  function priceFor(id, now) {
    if (live[id]) return live[id];
    var plan = PLANS[id];
    if (!plan) return null;
    var offer = offerRunning(plan.offer, now) ? plan.offer : null;
    return { amount: offer ? offer.amount : plan.amount, listAmount: plan.amount, offer: offer };
  }

  var AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

  // Halalas to a riyal figure a person would say out loud: 1500 -> "15",
  // 960 -> "9.6". Arabic gets Arabic-Indic digits, matching the numerals
  // already used across the site, but keeps the full stop as the decimal
  // mark. The formally correct Arabic separator is U+066B, which draws as a
  // comma and was read as one -- "٩٫٦" looked like two numbers, not nine
  // point six. A dot is what the price says in both languages.
  function sar(halalas, lang) {
    var riyals = halalas / 100;
    var s = Number.isInteger(riyals) ? String(riyals) : riyals.toFixed(2).replace(/0+$/, '');
    if (lang !== 'ar') return s;
    return s.replace(/\d/g, function (d) { return AR_DIGITS[Number(d)]; });
  }

  // The last day the offer price is available, named in Riyadh time so the
  // date on the badge is the date in the window, not the viewer's date.
  function offerEndsText(offer, lang) {
    if (!offer) return '';
    var last = new Date(Date.parse(offer.endsAt) - 1);
    var day;
    try {
      day = last.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB', {
        day: 'numeric', month: 'short', timeZone: 'Asia/Riyadh', calendar: 'gregory',
      });
    } catch (e) {
      // An engine without full ICU still has to say something truthful.
      day = last.toISOString().slice(0, 10);
    }
    return lang === 'ar' ? 'حتى ' + day : 'ends ' + day;
  }

  // "National Day offer · ends 27 Sep" -- the whole badge, in one string.
  function offerBadge(offer, lang) {
    if (!offer) return '';
    var name = offer.label[lang === 'ar' ? 'ar' : 'en'];
    return name + ' · ' + offerEndsText(offer, lang);
  }

  // Ask the server what it is really charging. Silent on failure: the baked-in
  // figures are already on screen and are correct unless someone has changed
  // the server without changing this file.
  function sync() {
    return fetch('/api/payments/plans')
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (body) {
        if (!body || !Array.isArray(body.plans)) return;
        var changed = false;
        var ids = body.plans.map(function (p) { return p.id; }).filter(Boolean);
        if (!offered || offered.join(',') !== ids.join(',')) changed = true;
        offered = ids;
        body.plans.forEach(function (p) {
          if (!p || typeof p.amount !== 'number') return;
          var before = priceFor(p.id);
          var next = {
            amount: p.amount,
            listAmount: typeof p.listAmount === 'number' ? p.listAmount : p.amount,
            offer: p.offer || null,
          };
          if (!before || before.amount !== next.amount || before.listAmount !== next.listAmount
              || Boolean(before.offer) !== Boolean(next.offer)) {
            changed = true;
          }
          live[p.id] = next;
        });
        if (changed) document.dispatchEvent(new CustomEvent('bahjah:pricing'));
      })
      .catch(function () { /* offline, or the API is down -- keep what we have */ });
  }

  // A tab left open across the moment an offer opens or closes would go on
  // quoting the old price while the server had already moved on -- and the
  // server is what the card is actually charged. Two cheap guards: re-check
  // when the tab comes back to the foreground, and, when a boundary is near
  // enough to fall inside one sitting, set a timer for the boundary itself.
  function nextBoundary(now) {
    var t = (now || new Date()).getTime();
    var soonest = null;
    Object.keys(PLANS).forEach(function (id) {
      var offer = PLANS[id].offer;
      if (!offer) return;
      [Date.parse(offer.startsAt), Date.parse(offer.endsAt)].forEach(function (at) {
        if (at > t && (soonest === null || at < soonest)) soonest = at;
      });
    });
    return soonest;
  }

  function armBoundaryTimer() {
    var at = nextBoundary();
    // setTimeout tops out around 24 days; a day's horizon is well inside it
    // and keeps idle tabs from holding a timer for a campaign months away.
    if (at === null || at - Date.now() > 24 * 60 * 60 * 1000) return;
    setTimeout(function () {
      live = {};          // recompute from the window, then confirm with the server
      document.dispatchEvent(new CustomEvent('bahjah:pricing'));
      sync();
      armBoundaryTimer();
    }, Math.max(1000, at - Date.now() + 1000));
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) sync();
  });

  // The ids GET /api/payments/plans listed, or null if it has not answered
  // yet. That endpoint returns only what is purchasable, so this is the
  // authority on what a storefront may show -- see the ENABLE_TEST_PLANS
  // note in the server's plans.ts for why a client must not decide that for
  // itself.
  function offeredIds() {
    return offered ? offered.slice() : null;
  }

  window.BahjahPricing = {
    priceFor: priceFor,
    offeredIds: offeredIds,
    sar: sar,
    offerBadge: offerBadge,
    offerEndsText: offerEndsText,
    sync: sync,
  };

  sync();
  armBoundaryTimer();
})();
