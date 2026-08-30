/* A minimal DOM patcher.
   The design is authored as one declarative tree re-derived from state on
   every change; replacing innerHTML wholesale would restart every CSS
   entrance animation on every tick (the chat feed, the lobby chips, the
   vote dots all animate in once and must stay put). This walks the new
   tree against the live one and only touches what actually differs, which
   is what keeps `animation: ... both` playing once per element — the same
   guarantee the prototype got from React's reconciler.

   Nodes are matched by an explicit `data-k` key where one is given, else
   by position. */
(function (global) {
  function keyOf(el) {
    return el.nodeType === 1 ? el.getAttribute('data-k') : null;
  }

  function sameType(a, b) {
    if (a.nodeType !== b.nodeType) return false;
    if (a.nodeType === 1) return a.tagName === b.tagName && keyOf(a) === keyOf(b);
    return true;
  }

  function patchAttrs(live, next) {
    var i, a;
    for (i = next.attributes.length - 1; i >= 0; i--) {
      a = next.attributes[i];
      if (live.getAttribute(a.name) !== a.value) live.setAttribute(a.name, a.value);
    }
    for (i = live.attributes.length - 1; i >= 0; i--) {
      a = live.attributes[i];
      if (!next.hasAttribute(a.name)) live.removeAttribute(a.name);
    }
    // Form controls keep their live value: re-rendering must never wipe
    // what someone is part-way through typing (the join-code field).
    if (live.tagName === 'INPUT' && next.hasAttribute('value')) live.value = next.getAttribute('value');
  }

  function morph(live, next) {
    if (!sameType(live, next)) {
      live.replaceWith(next);
      return;
    }
    if (live.nodeType !== 1) {
      if (live.nodeValue !== next.nodeValue) live.nodeValue = next.nodeValue;
      return;
    }
    patchAttrs(live, next);

    // Snapshot both child lists: they are live NodeLists, and moving a
    // node out of the incoming tree would mutate the list mid-walk.
    var liveKids = Array.prototype.slice.call(live.childNodes);
    var nextKids = Array.prototype.slice.call(next.childNodes);
    var keyed = false, i, k;
    for (i = 0; i < nextKids.length; i++) {
      if (keyOf(nextKids[i])) { keyed = true; break; }
    }
    if (keyed) {
      var pool = {};
      for (i = 0; i < liveKids.length; i++) {
        k = keyOf(liveKids[i]);
        if (k) pool[k] = liveKids[i];
      }
      var out = [];
      for (i = 0; i < nextKids.length; i++) {
        var nk = keyOf(nextKids[i]);
        if (nk && pool[nk]) { morph(pool[nk], nextKids[i]); out.push(pool[nk]); delete pool[nk]; }
        else out.push(nextKids[i]);
      }
      for (i = 0; i < out.length; i++) {
        if (live.childNodes[i] !== out[i]) live.insertBefore(out[i], live.childNodes[i] || null);
      }
      while (live.childNodes.length > out.length) live.removeChild(live.lastChild);
      return;
    }

    var n = Math.min(liveKids.length, nextKids.length);
    for (i = 0; i < n; i++) morph(liveKids[i], nextKids[i]);
    for (i = liveKids.length - 1; i >= nextKids.length; i--) live.removeChild(liveKids[i]);
    for (i = liveKids.length; i < nextKids.length; i++) live.appendChild(nextKids[i]);
  }

  // The game renders as a single root element, so the container always
  // holds exactly one child to patch against.
  global.mafiaMorph = function (container, html) {
    var stage = document.createElement('div');
    stage.innerHTML = html;
    if (!container.firstElementChild) { container.appendChild(stage.firstElementChild); return; }
    morph(container.firstElementChild, stage.firstElementChild);
  };
})(window);
