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
