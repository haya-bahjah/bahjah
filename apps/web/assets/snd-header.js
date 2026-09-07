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
  // The band's Arabic branding marks -- "LIVE NOW", the marquee's PRESS
  // START / SAUDI NATIONAL DAY / YOUR PHONE IS THE CONTROLLER and its two
  // Arabic hashtags -- are the official SND creative and stay exactly as
  // designed in both languages, the same way a logo wordmark would. The
  // sentence copy around them (until-date, headline, subhead, CTA label)
  // is ordinary site content and follows the page's language toggle like
  // everything else, via the same .lang-fade / data-en / data-ar
  // convention bahjah-landing.html already uses everywhere.
  //
  // dir/lang are left off the root <a> so it inherits <html>'s, exactly
  // like every other element on the page -- that is what makes .snd-copy's
  // align-items:flex-start and the CTA's icon-before-label order flip to
  // the correct side automatically when the page direction flips, with no
  // extra JS. data-en-label/data-ar-label on the <a> mirrors the existing
  // data-en-ph/data-ar-ph convention used for the room-code input
  // placeholder just below on this page -- aria-label isn't textContent,
  // so it can't go through the generic .lang-fade loop and gets the same
  // one-off treatment that placeholder already does.
  const MARKUP = `
<a class="snd-band" href="__HREF__" aria-label="ابدأ تحدي اليوم الوطني السعودي" data-en-label="Start the Saudi National Day Challenge" data-ar-label="ابدأ تحدي اليوم الوطني السعودي">
  <img class="snd-photo-bg" src="assets/snd/key-visual.jpg" alt="" aria-hidden="true">
  <span class="snd-scrim"></span>
  <span class="snd-scan"></span>

  <div class="snd-inner">
    <div class="snd-top">
      <img class="snd-wordmark" src="assets/logos/bahjah-wordmark.png" alt="" aria-hidden="true">
      <img class="snd-lockup" src="assets/logos/snd-logo-vertical.svg?v=20260823" alt="" aria-hidden="true">
    </div>

    <div class="snd-body">
      <span class="snd-tag">
        <span class="snd-tag-ar">الأصالة</span>
        <span class="snd-tag-en">AUTHENTICITY</span>
      </span>

      <h1 class="snd-h1">قدّ التحدي؟</h1>

      <p class="snd-sub lang-fade" data-en="A trivia challenge about the Kingdom: its history, its people, its character. The screen is for everyone, your phone is the controller." data-ar="تحدّي أسئلة عن المملكة: تاريخها، أهلها، وطبعها. الشاشة للجميع، وجوالك هو وحدة التحكم.">تحدّي أسئلة عن المملكة: تاريخها، أهلها، وطبعها. الشاشة للجميع، وجوالك هو وحدة التحكم.</p>

      <div class="snd-actions">
        <span class="snd-cta lang-fade" data-en="Start" data-ar="ابدأ">ابدأ</span>
        <span class="snd-pass">
          <span class="snd-pass-label lang-fade" data-en="Day Pass" data-ar="Day Pass">Day Pass</span>
          <span class="snd-pass-amount">9.6</span>
          <span>ريال</span>
        </span>
      </div>
    </div>
  </div>

  <span class="snd-tape"></span>
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
