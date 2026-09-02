// The avatar picker: a modal for choosing one of the pack avatars or
// uploading a photo (resized/compressed client-side so the base64 payload
// stays small).
// Usage: BahjahAvatarPicker.open(currentValue, (newValue) => { ... });
//
// The grid is the Claude Design handoff's ("Bahjah Avatar Library", artboard
// "Avatar Pack"): tinted squircle tiles on an auto-fill grid, each with the
// avatar's name on a plate along the bottom and a pulsing pixel-green marker
// on the current pick. The tile frame itself lives in
// assets/design-system/avatar.css; this file only builds the buttons and
// keeps the picker's behaviour -- tap an avatar, it is chosen and the modal
// closes -- exactly as it was.
//
// Pass a 3rd `extraSection` arg ({ label, values: [...] }) to render an
// additional labeled grid above the pack grid -- used by Knows You Best's
// lobby to offer its 6 character avatars without exposing them to every other
// game's picker (every other call site omits this arg and is unaffected).
window.BahjahAvatarPicker = (function () {
  const MAX_SIZE = 160;
  const JPEG_QUALITY = 0.82;

  function resizePhoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read-failed'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('decode-failed'));
        img.onload = () => {
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          const canvas = document.createElement('canvas');
          canvas.width = MAX_SIZE;
          canvas.height = MAX_SIZE;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, sx, sy, side, side, 0, 0, MAX_SIZE, MAX_SIZE);
          resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function open(currentValue, onSelect, extraSection) {
    const LANG = document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en';
    const overlay = document.createElement('div');
    overlay.className = 'bh-avatar-picker';
    overlay.style.cssText =
      'position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px;';

    // Handoff panel: midnight-3 ground, hairline white-8 border, 16px
    // radius, the design system's card shadow.
    const panel = document.createElement('div');
    panel.style.cssText =
      'box-sizing:border-box; background:var(--surface-card); border:1px solid var(--white-8);' +
      ' border-radius:16px; padding:24px; max-width:560px; width:100%; max-height:88vh;' +
      ' overflow-y:auto; box-shadow:0 4px 24px rgba(0,0,0,.45);';

    // Handoff heading (artboard "Avatar Library"): display face, 800.
    const title = document.createElement('h3');
    title.textContent = LANG === 'ar' ? 'اختر وجهك.' : 'Pick your face.';
    title.style.cssText =
      'margin:0 0 4px; font-family:var(--font-display); font-weight:800; font-size:24px;' +
      ' line-height:1.05; letter-spacing:.01em; color:var(--text-primary);';
    panel.appendChild(title);

    // The handoff's sub-line under the picker heading.
    const sub = document.createElement('p');
    sub.textContent = LANG === 'ar'
      ? 'بلا وجوه. أنت فقط.'
      : 'No faces here. Just you.';
    sub.style.cssText = 'margin:0 0 18px; color:var(--white-64); font-size:15px; line-height:1.55;';
    panel.appendChild(sub);

    const Avatars = window.BahjahAvatars;

    // One handoff tile. The button is the tile; the artwork, the name plate
    // and the selected marker sit inside it.
    function makeTile(value) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'bh-av-tile';

      const tile = Avatars.tileAttrs(value);
      cell.setAttribute('style', tile.style);
      cell.innerHTML = tile.html;

      const info = Avatars.describe(value);
      const selected = Avatars.sameAvatar(currentValue, value);
      cell.setAttribute('aria-pressed', selected ? 'true' : 'false');
      if (info.name) {
        cell.title = info.trait ? `${info.name} — ${info.trait}` : info.name;
        cell.setAttribute('aria-label', info.name);
      }

      // Handoff: an 8px pixel-green square, top-left, pulsing on the current
      // pick. It replaces the check badge the picker used to draw, which was
      // the old avatar treatment rather than this design's.
      if (selected) {
        const mark = document.createElement('span');
        mark.className = 'bh-av-tile-mark';
        mark.setAttribute('aria-hidden', 'true');
        cell.appendChild(mark);
      }

      if (info.name) {
        const plate = document.createElement('span');
        plate.className = 'bh-av-tile-name';
        plate.setAttribute('aria-hidden', 'true');
        plate.textContent = info.name;
        cell.appendChild(plate);
      }

      cell.onclick = () => {
        onSelect(value);
        close();
      };
      return cell;
    }

    function makeGrid(values) {
      const grid = document.createElement('div');
      grid.className = 'bh-av-grid';
      grid.style.marginBottom = '18px';
      values.forEach((value) => grid.appendChild(makeTile(value)));
      return grid;
    }

    // Handoff section eyebrow: pixel face, 11px, .14em, white-40, uppercase.
    function makeLabel(text, countText) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; justify-content:space-between; align-items:baseline; gap:12px; margin-bottom:10px;';
      const label = document.createElement('div');
      label.className = 'bh-av-label';
      label.textContent = text || '';
      row.appendChild(label);
      if (countText) {
        // Handoff count label: pixel face, 11px, arcade-yellow.
        const count = document.createElement('div');
        count.textContent = countText;
        count.style.cssText = 'font-family:var(--font-pixel); font-size:11px; letter-spacing:.1em; color:var(--arcade-yellow);';
        row.appendChild(count);
      }
      return row;
    }

    if (extraSection && extraSection.values && extraSection.values.length) {
      panel.appendChild(makeLabel(extraSection.label));
      panel.appendChild(makeGrid(extraSection.values));
    }

    // The pack. This is the site's avatar set now -- the flat glyph discs the
    // picker used to list alongside it are gone from the grid, and any value
    // still saved against one resolves onto its pack counterpart (see
    // assets/avatars.js), so those players land on a highlighted tile here
    // rather than on nothing.
    const arcade = window.BahjahArcadeAvatars;
    if (arcade && arcade.ROSTER.length) {
      panel.appendChild(makeLabel(
        LANG === 'ar' ? 'اختر صورتك الرمزية' : 'Choose your avatar',
        String(arcade.ROSTER.length)
      ));
      panel.appendChild(makeGrid(arcade.ROSTER.map((a) => `arcade:${a.id}`)));
    }

    function makePhotoInput(labelText, accept, captureAttr) {
      const label = document.createElement('label');
      label.textContent = labelText;
      // Handoff secondary button: transparent on a white-16 hairline, 8px
      // radius, uppercase at .14em.
      label.style.cssText =
        'display:block; text-align:center; box-sizing:border-box; background:transparent;' +
        ' border:1px solid var(--white-16); border-radius:8px; padding:12px; cursor:pointer;' +
        ' font-family:var(--font-body); font-size:13px; font-weight:500; letter-spacing:.14em;' +
        ' text-transform:uppercase; color:var(--text-primary); margin-bottom:10px;' +
        ' transition:all 120ms cubic-bezier(.2,1.4,.4,1);';
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      if (captureAttr) input.capture = captureAttr;
      input.style.display = 'none';
      input.onchange = async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const originalText = labelText;
        label.textContent = LANG === 'ar' ? 'جارٍ المعالجة…' : 'Processing…';
        try {
          const dataUrl = await resizePhoto(file);
          onSelect(dataUrl);
          close();
        } catch {
          label.textContent = LANG === 'ar' ? 'تعذّرت معالجة الصورة.' : 'Could not process that image.';
          setTimeout(() => { label.textContent = originalText; }, 2000);
        }
      };
      label.appendChild(input);
      return label;
    }

    panel.appendChild(makePhotoInput(LANG === 'ar' ? 'التقط صورة' : 'Take a photo', 'image/*', 'user'));
    panel.appendChild(makePhotoInput(LANG === 'ar' ? 'أو ارفع صورة' : 'Or upload a photo', 'image/png,image/jpeg,image/webp', null));

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = LANG === 'ar' ? 'إلغاء' : 'Cancel';
    cancelBtn.style.cssText =
      'box-sizing:border-box; width:100%; background:transparent; border:1px solid var(--white-16);' +
      ' border-radius:8px; padding:12px; font-family:var(--font-body); font-size:13px; font-weight:500;' +
      ' letter-spacing:.14em; text-transform:uppercase; color:var(--white-64); cursor:pointer;' +
      ' transition:all 120ms cubic-bezier(.2,1.4,.4,1);';
    cancelBtn.onclick = close;
    panel.appendChild(cancelBtn);

    overlay.appendChild(panel);
    overlay.onclick = (e) => {
      if (e.target === overlay) close();
    };
    document.body.appendChild(overlay);

    function close() {
      overlay.remove();
    }
  }

  return { open };
})();
