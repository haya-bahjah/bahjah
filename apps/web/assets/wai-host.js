// مين أنا؟ -- the host's controls for each phase, drawn both by the TV's
// pill bar (assets/wai-tv.js) and the host panel on the host's phone
// (assets/wai-panel.js), so the two can never disagree. Every skip and every
// step that cannot be undone asks first.
window.WaiHost = (function () {
  const UI = window.WaiUI;

  // [{ act, label, icon, variant }] for this moment; `primary` first.
  function controls(state) {
    const t = UI.t();
    const x = (state && state.data) || {};
    const last = x.round + 1 >= x.total;
    switch (state && state.phase) {
      case 'intro':
        return [
          { act: 'startClues', label: t.startClues, icon: 'play' },
          { act: 'skip', label: t.skip, icon: 'skip', variant: 'ghost' },
        ];
      case 'clue': {
        const out = [];
        if (x.reveal === 'timed' && !x.closing) out.push(x.paused ? { act: 'pause', label: t.resume, icon: 'play', variant: 'sun' } : { act: 'pause', label: t.pause, icon: 'pause', variant: 'secondary' });
        if (x.clue < 6 && !x.closing) out.push({ act: 'nextClue', label: t.nextClue, icon: 'skip' });
        out.push({ act: 'revealAnswer', label: t.revealAnswer, icon: 'eye', variant: x.clue >= 6 ? undefined : 'secondary' });
        out.push({ act: 'skip', label: t.skip, icon: 'rotate', variant: 'ghost' });
        return out;
      }
      case 'reveal':
        return [{ act: 'board', label: t.leaderboard, icon: 'trophy' }];
      case 'board':
        return [
          { act: 'next', label: last ? t.seeWinner : t.nextIdentity, icon: last ? 'crown' : 'skip' },
          { act: 'endGame', label: t.endEarly, variant: 'ghost' },
        ];
      case 'finished':
        return [
          { act: 'rematch', label: t.rematch, icon: 'rotate' },
          { act: 'newPack', label: t.newPack, icon: 'layers', variant: 'secondary' },
          { act: 'share', label: t.share, icon: 'share', variant: 'secondary' },
          { act: 'endSession', label: t.endSession, icon: 'x', variant: 'ghost' },
        ];
      default:
        return [];
    }
  }

  // Runs one action. ctx: { state, socket, onShare, onNewPack }.
  async function run(act, ctx) {
    const t = UI.t();
    const x = (ctx.state && ctx.state.data) || {};
    const send = (action) => ctx.socket && ctx.socket.emit('game:action', { action });
    switch (act) {
      case 'skip':
        if (await UI.confirmSheet({ title: t.skipQ, body: t.skipBody, yes: t.yesSkip })) send({ type: 'skip' });
        return;
      case 'revealAnswer': {
        const everyone = (x.status || []).length && (x.status || []).every((s) => s.state === 'solved');
        if (x.clue >= 6 || everyone || (await UI.confirmSheet({ title: t.revealQ, body: t.revealBody, yes: t.yesReveal }))) send({ type: 'revealAnswer' });
        return;
      }
      case 'endGame':
        if (await UI.confirmSheet({ title: t.endQ, body: t.endBody, yes: t.yesEnd })) send({ type: 'endGame' });
        return;
      case 'rematch':
        if (ctx.socket) ctx.socket.emit('room:restart');
        return;
      case 'newPack':
        try { sessionStorage.setItem('wai_open_setup', '1'); } catch (_) { /* private mode */ }
        if (ctx.socket) ctx.socket.emit('room:restart');
        return;
      case 'share':
        if (ctx.onShare) ctx.onShare();
        return;
      case 'endSession':
        if (await UI.confirmSheet({ title: t.closeQ, body: t.closeBody, yes: t.yesClose, danger: true })) ctx.socket && ctx.socket.emit('room:end');
        return;
      default:
        send({ type: act });
    }
  }

  // The share card's text: ranks only, never anyone's guesses.
  function resultsText(state) {
    const t = UI.t();
    const x = (state && state.data) || {};
    const lines = UI.ranked(x.players || [], x.scores).map((p) => `${p.rank}. ${p.name} — ${p.score}`);
    return `${t.title}${t.q}\n\n${lines.join('\n')}`;
  }

  return { controls, run, resultsText };
})();
