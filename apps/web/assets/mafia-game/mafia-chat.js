/* Mafia — the phone's night and day.

   With the television carrying the narration, the phone is where the game
   is actually played, and at night and during the day what a player does is
   talk. So both phases are a messaging app: a list of conversations, and a
   thread you open from it.

   Your night action is not a separate screen -- it sits at the top of the
   same list as a card you open, so choosing a target never costs you the
   conversation you were in the middle of. */
(function (global) {
  var S = {};
  var esc = global.MafiaScreensA.esc;
  var A = global.MafiaScreensA;

  function avatar(token, ring, size) {
    var inner = Math.round(size * 0.6);
    return '<div style="width:' + size + 'px;height:' + size + 'px;flex:none;border-radius:50%;border:2px solid ' + ring + ';display:flex;align-items:center;justify-content:center">' +
      '<div style="width:' + inner + 'px;height:' + inner + 'px;background-image:url(\'' + token + '\');background-size:contain;background-repeat:no-repeat;background-position:center;opacity:.92"></div>' +
    '</div>';
  }

  /* Phase title + clock, the same strip above both the night and the day. */
  function bar(v) {
    return '<div style="display:flex;align-items:center;gap:12px;padding:0 2px">' +
      '<span style="font-family:var(--font-display);font-weight:800;font-size:19px;letter-spacing:.05em;text-transform:uppercase">' + esc(v.chatTitle) + '</span>' +
      '<span style="font-family:var(--font-pixel);font-size:12px;letter-spacing:.14em;color:' + v.timerColor + ';border:1px solid ' + v.timerBorder + ';border-radius:6px;padding:5px 12px 4px;margin-inline-start:auto">' + esc(v.dayTimer) + '</span>' +
    '</div>';
  }

  function bubbles(lines, emptyText) {
    if (!lines.length) {
      return '<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:26px 0"><span style="font-size:13px;color:var(--text-muted);text-align:center">' + esc(emptyText) + '</span></div>';
    }
    return lines.map(function (m, i) {
      return '<div data-k="cb' + i + '" style="display:flex;flex-direction:column;gap:3px;align-items:' + (m.mine ? 'flex-end' : 'flex-start') + ';animation:fadeUp .25s ease-out both">' +
        (m.mine ? '' : '<span style="font-family:var(--font-pixel);font-size:8px;letter-spacing:.12em;color:' + (m.color || 'var(--text-muted)') + '">' + esc(m.who) + '</span>') +
        '<span style="font-size:14px;line-height:1.45;color:var(--text-primary);background:' + (m.mine ? 'rgba(93,214,168,.14)' : 'rgba(247,247,255,.07)') + ';border:1px solid ' + (m.mine ? 'rgba(93,214,168,.25)' : 'var(--border-subtle)') + ';border-radius:' + (m.mine ? '12px 12px 3px 12px' : '12px 12px 12px 3px') + ';padding:8px 12px;max-width:82%;word-break:break-word">' + esc(m.text) + '</span>' +
      '</div>';
    }).join('');
  }

  function composer(role, placeholder, sendLabel, action, accent) {
    return '<div style="display:flex;gap:8px;padding-top:2px">' +
      '<input data-role="' + role + '" placeholder="' + esc(placeholder) + '" style="flex:1;min-width:0;background:rgba(18,18,26,.7);border:1px solid ' + accent + ';border-radius:10px;padding:12px 14px;color:var(--soft-white);font-family:var(--font-body);font-size:14px;outline:none">' +
      '<button data-a="' + action + '" class="ds-btn ds-btn--ghost ds-btn--sm">' + esc(sendLabel) + '</button>' +
    '</div>';
  }

  /* An open thread fills the screen, phone-messenger style: back, who you
     are talking to, the messages, the box. */
  S.thread = function (v) {
    var mafia = v.chatOpenIsTeam;
    var accent = mafia ? 'rgba(238,45,35,.45)' : 'var(--border-strong)';
    return '<div data-screen-label="' + (mafia ? 'Team thread' : 'Private thread') + '" class="mf-screen" style="flex:1;display:flex;flex-direction:column;padding:16px 16px 20px;gap:12px;max-width:620px;width:100%;margin:0 auto;animation:fadeIn .2s both">' +
      '<div style="display:flex;align-items:center;gap:12px">' +
        '<button data-a="closeThread" class="ds-btn ds-btn--ghost ds-btn--sm">' + esc(v.tBack) + '</button>' +
        '<span style="font-family:var(--font-display);font-weight:800;font-size:17px;letter-spacing:.04em;text-transform:uppercase;color:' + (mafia ? '#EE2D23' : 'var(--text-primary)') + '">' + esc(v.chatOpenName) + '</span>' +
        (mafia ? '<span style="font-family:var(--font-pixel);font-size:8px;letter-spacing:.14em;color:#EE2D23;border:1px solid rgba(238,45,35,.4);border-radius:99px;padding:4px 9px 3px">' + esc(v.tMafiaOnly) + '</span>' : '') +
      '</div>' +
      '<div style="flex:1;min-height:280px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;background:linear-gradient(180deg, rgba(11,29,58,.4), rgba(11,11,20,.5));border:1px solid ' + accent + ';border-radius:14px;padding:16px">' +
        bubbles(v.chatOpenLines, v.tNoMessages) +
      '</div>' +
      composer(mafia ? 'wm' : 'pm', v.tSayPh, v.tSend, mafia ? 'sendWhisper' : 'sendPrivate', accent) +
    '</div>';
  };

  /* Out of the game: still in the room, still watching, but with nothing
     the server would accept. Said plainly rather than shown as a chat list
     that quietly drops what you type into it. */
  S.spectating = function (v, label) {
    return '<div data-screen-label="' + label + '" class="mf-screen" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;gap:14px;animation:fadeIn .4s both">' +
      '<span style="font-family:var(--font-pixel);font-size:11px;letter-spacing:.18em;color:#EE2D23">' + esc(v.tOut) + '</span>' +
      '<span style="font-family:var(--font-display);font-weight:900;font-size:30px;letter-spacing:.04em;text-transform:uppercase;text-align:center">' + esc(v.chatTitle) + '</span>' +
      '<span style="color:var(--text-secondary);font-size:14px;text-align:center;max-width:22em">' + esc(v.tOutSub) + '</span>' +
      '<span style="font-family:var(--font-pixel);font-size:22px;letter-spacing:.1em;color:' + v.timerColor + ';border:1px solid ' + v.timerBorder + ';border-radius:10px;padding:11px 20px 8px;margin-top:8px">' + esc(v.dayTimer) + '</span>' +
    '</div>';
  };

  /* The night, as a phone. Your action card first, then everyone you can
     talk to. */
  S.night = function (v) {
    if (v.isOut) return S.spectating(v, 'Night phase');
    if (v.chatOpen) return S.thread(v);
    return '<div data-screen-label="Night phase" class="mf-screen" style="flex:1;display:flex;flex-direction:column;padding:18px 16px 26px;gap:14px;max-width:620px;width:100%;margin:0 auto;animation:fadeUp .3s ease-out both">' +
      bar(v) +
      (v.showReadResult ? A.readResult(v) : '') +
      (v.actionCard ? S.actionCard(v) : '') +
      '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.18em;color:var(--text-muted);padding:6px 2px 0">' + esc(v.tChats) + '</span>' +
      S.threadList(v) +
    '</div>';
  };

  /* The one thing on the night screen that isn't a conversation: what your
     role does tonight. Collapsed to a summary once you've committed, so a
     player who has acted gets their whole screen back for talking. */
  S.actionCard = function (v) {
    var a = v.actionCard;
    if (a.done) {
      return '<div style="display:flex;align-items:center;gap:11px;background:rgba(11,29,58,.5);border:1px solid ' + a.color + ';border-radius:12px;padding:13px 15px">' +
        '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.14em;color:' + a.color + '">' + esc(a.doneLabel) + '</span>' +
        '<span style="font-size:14px;font-weight:600;color:var(--text-primary);margin-inline-start:auto">' + esc(a.doneTarget) + '</span>' +
      '</div>';
    }
    if (!a.open) {
      return '<div data-a="openAction" style="cursor:pointer;display:flex;align-items:center;gap:11px;background:linear-gradient(180deg, rgba(28,10,14,.7), rgba(11,11,20,.6));border:1px solid ' + a.color + ';border-radius:12px;padding:15px 16px;transition:all .15s var(--ease-arcade)" class="hv-lift3">' +
        '<div style="display:flex;flex-direction:column;gap:3px">' +
          '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.14em;color:' + a.color + '">' + esc(a.kicker) + '</span>' +
          '<span style="font-size:15px;font-weight:700;color:var(--text-primary)">' + esc(a.title) + '</span>' +
        '</div>' +
        '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.14em;color:var(--text-muted);margin-inline-start:auto">' + esc(v.tOpen) + '</span>' +
      '</div>';
    }
    return '<div style="display:flex;flex-direction:column;gap:13px;background:linear-gradient(180deg, rgba(28,10,14,.7), rgba(11,11,20,.6));border:1px solid ' + a.color + ';border-radius:14px;padding:16px">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.14em;color:' + a.color + '">' + esc(a.kicker) + '</span>' +
        '<button data-a="closeAction" class="ds-btn ds-btn--ghost ds-btn--sm" style="margin-inline-start:auto">' + esc(v.tHide) + '</button>' +
      '</div>' +
      '<span style="font-size:15px;font-weight:700">' + esc(a.title) + '</span>' +
      '<span style="font-size:13px;color:var(--text-secondary);line-height:1.45">' + esc(a.sub) + '</span>' +
      (v.showAbilities ? A.abilities(v) : '') +
      '<div style="display:flex;flex-wrap:wrap;gap:9px">' +
        v.candidates.map(function (c) {
          return '<div ' + (c.blocked ? 'data-blocked="1"' : 'data-a="pickNight"') + ' data-id="' + c.id + '" data-k="ac' + c.id + '" style="flex:1 1 128px;opacity:' + (c.blocked ? '.4' : '1') + ';cursor:' + (c.blocked ? 'not-allowed' : 'pointer') + ';display:flex;align-items:center;gap:9px;background:rgba(11,11,20,.55);border:1px solid ' + c.border + ';box-shadow:' + c.shadow + ';border-radius:10px;padding:9px 12px;transition:all .15s">' +
            avatar(c.token, c.ring, 28) +
            '<div style="display:flex;flex-direction:column;gap:1px;min-width:0">' +
              '<span style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(c.name) + '</span>' +
              (c.tag ? '<span style="font-family:var(--font-pixel);font-size:7px;letter-spacing:.12em;color:' + c.tagColor + '">' + esc(c.tag) + '</span>' : '') +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<button data-a="confirmNight" class="ds-btn ds-btn--' + v.nightBtnVariant + '"' + (v.nightConfirmDisabled ? ' disabled' : '') + '>' + esc(v.nightConfirmLabel) + '</button>' +
    '</div>';
  };

  /* Every conversation open to you: the Mafia's own channel if you have
     one, then one row per living player. */
  S.threadList = function (v) {
    return '<div style="display:flex;flex-direction:column;gap:8px">' +
      v.chatRows.map(function (r) {
        return '<div data-a="openThread" data-id="' + r.id + '" data-k="cr' + r.id + '" style="cursor:pointer;display:flex;align-items:center;gap:12px;background:' + (r.team ? 'rgba(28,10,14,.55)' : 'rgba(11,11,20,.5)') + ';border:1px solid ' + (r.unread ? 'var(--cyber-cyan)' : r.team ? 'rgba(238,45,35,.35)' : 'var(--border-subtle)') + ';border-radius:12px;padding:11px 14px;transition:all .15s" class="hv-lift3">' +
          avatar(r.token, r.ring, 34) +
          '<div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0">' +
            '<div style="display:flex;align-items:center;gap:7px">' +
              '<span style="font-size:14px;font-weight:700;color:' + (r.team ? '#EE2D23' : 'var(--text-primary)') + '">' + esc(r.name) + '</span>' +
              (r.badge ? '<span style="font-family:var(--font-pixel);font-size:7px;letter-spacing:.12em;color:' + r.badgeColor + ';border:1px solid ' + r.badgeColor + ';border-radius:99px;padding:3px 6px 2px">' + esc(r.badge) + '</span>' : '') +
            '</div>' +
            '<span style="font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(r.preview) + '</span>' +
          '</div>' +
          (r.unread ? '<div style="width:9px;height:9px;flex:none;border-radius:50%;background:var(--cyber-cyan);box-shadow:0 0 10px var(--cyber-cyan)"></div>' : '') +
        '</div>';
      }).join('') +
    '</div>';
  };

  /* The day is one room-wide conversation, so it needs no list -- it opens
     straight into the thread, with the roster folded above it. */
  S.day = function (v) {
    if (v.isOut) return S.spectating(v, 'Day discussion');
    return '<div data-screen-label="Day discussion" class="mf-screen" style="flex:1;display:flex;flex-direction:column;padding:18px 16px 26px;gap:12px;max-width:620px;width:100%;margin:0 auto;animation:fadeUp .3s ease-out both">' +
      bar(v) +
      '<div style="display:flex;gap:7px;overflow-x:auto;padding:2px 0 6px">' +
        v.roster.map(function (r, i) {
          return '<div data-k="dr' + i + '" style="flex:none;display:inline-flex;align-items:center;gap:7px;opacity:' + r.op + ';border:1px solid var(--border-subtle);border-radius:99px;padding:4px 12px 4px 4px;background:rgba(11,11,20,.5)">' +
            avatar(r.token, r.ring, 24) +
            '<span style="font-size:12px;font-weight:600;white-space:nowrap">' + esc(r.name) + '</span>' +
          '</div>';
        }).join('') +
      '</div>' +
      // Said once, above the thread: the day is a forum. Without it people
      // assume the names are simply missing.
      '<span style="font-family:var(--font-pixel);font-size:8px;letter-spacing:.14em;color:var(--text-muted);padding:0 2px">' + esc(v.tDayAnon) + '</span>' +
      '<div style="flex:1;min-height:260px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;background:linear-gradient(180deg, rgba(28,42,72,.5), rgba(15,17,30,.5));border:1px solid var(--border-subtle);border-radius:14px;padding:16px">' +
        bubbles(v.dayLines, v.tNoMessages) +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:7px">' +
        v.quickReplies.map(function (q, i) {
          return '<div data-a="sayQuick" data-id="' + i + '" class="hv-quick" style="cursor:pointer;font-size:12px;color:' + q.fg + ';border:1px solid ' + q.bd + ';border-radius:99px;padding:7px 13px;user-select:none;transition:all .15s">' + esc(q.text) + '</div>';
        }).join('') +
      '</div>' +
      composer('dm', v.tSayPh, v.tSend, 'sendDay', 'var(--border-strong)') +
      (v.canVote
        ? '<button data-a="startVote" class="ds-btn ds-btn--hot ds-btn--lg">' + esc(v.tStartVote) + '</button>'
        : '') +
    '</div>';
  };

  global.MafiaChat = S;
})(window);
