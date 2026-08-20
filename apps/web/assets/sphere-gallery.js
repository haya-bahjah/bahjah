// Spherical gallery for our-games.html: the cards sit on the inside surface
// of a sphere with the camera at its centre, so dragging looks *around* the
// room rather than scrolling a flat list.
//
// Placement maths: `rotateY(yaw) rotateX(pitch) translateZ(R)` both moves a
// card onto the sphere at that angle AND leaves it tangent to the surface
// (facing the centre) in one step -- no separate look-at needed, because the
// element's local +Z is pushed outward along the radius after the rotations.
//
// Motion: pointer drag feeds a target angle; every frame the rendered angle
// eases toward it (`cur += (target - cur) * EASE`), which is the same
// critically-damped follow lenis uses for smooth scrolling. Releasing mid-drag
// hands the leftover pointer velocity to the target and lets FRICTION bleed it
// off, so a flick coasts and settles instead of stopping dead.
window.BahjahSphereGallery = (function () {
  const EASE = 0.085;      // how hard the rendered angle chases the target
  const FRICTION = 0.94;   // per-frame decay of flick momentum
  const DRAG_SCALE = 0.28; // pointer px -> degrees
  const CLICK_SLOP_PX = 7; // movement under this still counts as a tap

  function mount(container, opts) {
    const items = opts.items || [];
    if (!items.length) return null;

    const radius = opts.radius || 620;
    // A curved *wall* of cards (rows x columns wrapped onto the sphere), not a
    // spinning carousel -- with a handful of items a full 360deg ring would
    // leave most of the view empty, whereas a grid keeps every card reachable
    // and on screen.
    const cols = opts.cols || 3;
    const yawStep = opts.yawStep || 40;
    const pitchStep = opts.pitchStep || 32;
    const rows = Math.ceil(items.length / cols);
    // How far past the outermost card you may look before the drag stops.
    const maxYaw = ((cols - 1) / 2) * yawStep + (opts.yawOverscan || 26);
    const maxPitch = ((rows - 1) / 2) * pitchStep + (opts.pitchOverscan || 14);

    const stage = document.createElement('div');
    stage.className = 'sg-stage';
    const sphere = document.createElement('div');
    sphere.className = 'sg-sphere';
    stage.appendChild(sphere);
    container.appendChild(stage);

    const cards = items.map((item, i) => {
      const el = document.createElement(item.href ? 'a' : 'div');
      el.className = 'sg-card' + (item.comingSoon ? ' is-soon' : '');
      if (item.href) el.href = item.href;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const yaw = (col - (cols - 1) / 2) * yawStep;
      // Negated so row 0 sits above centre: a positive rotateX tips the top
      // of the card away from the camera, which moves it *down* the sphere.
      const pitch = -((row - (rows - 1) / 2) * pitchStep);
      el.style.transform = `rotateY(${yaw}deg) rotateX(${pitch}deg) translateZ(${radius}px)`;
      el.innerHTML = item.html;
      sphere.appendChild(el);
      return { el, yaw, pitch, item };
    });

    let targetYaw = 0, targetPitch = 0;
    let curYaw = 0, curPitch = 0;
    let velYaw = 0, velPitch = 0;
    let dragging = false, moved = 0;
    let lastX = 0, lastY = 0, downX = 0, downY = 0, downTarget = null;
    let raf = null, destroyed = false;

    function onDown(e) {
      if (e.button != null && e.button !== 0) return; // left button only
      dragging = true;
      moved = 0;
      velYaw = velPitch = 0;
      lastX = downX = e.clientX;
      lastY = downY = e.clientY;
      downTarget = e.target;
      stage.classList.add('is-dragging');
      // Deliberately NOT setPointerCapture: capturing retargets pointerup to
      // the stage, so the resulting click fires on the stage/card common
      // ancestor instead of the card, and the delegated lookup below misses.
      // The window-level move/up listeners already keep the drag alive when
      // the cursor leaves the stage, which is all capture would have bought.
    }

    function onMove(e) {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      velYaw = dx * DRAG_SCALE;
      velPitch = -dy * DRAG_SCALE;
      targetYaw = clamp(targetYaw + velYaw, -maxYaw, maxYaw);
      targetPitch = clamp(targetPitch + velPitch, -maxPitch, maxPitch);
      e.preventDefault();
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('is-dragging');
    }

    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

    function frame() {
      if (destroyed) return;
      if (!dragging) {
        // Coast: keep feeding decaying velocity into the target.
        if (Math.abs(velYaw) > 0.01 || Math.abs(velPitch) > 0.01) {
          velYaw *= FRICTION;
          velPitch *= FRICTION;
          targetYaw = clamp(targetYaw + velYaw, -maxYaw, maxYaw);
          targetPitch = clamp(targetPitch + velPitch, -maxPitch, maxPitch);
        }
      }
      curYaw += (targetYaw - curYaw) * EASE;
      curPitch += (targetPitch - curPitch) * EASE;
      // No translateZ here: each card already carries translateZ(radius), so
      // shifting the sphere too would push the front card past the camera
      // plane and blow its projected size up to thousands of px.
      sphere.style.transform = `rotateX(${curPitch}deg) rotateY(${curYaw}deg)`;

      // Dim by angular distance from the view axis, so whatever you've turned
      // toward reads as the focus and the oblique edges recede.
      cards.forEach((c) => {
        const dy = c.yaw + curYaw;
        const dp = c.pitch - curPitch;
        const off = Math.sqrt(dy * dy + dp * dp) / 90; // 0 = dead centre
        c.el.style.opacity = (1 - Math.min(0.72, off * 0.78)).toFixed(3);
      });

      raf = requestAnimationFrame(frame);
    }

    // Suppress the click that follows a real drag, so spinning the sphere
    // never navigates.
    function onClickCapture(e) {
      if (moved > CLICK_SLOP_PX) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const card = (downTarget && downTarget.closest && downTarget.closest('.sg-card')) || e.target.closest('.sg-card');
      if (!card) return;
      const rec = cards.find((c) => c.el === card);
      if (!rec) return;
      if (rec.item.comingSoon) { e.preventDefault(); return; }
      if (opts.onSelect) {
        e.preventDefault();
        opts.onSelect(rec.item, card);
      }
    }

    stage.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    stage.addEventListener('click', onClickCapture, true);
    // Wheel nudges the ring too -- expected on a desktop gallery.
    stage.addEventListener('wheel', (e) => {
      targetYaw = clamp(targetYaw + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 0.12, -maxYaw, maxYaw);
      e.preventDefault();
    }, { passive: false });

    // Keyboard access: the drag is a pointer affordance, so give the same
    // rotation to arrow keys rather than leaving the gallery mouse-only.
    stage.tabIndex = 0;
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { targetYaw = clamp(targetYaw + yawStep, -maxYaw, maxYaw); e.preventDefault(); }
      if (e.key === 'ArrowRight') { targetYaw = clamp(targetYaw - yawStep, -maxYaw, maxYaw); e.preventDefault(); }
      if (e.key === 'ArrowUp') { targetPitch = clamp(targetPitch + 10, -maxPitch, maxPitch); e.preventDefault(); }
      if (e.key === 'ArrowDown') { targetPitch = clamp(targetPitch - 10, -maxPitch, maxPitch); e.preventDefault(); }
    });

    frame();

    return {
      destroy() {
        destroyed = true;
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        stage.remove();
      },
      spinTo(index) { targetYaw = clamp(-((index % cols) - (cols - 1) / 2) * yawStep, -maxYaw, maxYaw); },
    };
  }

  // Card -> page transition: clone the card's artwork, park the clone exactly
  // over the real card's on-screen box, then grow it to fill the viewport
  // before navigating. Using the live bounding rect means the clone starts
  // perfectly aligned no matter where the sphere happened to be rotated to.
  function flyTo(cardEl, href, artSelector) {
    const art = cardEl.querySelector(artSelector || '.sg-art');
    const rect = (art || cardEl).getBoundingClientRect();
    const clone = document.createElement('div');
    clone.className = 'sg-fly';
    clone.style.cssText =
      `position:fixed; left:${rect.left}px; top:${rect.top}px; width:${rect.width}px; height:${rect.height}px; z-index:999;`;
    clone.innerHTML = (art || cardEl).innerHTML;
    if (art) clone.style.background = getComputedStyle(art).background;
    document.body.appendChild(clone);

    const veil = document.createElement('div');
    veil.className = 'sg-veil';
    document.body.appendChild(veil);

    requestAnimationFrame(() => {
      veil.style.opacity = '1';
      clone.style.transition = 'left .62s cubic-bezier(.7,0,.2,1), top .62s cubic-bezier(.7,0,.2,1), width .62s cubic-bezier(.7,0,.2,1), height .62s cubic-bezier(.7,0,.2,1), border-radius .62s ease';
      clone.style.left = '0px';
      clone.style.top = '0px';
      clone.style.width = '100vw';
      clone.style.height = '100vh';
      clone.style.borderRadius = '0';
    });

    setTimeout(() => { window.location.href = href; }, 560);
  }

  return { mount, flyTo };
})();
