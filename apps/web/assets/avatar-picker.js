// A small modal for picking one of the built-in avatar icons or uploading a
// photo (resized/compressed client-side so the base64 payload stays small).
// Usage: BahjahAvatarPicker.open(currentValue, (newValue) => { ... });
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

  function open(currentValue, onSelect) {
    const LANG = document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en';
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px;';

    const panel = document.createElement('div');
    panel.style.cssText =
      'background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-a); padding:24px; max-width:420px; width:100%;';

    const title = document.createElement('h3');
    title.textContent = LANG === 'ar' ? 'اختر صورتك الرمزية' : 'Choose your avatar';
    title.style.cssText = 'margin-bottom:16px; font-size:18px;';
    panel.appendChild(title);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns:repeat(6, 1fr); gap:10px; margin-bottom:18px;';
    window.BahjahAvatars.ICONS.forEach((icon) => {
      const cell = document.createElement('button');
      const value = `icon:${icon.id}`;
      cell.innerHTML = window.BahjahAvatars.renderAvatarHtml(value);
      const selected = currentValue === value;
      cell.style.cssText = `width:100%; aspect-ratio:1; border-radius:50%; border:2px solid ${selected ? 'var(--brand)' : 'transparent'}; padding:0; cursor:pointer; background:none;`;
      cell.onclick = () => {
        onSelect(value);
        close();
      };
      grid.appendChild(cell);
    });
    panel.appendChild(grid);

    const uploadLabel = document.createElement('label');
    uploadLabel.textContent = LANG === 'ar' ? 'أو ارفع صورة' : 'Or upload a photo';
    uploadLabel.style.cssText =
      'display:block; text-align:center; background:var(--surface-2); border:1px dashed var(--line); border-radius:8px; padding:12px; cursor:pointer; font-size:13px; font-weight:700; color:var(--text); margin-bottom:14px;';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png,image/jpeg,image/webp';
    fileInput.style.display = 'none';
    fileInput.onchange = async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      uploadLabel.textContent = LANG === 'ar' ? 'جارٍ المعالجة…' : 'Processing…';
      try {
        const dataUrl = await resizePhoto(file);
        onSelect(dataUrl);
        close();
      } catch {
        uploadLabel.textContent = LANG === 'ar' ? 'تعذّرت معالجة الصورة.' : 'Could not process that image.';
      }
    };
    uploadLabel.appendChild(fileInput);
    panel.appendChild(uploadLabel);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = LANG === 'ar' ? 'إلغاء' : 'Cancel';
    cancelBtn.style.cssText =
      'width:100%; background:none; border:1px solid var(--line); border-radius:8px; padding:10px; font-weight:700; color:var(--muted); cursor:pointer;';
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
