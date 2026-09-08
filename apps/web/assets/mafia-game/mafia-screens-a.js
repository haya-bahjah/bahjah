/* Mafia — screen markup, part 1: scene layers, HUD, landing, lobby,
   role reveal, night, dawn.

   Transcribed from the supplied design (Mafia Game.dc.html). Inline styles
   are the design's own, verbatim; the prototype's `style-hover="..."`
   attributes become the hv-* classes in mafia-game.css, and its
   `onClick="{{ fn }}"` bindings become data-a action names dispatched by
   mafia-view.js. */
(function (global) {
  var S = {};

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  S.esc = esc;

  /* Three fixed background layers cross-fade under every screen. */
  S.scenes = function (v) {
    return '' +
      '<div style="position:fixed;inset:0;pointer-events:none;z-index:0;transition:opacity 1.2s ease;opacity:' + v.nightOp + '">' +
        v.stars.map(function (st) {
          return '<div style="position:absolute;left:' + st.x + '%;top:' + st.y + '%;width:' + st.s + 'px;height:' + st.s + 'px;border-radius:50%;background:#DDE6FF;animation:twinkle ' + st.d + 's ease-in-out ' + st.dl + 's infinite"></div>';
        }).join('') +
        '<div style="position:absolute;top:84px;right:10%;width:84px;height:84px;border-radius:50%;background:#E9EDF9;box-shadow:0 0 60px rgba(220,230,255,.45)"><div style="position:absolute;top:-8px;right:-14px;width:76px;height:76px;border-radius:50%;background:#0B0F1E"></div></div>' +
        '<div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(6,10,26,.55), transparent 50%)"></div>' +
      '</div>' +
      '<div style="position:fixed;inset:0;pointer-events:none;z-index:0;transition:opacity 1.2s ease;opacity:' + v.dayOp + '">' +
        '<div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(216,224,238,.5), rgba(238,228,206,.34) 42%, rgba(150,158,172,.16) 78%, transparent)"></div>' +
        '<div style="position:absolute;inset:0;background:radial-gradient(1000px 620px at 78% -8%, rgba(255,246,222,.62), rgba(255,236,196,.2) 42%, transparent 68%)"></div>' +
        '<div style="position:absolute;top:44px;right:11%;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle, #FFFDF4 32%, #FFEFC0 58%, rgba(255,232,176,0) 74%);box-shadow:0 0 140px 40px rgba(255,244,210,.55);animation:sunPulse 6s ease-in-out infinite"></div>' +
        '<div style="position:absolute;top:0;right:0;width:70%;height:100%;background:linear-gradient(196deg, rgba(255,250,232,.34) 0%, rgba(255,250,232,.08) 26%, transparent 46%);filter:blur(1px)"></div>' +
        '<div style="position:absolute;top:0;right:24%;width:130px;height:112%;background:linear-gradient(200deg, rgba(255,250,235,.24), transparent 60%);transform:skewX(-14deg);filter:blur(6px)"></div>' +
        '<div style="position:absolute;top:0;right:40%;width:70px;height:112%;background:linear-gradient(200deg, rgba(255,250,235,.16), transparent 55%);transform:skewX(-14deg);filter:blur(8px)"></div>' +
        '<div style="position:absolute;top:132px;left:10%;width:180px;height:30px;border-radius:99px;background:rgba(248,248,244,.2);filter:blur(7px);animation:drift 13s ease-in-out infinite"></div>' +
        '<div style="position:absolute;top:210px;left:34%;width:130px;height:22px;border-radius:99px;background:rgba(248,248,244,.14);filter:blur(7px);animation:drift 17s ease-in-out 2s infinite"></div>' +
        '<div style="position:absolute;inset:0;background:repeating-linear-gradient(102deg, rgba(255,250,235,.05) 0 2px, transparent 2px 26px);opacity:.5"></div>' +
        '<div style="position:absolute;left:0;right:0;bottom:0;height:38%;background:linear-gradient(180deg, transparent, rgba(20,20,26,.5))"></div>' +
      '</div>' +
      '<div style="position:fixed;inset:0;pointer-events:none;z-index:0;transition:opacity 1.2s ease;opacity:' + v.dawnOp + '">' +
        '<div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(70,80,140,.3), rgba(255,120,80,.16) 55%, rgba(255,170,90,.2))"></div>' +
        '<div style="position:absolute;bottom:-70px;left:50%;margin-left:-90px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle, #FFD9A0, #FF9A5E 60%, rgba(255,154,94,0) 72%);box-shadow:0 0 110px rgba(255,160,100,.5)"></div>' +
      '</div>';
  };

  /* Persistent chrome: logo + badge, phase tracker, room/alive counters,
     language + sound toggles, Exit. */
  S.hud = function (v) {
    return '' +
      '<div class="mf-hud" style="position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:16px;height:64px;padding:0 24px;border-bottom:1px solid var(--border-subtle);background:rgba(11,11,20,.72);backdrop-filter:blur(12px)">' +
        '<div style="display:flex;align-items:center;gap:14px">' +
          '<img src="/assets/mafia/logo-mark.svg" alt="Bahjah" style="height:24px;width:auto;display:block;filter:invert(1) brightness(1.7)">' +
          '<div style="width:1px;height:22px;background:var(--border-strong)"></div>' +
          '<span style="font-family:var(--font-pixel);font-size:10px;letter-spacing:.14em;color:#EE2D23;border:1px solid rgba(238,45,35,.4);border-radius:4px;padding:4px 9px 3px">' + esc(v.tBadge) + '</span>' +
        '</div>' +
        (v.showTracker
          ? '<div class="mf-hud-tracker" style="display:flex;align-items:center;gap:6px">' +
              v.segs.map(function (s) {
                return '<div style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.12em;padding:5px 10px 4px;border-radius:4px;border:1px solid ' + s.bd + ';color:' + s.fg + ';background:' + s.bg + ';transition:all .2s">' + esc(s.label) + '</div>';
              }).join('') +
            '</div>'
          : '') +
        '<div style="display:flex;align-items:center;gap:14px">' +
          (v.showHud
            ? '<span style="font-family:var(--font-pixel);font-size:10px;letter-spacing:.14em;color:var(--cyber-cyan)">' + esc(v.tRoom) + ' ' + esc(v.code) + '</span>' +
              '<span style="font-family:var(--font-pixel);font-size:10px;letter-spacing:.14em;color:var(--text-muted)">' + esc(v.aliveLabel) + '</span>'
            : '') +
          '<div style="display:flex;gap:8px">' +
            '<div data-a="toggleLang" class="hv-lang" style="cursor:pointer;font-family:var(--font-pixel);font-size:9px;letter-spacing:.1em;color:var(--cyber-cyan);border:1px solid rgba(185,194,206,.35);border-radius:4px;padding:5px 10px 4px;user-select:none">' + esc(v.langLabel) + '</div>' +
            '<div data-a="toggleSound" class="hv-snd" style="cursor:pointer;font-family:var(--font-pixel);font-size:9px;letter-spacing:.1em;color:' + v.sndColor + ';border:1px solid ' + v.sndBorder + ';border-radius:4px;padding:5px 10px 4px;user-select:none">' + esc(v.sndLabel) + '</div>' +
            (v.showExit
              ? '<div data-a="exitAsk" class="hv-exit" style="cursor:pointer;display:flex;align-items:center;gap:7px;font-family:var(--font-pixel);font-size:9px;letter-spacing:.1em;color:#C57A74;border:1px solid rgba(238,45,35,.35);border-radius:4px;padding:5px 10px 4px;user-select:none;transition:all .15s">' +
                  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>' +
                  esc(v.tExit) +
                '</div>'
              : '') +
          '</div>' +
        '</div>' +
      '</div>';
  };

  S.landing = function (v) {
    return '' +
      '<div data-screen-label="Landing" class="mf-landing" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:72px 24px 56px;animation:fadeUp .5s ease-out both">' +
        '<h1 class="mf-hero" style="margin:20px 0 0;font-family:var(--font-display);font-weight:900;font-size:clamp(40px,6.2vw,76px);line-height:1.06;text-transform:uppercase;text-align:center;letter-spacing:.01em">' + esc(v.tHeroA) + ' <span style="color:#EE2D23;text-shadow:0 3px 14px rgba(0,0,0,.9)">' + esc(v.tHeroRed) + '</span><br>' + esc(v.tHeroB) + '</h1>' +
        '<p style="margin:22px 0 0;max-width:540px;text-align:center;color:var(--text-secondary);font-size:17px;line-height:1.6;text-wrap:pretty">' + esc(v.tHeroSub) + '</p>' +
        '<div style="display:flex;flex-direction:column;align-items:center;gap:22px;margin-top:38px">' +
          '<button data-a="create" class="ds-btn ds-btn--primary ds-btn--lg">' + esc(v.tCreate) + '</button>' +
          '<div style="display:flex;align-items:center;gap:14px;width:280px">' +
            '<div style="flex:1;height:1px;background:var(--border-subtle)"></div>' +
            '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.16em;color:var(--text-muted)">' + esc(v.tOr) + '</span>' +
            '<div style="flex:1;height:1px;background:var(--border-subtle)"></div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center">' +
            '<input data-role="code" placeholder="' + esc(v.tCodePh) + '" style="width:150px;background:rgba(18,18,26,.6);border:1px solid var(--border-strong);border-radius:8px;padding:15px 16px;color:var(--soft-white);font-family:var(--font-pixel);font-size:11px;letter-spacing:.16em;outline:none;text-transform:uppercase">' +
            // A real room needs a name to put on the seat. The design has no
            // field for it (its table is pre-named), so this appears only
            // when joining an actual room, styled as the code input's twin.
            (v.needsName
              ? '<input data-role="nickname" placeholder="' + esc(v.tYourName) + '" style="width:150px;background:rgba(18,18,26,.6);border:1px solid var(--border-strong);border-radius:8px;padding:15px 16px;color:var(--soft-white);font-family:var(--font-pixel);font-size:11px;letter-spacing:.16em;outline:none">'
              : '') +
            '<button data-a="join" class="ds-btn ds-btn--ghost ds-btn--md">' + esc(v.tJoin) + '</button>' +
          '</div>' +
          (v.netError
            ? '<p style="margin:0;max-width:420px;text-align:center;font-size:13px;line-height:1.5;color:#EE2D23">' + esc(v.netError) + '</p>'
            : '') +
          '<div data-a="openTut" class="hv-how" style="cursor:pointer;font-family:var(--font-pixel);font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--text-muted);padding:8px 12px;border-bottom:1px solid transparent">' + esc(v.tHow) + '</div>' +
        '</div>' +
        '<div class="mf-role-lineup" style="display:flex;flex-wrap:wrap;gap:18px;justify-content:center;margin-top:56px;max-width:900px">' +
          v.roleCards.map(function (rc) {
            return '<div class="hv-rolecard" style="box-sizing:border-box;width:200px;display:flex;flex-direction:column;align-items:center;gap:12px;padding:18px 14px 20px;border:1px solid var(--border-subtle);border-radius:14px;background:linear-gradient(180deg, rgba(11,29,58,.45), rgba(11,11,20,.5));transition:transform .15s var(--ease-arcade), border-color .15s">' +
              '<div role="img" aria-label="' + esc(rc.name) + '" style="width:140px;height:194px;border-radius:10px;background-image:url(\'' + rc.art + '\');background-size:cover;background-position:center;filter:drop-shadow(0 12px 22px rgba(0,0,0,.8))"></div>' +
              '<span style="font-family:var(--font-display);font-weight:900;font-size:18px;letter-spacing:.06em;text-transform:uppercase;color:' + rc.color + '">' + esc(rc.name) + '</span>' +
              '<p style="margin:0;text-align:center;font-size:12px;line-height:1.5;color:var(--text-secondary);text-wrap:pretty">' + esc(rc.desc) + '</p>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>';
  };

  /* JoinCode, from the DS bundle (components/game/JoinCode.jsx). */
  S.joinCode = function (code, size, color) {
    var map = { cyan: 'var(--cyber-cyan)', green: 'var(--pixel-green)', yellow: 'var(--arcade-yellow)', pink: 'var(--neon-pink)' };
    var c = map[color] || map.cyan;
    return '<div class="mf-jc" style="display:inline-flex;gap:10px">' +
      String(code).split('').map(function (ch) {
        return '<div style="width:' + size + 'px;height:' + (size * 1.15) + 'px;display:flex;align-items:center;justify-content:center;background:var(--surface-raised);border:1px solid ' + c + ';border-radius:var(--radius-sm);font-family:var(--font-pixel);font-size:' + (size * 0.5) + 'px;color:' + c + ';text-shadow:0 0 14px ' + c + ';box-shadow:inset 0 0 24px color-mix(in srgb, ' + c + ' 10%, transparent)">' + esc(ch) + '</div>';
      }).join('') +
    '</div>';
  };

  S.lobby = function (v) {
    return '' +
      '<div data-screen-label="Lobby" class="mf-screen" style="flex:1;display:flex;justify-content:center;padding:56px 28px;animation:fadeUp .4s ease-out both">' +
        '<div class="mf-lobby-grid" style="display:grid;grid-template-columns:360px 1fr;gap:44px;max-width:1060px;width:100%;align-items:start">' +
          '<div style="background:linear-gradient(180deg, rgba(11,29,58,.5), rgba(11,11,20,.5));border:1px solid var(--border-subtle);border-radius:16px;padding:30px 28px;display:flex;flex-direction:column;gap:20px">' +
            '<span style="font-family:var(--font-pixel);font-size:10px;letter-spacing:.16em;color:var(--text-muted)">' + esc(v.tRoomCode) + '</span>' +
            S.joinCode(v.code, v.jcSize, 'cyan') +
            '<p style="margin:0;color:var(--text-secondary);font-size:14px;line-height:1.5">' + esc(v.tShare) + '</p>' +
            // The design was drawn for one device, so it has no QR. With the
            // TV hosting and everyone playing from their own phone, a scan
            // is how a phone gets into the room without typing anything.
            (v.qrUrl
              ? '<div style="display:flex;flex-direction:column;align-items:center;gap:10px">' +
                  '<div style="background:#F7F7FF;border-radius:12px;padding:10px;line-height:0"><img src="' + v.qrUrl + '" alt="' + esc(v.tScan) + '" width="150" height="150" style="display:block;width:150px;height:150px"></div>' +
                  '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.16em;color:var(--text-muted);text-align:center">' + esc(v.tScan) + '</span>' +
                '</div>'
              : '') +
            '<div style="height:1px;background:var(--border-subtle)"></div>' +
            '<span style="font-family:var(--font-pixel);font-size:10px;letter-spacing:.16em;color:var(--text-muted)">' + esc(v.tTonight) + '</span>' +
            '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
              '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.1em;color:#EE2D23;border:1px solid rgba(238,45,35,.4);border-radius:99px;padding:5px 10px 4px">' + esc(v.tChipMafia) + '</span>' +
              '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.1em;color:#AEB8C4;border:1px solid rgba(174,184,196,.35);border-radius:99px;padding:5px 10px 4px">' + esc(v.tChipDoctor) + '</span>' +
              '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.1em;color:#C8A94E;border:1px solid rgba(200,169,78,.3);border-radius:99px;padding:5px 10px 4px">' + esc(v.tChipSheriff) + '</span>' +
              '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.1em;color:var(--text-secondary);border:1px solid var(--border-strong);border-radius:99px;padding:5px 10px 4px">' + esc(v.tChipCitizen) + '</span>' +
            '</div>' +
            '<button data-a="start" class="ds-btn ds-btn--primary ds-btn--lg"' + (v.startDisabled ? ' disabled' : '') + '>' + esc(v.startLabel) + '</button>' +
            // Practice bots: the host's way out of a room that will never
            // fill up. Nothing in the supplied design covers this case, so
            // it is styled as the card's quiet secondary action.
            (v.showAddBots
              ? '<button data-a="addBots" class="ds-btn ds-btn--ghost">' + esc(v.tAddBots) + '</button>'
              : '') +
            (v.showRemoveBots
              ? '<button data-a="removeBots" class="ds-btn ds-btn--ghost">' + esc(v.tRemoveBots) + '</button>'
              : '') +
            // Testing aid: the first seat can call the role it wants dealt,
            // so every role's screen can be walked through instead of
            // waiting on a random deal. Only shown with practice bots in
            // the room, and the server checks that too.
            (v.showCallRole
              ? '<div style="display:flex;flex-direction:column;gap:9px">' +
                  '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.16em;color:var(--text-muted)">' + esc(v.tCallRole) + '</span>' +
                  '<div style="display:flex;flex-wrap:wrap;gap:7px">' +
                    v.callRoles.map(function (r) {
                      return '<div data-a="callRole" data-id="' + r.key + '" style="cursor:pointer;font-family:var(--font-pixel);font-size:9px;letter-spacing:.1em;color:' + (r.on ? '#0B0B14' : r.color) + ';background:' + (r.on ? r.color : 'transparent') + ';border:1px solid ' + r.color + ';border-radius:99px;padding:6px 11px 5px;transition:all .15s">' + esc(String(r.label).toUpperCase()) + '</div>';
                    }).join('') +
                  '</div>' +
                '</div>'
              : '') +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:18px">' +
            '<div style="display:flex;align-items:baseline;gap:12px">' +
              '<span style="font-family:var(--font-display);font-weight:800;font-size:22px;letter-spacing:.06em;text-transform:uppercase">' + esc(v.tPlayers) + '</span>' +
              '<span style="font-family:var(--font-pixel);font-size:11px;letter-spacing:.14em;color:var(--pixel-green)">' + v.joined + '/8</span>' +
            '</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:12px;align-content:start">' +
              v.lobbyPlayers.map(function (p, i) {
                return '<div data-k="lp' + i + '" style="display:inline-flex;align-items:center;gap:10px;border:1px solid ' + p.ring + ';border-radius:99px;padding:5px 18px 5px 5px;background:rgba(11,11,20,.55);animation:popIn .3s var(--ease-arcade) both">' +
                  '<div style="width:30px;height:30px;border-radius:50%;border:1px solid ' + p.ring + ';background:rgba(11,29,58,.5);display:flex;align-items:center;justify-content:center"><div style="width:19px;height:19px;background-image:url(\'' + p.token + '\');background-size:contain;background-repeat:no-repeat;background-position:center;opacity:.95"></div></div>' +
                  '<span style="font-size:13px;font-weight:600;color:var(--text-primary)">' + esc(p.name) + '</span>' +
                  // Nobody at the table should have to guess which of these
                  // names is a person.
                  (p.bot ? '<span style="font-family:var(--font-pixel);font-size:8px;letter-spacing:.12em;color:var(--text-muted);border:1px solid var(--border-strong);border-radius:99px;padding:3px 7px 2px">' + esc(p.tBot) + '</span>' : '') +
                '</div>';
              }).join('') +
              v.emptySlots.map(function (e, i) {
                return '<div data-k="es' + i + '" style="display:inline-flex;align-items:center;gap:10px;border:1px dashed var(--border-strong);border-radius:99px;padding:6px 18px 6px 6px;animation:pulseSoft 1.8s ease-in-out infinite"><div style="width:28px;height:28px;border-radius:50%;border:1px dashed var(--border-strong)"></div><span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.12em;color:var(--text-muted)">' + esc(v.tWaiting) + '</span></div>';
              }).join('') +
            '</div>' +
            '<p style="margin:6px 0 0;color:var(--text-muted);font-size:13px">' + esc(v.tHostNote) + '</p>' +
          '</div>' +
        '</div>' +
      '</div>';
  };

  S.reveal = function (v) {
    return '' +
      '<div data-screen-label="Role reveal" class="mf-screen" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;gap:26px;animation:fadeIn .4s both">' +
        '<div style="display:flex;flex-direction:column;align-items:center;gap:8px">' +
          '<span style="font-family:var(--font-pixel);font-size:11px;letter-spacing:.16em;color:#EE2D23;text-shadow:0 2px 10px rgba(0,0,0,.85)">' + esc(v.tNightFalls) + '</span>' +
          '<span style="color:var(--text-secondary);font-size:15px">' + esc(v.tSecretNote) + '</span>' +
        '</div>' +
        (v.notFlipped
          ? '<div data-a="flip" class="mf-reveal-back hv-lift4" style="width:300px;height:430px;cursor:pointer;border-radius:16px;border:1px solid var(--border-strong);background:radial-gradient(rgba(174,184,196,.1) 1px, transparent 1.5px) 0 0 / 16px 16px, linear-gradient(180deg, #0B1D3A, #090D1A);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;animation:redPulse 2.6s ease-in-out infinite">' +
              '<div style="display:flex;flex-direction:column;align-items:center;opacity:.85;filter:drop-shadow(0 6px 16px rgba(0,0,0,.8))"><div style="width:40px;height:40px;border-radius:50%;background:#EE2D23"></div><div style="width:44px;height:30px;background:#EE2D23;clip-path:polygon(34% 0,66% 0,92% 100%,8% 100%);margin-top:-7px"></div></div>' +
              '<span style="font-family:var(--font-pixel);font-size:11px;letter-spacing:.18em;color:var(--text-secondary);animation:pulseSoft 1.6s infinite">' + esc(v.tTapReveal) + '</span>' +
            '</div>'
          : '') +
        (v.flipped
          ? '<div class="mf-reveal-front" style="width:300px;min-height:430px;border-radius:16px;border:1px solid ' + v.roleColor + ';box-shadow:0 0 46px ' + v.roleDim + ';background:radial-gradient(420px 260px at 50% 0%, ' + v.roleDim + ', transparent 70%), linear-gradient(180deg, #0B1D3A, #090D1A);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:26px;animation:flipIn .55s var(--ease-arcade) both">' +
              '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.2em;color:var(--text-muted)">' + esc(v.tSecretRole) + '</span>' +
              '<div role="img" aria-label="Role card" style="width:170px;height:234px;border-radius:10px;background-image:url(\'' + v.roleArt + '\');background-size:cover;background-position:center;filter:drop-shadow(0 14px 26px rgba(0,0,0,.85))"></div>' +
              '<span style="font-family:var(--font-display);font-weight:900;font-size:32px;letter-spacing:.06em;text-transform:uppercase;color:' + v.roleColor + ';text-shadow:0 3px 12px rgba(0,0,0,.85)">' + esc(v.roleName) + '</span>' +
              '<div style="width:48px;height:1px;background:var(--border-strong)"></div>' +
              '<p style="margin:0;text-align:center;color:var(--text-primary);font-size:15px;line-height:1.55">' + esc(v.roleDesc) + '</p>' +
              '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.12em;color:var(--text-muted);text-align:center;line-height:1.8">' + esc(v.roleWin) + '</span>' +
            '</div>' +
            '<button data-a="enterNight" class="ds-btn ds-btn--primary ds-btn--lg">' + esc(v.tBeginNight1) + '</button>'
          : '') +
      '</div>';
  };

  S.night = function (v) {
    return '' +
      '<div data-screen-label="Night phase" class="mf-screen" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;gap:24px;animation:fadeIn .4s both">' +
        '<div style="display:flex;flex-direction:column;align-items:center;gap:10px">' +
          '<span style="font-family:var(--font-pixel);font-size:11px;letter-spacing:.16em;color:#EE2D23;text-shadow:0 2px 10px rgba(0,0,0,.85)">' + esc(v.tNightN) + '</span>' +
          '<span style="font-family:var(--font-display);font-weight:900;font-size:34px;letter-spacing:.04em;text-transform:uppercase;text-align:center">' + esc(v.nightTitle) + '</span>' +
          '<span style="color:var(--text-secondary);font-size:15px;text-align:center;max-width:440px">' + esc(v.nightSub) + '</span>' +
        '</div>' +
        (v.mafiaChat
          ? '<div style="width:min(440px,90vw);background:rgba(20,8,10,.6);border:1px solid rgba(238,45,35,.35);border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:10px">' +
              '<span style="font-family:var(--font-pixel);font-size:8px;letter-spacing:.16em;color:#EE2D23">' + esc(v.tWhisperHdr) + '</span>' +
              (v.partnerLine
                ? '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.14em;color:#FF8079">' + esc(v.partnerLine) + '</span>'
                : '') +
              v.whispers.map(function (w, i) {
                return '<div data-k="w' + i + '" style="display:flex;gap:9px;align-items:flex-start;animation:fadeUp .3s ease-out both">' +
                  '<div style="width:24px;height:24px;flex:none;border-radius:50%;border:2px solid #EE2D23;display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:800;font-size:10px;color:#EE2D23"><div style="width:14px;height:14px;background-image:url(\'' + w.token + '\');background-size:contain;background-repeat:no-repeat;background-position:center;opacity:.92"></div></div>' +
                  '<div style="display:flex;flex-direction:column;gap:2px"><span style="font-family:var(--font-pixel);font-size:8px;letter-spacing:.12em;color:#EE2D23">' + esc(w.name) + '</span><span style="font-size:13px;line-height:1.4;color:var(--text-primary)">' + esc(w.text) + '</span></div>' +
                '</div>';
              }).join('') +
              // The design's whisper panel was a scripted feed -- it had
              // nothing to type into, because in a one-device mockup there
              // was nobody to type to. With real partners on real phones it
              // needs a way to actually talk back.
              (v.canWhisper
                ? '<div style="display:flex;gap:8px">' +
                    '<input data-role="wm" placeholder="' + esc(v.tSayPh) + '" style="flex:1;min-width:0;background:rgba(18,18,26,.6);border:1px solid rgba(238,45,35,.35);border-radius:8px;padding:11px 13px;color:var(--soft-white);font-family:var(--font-body);font-size:13px;outline:none">' +
                    '<button data-a="sendWhisper" class="ds-btn ds-btn--ghost ds-btn--sm">' + esc(v.tSend) + '</button>' +
                  '</div>'
                : '') +
            '</div>'
          : '') +
        (v.showAbilities ? S.abilities(v) : '') +
        (v.showNightPicker
          ? '<div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center;max-width:760px">' +
              v.candidates.map(function (c) {
                return '<div ' + (c.blocked ? 'data-blocked="1"' : 'data-a="pickNight"') + ' data-id="' + c.id + '" data-k="c' + c.id + '" class="mf-cand' + (c.blocked ? '' : ' hv-lift3') + '" style="width:140px;opacity:' + (c.blocked ? '.4' : '1') + ';cursor:' + (c.blocked ? 'not-allowed' : 'pointer') + ';background:linear-gradient(180deg, rgba(11,29,58,.55), rgba(11,11,20,.6));border:1px solid ' + c.border + ';box-shadow:' + c.shadow + ';border-radius:12px;padding:18px 12px 14px;display:flex;flex-direction:column;align-items:center;gap:10px;transition:all .15s var(--ease-arcade)">' +
                  '<div style="width:44px;height:44px;border-radius:50%;border:2px solid ' + c.ring + ';display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:800;font-size:18px;color:' + c.ring + '"><div style="width:26px;height:26px;background-image:url(\'' + c.token + '\');background-size:contain;background-repeat:no-repeat;background-position:center;opacity:.92"></div></div>' +
                  '<span style="font-size:14px;font-weight:600">' + esc(c.name) + '</span>' +
                  '<span style="font-family:var(--font-pixel);font-size:8px;letter-spacing:.12em;color:' + c.tagColor + ';min-height:10px">' + esc(c.tag) + '</span>' +
                '</div>';
              }).join('') +
            '</div>' +
            '<button data-a="confirmNight" class="ds-btn ds-btn--' + v.nightBtnVariant + ' ds-btn--lg"' + (v.nightConfirmDisabled ? ' disabled' : '') + '>' + esc(v.nightConfirmLabel) + '</button>'
          : '') +
        (v.sheriffDone
          ? '<div style="display:flex;flex-direction:column;align-items:center;gap:20px;background:linear-gradient(180deg, rgba(11,29,58,.55), rgba(11,11,20,.6));border:1px solid ' + v.sheriffBorder + ';box-shadow:0 0 40px ' + v.sheriffGlow + ';border-radius:16px;padding:38px 48px;animation:popIn .4s var(--ease-arcade) both">' +
              '<span style="font-family:var(--font-pixel);font-size:10px;letter-spacing:.16em;color:var(--text-muted)">' + esc(v.tInvResult) + '</span>' +
              '<span style="font-family:var(--font-display);font-weight:900;font-size:32px;letter-spacing:.05em;text-transform:uppercase;color:' + v.sheriffColor + ';text-shadow:0 3px 12px rgba(0,0,0,.85)">' + esc(v.sheriffText) + '</span>' +
              '<button data-a="sheriffContinue" class="ds-btn ds-btn--primary ds-btn--lg">' + esc(v.tCloseEyes) + '</button>' +
            '</div>'
          : '') +
        (v.showReadResult ? S.readResult(v) : '') +
        (v.showPrivateChats ? S.privateChats(v) : '') +
        (v.citizenSleep
          ? '<div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:30px">' +
              '<span style="font-family:var(--font-display);font-weight:900;font-size:40px;letter-spacing:.05em;text-transform:uppercase;animation:pulseSoft 2.2s ease-in-out infinite">' + esc(v.tTownSleeps) + '</span>' +
              '<span style="color:var(--text-secondary);font-size:15px">' + esc(v.tKeepClosed) + '</span>' +
            '</div>'
          : '') +
      '</div>';
  };


  /* The Detective picks one of two abilities a night. Read unlocks from the
     second night, so before then it is shown but disabled rather than
     hidden -- the player should know it is coming. */
  S.abilities = function (v) {
    var chip = function (mode, label, on, disabled) {
      return '<div ' + (disabled ? '' : 'data-a="setAbility" data-id="' + mode + '" ') +
        'style="cursor:' + (disabled ? 'not-allowed' : 'pointer') + ';font-family:var(--font-pixel);font-size:9px;letter-spacing:.14em;padding:8px 16px 7px;border-radius:99px;border:1px solid ' +
        (on ? '#C8A94E' : 'var(--border-strong)') + ';color:' + (on ? '#C8A94E' : 'var(--text-muted)') +
        ';background:' + (on ? 'rgba(200,169,78,.12)' : 'transparent') + ';opacity:' + (disabled ? '.45' : '1') +
        ';user-select:none;transition:all .15s">' + esc(label) + '</div>';
    };
    return '<div style="display:flex;gap:10px;justify-content:center">' +
      chip('reveal', v.tReveal, v.ability === 'reveal', false) +
      chip('read', v.tRead, v.ability === 'read', !v.canRead) +
      '</div>';
  };

  /* The Read result: what the target said, with whoever they said it to
     left anonymous. */
  S.readResult = function (v) {
    return '<div style="width:min(440px,90vw);display:flex;flex-direction:column;gap:14px;background:linear-gradient(180deg, rgba(11,29,58,.55), rgba(11,11,20,.6));border:1px solid rgba(200,169,78,.4);box-shadow:0 0 40px rgba(200,169,78,.18);border-radius:16px;padding:26px 24px;animation:popIn .4s var(--ease-arcade) both">' +
      '<span style="font-family:var(--font-pixel);font-size:10px;letter-spacing:.16em;color:var(--text-muted)">' + esc(v.tReadResult) + '</span>' +
      '<span style="font-family:var(--font-display);font-weight:900;font-size:22px;letter-spacing:.04em;text-transform:uppercase;color:#C8A94E">' + esc(v.readName) + '</span>' +
      (v.readLines.length
        ? '<div style="display:flex;flex-direction:column;gap:10px">' +
            v.readLines.map(function (l) {
              return '<div style="display:flex;flex-direction:column;gap:3px">' +
                '<span style="font-family:var(--font-pixel);font-size:8px;letter-spacing:.12em;color:' + (l.isTarget ? '#C8A94E' : 'var(--text-muted)') + '">' + esc(l.who) + '</span>' +
                '<span style="font-size:14px;line-height:1.45;color:var(--text-primary)">' + esc(l.text) + '</span>' +
              '</div>';
            }).join('') +
          '</div>'
        : '<p style="margin:0;font-size:14px;color:var(--text-secondary)">' + esc(v.tReadEmpty) + '</p>') +
      '<button data-a="sheriffContinue" class="ds-btn ds-btn--primary ds-btn--lg">' + esc(v.tCloseEyes) + '</button>' +
    '</div>';
  };

  /* Night's one-to-one chats. Closed, it is a row of the other living
     players; open, it is that thread with a line to send. */
  S.privateChats = function (v) {
    if (v.openThread) {
      return '<div style="width:min(440px,90vw);background:rgba(11,29,58,.5);border:1px solid var(--border-strong);border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:10px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">' +
          '<span style="font-family:var(--font-pixel);font-size:8px;letter-spacing:.16em;color:var(--cyber-cyan)">' + esc(v.openThreadName) + '</span>' +
          '<div data-a="closeThread" style="cursor:pointer;font-family:var(--font-pixel);font-size:8px;letter-spacing:.14em;color:var(--text-muted);padding:4px 8px">' + esc(v.tBack) + '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:9px;max-height:210px;overflow:auto">' +
          (v.threadLines.length
            ? v.threadLines.map(function (m, i) {
                return '<div data-k="pm' + i + '" style="display:flex;flex-direction:column;gap:2px;align-items:' + (m.mine ? 'flex-end' : 'flex-start') + ';animation:fadeUp .3s ease-out both">' +
                  '<span style="font-family:var(--font-pixel);font-size:8px;letter-spacing:.12em;color:' + (m.mine ? 'var(--cyber-cyan)' : 'var(--text-muted)') + '">' + esc(m.who) + '</span>' +
                  '<span style="font-size:13px;line-height:1.4;color:var(--text-primary);background:' + (m.mine ? 'rgba(185,194,206,.12)' : 'rgba(247,247,255,.06)') + ';border-radius:10px;padding:7px 11px;max-width:85%">' + esc(m.text) + '</span>' +
                '</div>';
              }).join('')
            : '<span style="font-size:13px;color:var(--text-muted)">' + esc(v.tNoMessages) + '</span>') +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<input data-role="pm" placeholder="' + esc(v.tSayPh) + '" style="flex:1;min-width:0;background:rgba(18,18,26,.6);border:1px solid var(--border-strong);border-radius:8px;padding:11px 13px;color:var(--soft-white);font-family:var(--font-body);font-size:13px;outline:none">' +
          '<button data-a="sendPrivate" class="ds-btn ds-btn--ghost ds-btn--sm">' + esc(v.tSend) + '</button>' +
        '</div>' +
      '</div>';
    }
    return '<div style="width:min(440px,90vw);display:flex;flex-direction:column;gap:10px">' +
      '<span style="font-family:var(--font-pixel);font-size:8px;letter-spacing:.16em;color:var(--text-muted);text-align:center">' + esc(v.tPrivateHdr) + '</span>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">' +
        v.threadPeers.map(function (p) {
          return '<div data-a="openThread" data-id="' + p.id + '" style="cursor:pointer;display:inline-flex;align-items:center;gap:9px;border:1px solid ' + (p.unread ? 'var(--cyber-cyan)' : 'var(--border-strong)') + ';border-radius:99px;padding:5px 15px 5px 5px;background:rgba(11,11,20,.55);transition:all .15s">' +
            '<div style="width:26px;height:26px;border-radius:50%;border:1px solid ' + p.ring + ';display:flex;align-items:center;justify-content:center"><div style="width:16px;height:16px;background-image:url(\'' + p.token + '\');background-size:contain;background-repeat:no-repeat;background-position:center;opacity:.92"></div></div>' +
            '<span style="font-size:13px;font-weight:600;color:var(--text-primary)">' + esc(p.name) + '</span>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>';
  };

  /* A rejected action, said out loud. Fixed to the top so it is visible
     whatever screen is up and whatever the page is scrolled to. */
  S.toast = function (v) {
    return '<div data-k="toast" style="position:fixed;top:74px;left:50%;transform:translateX(-50%);z-index:120;max-width:min(460px,92vw);background:rgba(28,10,12,.96);border:1px solid rgba(238,45,35,.55);border-radius:10px;padding:11px 16px;box-shadow:0 10px 30px rgba(0,0,0,.5);animation:fadeUp .25s ease-out both">' +
      '<span style="font-size:13px;line-height:1.45;color:#FFB3AE">' + esc(v.netError) + '</span>' +
    '</div>';
  };

  S.sleeping = function (v) {
    return '<div class="' + v.scanCls + '" style="position:fixed;inset:0;z-index:80;background:rgba(6,9,20,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;animation:fadeIn .4s both">' +
      '<span style="font-family:var(--font-display);font-weight:900;font-size:44px;letter-spacing:.06em;text-transform:uppercase;animation:pulseSoft 2s ease-in-out infinite">' + esc(v.tTownSleeps) + '</span>' +
      '<span style="font-family:var(--font-pixel);font-size:10px;letter-spacing:.2em;color:#EE2D23;animation:pulseSoft 1.4s infinite">' + esc(v.tSomethingMoves) + '</span>' +
    '</div>';
  };

  S.dawn = function (v) {
    return '' +
      '<div data-screen-label="Dawn reveal" class="mf-screen" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;gap:24px;animation:fadeUp .5s ease-out both">' +
        '<span style="font-family:var(--font-pixel);font-size:11px;letter-spacing:.16em;color:var(--arcade-yellow);text-shadow:0 2px 10px rgba(0,0,0,.85)">' + esc(v.tDawnDay) + '</span>' +
        // The design turned the victim's role card face up here. It stays
        // face down now: the morning says who the Mafia took, never what
        // they were -- working that out is the game. So this is the card
        // back from the reveal screen, with the name under it.
        (v.dawnKilled
          ? '<div style="display:flex;flex-direction:column;align-items:center;gap:18px">' +
              '<div style="width:250px;border-radius:14px;border:1px solid var(--border-strong);box-shadow:0 0 38px rgba(238,45,35,.16);background:radial-gradient(rgba(174,184,196,.09) 1px, transparent 1.5px) 0 0 / 14px 14px, linear-gradient(180deg, #0B1D3A, #090D1A);display:flex;flex-direction:column;align-items:center;gap:14px;padding:30px 22px;animation:flipIn .55s var(--ease-arcade) both">' +
                '<div style="width:66px;height:66px;border-radius:50%;border:2px solid rgba(238,45,35,.5);display:flex;align-items:center;justify-content:center;filter:grayscale(.5)">' +
                  '<div style="width:38px;height:38px;background-image:url(\'' + v.victimToken + '\');background-size:contain;background-repeat:no-repeat;background-position:center;opacity:.85"></div>' +
                '</div>' +
                '<span style="font-family:var(--font-display);font-weight:900;font-size:24px;letter-spacing:.05em;text-transform:uppercase;color:var(--text-primary)">' + esc(v.victimName) + '</span>' +
                '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.16em;color:var(--text-muted);text-align:center">' + esc(v.tRoleUnknown) + '</span>' +
              '</div>' +
              '<span style="font-family:var(--font-display);font-weight:900;font-size:34px;letter-spacing:.04em;text-transform:uppercase;text-align:center">' + esc(v.tFoundDead) + '</span>' +
            '</div>'
          : '') +
        (v.dawnSaved
          ? '<div style="display:flex;flex-direction:column;align-items:center;gap:14px">' +
              '<span style="font-family:var(--font-display);font-weight:900;font-size:38px;letter-spacing:.04em;text-transform:uppercase;text-align:center">' + esc(v.tEyesOpen) + '</span>' +
              '<span style="font-size:16px;color:#AEB8C4;text-shadow:0 2px 10px rgba(0,0,0,.85)">' + esc(v.tDoctorSaved) + '</span>' +
            '</div>'
          : '') +
        // A night the Mafia skipped is its own morning: nobody was attacked
        // at all, so crediting the Doctor would be wrong.
        (v.dawnQuiet
          ? '<div style="display:flex;flex-direction:column;align-items:center;gap:14px">' +
              '<span style="font-family:var(--font-display);font-weight:900;font-size:38px;letter-spacing:.04em;text-transform:uppercase;text-align:center">' + esc(v.tNoKill) + '</span>' +
              '<span style="font-size:16px;color:var(--text-secondary);text-shadow:0 2px 10px rgba(0,0,0,.85)">' + esc(v.tNoKillSub) + '</span>' +
            '</div>'
          : '') +
        // The television presses nothing; it counts.
        (v.showReportCount
          ? '<div style="display:flex;flex-direction:column;align-items:center;gap:6px">' +
              '<span style="font-family:var(--font-display);font-weight:900;font-size:clamp(30px,4vw,52px);color:var(--pixel-green)">' + esc(v.tReportCount) + '</span>' +
              '<span style="font-family:var(--font-pixel);font-size:10px;letter-spacing:.2em;color:var(--text-muted)">' + esc(v.tReportCountLbl) + '</span>' +
            '</div>'
          : '<button data-a="startDay" class="ds-btn ds-btn--primary ds-btn--lg"' + (v.reportWaiting ? ' disabled' : '') + '>' + esc(v.tStartDay) + '</button>') +
      '</div>';
  };

  global.MafiaScreensA = S;
})(window);
