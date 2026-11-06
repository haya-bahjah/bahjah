// The host's settings on fabrication-lobby.html: how many rounds, how long
// players have to write their lie, and which language. Deliberately small --
// the setup should stay light so a host can start quickly. (Categories and
// difficulty are gone: questions are dealt at random from the whole bank,
// and never repeat within a room -- see dealFabricationQuestions.)
//
// The page has a settings slot in each of its layouts (the television and the
// phone), marked .fab-config; every one of them is painted, and only the one
// in the layout on screen is visible. Everyone else in the room sees the same
// settings read-only in .fab-config-readonly, so a player can tell what they
// are about to play without being able to change it. .fab-estimate gets the
// "6 rounds · about 20 minutes" line.
//
// The game's language is the host's choice here too: English or Arabic, for
// every question, the real answer on the board and the reveal. It starts as
// the language the host's screen is in, and after that only the host's pick
// changes it (switching the screen's language does not). It is locked when
// the game starts: the server only takes config changes in the lobby.
(function () {
  const U = window.FabUI;
  const t = U.t;
  const esc = U.esc;

  const ROUND_CHOICES = [3, 4, 5, 6, 7, 8];
  // The writing timer's choices, in seconds (WRITE_SECONDS_CHOICES on the
  // server). 60 is the default.
  const TIMER_CHOICES = [45, 60, 90];
  const timerOf = (c) => (c && TIMER_CHOICES.includes(c.writeSeconds) ? c.writeSeconds : 60);
  // Each language is named in itself, so a host can find theirs whichever
  // language the screen is in.
  const LANGUAGES = [
    { id: 'en', label: 'English' },
    { id: 'ar', label: 'العربية' },
  ];
  // A round is 15s reading, the writing timer, up to 30s voting and the
  // reveal at the room's own pace: about 140s plus the timer in practice.
  const minutesPerRound = (c) => (timerOf(c) + 140) / 60;

  let code = null;
  let isHost = false;
  let inLobby = false;
  let config = null;
  let poolSize = 0;
  let loaded = false;

  const panels = () => document.querySelectorAll('.fab-config');
  const readonlys = () => document.querySelectorAll('.fab-config-readonly');

  // The server announces every saved change to the room (the config PATCH
  // route emits fabrication:config), so the players' read-only summary and
  // any second host screen follow the host's picks live.
  let listeningOn = null;
  function listen(socket) {
    if (!socket || socket === listeningOn || typeof socket.on !== 'function') return;
    listeningOn = socket;
    socket.on('fabrication:config', (payload) => {
      if (!payload || !payload.config) return;
      config = payload.config;
      poolSize = payload.poolSize || 0;
      paint();
    });
  }

  document.addEventListener('bahjah:lobby-update', (e) => {
    const detail = e.detail || {};
    listen(detail.socket);
    code = detail.code;
    isHost = Boolean(detail.isHost);
    // Only in the lobby: once the game starts the console takes the screen.
    inLobby = Boolean(detail.room && detail.room.status === 'lobby');
    if (inLobby && !loaded && code) {
      loaded = true;
      load();
    } else {
      paint();
    }
  });

  document.addEventListener('bahjah:lang-change', paint);

  async function load() {
    const token = BahjahSession.getActiveToken();
    if (!token) return;
    try {
      const cfgRes = await fetch(`/api/games/fabrication/rooms/${encodeURIComponent(code)}/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (cfgRes.ok) {
        const data = await cfgRes.json();
        config = data.config;
        poolSize = data.poolSize || 0;
      }
      defaultLanguage();
      paint();
    } catch {
      // A settings panel that cannot load is not worth blocking a game over:
      // the server falls back to sensible defaults if nothing is ever saved.
    }
  }

  async function save(next) {
    const token = BahjahSession.getActiveToken();
    if (!token || !code) return;
    config = next;
    paint();
    try {
      const res = await fetch(`/api/games/fabrication/rooms/${encodeURIComponent(code)}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(next),
      });
      if (res.ok) {
        const data = await res.json();
        config = data.config;
        poolSize = data.poolSize || 0;
        paint();
      }
    } catch {
      // Same reasoning as above -- the last saved config still stands.
    }
  }

  function timerLabel(c) {
    const s = timerOf(c);
    return t(`${s}s to write`, `${U.num(s)} ثانية للكتابة`);
  }

  function estimateLine() {
    if (!config) return '';
    const minutes = Math.round(config.rounds * minutesPerRound(config));
    return t(
      `${config.rounds} rounds · about ${minutes} minutes`,
      `${U.count(config.rounds, 'round')} · حوالي ${U.num(minutes)} دقيقة`
    );
  }

  function languageLabel(id) {
    const l = LANGUAGES.find((x) => x.id === (id === 'ar' ? 'ar' : 'en'));
    return l ? l.label : '';
  }

  // A new room starts in the language the host's screen is in, once. From
  // then on the host's pick stands, through reloads of this lobby too.
  const pickedKey = () => `fab_lang_picked_${code}`;
  function languagePicked() {
    try { return Boolean(sessionStorage.getItem(pickedKey())); } catch { return false; }
  }
  function markLanguagePicked() {
    try { sessionStorage.setItem(pickedKey(), '1'); } catch {}
  }
  function defaultLanguage() {
    if (!isHost || !inLobby || !config || languagePicked()) return;
    markLanguagePicked();
    const want = U.lang();
    if (config.language !== want) save({ ...config, language: want });
  }

  function paint() {
    document.querySelectorAll('.fab-estimate').forEach((el) => {
      el.textContent = inLobby ? estimateLine() : '';
    });
    if (!inLobby || !config) {
      panels().forEach((p) => (p.hidden = true));
      readonlys().forEach((p) => (p.hidden = true));
      return;
    }

    if (!isHost) {
      panels().forEach((p) => (p.hidden = true));
      readonlys().forEach((p) => {
        p.hidden = false;
        p.innerHTML = `
          <span class="fab-kicker">${t('This game', 'هذه اللعبة')}</span>
          <span class="cfg-readonly-line">${esc(estimateLine())} · ${esc(timerLabel(config))} · ${esc(languageLabel(config.language))}</span>`;
      });
      return;
    }

    readonlys().forEach((p) => (p.hidden = true));
    const html = `
      <div class="cfg-grid">
        <div class="cfg-group">
          <span class="fab-kicker">${t('Rounds', 'الجولات')}</span>
          <div class="cfg-row">
            ${ROUND_CHOICES.map(
              (n) => `<button type="button" class="cfg-chip cfg-chip--num ${config.rounds === n ? 'active' : ''}" data-rounds="${n}">${U.num(n)}</button>`
            ).join('')}
          </div>
        </div>
        <div class="cfg-group">
          <span class="fab-kicker">${t('Time to write', 'وقت الكتابة')}</span>
          <div class="cfg-row">
            ${TIMER_CHOICES.map(
              (n) => `<button type="button" class="cfg-chip ${timerOf(config) === n ? 'active' : ''}" data-timer="${n}">${esc(t(`${n} sec`, `${U.num(n)} ثانية`))}</button>`
            ).join('')}
          </div>
        </div>
      </div>
      <span class="cfg-pool">${esc(
        t(`Questions come at random from ${poolSize}, and never repeat in this room.`,
          `الأسئلة عشوائية من ${U.num(poolSize)} سؤالًا، ولا تتكرر في هذه الغرفة.`)
      )}</span>
      <div class="cfg-group">
        <span class="fab-kicker">${t('Game language', 'لغة اللعبة')}</span>
        <div class="cfg-row">
          ${LANGUAGES.map(
            (l) => `<button type="button" class="cfg-chip ${(config.language === 'ar' ? 'ar' : 'en') === l.id ? 'active' : ''}" data-language="${l.id}" lang="${l.id}">${esc(l.label)}</button>`
          ).join('')}
        </div>
        <span class="cfg-pool">${esc(
          config.language === 'ar'
            ? t('Every question and answer will be in Arabic.', 'كل الأسئلة والإجابات ستكون بالعربية.')
            : t('Every question and answer will be in English.', 'كل الأسئلة والإجابات ستكون بالإنجليزية.')
        )}</span>
      </div>`;
    panels().forEach((p) => {
      p.hidden = false;
      p.innerHTML = html;
    });
  }

  document.addEventListener('click', (e) => {
    if (!isHost || !config) return;
    const rounds = e.target.closest('.fab-config [data-rounds]');
    if (rounds) return save({ ...config, rounds: Number(rounds.dataset.rounds) });
    const timer = e.target.closest('.fab-config [data-timer]');
    if (timer) return save({ ...config, writeSeconds: Number(timer.dataset.timer) });
    const language = e.target.closest('.fab-config [data-language]');
    if (language) {
      markLanguagePicked();
      return save({ ...config, language: language.dataset.language });
    }
  });
})();
