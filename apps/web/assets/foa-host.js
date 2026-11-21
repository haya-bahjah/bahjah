// مع أو ضد -- the host's controls (wireframes' "Host controls" column and the
// on-TV host bar). One list of actions per phase, drawn by both the big
// screen's bar (assets/foa-host-console.js) and the host's own phone when
// the host plays too (assets/foa-play.js), so the two can never disagree.
// Every skip and every step that cannot be undone asks first.
window.FoaHost = (function () {
  const UI = window.FoaUI;
  const esc = UI.esc;
  // Offline players the host chose to wait for, so the prompt stops asking.
  const waited = new Set();

  function offlinePlayer(state, room) {
    const d = (state && state.data) || {};
    if (!room || state.phase === 'finished') return null;
    return (d.players || []).find((p) => {
      if (p.removed || waited.has(p.userId)) return false;
      const m = room.members.find((x) => x.userId === p.userId);
      return !m || !m.connected;
    }) || null;
  }

  // { status, buttons: [{ act, label, variant, icon }] } for this moment.
  function controls(state, room) {
    const t = UI.t();
    const d = (state && state.data) || {};
    const total = d.total || 0;
    const active = (d.players || []).filter((p) => !p.removed);
    const teams = d.teams || {};
    const nFor = Object.values(teams).filter((s) => s === 'for').length;
    const nAgainst = Object.values(teams).filter((s) => s === 'against').length;
    const off = offlinePlayer(state, room);
    let status = '';
    let buttons = [];
    switch (state && state.phase) {
      case 'statement':
        status = `${t.statementN} <bdi dir="ltr">${UI.n2(d.index + 1)} / ${UI.n2(total)}</bdi>`;
        // End game sits here too, so the host never has to skip through the
        // rest of the deck to stop early.
        buttons = [{ act: 'openVote', label: t.openVote, variant: 'primary', icon: 'vote' }, { act: 'skip', label: t.skip, variant: 'ghost' }, { act: 'endGame', label: t.endGame, variant: 'ghost' }];
        break;
      case 'vote1':
      case 'vote2':
        status = `${esc(t.voted)} <bdi dir="ltr">${UI.n2((d.votedIds || []).length)} / ${UI.n2(active.length)}</bdi>`;
        buttons = [{ act: 'closeVote', label: state.phase === 'vote1' ? t.closeVote : t.closeReveal, variant: 'primary' }];
        break;
      case 'teams': {
        status = nFor && nAgainst
          ? `<bdi dir="ltr">${UI.n2(nFor)}</bdi> ${esc(t.forW)} · <bdi dir="ltr">${UI.n2(nAgainst)}</bdi> ${esc(t.againstW)}`
          : !nFor && !nAgainst ? esc(t.noVotes) : esc(t.isEmpty(UI.teamName(nFor ? 'against' : 'for')));
        const first = nFor ? 'for' : nAgainst ? 'against' : null;
        buttons = [first ? { act: 'startDebate', label: t.startTeam(UI.teamName(first)), variant: first, icon: 'play' } : { act: 'startDebate', label: t.startFinal, variant: 'primary' }];
        if (!nFor || !nAgainst) buttons.push({ act: 'skip', label: t.skip, variant: 'ghost' });
        break;
      }
      case 'debate': {
        const clock = d.paused ? UI.fmt((d.remainingMs || 0) / 1000) : `<span data-foa-clock="${d.phaseEndsAt || 0}">${UI.fmt(Math.max(0, ((d.phaseEndsAt || 0) - UI.now()) / 1000))}</span>`;
        status = d.paused ? `${esc(t.paused)} · <bdi dir="ltr">${clock}</bdi>` : `${esc(UI.teamName(d.side))} · <bdi dir="ltr">${clock}</bdi>`;
        buttons = [
          d.paused ? { act: 'pause', label: t.resume, variant: 'accent', icon: 'play' } : { act: 'pause', label: t.pause, variant: 'secondary', icon: 'pause' },
          { act: 'endTurn', label: t.endTurn, variant: 'ghost' },
        ];
        break;
      }
      case 'result':
        status = `${esc(t.result)} <bdi dir="ltr">${UI.n2(d.index + 1)} / ${UI.n2(total)}</bdi>`;
        buttons = [{ act: 'next', label: d.index + 1 < total ? t.next : t.seeResults, variant: 'accent' }, { act: 'endGame', label: t.endGame, variant: 'ghost' }];
        break;
      case 'tie':
        status = `${esc(t.tie.replace(/\.$/, ''))} <bdi dir="ltr">${(d.tie || {}).for || 0} : ${(d.tie || {}).against || 0}</bdi>`;
        buttons = [{ act: 'suddenDeath', label: t.suddenDeath, variant: 'accent' }, { act: 'noWinner', label: t.noWinner, variant: 'ghost' }];
        break;
      case 'finished':
        status = esc(t.gameOver.replace(/\.$/, ''));
        buttons = [{ act: 'newGame', label: t.newGame, variant: 'accent', icon: 'rotate' }, { act: 'shareResults', label: t.shareResults, variant: 'secondary', icon: 'share' }, { act: 'closeSession', label: t.closeSession, variant: 'ghost' }];
        break;
      default:
        status = '';
    }
    if (off) {
      status = esc(t.offline(off.name));
      const extra = [{ act: `wait:${off.userId}`, label: t.wait, variant: 'secondary' }, { act: `remove:${off.userId}`, label: t.remove, variant: 'ghost' }];
      buttons = state.phase === 'debate' ? [...extra, buttons[0]] : [...extra, ...buttons];
    }
    return { status, buttons, offline: off };
  }

  function buttonHtml(b, size = 'sm') {
    const v = b.variant === 'primary' ? '' : ` foa-btn--${b.variant}`;
    return `<button type="button" class="foa-btn${v} foa-btn--${size}" data-host-act="${esc(b.act)}">${b.icon ? UI.icon(b.icon, 16) : ''}${esc(b.label)}</button>`;
  }

  // Runs one action, asking first where the wireframes say to.
  async function run(act, ctx) {
    const t = UI.t();
    const { state, room, socket, onShare } = ctx;
    const d = (state && state.data) || {};
    const send = (action) => socket && socket.emit('game:action', { action });
    if (act.startsWith('wait:')) { waited.add(act.slice(5)); return 'repaint'; }
    if (act.startsWith('remove:')) {
      const id = act.slice(7);
      const p = (d.players || []).find((x) => x.userId === id);
      if (await UI.confirmSheet({ title: t.removeQ(p ? p.name : ''), body: t.removeBody, yes: t.yesRemove })) send({ type: 'remove', userId: id });
      return null;
    }
    switch (act) {
      case 'skip':
        if (await UI.confirmSheet({ title: t.skipQ, body: t.skipBody, yes: t.yesSkip })) send({ type: 'skip' });
        return null;
      case 'endTurn': {
        const nextTeam = d.nextSide ? UI.teamName(d.nextSide) : null;
        if (await UI.confirmSheet({ title: t.endTurnQ(UI.teamName(d.side)), body: t.endTurnBody(nextTeam), yes: t.yesEnd })) send({ type: 'endTurn' });
        return null;
      }
      case 'endGame':
        if (await UI.confirmSheet({ title: t.endGameQ, body: t.endGameBody, yes: t.yesEndGame })) send({ type: 'endGame' });
        return null;
      case 'newGame':
        if (socket) socket.emit('room:restart');
        return null;
      case 'closeSession':
        if (await UI.confirmSheet({ title: t.closeQ, body: t.closeBody, yes: t.yesClose })) socket && socket.emit('room:end');
        return null;
      case 'shareResults':
        if (onShare) onShare();
        return null;
      default:
        send({ type: act });
        return null;
    }
  }

  // The share card's text: scores and results only, never anyone's votes.
  function resultsText(state) {
    const t = UI.t();
    const d = (state && state.data) || {};
    const ranked = (d.players || []).filter((p) => !p.removed).map((p) => ({ name: p.name, pts: (d.scores || {})[p.userId] || 0 })).sort((a, b) => b.pts - a.pts);
    // Equal scores share a place (1, 1, 3), as on the big screen.
    const lines = ranked.map((r) => `${ranked.filter((x) => x.pts > r.pts).length + 1}. ${r.name} — ${r.pts}`);
    return `مع أو ضد · For or Against\n\n${lines.join('\n')}\n\n${location.origin}/for-or-against.html`;
  }

  return { controls, buttonHtml, run, resultsText, offlinePlayer };
})();
