/* Mafia — screen markup, part 2: day discussion, vote, elimination,
   exit confirm, suspense, tutorial, share sheet and the two verdicts.
   Transcribed from the supplied design (Mafia Game.dc.html). */
(function (global) {
  var S = {};
  var esc = global.MafiaScreensA.esc;

  S.day = function (v) {
    return '' +
      '<div data-screen-label="Day discussion" class="mf-screen" style="flex:1;display:flex;justify-content:center;padding:44px 28px;animation:fadeUp .4s ease-out both">' +
        '<div class="mf-day-grid" style="display:grid;grid-template-columns:1fr 300px;gap:32px;max-width:1020px;width:100%;align-items:start">' +
          '<div style="display:flex;flex-direction:column;gap:16px">' +
            '<div style="display:flex;align-items:baseline;gap:12px">' +
              '<span style="font-family:var(--font-display);font-weight:800;font-size:22px;letter-spacing:.06em;text-transform:uppercase">' + esc(v.tDayN) + '</span>' +
              '<span style="font-family:var(--font-pixel);font-size:10px;letter-spacing:.14em;color:var(--text-muted)">' + esc(v.tDiscussion) + '</span>' +
              '<span style="font-family:var(--font-pixel);font-size:12px;letter-spacing:.14em;color:' + v.timerColor + ';border:1px solid ' + v.timerBorder + ';border-radius:6px;padding:5px 12px 4px;margin-inline-start:auto">' + esc(v.dayTimer) + '</span>' +
            '</div>' +
            '<div style="background:linear-gradient(180deg, rgba(28,42,72,.55), rgba(15,17,30,.5));border:1px solid var(--border-subtle);border-radius:16px;padding:24px;min-height:360px;display:flex;flex-direction:column;gap:16px">' +
              v.messages.map(function (m, i) {
                return '<div data-k="m' + i + '" style="display:flex;gap:12px;align-items:flex-start;animation:fadeUp .3s ease-out both">' +
                  '<div style="width:32px;height:32px;flex:none;border-radius:50%;border:2px solid ' + m.ring + ';display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:800;font-size:13px;color:' + m.ring + '"><div style="width:19px;height:19px;background-image:url(\'' + m.token + '\');background-size:contain;background-repeat:no-repeat;background-position:center;opacity:.92"></div></div>' +
                  '<div style="display:flex;flex-direction:column;gap:3px"><span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.12em;color:' + m.ring + '">' + esc(m.name) + '</span><span style="font-size:15px;line-height:1.45;color:var(--text-primary)">' + esc(m.text) + '</span></div>' +
                '</div>';
              }).join('') +
              (v.typing
                ? '<div data-k="typing" style="display:flex;gap:6px;padding:6px 2px"><div style="width:6px;height:6px;border-radius:50%;background:var(--text-muted);animation:pulseSoft 1s infinite"></div><div style="width:6px;height:6px;border-radius:50%;background:var(--text-muted);animation:pulseSoft 1s .2s infinite"></div><div style="width:6px;height:6px;border-radius:50%;background:var(--text-muted);animation:pulseSoft 1s .4s infinite"></div></div>'
                : '') +
            '</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">' +
              v.quickReplies.map(function (q, i) {
                return '<div data-a="sayQuick" data-id="' + i + '" class="hv-quick" style="cursor:pointer;font-size:13px;color:' + q.fg + ';border:1px solid ' + q.bd + ';border-radius:99px;padding:8px 16px;user-select:none;transition:all .15s">' + esc(q.text) + '</div>';
              }).join('') +
            '</div>' +
            (v.canVote
              ? '<div style="display:flex;justify-content:center;animation:popIn .3s var(--ease-arcade) both"><button data-a="startVote" class="ds-btn ds-btn--hot ds-btn--lg">' + esc(v.tStartVote) + '</button></div>'
              : '') +
          '</div>' +
          '<div style="background:linear-gradient(180deg, rgba(28,42,72,.55), rgba(15,17,30,.5));border:1px solid var(--border-subtle);border-radius:16px;padding:22px;display:flex;flex-direction:column;gap:14px">' +
            '<span style="font-family:var(--font-pixel);font-size:10px;letter-spacing:.16em;color:var(--text-muted)">' + esc(v.tTheTown) + '</span>' +
            v.roster.map(function (r) {
              return '<div style="display:flex;align-items:center;gap:10px;opacity:' + r.op + '">' +
                '<div style="width:28px;height:28px;border-radius:50%;border:2px solid ' + r.ring + ';display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:800;font-size:12px;color:' + r.ring + '"><div style="width:17px;height:17px;background-image:url(\'' + r.token + '\');background-size:contain;background-repeat:no-repeat;background-position:center;opacity:.92"></div></div>' +
                '<span style="font-size:14px;font-weight:500;flex:1">' + esc(r.name) + '</span>' +
                '<span style="font-family:var(--font-pixel);font-size:8px;letter-spacing:.12em;color:' + r.stColor + '">' + esc(r.status) + '</span>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</div>';
  };

  S.vote = function (v) {
    return '' +
      '<div data-screen-label="Voting" class="mf-screen" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;gap:26px;animation:fadeIn .4s both">' +
        '<div style="display:flex;flex-direction:column;align-items:center;gap:10px">' +
          '<span style="font-family:var(--font-pixel);font-size:11px;letter-spacing:.16em;color:#EE2D23;text-shadow:0 2px 10px rgba(0,0,0,.85)">' + esc(v.tTheVote) + '</span>' +
          '<span style="font-family:var(--font-display);font-weight:900;font-size:34px;letter-spacing:.04em;text-transform:uppercase">' + esc(v.tWhoIsMafia) + '</span>' +
          '<span style="font-family:var(--font-pixel);font-size:10px;letter-spacing:.14em;color:var(--text-muted);animation:pulseSoft 1.8s infinite">' + esc(v.voteStatus) + '</span>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center;max-width:780px">' +
          v.voteCands.map(function (c) {
            return '<div data-a="voteFor" data-id="' + c.id + '" data-k="v' + c.id + '" class="mf-cand hv-lift3" style="width:150px;cursor:pointer;background:linear-gradient(180deg, rgba(11,29,58,.55), rgba(11,11,20,.6));border:1px solid ' + c.border + ';box-shadow:' + c.shadow + ';border-radius:12px;padding:18px 12px 14px;display:flex;flex-direction:column;align-items:center;gap:9px;transition:all .15s var(--ease-arcade)">' +
              '<div style="width:44px;height:44px;border-radius:50%;border:2px solid ' + c.ring + ';display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:800;font-size:18px;color:' + c.ring + '"><div style="width:26px;height:26px;background-image:url(\'' + c.token + '\');background-size:contain;background-repeat:no-repeat;background-position:center;opacity:.92"></div></div>' +
              '<span style="font-size:14px;font-weight:600">' + esc(c.name) + '</span>' +
              '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:5px;min-height:20px">' +
                c.dots.map(function (d, i) {
                  return '<div data-k="d' + i + '" title="' + esc(d.voter) + '" style="width:20px;height:20px;border-radius:50%;border:1px solid ' + d.c + ';background:rgba(11,11,20,.6);display:flex;align-items:center;justify-content:center;animation:popIn .25s var(--ease-arcade) both"><div style="width:13px;height:13px;background-image:url(\'' + d.token + '\');background-size:contain;background-repeat:no-repeat;background-position:center;opacity:.95"></div></div>';
                }).join('') +
              '</div>' +
              '<span style="font-family:var(--font-pixel);font-size:8px;letter-spacing:.12em;color:' + c.tagColor + ';min-height:10px">' + esc(c.tag) + '</span>' +
            '</div>';
          }).join('') +
        '</div>' +
        (v.votesDone
          ? '<div style="animation:popIn .3s var(--ease-arcade) both"><button data-a="revealVerdict" class="ds-btn ds-btn--hot ds-btn--lg">' + esc(v.tRevealVerdict) + '</button></div>'
          : '') +
      '</div>';
  };

  S.exitDialog = function (v) {
    return '' +
      '<div style="position:fixed;inset:0;z-index:120;background:rgba(6,7,12,.82);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:24px;animation:fadeIn .18s both">' +
        '<div style="width:min(400px,92vw);background:linear-gradient(180deg,#16161F,#0D0D14);border:1px solid var(--border-strong);border-radius:16px;padding:32px 30px;display:flex;flex-direction:column;align-items:center;gap:14px;box-shadow:0 30px 70px rgba(0,0,0,.8);animation:popIn .22s var(--ease-arcade) both">' +
          '<div style="width:44px;height:44px;border-radius:50%;border:1px solid rgba(238,45,35,.4);display:flex;align-items:center;justify-content:center;color:#EE2D23">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>' +
          '</div>' +
          '<span style="font-family:var(--font-display);font-weight:900;font-size:24px;letter-spacing:.03em;text-transform:uppercase;text-align:center">' + esc(v.tExitTitle) + '</span>' +
          '<p style="margin:0;text-align:center;color:var(--text-secondary);font-size:14px;line-height:1.55;text-wrap:pretty">' + esc(v.tExitBody) + '</p>' +
          '<div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap;justify-content:center">' +
            '<button data-a="exitStay" class="ds-btn ds-btn--ghost ds-btn--md">' + esc(v.tExitStay) + '</button>' +
            '<button data-a="exitGo" class="ds-btn ds-btn--hot ds-btn--md">' + esc(v.tExitGo) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  };

  S.suspense = function (v) {
    return '<div class="' + v.scanCls + '" style="position:fixed;inset:0;z-index:80;background:rgba(6,9,20,.95);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;animation:fadeIn .3s both">' +
      '<span style="font-family:var(--font-display);font-weight:900;font-size:40px;letter-spacing:.06em;text-transform:uppercase;animation:pulseSoft 1.1s ease-in-out infinite">' + esc(v.tHoldsBreath) + '</span>' +
      '<span style="font-family:var(--font-pixel);font-size:10px;letter-spacing:.2em;color:#EE2D23;animation:pulseSoft .8s infinite">' + esc(v.tCountingVotes) + '</span>' +
    '</div>';
  };

  S.elim = function (v) {
    return '' +
      '<div data-screen-label="Elimination reveal" class="mf-screen" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;gap:26px;animation:fadeIn .4s both">' +
        '<span style="font-family:var(--font-pixel);font-size:11px;letter-spacing:.16em;color:var(--text-muted)">' + esc(v.tTownDecided) + '</span>' +
        '<div style="width:290px;border-radius:16px;border:1px solid ' + v.elimColor + ';box-shadow:0 0 44px ' + v.elimDim + ';background:radial-gradient(400px 240px at 50% 0%, ' + v.elimDim + ', transparent 70%), linear-gradient(180deg, #0B1D3A, #090D1A);display:flex;flex-direction:column;align-items:center;gap:16px;padding:36px 28px;animation:flipIn .55s var(--ease-arcade) both">' +
          '<div role="img" aria-label="Role card" style="width:120px;height:165px;border-radius:8px;background-image:url(\'' + v.elimArt + '\');background-size:cover;background-position:center;filter:drop-shadow(0 12px 22px rgba(0,0,0,.85))"></div>' +
          '<span style="font-family:var(--font-display);font-weight:800;font-size:22px;letter-spacing:.04em;text-transform:uppercase">' + esc(v.tElimName) + '</span>' +
          '<div style="width:44px;height:1px;background:var(--border-strong)"></div>' +
          '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.16em;color:var(--text-muted)">' + esc(v.tTheirRole) + '</span>' +
          '<span style="font-family:var(--font-display);font-weight:900;font-size:30px;letter-spacing:.06em;text-transform:uppercase;color:' + v.elimColor + ';text-shadow:0 3px 12px rgba(0,0,0,.85)">' + esc(v.elimRoleName) + '</span>' +
          '<span style="font-size:14px;color:var(--text-secondary);text-align:center">' + esc(v.elimFactionText) + '</span>' +
        '</div>' +
        '<button data-a="continueElim" class="ds-btn ds-btn--primary ds-btn--lg">' + esc(v.continueElimLabel) + '</button>' +
      '</div>';
  };

  S.tutorial = function (v) {
    return '' +
      '<div data-screen-label="Tutorial" style="position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(4,4,8,.86);backdrop-filter:blur(10px);animation:fadeIn .25s ease-out both">' +
        '<div style="position:relative;box-sizing:border-box;width:min(560px,100%);border:1px solid var(--border-strong);border-radius:16px;padding:32px 32px 26px;background:linear-gradient(180deg, rgba(11,29,58,.55), rgba(11,11,20,.94));box-shadow:0 30px 80px rgba(0,0,0,.9);animation:popIn .3s var(--ease-arcade) both">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px">' +
            '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.2em;color:#EE2D23">' + esc(v.tutCount) + '</span>' +
            '<div data-a="tutSkip" class="hv-tutskip" style="cursor:pointer;font-family:var(--font-pixel);font-size:9px;letter-spacing:.18em;color:var(--text-muted);padding:6px 10px;border-radius:6px">' + esc(v.tSkip) + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:6px;margin-top:16px">' +
            v.tutDots.map(function (d) {
              return '<div style="width:' + d.w + 'px;height:4px;border-radius:99px;background:' + d.bg + ';transition:width .25s var(--ease-arcade), background .25s"></div>';
            }).join('') +
          '</div>' +
          '<h2 style="margin:22px 0 0;font-family:var(--font-display);font-weight:900;font-size:30px;line-height:1.15;color:var(--text-primary);text-wrap:balance">' + esc(v.tutTitle) + '</h2>' +
          '<p style="margin:14px 0 0;font-size:16px;line-height:1.65;color:var(--text-secondary);text-wrap:pretty;min-height:80px">' + esc(v.tutBody) + '</p>' +
          '<div style="display:flex;justify-content:flex-end;align-items:center;gap:14px;margin-top:24px">' +
            (v.tutCanBack
              ? '<div data-a="tutBack" style="cursor:pointer;font-size:13px;font-weight:600;color:var(--text-muted);padding:10px 6px">' + esc(v.tBack) + '</div>'
              : '') +
            '<button data-a="tutNext" class="ds-btn ds-btn--hot ds-btn--md">' + esc(v.tutNextLabel) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  };

  /* The result card is a playing card: 340x476 (5:7), matching role-card
     proportions, so it reads as part of the same deck when shared. */
  S.share = function (v) {
    return '' +
      '<div data-screen-label="Share result" style="position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(4,4,8,.92);backdrop-filter:blur(12px);animation:fadeIn .25s ease-out both;overflow:auto">' +
        '<div style="display:flex;flex-direction:column;align-items:center;gap:22px;animation:popIn .32s var(--ease-arcade) both">' +
          '<div class="mf-sharecard" style="position:relative;box-sizing:border-box;width:340px;height:476px;border-radius:14px;padding:16px;background:' + v.shareBg + ';box-shadow:0 0 0 1px ' + v.shareBorder + ', 0 40px 90px rgba(0,0,0,.92);display:flex">' +
            '<div style="position:relative;flex:1;box-sizing:border-box;border:1px solid ' + v.shareBorder + ';border-radius:6px;padding:18px 18px 16px;display:flex;flex-direction:column">' +
              '<div style="position:absolute;top:8px;left:8px;width:16px;height:16px;border-top:2px solid ' + v.shareWinColor + ';border-left:2px solid ' + v.shareWinColor + '"></div>' +
              '<div style="position:absolute;top:8px;right:8px;width:16px;height:16px;border-top:2px solid ' + v.shareWinColor + ';border-right:2px solid ' + v.shareWinColor + '"></div>' +
              '<div style="position:absolute;bottom:8px;left:8px;width:16px;height:16px;border-bottom:2px solid ' + v.shareWinColor + ';border-left:2px solid ' + v.shareWinColor + '"></div>' +
              '<div style="position:absolute;bottom:8px;right:8px;width:16px;height:16px;border-bottom:2px solid ' + v.shareWinColor + ';border-right:2px solid ' + v.shareWinColor + '"></div>' +
              '<div style="flex:none;display:flex;align-items:flex-start;justify-content:space-between;gap:10px">' +
                '<div style="display:flex;flex-direction:column;align-items:flex-start;gap:5px">' +
                  '<span style="font-family:var(--font-display);font-weight:900;font-size:19px;line-height:1;letter-spacing:.02em;color:' + v.shareWinColor + '">' + esc(v.shareVerdict) + '</span>' +
                '</div>' +
                '<span style="font-family:var(--font-display);font-weight:900;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:' + v.shareFg + ';opacity:.85">' + esc(v.tBadge) + '</span>' +
              '</div>' +
              '<div style="flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:13px;padding:4px 0">' +
                '<div style="flex: none; width: 135px; height: 185px; border-radius: 8px; background-image: url(\'' + v.shareRoleArt + '\'); background-size: cover; box-shadow: 0 0 0 1px ' + v.shareBorder + ', 0 18px 38px rgba(0,0,0,.6)"></div>' +
                '<div style="display:flex;flex-direction:column;align-items:center;gap:5px">' +
                  '<span style="font-family:var(--font-display);font-weight:900;font-size:21px;line-height:1;text-transform:uppercase;color:' + v.shareFg + '">' + esc(v.sharePlayerName) + '</span>' +
                  '<span style="font-family:var(--font-pixel);font-size:8px;letter-spacing:.2em;color:' + v.shareMuted + '">' + esc(v.tShareRole) + '</span>' +
                  '<span style="font-family:var(--font-display);font-weight:800;font-size:15px;line-height:1;letter-spacing:.06em;text-transform:uppercase;color:' + v.shareWinColor + '">' + esc(v.shareRoleName) + '</span>' +
                '</div>' +
                '<span style="font-family:var(--font-display);font-weight:800;font-size:11px;letter-spacing:.16em;text-transform:uppercase;text-align:center;color:' + v.shareWinColor + ';text-wrap:balance">' + esc(v.shareWinKicker) + '</span>' +
              '</div>' +
              '<div style="flex:none;display:flex;justify-content:space-between;gap:6px;padding:10px 0;border-top:1px solid ' + v.shareBorder + ';border-bottom:1px solid ' + v.shareBorder + '">' +
                '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1">' +
                  '<span style="font-family:var(--font-pixel);font-size:7px;letter-spacing:.16em;color:' + v.shareMuted + '">' + esc(v.tStatRounds) + '</span>' +
                  '<span style="font-family:var(--font-display);font-weight:900;font-size:19px;line-height:1;color:' + v.shareFg + '">' + esc(v.statRounds) + '</span>' +
                '</div>' +
                '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1">' +
                  '<span style="font-family:var(--font-pixel);font-size:7px;letter-spacing:.16em;color:' + v.shareMuted + '">' + esc(v.tStatMafia) + '</span>' +
                  '<span style="font-family:var(--font-display);font-weight:900;font-size:19px;line-height:1;color:' + v.shareWinColor + '">' + esc(v.statMafia) + '</span>' +
                '</div>' +
                '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1">' +
                  '<span style="font-family:var(--font-pixel);font-size:7px;letter-spacing:.16em;color:' + v.shareMuted + '">' + esc(v.tStatSurvivors) + '</span>' +
                  '<span style="font-family:var(--font-display);font-weight:900;font-size:19px;line-height:1;color:' + v.shareFg + '">' + esc(v.statSurvivors) + '</span>' +
                '</div>' +
              '</div>' +
              '<div style="flex:none;display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-top:10px">' +
                '<div style="display:flex;flex-direction:column;gap:3px"></div>' +
                '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">' +
                  '<span style="font-size:9px;color:' + v.shareMuted + '">' + esc(v.tShareTag) + '</span>' +
                  '<span style="font-family:var(--font-display);font-weight:800;font-size:12px;color:' + v.shareFg + '">' + esc(v.tShareLink) + '</span>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;align-items:center;gap:12px">' +
            '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.2em;color:var(--text-muted)">' + esc(v.tShareSocial) + '</span>' +
            '<div style="display:flex;gap:12px;justify-content:center">' +
              v.shareTargets.map(function (t) {
                return '<div data-a="shareTo" data-id="' + t.k + '" title="' + esc(t.label) + '" class="hv-share" style="cursor:pointer;width:54px;height:54px;border-radius:14px;border:1px solid var(--border-strong);background:rgba(18,18,26,.7);display:flex;align-items:center;justify-content:center;transition:transform .15s var(--ease-arcade), border-color .15s, background .15s">' +
                  '<div style="width:24px;height:24px;background-image:url(\'' + t.icon + '\');background-size:contain;background-repeat:no-repeat;background-position:center;opacity:.92"></div>' +
                '</div>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:center">' +
            '<button data-a="copyShare" class="ds-btn ds-btn--hot ds-btn--md">' + esc(v.tShareCopy) + '</button>' +
            '<button data-a="closeShare" class="ds-btn ds-btn--ghost ds-btn--md">' + esc(v.tShareClose) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  };

  function endStats(v, cells) {
    return '<div style="position:relative;display:flex;gap:44px;margin-top:30px;animation:fadeUp .6s ease-out .34s both">' +
      cells.map(function (c, i) {
        return (i ? '<div style="width:1px;background:' + c.rule + '"></div>' : '') +
          '<div style="display:flex;flex-direction:column;align-items:center;gap:5px">' +
            '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.18em;color:' + c.labelColor + '">' + esc(c.label) + '</span>' +
            '<span style="font-family:var(--font-display);font-weight:900;font-size:30px;color:' + c.color + '">' + esc(c.value) + '</span>' +
          '</div>';
      }).join('') +
    '</div>';
  }

  S.endMafia = function (v) {
    return '' +
      '<div data-screen-label="Verdict — Mafia won" style="position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:52px 24px 44px;gap:0;overflow:hidden;background:radial-gradient(120% 78% at 50% 12%, #21070A 0%, #0A0308 46%, #000000 100%)">' +
        '<div style="position:absolute;inset:-12% -8%;pointer-events:none;background:radial-gradient(38% 30% at 22% 62%, rgba(180,186,196,.13), transparent 70%),radial-gradient(44% 26% at 74% 48%, rgba(150,158,170,.1), transparent 72%),radial-gradient(30% 22% at 48% 82%, rgba(120,128,140,.09), transparent 70%);filter:blur(26px);animation:smokeDrift 22s ease-in-out infinite alternate"></div>' +
        '<div style="position:absolute;top:-10%;left:50%;width:520px;height:520px;transform:translateX(-50%);pointer-events:none;background:radial-gradient(circle, rgba(238,45,35,.3), rgba(238,45,35,.06) 52%, transparent 72%);animation:bloomBreathe 6s ease-in-out infinite"></div>' +
        '<div style="position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 220px 90px rgba(0,0,0,.92)"></div>' +
        '<div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:10px;animation:fadeUp .55s ease-out both">' +
          '<span style="font-family:var(--font-pixel);font-size:10px;letter-spacing:.2em;color:rgba(238,45,35,.75)">' + esc(v.tGameOver) + '</span>' +
          '<span style="font-family:var(--font-display);font-weight:900;font-size:clamp(38px,5.2vw,64px);line-height:1.02;letter-spacing:.02em;text-transform:uppercase;text-align:center;max-width:14ch;color:#F3F2EF;text-shadow:0 0 42px rgba(238,45,35,.55), 0 6px 26px rgba(0,0,0,.95);text-wrap:balance">' + esc(v.endTitle) + '</span>' +
          '<div style="display:flex;align-items:center;gap:14px;margin-top:6px">' +
            '<div style="width:52px;height:1px;background:linear-gradient(90deg, transparent, rgba(238,45,35,.85))"></div>' +
            '<span style="font-family:var(--font-display);font-weight:800;font-size:15px;letter-spacing:.28em;text-transform:uppercase;color:#EE2D23">' + esc(v.endKicker) + '</span>' +
            '<div style="width:52px;height:1px;background:linear-gradient(90deg, rgba(238,45,35,.85), transparent)"></div>' +
          '</div>' +
        '</div>' +
        '<div class="mf-endcards" style="position:relative;display:flex;align-items:flex-end;justify-content:center;margin:34px 0 6px;height:266px;animation:cardRise .7s var(--ease-arcade) .12s both">' +
          '<div style="width:150px;height:210px;border-radius:11px;background-image:url(\'assets/mafia/cards/mafia-hitman.svg\');background-size:cover;transform:rotate(-15deg) translate(48px,14px);filter:brightness(.5) saturate(.7);box-shadow:0 22px 44px rgba(0,0,0,.9)"></div>' +
          '<div style="position:relative;z-index:2;width:186px;height:260px;border-radius:13px;background-image:url(\'assets/mafia/cards/mafia-boss.svg\');background-size:cover;box-shadow:0 0 0 1px rgba(238,45,35,.4), 0 0 60px rgba(238,45,35,.32), 0 30px 60px rgba(0,0,0,.95)"></div>' +
          '<div style="width:150px;height:210px;border-radius:11px;background-image:url(\'assets/mafia/cards/mafia-hitman.svg\');background-size:cover;transform:rotate(15deg) translate(-48px,14px) scaleX(-1);filter:brightness(.5) saturate(.7);box-shadow:0 22px 44px rgba(0,0,0,.9)"></div>' +
        '</div>' +
        '<div style="position:relative;display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:660px;margin-top:22px;animation:fadeUp .6s ease-out .26s both">' +
          v.endWinners.map(function (w) {
            return '<div style="box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:9px 16px 9px 10px;border-radius:999px;border:1px solid rgba(238,45,35,.35);background:rgba(20,6,8,.72)">' +
              '<div style="width:30px;height:30px;border-radius:50%;border:1px solid rgba(238,45,35,.6);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:800;font-size:13px;color:#EE2D23"><div style="width:18px;height:18px;background-image:url(\'' + w.token + '\');background-size:contain;background-repeat:no-repeat;background-position:center;opacity:.92"></div></div>' +
              '<span style="font-size:13px;font-weight:600;color:#E8EAF0">' + esc(w.name) + '</span>' +
              '<span style="font-family:var(--font-pixel);font-size:8px;letter-spacing:.12em;color:rgba(238,45,35,.8)">' + esc(w.roleName) + '</span>' +
            '</div>';
          }).join('') +
        '</div>' +
        endStats(v, [
          { label: v.tStatRounds, value: v.statRounds, color: '#F3F2EF', labelColor: 'var(--text-muted)', rule: 'rgba(238,45,35,.25)' },
          { label: v.tStatMafia, value: v.statMafia, color: '#EE2D23', labelColor: 'var(--text-muted)', rule: 'rgba(238,45,35,.25)' },
          { label: v.tStatSurvivors, value: v.statSurvivors, color: '#F3F2EF', labelColor: 'var(--text-muted)', rule: 'rgba(238,45,35,.25)' }
        ]) +
        '<div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:16px;margin-top:32px;animation:fadeUp .6s ease-out .42s both">' +
          '<span style="font-size:14px;color:var(--text-secondary)">' + esc(v.youWonText) + '</span>' +
          '<div style="display:flex;gap:12px;align-items:center">' +
            '<button data-a="playAgain" class="ds-btn ds-btn--hot ds-btn--lg">' + esc(v.tPlayAgain) + '</button>' +
            '<button data-a="share" class="ds-btn ds-btn--ghost ds-btn--lg">' + esc(v.tShareBtn) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  };

  S.endVillage = function (v) {
    return '' +
      '<div data-screen-label="Verdict — Citizens won" style="position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:52px 24px 44px;gap:0;overflow:hidden;background:radial-gradient(115% 72% at 50% 4%, #DCEFF5 0%, #6FA8BE 22%, #1E4468 52%, #0B1D3A 100%)">' +
        '<div style="position:absolute;top:-24%;left:50%;width:760px;height:760px;transform:translateX(-50%);pointer-events:none;background:radial-gradient(circle, rgba(255,255,255,.75), rgba(143,197,209,.34) 40%, transparent 70%);animation:bloomBreathe 7s ease-in-out infinite"></div>' +
        '<div style="position:absolute;top:0;left:50%;width:900px;height:620px;transform:translateX(-50%);pointer-events:none;opacity:.35;background:repeating-conic-gradient(from 200deg at 50% 0%, rgba(255,255,255,.5) 0deg 2.5deg, transparent 2.5deg 9deg);mask-image:radial-gradient(circle at 50% 0%, #000 12%, transparent 68%);-webkit-mask-image:radial-gradient(circle at 50% 0%, #000 12%, transparent 68%)"></div>' +
        '<div style="position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 -140px 160px -60px rgba(11,29,58,.85)"></div>' +
        '<div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:10px;animation:fadeUp .55s ease-out both">' +
          '<span style="font-family:var(--font-pixel);font-size:10px;letter-spacing:.2em;color:#0B1D3A">' + esc(v.tGameOver) + '</span>' +
          '<span style="font-family:var(--font-display);font-weight:900;font-size:clamp(38px,5.2vw,64px);line-height:1.02;letter-spacing:.02em;text-transform:uppercase;text-align:center;max-width:15ch;color:#08223D;text-shadow:0 0 46px rgba(255,255,255,.85), 0 2px 0 rgba(255,255,255,.5);text-wrap:balance">' + esc(v.endTitle) + '</span>' +
          '<div style="display:flex;align-items:center;gap:14px;margin-top:6px">' +
            '<div style="width:52px;height:1px;background:linear-gradient(90deg, transparent, rgba(11,29,58,.7))"></div>' +
            '<span style="font-family:var(--font-display);font-weight:800;font-size:15px;letter-spacing:.28em;text-transform:uppercase;color:#0B1D3A">' + esc(v.endKicker) + '</span>' +
            '<div style="width:52px;height:1px;background:linear-gradient(90deg, rgba(11,29,58,.7), transparent)"></div>' +
          '</div>' +
        '</div>' +
        '<div class="mf-endcards" style="position:relative;display:flex;align-items:flex-end;justify-content:center;margin:34px 0 6px;height:270px;animation:cardRise .7s var(--ease-arcade) .12s both">' +
          '<div style="width:142px;height:198px;border-radius:11px;background-image:url(\'assets/mafia/cards/sheriff.svg\');background-size:cover;transform:rotate(-16deg) translate(76px,18px);box-shadow:0 20px 40px rgba(8,34,61,.55)"></div>' +
          '<div style="width:152px;height:212px;border-radius:11px;background-image:url(\'assets/mafia/cards/citizen-f.svg\');background-size:cover;transform:rotate(-7deg) translate(38px,6px);box-shadow:0 22px 44px rgba(8,34,61,.55)"></div>' +
          '<div style="position:relative;z-index:2;width:186px;height:260px;border-radius:13px;background-image:url(\'assets/mafia/cards/citizen-m.svg\');background-size:cover;box-shadow:0 0 0 1px rgba(255,255,255,.55), 0 0 70px rgba(255,255,255,.6), 0 28px 56px rgba(8,34,61,.6)"></div>' +
          '<div style="width:152px;height:212px;border-radius:11px;background-image:url(\'assets/mafia/cards/doctor.svg\');background-size:cover;transform:rotate(11deg) translate(-38px,6px);box-shadow:0 22px 44px rgba(8,34,61,.55)"></div>' +
        '</div>' +
        '<div style="position:relative;display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:700px;margin-top:22px;animation:fadeUp .6s ease-out .26s both">' +
          v.endWinners.map(function (w) {
            return '<div style="box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:9px 16px 9px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.6);background:rgba(255,255,255,.82)">' +
              '<div style="width:30px;height:30px;border-radius:50%;border:1px solid rgba(11,29,58,.35);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:800;font-size:13px;color:#0B1D3A"><div style="width:18px;height:18px;background-image:url(\'' + w.token + '\');background-size:contain;background-repeat:no-repeat;background-position:center;opacity:.92;filter:invert(1)"></div></div>' +
              '<span style="font-size:13px;font-weight:600;color:#08223D">' + esc(w.name) + '</span>' +
              '<span style="font-family:var(--font-pixel);font-size:8px;letter-spacing:.12em;color:' + w.roleColor + '">' + esc(w.roleName) + '</span>' +
            '</div>';
          }).join('') +
        '</div>' +
        endStats(v, [
          { label: v.tStatRounds, value: v.statRounds, color: '#FFFFFF', labelColor: 'rgba(232,234,240,.75)', rule: 'rgba(232,234,240,.3)' },
          { label: v.tStatSaved, value: v.statSurvivors, color: '#8FC5D1', labelColor: 'rgba(232,234,240,.75)', rule: 'rgba(232,234,240,.3)' },
          { label: v.tStatMafia, value: v.statMafia, color: '#FFFFFF', labelColor: 'rgba(232,234,240,.75)', rule: 'rgba(232,234,240,.3)' }
        ]) +
        '<div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:16px;margin-top:32px;animation:fadeUp .6s ease-out .42s both">' +
          '<span style="font-size:14px;color:rgba(232,234,240,.9)">' + esc(v.youWonText) + '</span>' +
          '<div style="display:flex;gap:12px;align-items:center">' +
            '<button data-a="playAgain" class="ds-btn ds-btn--primary ds-btn--lg">' + esc(v.tPlayAgain) + '</button>' +
            '<button data-a="share" class="ds-btn ds-btn--ghost ds-btn--lg">' + esc(v.tShareBtn) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  };

  global.MafiaScreensB = S;
})(window);
