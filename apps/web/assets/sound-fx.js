// Lightweight game sound effects, synthesized with the Web Audio API --
// no audio files to load or license. Mute preference persists across pages
// via localStorage so it carries from one game to the next.
window.BahjahSoundFx = (function () {
  const STORAGE_KEY = 'bahjah_sound';
  let ctx = null;
  let enabled = localStorage.getItem(STORAGE_KEY) !== 'off';

  function getCtx() {
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(c, freq, startTime, duration, type, peakGain) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  function play(build) {
    if (!enabled) return;
    const c = getCtx();
    if (!c) return;
    try {
      build(c, c.currentTime);
    } catch {
      // Audio unsupported or blocked (e.g. no user gesture yet) -- skip silently.
    }
  }

  // Frequency-ramp variant of tone() for rising/falling sweeps (riser,
  // night/day transitions) that a fixed-pitch tone() can't express.
  function ramp(c, freqStart, freqEnd, startTime, duration, type, peakGain) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, startTime);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, startTime + duration);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  return {
    // Countdown warning -- last few seconds of a timer.
    tick() {
      play((c, t) => tone(c, 880, t, 0.07, 'square', 0.05));
    },
    // A player submits an answer/vote/action.
    submit() {
      play((c, t) => {
        tone(c, 520, t, 0.09, 'sine', 0.07);
        tone(c, 760, t + 0.06, 0.09, 'sine', 0.05);
      });
    },
    // Correct answer / positive round outcome.
    correct() {
      play((c, t) => [523.25, 659.25, 784.0].forEach((f, i) => tone(c, f, t + i * 0.09, 0.16, 'triangle', 0.08)));
    },
    // Wrong answer / negative round outcome.
    wrong() {
      play((c, t) => {
        tone(c, 220, t, 0.2, 'sawtooth', 0.06);
        tone(c, 165, t + 0.09, 0.26, 'sawtooth', 0.05);
      });
    },
    // Game-over win fanfare.
    win() {
      play((c, t) => [523.25, 659.25, 784.0, 1046.5].forEach((f, i) => tone(c, f, t + i * 0.1, 0.22, 'triangle', 0.09)));
    },
    // Game-over loss -- mirrors win()'s shape, descending instead of rising.
    lose() {
      play((c, t) => [523.25, 392.0, 293.66, 220.0].forEach((f, i) => tone(c, f, t + i * 0.1, 0.24, 'triangle', 0.07)));
    },
    // Generic UI tap (nav, toggle, quick-reply chip).
    click() {
      play((c, t) => tone(c, 1200, t, 0.03, 'square', 0.04));
    },
    // Selecting a target in a picker (kill/protect/investigate/vote), before
    // the action is actually submitted -- lighter than submit().
    pick() {
      play((c, t) => tone(c, 700, t, 0.05, 'sine', 0.05));
    },
    // A mafia-chat or day-chat message arrives from someone else.
    whisper() {
      play((c, t) => {
        tone(c, 340, t, 0.09, 'sine', 0.025);
        tone(c, 260, t + 0.03, 0.1, 'sine', 0.02);
      });
    },
    // A role/identity is revealed (role-reveal card flip, elimination
    // interstitial's role line).
    reveal() {
      play((c, t) => [392.0, 523.25, 659.25].forEach((f, i) => tone(c, f, t + i * 0.07, 0.14, 'triangle', 0.07)));
    },
    // Mafia's night kill lands.
    kill() {
      play((c, t) => tone(c, 90, t, 0.35, 'sawtooth', 0.09));
    },
    // Doctor's protection successfully blocks a kill.
    save() {
      play((c, t) => {
        tone(c, 587.33, t, 0.12, 'triangle', 0.07);
        tone(c, 880, t + 0.08, 0.16, 'triangle', 0.06);
      });
    },
    // Night-falls transition.
    night() {
      play((c, t) => ramp(c, 440, 110, t, 0.9, 'sine', 0.05));
    },
    // Dawn/day-breaks transition -- mirrors night(), rising instead of falling.
    day() {
      play((c, t) => ramp(c, 220, 660, t, 0.7, 'sine', 0.05));
    },
    // A warm, soft confirmation (e.g. doctor protecting someone).
    heart() {
      play((c, t) => tone(c, 494, t, 0.18, 'sine', 0.05));
    },
    // Suspense build before a reveal (vote-transition overlay).
    riser() {
      play((c, t) => ramp(c, 220, 880, t, 0.5, 'sawtooth', 0.04));
    },
    // Sharp dramatic hit for an interstitial (elimination reveal).
    stinger() {
      play((c, t) => {
        tone(c, 110, t, 0.3, 'sawtooth', 0.08);
        tone(c, 165, t, 0.3, 'square', 0.04);
      });
    },
    isEnabled() {
      return enabled;
    },
    setEnabled(value) {
      enabled = value;
      localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off');
    },
    toggle() {
      this.setEnabled(!enabled);
      return enabled;
    },
  };
})();
