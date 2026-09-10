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
    return '<div class="mf-phasebar" style="display:flex;align-items:center;gap:12px;padding:0 2px">' +
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
    return '<div data-screen-label="' + (mafia ? 'Team thread' : 'Private thread') + '" class="mf-screen" style="flex:1;display:flex;flex-direction:column;padding:16px 16px 20px;gap:12px;box-sizing:border-box;max-width:620px;width:100%;margin:0 auto;animation:fadeIn .2s both">' +
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
  /* What the Detective's Reveal came back with. Answered on the spot, in
     the night that spent the ability -- an investigation you have to wait
     until morning to hear is no use to anyone. The card the design drew for
     this lived on its night screen, which the messaging layout replaced, so
     it is restated here. */
  S.revealResult = function (v) {
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;background:linear-gradient(180deg, rgba(11,29,58,.55), rgba(11,11,20,.6));border:1px solid ' + v.sheriffBorder + ';box-shadow:0 0 34px ' + v.sheriffGlow + ';border-radius:14px;padding:20px 22px;animation:popIn .35s var(--ease-arcade) both">' +
      '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.16em;color:var(--text-muted)">' + esc(v.tInvResult) + '</span>' +
      '<span style="font-family:var(--font-display);font-weight:900;font-size:22px;letter-spacing:.04em;text-transform:uppercase;text-align:center;color:' + v.sheriffColor + ';text-shadow:0 3px 12px rgba(0,0,0,.85)">' + esc(v.sheriffText) + '</span>' +
      // Dismissable, like the Read result. What you learned stays on the
      // collapsed action card underneath, so closing this loses nothing.
      '<button data-a="sheriffContinue" class="ds-btn ds-btn--ghost ds-btn--sm">' + esc(v.tCloseEyes) + '</button>' +
    '</div>';
  };

  /* What a Read turned up: every conversation the target had last round,
     named by nothing but their order. You open one and get the whole thing;
     the rest stay shut. */
  S.readPicker = function (v) {
    return '<div style="display:flex;flex-direction:column;gap:11px;background:linear-gradient(180deg, rgba(11,29,58,.55), rgba(11,11,20,.6));border:1px solid rgba(200,169,78,.4);border-radius:14px;padding:18px 18px 20px;animation:popIn .35s var(--ease-arcade) both">' +
      '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.16em;color:var(--text-muted)">' + esc(v.tReadPick) + '</span>' +
      '<span style="font-family:var(--font-display);font-weight:900;font-size:20px;letter-spacing:.04em;text-transform:uppercase;color:#C8A94E">' + esc(v.readName) + '</span>' +
      '<span style="font-size:13px;line-height:1.45;color:var(--text-secondary)">' + esc(v.tReadPickSub) + '</span>' +
      (v.readOptions.length
        ? '<div style="display:flex;flex-direction:column;gap:8px">' +
            v.readOptions.map(function (o) {
              return '<div data-a="openRead" data-id="' + o.index + '" data-k="ro' + o.index + '" class="hv-lift3" style="cursor:pointer;display:flex;align-items:center;gap:12px;background:rgba(11,11,20,.55);border:1px solid rgba(200,169,78,.35);border-radius:10px;padding:12px 14px;transition:all .15s">' +
                '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.14em;color:#C8A94E;flex:1;text-align:start">' + esc(o.label) + '</span>' +
                '<span style="font-family:var(--font-pixel);font-size:8px;letter-spacing:.12em;color:var(--text-muted)">' + esc(o.countLabel) + '</span>' +
              '</div>';
            }).join('') +
          '</div>'
        : '<p style="margin:0;font-size:13px;color:var(--text-secondary)">' + esc(v.tReadEmpty) + '</p>') +
    '</div>';
  };

  S.night = function (v) {
    if (v.isOut) return S.spectating(v, 'Night phase');
    if (v.chatOpen) return S.thread(v);
    return '<div data-screen-label="Night phase" class="mf-screen" style="flex:1;display:flex;flex-direction:column;padding:18px 16px 26px;gap:14px;box-sizing:border-box;max-width:620px;width:100%;margin:0 auto;animation:fadeUp .3s ease-out both">' +
      bar(v) +
      (v.showReadPicker ? S.readPicker(v) : '') +
      (v.showReadResult ? A.readResult(v) : '') +
      (v.showRevealResult ? S.revealResult(v) : '') +
      // The Detective's own cards already say where their move is, so don't
      // stack the generic acknowledgement on top of them.
      (v.showReadPicker || v.showReadResult || v.showRevealResult ? '' : v.actionCard ? S.actionCard(v) : '') +
      // The inbox header. One row: a message glyph, the section name, and the
      // line that says what the rows are for. Deliberately compact -- it sits
      // on a phone screen that has to hold the phase clock, the action card and
      // every conversation without scrolling.
      '<div class="mf-chats-label" style="display:flex;align-items:center;gap:9px;padding:4px 2px 0">' +
        '<span class="mf-chats-icon" style="flex:none;display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;border:1px solid var(--border-strong);background:rgba(11,29,58,.45);color:var(--cyber-cyan)">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.1-.5L3 21l1.6-4.6A8.3 8.3 0 0 1 3.6 11.5 8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z"></path></svg>' +
        '</span>' +
        '<span style="display:flex;flex-direction:column;min-width:0;line-height:1.2">' +
          '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.18em;color:var(--text-secondary)">' + esc(v.tChats) + '</span>' +
          '<span class="mf-chats-sub" style="font-size:11px;color:var(--text-muted)">' + esc(v.tChatsSub) + '</span>' +
        '</span>' +
        // Nobody else in the room can read these. Worth saying on the header
        // of a game built on who trusts whom.
        '<span class="mf-chats-secret" style="margin-inline-start:auto">' +
          '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>' +
          esc(v.tChatsSecret) +
        '</span>' +
      '</div>' +
      S.threadList(v) +
    '</div>';
  };

  /* The one thing on the night screen that isn't a conversation: what your
     role does tonight. Collapsed to a summary once you've committed, so a
     player who has acted gets their whole screen back for talking. */
  S.actionCard = function (v) {
    var a = v.actionCard;
    if (a.spent) {
      return '<div style="display:flex;flex-direction:column;gap:6px;background:rgba(11,29,58,.5);border:1px solid ' + a.color + ';border-radius:12px;padding:14px 16px">' +
        '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.14em;color:' + a.color + '">' + esc(a.spentLabel) + '</span>' +
        '<span style="font-size:13px;line-height:1.45;color:var(--text-secondary)">' + esc(a.spentSub) + '</span>' +
      '</div>';
    }
    if (a.done) {
      return '<div style="display:flex;align-items:center;gap:11px;background:rgba(11,29,58,.5);border:1px solid ' + a.color + ';border-radius:12px;padding:13px 15px">' +
        '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.14em;color:' + a.color + '">' + esc(a.doneLabel) + '</span>' +
        '<span style="font-size:14px;font-weight:600;color:var(--text-primary);margin-inline-start:auto">' + esc(a.doneTarget) + '</span>' +
      '</div>';
    }
    if (!a.open) {
      // The whole card is the button -- it always was, but nothing on it said
      // so. The move it is asking for now runs the full width of the card as
      // its own bar, in the role's colour, with a chevron: down, because
      // tapping expands this card in place rather than going anywhere, and a
      // vertical chevron needs no mirroring under RTL.
      //
      // role/tabindex/aria-label because this is a div doing a button's job;
      // Enter and Space are handled with the other keyboard shortcuts in
      // mafia-view.js.
      return '<div data-a="openAction" role="button" tabindex="0" aria-label="' + esc(a.cta || v.tOpen) + '"' +
        ' class="hv-lift3 mf-action-open"' +
        ' style="cursor:pointer;display:flex;flex-direction:column;gap:12px;background:linear-gradient(180deg, rgba(28,10,14,.7), rgba(11,11,20,.6));border:1px solid ' + a.color + ';border-radius:12px;padding:15px 16px;transition:all .15s var(--ease-arcade)">' +
        '<div style="display:flex;flex-direction:column;gap:4px">' +
          '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.14em;color:' + a.color + '">' + esc(a.kicker) + '</span>' +
          '<span style="font-size:16px;font-weight:700;line-height:1.35;color:var(--text-primary)">' + esc(a.title) + '</span>' +
        '</div>' +
        '<span class="mf-action-cta" style="display:flex;align-items:center;justify-content:center;gap:9px;border:1px solid ' + a.color + ';border-radius:9px;padding:12px 14px;background:color-mix(in srgb, ' + a.color + ' 16%, transparent);color:' + a.color + '">' +
          '<span style="font-family:var(--font-pixel);font-size:11px;letter-spacing:.14em">' + esc(a.cta || v.tOpen) + '</span>' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
        '</span>' +
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
  /* The inbox.

     One surface with hairline-separated rows, not a stack of bordered cards:
     that is the difference between a messaging list and a list of players who
     happen to be tappable. A row is avatar, then who and the last thing said,
     then the mark that says what to do about it -- an unread pip, or the
     chevron that says the row opens.

     Structure is markup; everything about how it looks is in mafia-game.css
     under .mf-inbox, so the two states a row can be in (unread, never spoken
     to) are one class each rather than a ternary in a style attribute. */
  S.threadList = function (v) {
    return '<div class="mf-threadlist mf-inbox">' +
      v.chatRows.map(function (r) {
        return '<div data-a="openThread" data-id="' + r.id + '" data-k="cr' + r.id + '"' +
          ' role="button" tabindex="0" aria-label="' + esc(r.name) + '"' +
          ' class="mf-chatrow' + (r.unread ? ' is-unread' : '') + (r.team ? ' is-team' : '') + (r.empty ? ' is-quiet' : '') + '">' +
          '<span class="mf-chatrow-av">' + avatar(r.token, r.ring, 40) + '</span>' +
          '<span class="mf-chatrow-main">' +
            '<span class="mf-chatrow-top">' +
              '<span class="mf-chatrow-name">' + esc(r.name) + '</span>' +
              (r.badge ? '<span class="mf-chatrow-badge" style="color:' + r.badgeColor + ';border-color:' + r.badgeColor + '">' + esc(r.badge) + '</span>' : '') +
            '</span>' +
            '<span class="mf-chatrow-line">' + esc(r.preview) + '</span>' +
          '</span>' +
          '<span class="mf-chatrow-meta">' +
            (r.unread
              ? '<span class="mf-chatrow-dot" aria-hidden="true"></span>'
              : '<svg class="mf-chatrow-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>') +
          '</span>' +
        '</div>';
      }).join('') +
    '</div>';
  };

  /* The day is one room-wide conversation, so it needs no list -- it opens
     straight into the thread, with the roster folded above it. */
  S.day = function (v) {
    if (v.isOut) return S.spectating(v, 'Day discussion');
    return '<div data-screen-label="Day discussion" class="mf-screen" style="flex:1;display:flex;flex-direction:column;padding:18px 16px 26px;gap:12px;box-sizing:border-box;max-width:620px;width:100%;margin:0 auto;animation:fadeUp .3s ease-out both">' +
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
