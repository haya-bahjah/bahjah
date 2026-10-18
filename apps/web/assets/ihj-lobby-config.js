// The host's settings on insan-hayawan-jamad-lobby.html (wireframe 5d·03):
// how many rounds, how long to write, which five categories the board is
// ruled with, and the categories players have proposed. Drawn into the
// settings sheet for the host, and summarised on the lobby for everyone.
//
// Exactly five categories, always. The board is five columns wide and a phone
// fits five boxes without scrolling during a timed round, so picking a sixth
// swaps one out rather than adding to it.
//
// Anyone can propose a category. The host approves or rejects it here; an
// approved one becomes one of the room's own categories and is picked. The
// lobby has no push for any of this, so it reads the config again every few
// seconds while the room waits.
(function () {
  const sheet = document.getElementById('ihj-settings');
  const panel = document.getElementById('ihj-config-panel');
  if (!panel || !sheet) return;
  const Ink = window.IhjInk;
  const { esc, t } = Ink;

  const MIN_ROUNDS = 3;
  const MAX_ROUNDS = 8;
  const TIMER_CHOICES = [30, 60, 90];
  const CATEGORY_COUNT = 5;
  const REFRESH_MS = 3000;
  const api = (path) => `/api/games/insan-hayawan-jamad/rooms/${encodeURIComponent(code)}${path}`;

  let code = null;
  let isHost = false;
  let inLobby = false;
  let myId = null;
  let config = null;
  let picked = [];
  let all = [];
  let proposals = [];
  let started = false;
  let saving = 0;
  // Only marks drawn by the tap just made write themselves in; everything
  // else on the sheet is redrawn already finished.
  let freshMark = null;

  // The sheet's body is redrawn on every change; the two "propose" lines are
  // built once, so a refresh never wipes what somebody is typing.
  panel.innerHTML = '<div id="cfg-body"></div><div id="cfg-propose"></div>';
  const body = document.getElementById('cfg-body');
  proposeLine(document.getElementById('cfg-propose'));
  const phonePropose = document.getElementById('phone-propose');
  if (phonePropose) proposeLine(phonePropose);

  document.addEventListener('bahjah:lobby-update', (e) => {
    const detail = e.detail || {};
    code = detail.code;
    isHost = Boolean(detail.isHost);
    myId = detail.me && detail.me.id;
    inLobby = Boolean(detail.room && detail.room.status === 'lobby');
    if (!inLobby) {
      close();
      return;
    }
    if (!started && code) {
      started = true;
      load();
      setInterval(() => {
        if (inLobby && !document.hidden && !saving) load();
      }, REFRESH_MS);
    } else {
      paint();
    }
  });

  document.addEventListener('bahjah:lang-change', () => {
    paint();
    document.querySelectorAll('.ihj-propose').forEach((el) => el.dispatchEvent(new Event('ihj:repaint')));
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('.ihj-open-settings')) open();
    else if (e.target.closest('#ihj-settings-done') || e.target === sheet) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sheet.hidden) close();
  });

  function open() {
    if (!isHost) return;
    freshMark = null;
    paint();
    sheet.hidden = false;
  }

  function close() {
    sheet.hidden = true;
  }

  function headers(json) {
    const token = BahjahSession.getActiveToken();
    return { ...(json ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${token}` };
  }

  function take(data) {
    config = data.config;
    // The server answers with the five that will actually be played, so the
    // sheet shows a real selection even for a room never configured.
    picked = (data.categories || []).map((c) => c.id);
    all = data.allCategories || all;
    proposals = data.proposals || [];
    paint();
  }

  async function load() {
    if (!BahjahSession.getActiveToken()) return;
    try {
      const res = await fetch(api('/config'), { headers: headers() });
      if (res.ok && !saving) take(await res.json());
    } catch {
      // A panel that cannot load is not worth blocking a game over.
    }
  }

  async function send(method, path, payload) {
    saving += 1;
    try {
      const res = await fetch(api(path), { method, headers: headers(true), body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) take(data);
      return { ok: res.ok, data };
    } catch {
      return { ok: false, data: {} };
    } finally {
      saving -= 1;
    }
  }

  function save(next, nextPicked) {
    config = next;
    picked = nextPicked;
    paint();
    send('PATCH', '/config', { rounds: next.rounds, answerSeconds: next.answerSeconds, categoryIds: nextPicked });
  }

  function nameOf(id) {
    return (all.find((c) => c.id === id) || {}).name;
  }

  // The line under the settings on everybody's lobby, and on the television.
  function paintSummary() {
    const rounds = t(`${config.rounds} rounds`, `${Ink.num(config.rounds)} جولات`);
    const secs = t(`${config.answerSeconds} seconds a round`, `${Ink.num(config.answerSeconds)} ثانية للجولة`);
    const line = `${rounds} · ${secs}`;
    const cats = picked.map(nameOf).filter(Boolean).join('، ');
    const phone = document.getElementById('phone-config');
    const phoneCats = document.getElementById('phone-config-cats');
    const tv = document.getElementById('tv-config');
    if (phone) phone.textContent = line;
    if (phoneCats) {
      phoneCats.textContent = cats;
      phoneCats.setAttribute('dir', 'rtl');
    }
    if (tv) tv.textContent = cats ? `${line} · ${cats}` : line;

    // Waiting proposals, counted on the host's Settings button.
    const waiting = proposals.filter((p) => p.status === 'pending').length;
    document.querySelectorAll('.ihj-open-settings').forEach((btn) => {
      btn.textContent = waiting ? `${t('Settings', 'الإعدادات')} · ${Ink.num(waiting)}` : t('Settings', 'الإعدادات');
    });

    // A player's own proposals, and what the host made of them.
    const mine = document.getElementById('phone-proposals');
    if (mine) {
      const list = isHost ? [] : proposals.filter((p) => p.byUserId === myId);
      mine.innerHTML = list
        .map((p) => {
          const status = p.status === 'pending' ? t('waiting for the host', 'بانتظار المضيف') : p.status === 'approved' ? t('in the game ✓', 'في اللعبة ✓') : t('not this time', 'ليس هذه المرة');
          return `<div class="ihj-row ihj-row--split ihj-small"><span class="ihj-ellipsis" style="font-weight:700; font-size:16px;">${esc(p.name)}</span><span class="${p.status === 'rejected' ? '' : 'ihj-red'}">${status}</span></div>`;
        })
        .join('');
    }
  }

  function paint() {
    if (!config) return;
    paintSummary();
    if (!isHost) return;
    const still = (key) => ({ still: freshMark !== key });

    body.innerHTML = `
      <div class="ihj-row ihj-row--2 ihj-title" id="ihj-settings-title">${t('Settings', 'الإعدادات')}</div>
      <div class="ihj-row ihj-row--split" style="font-size:16px;">
        <span>${t('Rounds', 'عدد الجولات')}</span>
        <span dir="ltr" style="display:flex; gap:6px; align-items:baseline; font-weight:700; font-size:18px;">
          <button type="button" class="ihj-tap" data-rounds="${config.rounds - 1}" ${config.rounds <= MIN_ROUNDS ? 'disabled' : ''} aria-label="${t('Fewer rounds', 'جولات أقل')}" style="font-weight:700; font-size:18px;">−</button>
          <span>${Ink.num(config.rounds)}</span>
          <button type="button" class="ihj-tap" data-rounds="${config.rounds + 1}" ${config.rounds >= MAX_ROUNDS ? 'disabled' : ''} aria-label="${t('More rounds', 'جولات أكثر')}" style="font-weight:700; font-size:18px;">+</button>
        </span>
      </div>
      <div class="ihj-row ihj-row--split" style="font-size:16px; padding-bottom:3px;">
        <span style="padding-bottom:3px;">${t('Time per round', 'الوقت لكل جولة')}</span>
        <span dir="ltr" style="display:flex; gap:4px; align-items:center; font-size:15px;">
          ${TIMER_CHOICES.map((s) => `
            <button type="button" class="ihj-tap" data-timer="${s}" style="position:relative; width:40px; height:32px; font-size:15px; font-weight:${config.answerSeconds === s ? 700 : 400};" aria-pressed="${config.answerSeconds === s}">
              ${Ink.num(s)}${config.answerSeconds === s ? Ink.ring(still('timer')) : ''}
            </button>`).join('')}
        </span>
      </div>
      <div class="ihj-row ihj-hand" style="font-size:20px;">${t('Categories', 'الفئات')}</div>
      <div style="display:flex; flex-wrap:wrap; column-gap:18px;" dir="rtl">
        ${all.map((c) => {
          const on = picked.includes(c.id);
          return `
            <button type="button" class="ihj-row" data-category="${esc(c.id)}" aria-pressed="${on}"
                    style="background:none; border:none; padding:0 0 6px; gap:5px; font-size:17px; font-weight:${on ? 500 : 400}; opacity:${on ? 1 : .55};">
              <span style="color:var(--ihj-pen); width:12px;">${on ? '✓' : ''}</span><span>${esc(c.name)}</span>
            </button>`;
        }).join('')}
      </div>
      <div class="ihj-row ihj-small ${picked.length === CATEGORY_COUNT ? '' : 'ihj-red'}">
        ${t(`${picked.length} of 5 — tap one to swap it`, `${Ink.num(picked.length)} من ٥ — اضغط على فئة لاستبدالها`)}
      </div>
      ${proposalRows()}`;

    body.querySelectorAll('[data-rounds]').forEach((btn) =>
      btn.addEventListener('click', () => save({ ...config, rounds: Number(btn.dataset.rounds) }, picked))
    );
    body.querySelectorAll('[data-timer]').forEach((btn) =>
      btn.addEventListener('click', () => {
        freshMark = 'timer';
        save({ ...config, answerSeconds: Number(btn.dataset.timer) }, picked);
      })
    );
    body.querySelectorAll('[data-category]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const id = btn.dataset.category;
        if (picked.includes(id)) {
          // Deselecting leaves four, which is not a board. Held locally until
          // a fifth is chosen rather than sent to the server as an invalid
          // selection.
          picked = picked.filter((c) => c !== id);
          paint();
          return;
        }
        // Already full: the new pick replaces the one chosen longest ago, so
        // a host can keep tapping and always end up with five.
        const next = [...picked, id].slice(-CATEGORY_COUNT);
        if (next.length === CATEGORY_COUNT) save(config, next);
        else {
          picked = next;
          paint();
        }
      })
    );
    body.querySelectorAll('[data-decide]').forEach((btn) =>
      btn.addEventListener('click', () => {
        freshMark = `p:${btn.dataset.proposal}`;
        const approve = btn.dataset.decide === 'yes';
        // Shown decided at once; the server's answer confirms it.
        proposals = proposals.map((p) => (p.id === btn.dataset.proposal ? { ...p, status: approve ? 'approved' : 'rejected' } : p));
        paint();
        send('PATCH', `/proposals/${encodeURIComponent(btn.dataset.proposal)}`, { approve });
      })
    );
  }

  // "Player proposals": each waiting one with Approve / Reject; a decided one
  // keeps its red ring (approved) or cross (rejected), the other choice dimmed.
  function proposalRows() {
    const fromPlayers = proposals.filter((p) => p.byUserId !== myId);
    if (!fromPlayers.length) return '';
    return `
      <div class="ihj-row ihj-hand" style="font-size:18px;">${t('Player proposals', 'اقتراحات اللاعبين')}</div>
      ${fromPlayers
        .map((p) => {
          const yes = p.status === 'approved';
          const no = p.status === 'rejected';
          const decided = yes || no;
          const opts = { still: freshMark !== `p:${p.id}` };
          return `
            <div class="ihj-row ihj-row--split" style="padding-bottom:4px;">
              <span style="display:flex; gap:8px; align-items:baseline; padding-bottom:2px; min-width:0;">
                <span class="ihj-ellipsis" style="font-weight:700; font-size:17px;">${esc(p.name)}</span>
                <span class="ihj-ellipsis" style="font-size:13px;">${esc(t(`by ${p.byName}`, `من ${p.byName}`))}</span>
              </span>
              <span style="display:flex; gap:6px; flex:none;">
                <button type="button" class="ihj-chip" data-decide="yes" data-proposal="${esc(p.id)}" ${decided ? 'disabled' : ''} style="opacity:${no ? 0.45 : 1};">
                  ${t('Approve', 'قبول')}${yes ? Ink.svg(Ink.RING, { style: 'inset:-5px -7px;width:calc(100% + 14px);height:calc(100% + 10px)', ...opts }) : ''}
                </button>
                <button type="button" class="ihj-chip" data-decide="no" data-proposal="${esc(p.id)}" ${decided ? 'disabled' : ''} style="border-radius:7px 10px 8px 11px; opacity:${yes ? 0.45 : 1};">
                  ${t('Reject', 'رفض')}${no ? Ink.cross(opts) : ''}
                </button>
              </span>
            </div>`;
        })
        .join('')}`;
  }

  function proposeError(err) {
    const code = err && err.code;
    if (code === 'ALREADY_PROPOSED') return t('That category is already on the list.', 'هذه الفئة موجودة في القائمة.');
    if (code === 'TOO_MANY_PROPOSALS') return t('Wait for the host to answer your other proposals.', 'انتظر رد المضيف على اقتراحاتك الأخرى.');
    if (code === 'INVALID_STATUS') return t('The game has already started.', 'بدأت اللعبة بالفعل.');
    if (code === 'VALIDATION_ERROR') return t('Use up to 24 letters, without < or >.', 'حتى ٢٤ حرفًا، بلا < أو >.');
    return t('Could not send that — try again.', 'تعذّر الإرسال — حاول مرة أخرى.');
  }

  // "+ Propose a category": a link that turns into a line to write on. The
  // host's own goes straight in; anybody else's waits for the host.
  function proposeLine(mount) {
    mount.classList.add('ihj-propose');
    let writing = false;
    let error = '';
    const draw = () => {
      if (!writing) {
        mount.innerHTML = `
          <button type="button" class="ihj-row" data-propose style="background:none; border:none; padding:0 0 7px; font-size:15px; font-weight:500; color:var(--ihj-link);">${t('+ Propose a category', '+ اقترح فئة')}</button>
          ${error ? `<div class="ihj-row ihj-small ihj-red">${esc(error)}</div>` : ''}`;
        mount.querySelector('[data-propose]').addEventListener('click', () => {
          writing = true;
          error = '';
          draw();
          mount.querySelector('input').focus();
        });
        return;
      }
      mount.innerHTML = `
        <div class="ihj-row" style="padding-bottom:4px;">
          <input type="text" class="ihj-line-input" maxlength="24" dir="auto" autocomplete="off" placeholder="${esc(t('A category, e.g. food', 'فئة، مثلاً: أكلة'))}">
          <button type="button" class="ihj-chip" data-add style="flex:none;">${t('Add', 'أضف')}</button>
        </div>
        ${error ? `<div class="ihj-row ihj-small ihj-red"><span class="ihj-ellipsis">${esc(error)}</span></div>` : ''}`;
      const input = mount.querySelector('input');
      const submit = async () => {
        const name = input.value.trim();
        if (!name) {
          writing = false;
          error = '';
          draw();
          return;
        }
        input.disabled = true;
        const { ok, data } = await send('POST', '/proposals', { name });
        if (ok) {
          writing = false;
          error = '';
        } else {
          error = proposeError(data.error);
        }
        draw();
        if (!ok) {
          const again = mount.querySelector('input');
          if (again) {
            again.value = name;
            again.focus();
          }
        }
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
        if (e.key === 'Escape') {
          writing = false;
          draw();
        }
      });
      mount.querySelector('[data-add]').addEventListener('click', submit);
    };
    mount.addEventListener('ihj:repaint', () => {
      if (!writing) draw();
    });
    draw();
  }
})();
