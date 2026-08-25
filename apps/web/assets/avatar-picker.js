// A small modal for picking one of the built-in avatar icons, one of the
// arcade pack avatars, or uploading a photo (resized/compressed client-side
// so the base64 payload stays small).
// Usage: BahjahAvatarPicker.open(currentValue, (newValue) => { ... });
// The arcade pack renders on any page that has loaded
// assets/arcade-avatars.js; a page that hasn't just shows the icon grid.
// Pass a 3rd `extraSection` arg ({ label, icons: [{value, id? , seed?}] }) to
// render an additional labeled grid above the standard icon grid -- used by
// Knows You Best's lobby to offer its 6 character avatars without exposing
// them to every other game's picker (every other call site omits this arg
// and is unaffected).
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

    const panel = document.createElement('div');
    panel.style.cssText =
      'box-sizing:border-box; background:var(--surface-card); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:24px; max-width:420px; width:100%; max-height:88vh; overflow-y:auto;';

    const title = document.createElement('h3');
    title.textContent = LANG === 'ar' ? 'اختر صورتك الرمزية' : 'Choose your avatar';
    title.style.cssText = 'margin-bottom:16px; font-size:18px;';
    panel.appendChild(title);

    function makeGrid(values, opts) {
      const o = opts || {};
      const grid = document.createElement('div');
      grid.style.cssText = `display:grid; grid-template-columns:repeat(${o.columns || 6}, 1fr); gap:10px; margin-bottom:18px;`;
      values.forEach((value) => {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.innerHTML = window.BahjahAvatars.renderAvatarHtml(value);
        const selected = currentValue === value;
        cell.setAttribute('aria-pressed', selected ? 'true' : 'false');
        if (o.title) cell.title = o.title(value) || '';
        cell.style.cssText =
          'box-sizing:border-box; position:relative; display:block; margin:0; width:100%;' +
          ' min-width:0; min-height:0; aspect-ratio:1; border-radius:50%; padding:0; cursor:pointer;' +
          ` background:${o.tint ? o.tint(value) : 'none'};` +
          ` border:2px solid ${selected ? 'var(--accent-strong, var(--electric-purple))' : 'transparent'};` +
          (selected ? ' box-shadow:0 0 0 3px rgba(124,58,237,.28);' : '');
        // The current pick gets a ring and a check badge, so which avatar is
        // active reads at a glance instead of only from a 2px border -- which
        // is easy to miss against the pack's own coloured art.
        if (selected) {
          const tick = document.createElement('span');
          tick.textContent = '✓';
          tick.setAttribute('aria-hidden', 'true');
          tick.style.cssText =
            'position:absolute; inset-inline-end:-2px; bottom:-2px; width:18px; height:18px;' +
            ' border-radius:50%; display:grid; place-items:center; font-size:11px; font-weight:700;' +
            ' line-height:1; background:var(--accent-strong, var(--electric-purple)); color:#fff;' +
            ' border:2px solid var(--surface-card);';
          cell.appendChild(tick);
        }
        cell.onclick = () => {
          onSelect(value);
          close();
        };
        grid.appendChild(cell);
      });
      return grid;
    }

    function makeLabel(text) {
      const label = document.createElement('div');
      label.textContent = text || '';
      label.style.cssText = 'font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--text-muted); margin-bottom:8px;';
      return label;
    }

    if (extraSection && extraSection.values && extraSection.values.length) {
      panel.appendChild(makeLabel(extraSection.label));
      panel.appendChild(makeGrid(extraSection.values));
    }

    // The arcade pack, on pages that have loaded it. Its art is dark and
    // detailed, so each avatar sits on a faint disc of its own accent rather
    // than straight on the panel, and the grid runs five across instead of
    // six to keep them legible at this size.
    const arcade = window.BahjahArcadeAvatars;
    if (arcade && arcade.ROSTER.length) {
      panel.appendChild(makeLabel(LANG === 'ar' ? 'باقة الأركيد' : 'Arcade pack'));
      panel.appendChild(
        makeGrid(arcade.ROSTER.map((a) => `arcade:${a.id}`), {
          columns: 5,
          tint: (value) => {
            const a = arcade.byId(value.slice(7));
            return a ? `radial-gradient(circle at 50% 30%, ${arcade.COLORS[a.color]}2E, #0B0B14 78%)` : 'none';
          },
          title: (value) => {
            const a = arcade.byId(value.slice(7));
            return a ? `${a.name} — ${a.trait}` : '';
          },
        })
      );
      panel.appendChild(makeLabel(LANG === 'ar' ? 'الأيقونات' : 'Icons'));
    }

    panel.appendChild(makeGrid(window.BahjahAvatars.ICONS.map((icon) => `icon:${icon.id}`)));

    function makePhotoInput(labelText, accept, captureAttr) {
      const label = document.createElement('label');
      label.textContent = labelText;
      label.style.cssText =
        'display:block; text-align:center; box-sizing:border-box; background:var(--surface-raised); border:1px dashed var(--border-subtle); border-radius:8px; padding:12px; cursor:pointer; font-size:13px; font-weight:700; color:var(--text-primary); margin-bottom:10px;';
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
      'box-sizing:border-box; width:100%; background:none; border:1px solid var(--border-subtle); border-radius:8px; padding:10px; font-weight:700; color:var(--text-muted); cursor:pointer;';
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
