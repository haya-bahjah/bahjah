/* Mafia — the television.

   The host's screen is not a player's screen. It holds no role, has no
   action to take, and is looked at by the whole room at once, so anything
   secret is by definition unsafe on it. What it shows is the narration the
   table needs to keep time by: which phase the room is in and how long is
   left, and during the vote how many people have committed -- never who
   they picked, which only becomes public once the vote has closed and the
   card is turned over.

   Dawn, elimination and the two verdicts are already narration, so the TV
   reuses the design's own screens for those rather than restating them here. */
(function (global) {
  var S = {};
  var esc = global.MafiaScreensA.esc;

  /* One shell for every TV phase: a kicker, a headline, the clock, and a
     line of flavour underneath. Sized for a screen across the room -- these
     are much larger than anything on a phone. */
  function stage(label, v, parts) {
    return '<div data-screen-label="' + label + '" class="mf-screen mf-tv" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:56px 32px;gap:20px;animation:fadeIn .4s both">' +
      parts +
    '</div>';
  }

  function kicker(text, color) {
    return '<span style="font-family:var(--font-pixel);font-size:13px;letter-spacing:.22em;color:' + (color || 'var(--text-muted)') + ';text-shadow:0 2px 10px rgba(0,0,0,.85)">' + esc(text) + '</span>';
  }

  function headline(text) {
    return '<span class="mf-tv-title" style="font-family:var(--font-display);font-weight:900;font-size:clamp(38px,7vw,86px);letter-spacing:.04em;text-transform:uppercase;text-align:center;line-height:1.05">' + esc(text) + '</span>';
  }

  function sub(text) {
    return '<span style="color:var(--text-secondary);font-size:clamp(15px,1.7vw,22px);text-align:center;max-width:22em">' + esc(text) + '</span>';
  }

  /* The clock the room reads from the sofa. Turns red and starts pulsing
     once the phase is nearly over, which is the "night is about to end"
     warning without needing a sentence for it. */
  function clock(v) {
    if (!v.tvTimer) return '';
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:6px">' +
      '<span class="mf-tv-clock" style="font-family:var(--font-pixel);font-size:clamp(30px,5vw,60px);letter-spacing:.1em;color:' + v.tvTimerColor + ';border:2px solid ' + v.tvTimerBorder + ';border-radius:14px;padding:14px 28px 10px;' + (v.tvEnding ? 'animation:pulseSoft 1s ease-in-out infinite;' : '') + '">' + esc(v.tvTimer) + '</span>' +
      (v.tvEnding ? '<span style="font-family:var(--font-pixel);font-size:11px;letter-spacing:.2em;color:#EE2D23;animation:pulseSoft 1.2s infinite">' + esc(v.tTvEnding) + '</span>' : '') +
    '</div>';
  }

  /* Role reveal: the one place the TV counts people, because the room
     genuinely cannot tell by looking whether everyone has opened their
     card yet. It is a count, never a list of who. */
  S.tvReveal = function (v) {
    return stage('TV role reveal', v,
      kicker(v.tTvCheckPhone, '#EE2D23') +
      headline(v.tTvRolesDealt) +
      sub(v.tTvRolesSub) +
      '<div style="display:flex;align-items:baseline;gap:14px;margin-top:10px">' +
        '<span style="font-family:var(--font-display);font-weight:900;font-size:clamp(40px,6vw,72px);color:var(--pixel-green)">' + esc(String(v.tvReadyCount)) + '</span>' +
        '<span style="font-family:var(--font-pixel);font-size:clamp(13px,1.6vw,18px);letter-spacing:.18em;color:var(--text-muted)">' + esc(v.tTvOf(v.tvTotal)) + '</span>' +
      '</div>' +
      clock(v)
    );
  };

  S.tvNight = function (v) {
    return stage('TV night', v,
      kicker(v.tNightN, '#EE2D23') +
      headline(v.tTvNightTitle) +
      sub(v.tTvNightSub) +
      clock(v)
    );
  };

  S.tvDay = function (v) {
    return stage('TV day', v,
      kicker(v.tDayN, 'var(--arcade-yellow)') +
      headline(v.tTvDayTitle) +
      sub(v.tTvDaySub) +
      clock(v)
    );
  };

  /* The vote is the only phase where the TV carries live state, and it
     carries exactly one number: how many have committed. Who they picked
     stays private until the vote closes -- otherwise the room would watch
     the tally build and the last voter would decide everything with full
     information. */
  S.tvVote = function (v) {
    return stage('TV vote', v,
      kicker(v.tTheVote, '#EE2D23') +
      headline(v.tTvVoteTitle) +
      '<div style="display:flex;align-items:baseline;gap:14px;margin-top:4px">' +
        '<span style="font-family:var(--font-display);font-weight:900;font-size:clamp(44px,7vw,84px);color:#EE2D23;text-shadow:0 3px 16px rgba(0,0,0,.85)">' + esc(String(v.tvVotesCast)) + '</span>' +
        '<span style="font-family:var(--font-pixel);font-size:clamp(13px,1.6vw,18px);letter-spacing:.18em;color:var(--text-muted)">' + esc(v.tTvOf(v.tvVoteTotal)) + '</span>' +
      '</div>' +
      sub(v.tTvVoteSub) +
      clock(v)
    );
  };

  /* Once the vote has closed the ballots are public, so the TV can finally
     name names -- alongside the design's own elimination card. */
  S.tvTally = function (v) {
    if (!v.tvTally.length) return '';
    // Beside the card, not below it. The design's elimination screen fills
    // the viewport, so anything appended after it lands off the bottom of
    // the television -- and a screen nobody can scroll is a screen nobody
    // reads. A landscape TV has room to spare either side of that card.
    return '<div class="mf-tv-tally" style="position:fixed;inset-inline-end:36px;top:50%;transform:translateY(-50%);z-index:60;display:flex;flex-direction:column;gap:10px;align-items:center;width:min(400px,30vw);max-height:74vh;overflow-y:auto;animation:fadeUp .4s ease-out both">' +
      '<span style="font-family:var(--font-pixel);font-size:10px;letter-spacing:.2em;color:var(--text-muted)">' + esc(v.tTvHowVoted) + '</span>' +
      '<div style="display:flex;flex-direction:column;gap:7px;width:100%">' +
        v.tvTally.map(function (row, i) {
          return '<div data-k="tt' + i + '" style="display:flex;align-items:center;gap:12px;background:rgba(11,11,20,.5);border:1px solid var(--border-subtle);border-radius:10px;padding:9px 14px">' +
            '<span style="font-size:15px;font-weight:600;color:var(--text-primary);flex:1;text-align:start">' + esc(row.voter) + '</span>' +
            '<span style="font-family:var(--font-pixel);font-size:9px;letter-spacing:.14em;color:var(--text-muted)">' + esc(v.tTvVotedFor) + '</span>' +
            '<span style="font-size:15px;font-weight:700;color:#EE2D23">' + esc(row.target) + '</span>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>';
  };

  global.MafiaTV = S;
})(window);
