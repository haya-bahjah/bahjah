// مجلسك -- the host's controls for each phase, drawn by both the shared
// screen's pill bar (assets/mj-tv.js) and the host panel on the host's phone
// (assets/mj-panel.js), so the two never disagree. Skips and endings ask first.
window.MjHost = (function () {
  const UI = window.MjUI;

  // [{ act, label, icon, variant }], the primary first.
  function controls(state) {
    const t = UI.t();
    const x = (state && state.data) || {};
    const q = x.question || {};
    const last = x.index + 1 >= x.total;
    switch (state && state.phase) {
      case 'question': {
        const out = [{ act: 'reveal', label: t.reveal, icon: 'eye' }];
        if (q.timerSec && !x.closing) out.push(x.paused ? { act: 'pause', label: t.resume, icon: 'play', variant: 'secondary' } : { act: 'pause', label: t.pause, icon: 'pause', variant: 'secondary' });
        out.push({ act: 'skip', label: t.skip, icon: 'skip', variant: 'secondary' });
        return out;
      }
      case 'locked':
        return [{ act: 'reveal', label: t.reveal, icon: 'eye' }, { act: 'skip', label: t.skip, icon: 'skip', variant: 'secondary' }];
      case 'reveal':
        return [{ act: 'next', label: last ? t.seeResults : t.nextQuestion, icon: last ? 'trophy' : 'right' }, { act: 'endGame', label: t.endGame, variant: 'danger' }];
      case 'final':
        return [{ act: 'share', label: t.shareResults, icon: 'share' }, { act: 'newSession', label: t.newSession, variant: 'secondary' }, { act: 'endSession', label: t.endSession, variant: 'danger' }];
      default:
        return [];
    }
  }

  async function run(act, ctx) {
    const t = UI.t();
    const send = (action) => ctx.socket && ctx.socket.emit('game:action', { action });
    switch (act) {
      case 'skip':
        if (await UI.confirmSheet({ title: t.skipQ, body: t.skipBody, yes: t.yesSkip })) send({ type: 'skip' });
        return;
      case 'endGame':
        if (await UI.confirmSheet({ title: t.endQ, body: t.endBody, yes: t.yesEnd })) send({ type: 'endGame' });
        return;
      case 'newSession':
        if (ctx.socket) ctx.socket.emit('room:restart');
        return;
      case 'endSession':
        if (await UI.confirmSheet({ title: t.closeQ, body: t.closeBody, yes: t.yesClose })) ctx.socket && ctx.socket.emit('room:end');
        return;
      case 'share':
        if (ctx.onShare) ctx.onShare();
        return;
      default:
        send({ type: act });
    }
  }

  // The results card's text: ranks and points only, never anyone's answers.
  function resultsText(state) {
    const t = UI.t();
    const x = (state && state.data) || {};
    const top = (x.ranking || []).slice(0, 3).map((r) => `${r.rank}. ${r.name} — ${r.score}`).join('\n');
    return `${t.mabrouk(x.honoree || '')}\n${x.title || ''}${top ? `\n\n${top}` : ''}`;
  }

  function buttonHtml(b, size) {
    return `<button type="button" class="mj-btn${b.variant ? ` mj-btn--${b.variant}` : ''}${size ? ` mj-btn--${size}` : ''}" data-host-act="${UI.esc(b.act)}">${b.icon ? UI.icon(b.icon, 16) : ''}${UI.esc(b.label)}</button>`;
  }

  return { controls, run, resultsText, buttonHtml };
})();
