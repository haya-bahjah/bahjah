// Saudi National Day header — the shared partial.
//
// The markup lives here rather than inline in a page so there is exactly one
// copy of it. On bahjah-landing.html that also covers both states at once:
// the signed-out marketing hero and the signed-in dashboard hero are two
// sections inside the same <main>, so a single band mounted above <main>
// sits between the nav and whichever hero is showing.
//
// Load it on any page after the nav exists; it mounts synchronously, before
// prefs-boot.js's visibility hold is released, so nothing flashes.
(function () {
  // The band is Arabic and stays RTL even when the page is in EN mode --
  // it is the official SND creative, not translated site copy.
  const MARKUP = `
<a class="snd-band" dir="rtl" lang="ar" href="__HREF__" aria-label="ابدأ تحدي اليوم الوطني السعودي">
  <span class="snd-grid"></span>
  <span class="snd-glow"></span>
  <img class="snd-photo-bg" src="assets/snd/key-visual.jpg" alt="" aria-hidden="true">

  <div class="snd-inner">
    <div class="snd-copy">
      <div class="snd-meta">
        <span class="snd-live">LIVE NOW</span>
        <span class="snd-until">متاح حتى ٢٧ سبتمبر</span>
      </div>
      <h1 class="snd-h1">احتفل باليوم الوطني السعودي 🇸🇦</h1>
      <p class="snd-sub">تحدي أسئلة عن المملكة — تاريخها، أهلها، وطبعها. الشاشة للجميع، وجوالك هو وحدة التحكم.</p>
      <div class="snd-actions">
        <span class="snd-cta"><span aria-hidden="true" style="font-size:12px">▶</span> ابدأ تحدي اليوم الوطني</span>
        <span class="snd-cue"><span aria-hidden="true" style="font-size:14px">☝</span> اضغط هنا للعب</span>
        <span class="snd-facts">٣–١٢ لاعب · ٨ دقائق · بدون تحميل</span>
      </div>
    </div>

    <div class="snd-art">
      <!-- TODO: the official SND lockup is vector-only in the guideline and could
           not be extracted. Swap this typeset placeholder for the horizontal SVG
           when we have it:
           <span class="snd-lockup"><img src="assets/snd/logo-horizontal.svg" alt="عزّنا بطبعنا — اليوم الوطني السعودي"></span> -->
      <span class="snd-lockup">
        <span class="snd-lockup-ar">عزّنا بطبعنا</span>
        <span class="snd-lockup-en">SAUDI NATIONAL DAY</span>
      </span>
      <span class="snd-photo">
        <picture>
          <source media="(max-width:820px)" srcset="assets/snd/key-visual-sm.jpg">
          <img src="assets/snd/key-visual.jpg" alt="عزّنا بطبعنا — الهوية البصرية لليوم الوطني السعودي">
        </picture>
      </span>
      <span class="snd-swatches" aria-hidden="true">
        <i style="background:#5ABA1C"></i><i style="background:#0050AF"></i><i style="background:#971A4D"></i>
        <i style="background:#607C4F"></i><i style="background:#6565E0"></i><i style="background:#7C5D21"></i>
      </span>
    </div>
  </div>

  <div class="snd-marquee">
    <span>#عزنا_بطبعنا</span><span>◼</span><span>PRESS START</span><span>◼</span>
    <span>SAUDI NATIONAL DAY</span><span>◼</span><span>#اليوم_الوطني_السعودي</span><span>◼</span>
    <span>YOUR PHONE IS THE CONTROLLER</span>
  </div>
</a>`;

  // There is no Saudi National Day room route yet -- the theme activates from a
  // room's category selection (see assets/trivia-play.js), not from a URL. This
  // lands on Trivia, where the host creates the room; repoint it the moment a
  // real SND pack route exists.
  const HREF = 'trivia.html';

  function mount(target) {
    const host = target || document.querySelector('main');
    if (!host || document.querySelector('.snd-band')) return null;
    const frag = document.createElement('div');
    frag.innerHTML = MARKUP.replace('__HREF__', HREF).trim();
    const band = frag.firstElementChild;
    host.parentNode.insertBefore(band, host);
    return band;
  }

  window.BahjahSndHeader = { mount, markup: MARKUP, href: HREF };
})();
