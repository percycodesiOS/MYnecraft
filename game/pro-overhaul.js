(function () {
  'use strict';

  const TEACHERS = [
    { id: 'macek', name: 'Mr. Macek', role: 'CIRC & ECTV', accent: '#38bdf8', skin: '#f2c29b', hair: '#6b4f35', hairStyle: 'buzz', facialHair: 'light_stubble', glasses: false, shirt: '#111318', svLogo: true, sleeves: 'blue_pattern', lanyard: '#ea580c', pants: '#1a202c', shoes: '#111111' },
    { id: 'micco', name: 'Ms. Micco', role: 'CIRC & Tech', accent: '#eab308', skin: '#f5cba7', hair: '#785230', hairStyle: 'bob', facialHair: 'none', glasses: '#4a3525', shirt: '#1e293b', cardigan: '#9ca3af', lanyard: '#1d4ed8', pants: '#271c19', shoes: '#111111' },
    { id: 'eriksen', name: 'Ms. Eriksen', role: 'Art Studio', accent: '#a855f7', skin: '#f5cba7', hair: '#4a321f', hairStyle: 'curly', facialHair: 'none', glasses: false, shirt: '#9333ea', cardigan: '#111318', lanyard: '#111111', pants: '#111318', shoes: '#1f2937' },
    { id: 'wingenbach', name: 'Mr. Wingenbach', role: 'Music', accent: '#22c55e', skin: '#ecc098', hair: '#1f1610', hairStyle: 'short', facialHair: 'full_beard', glasses: false, shirt: '#14171f', lanyard: '#111111', pants: '#8b929a', shoes: '#111111' },
    { id: 'mcmichael', name: 'Sra. McMichael', role: 'Spanish', accent: '#f43f5e', skin: '#f6d0b1', hair: '#d6a95c', hairStyle: 'long_wavy', facialHair: 'none', glasses: '#1e293b', shirt: '#f3efe6', lanyard: '#18181b', pants: '#3b2314', polkaDots: true, shoes: '#f8fafc' },
    { id: 'mullet', name: 'Mr. Mullet', role: 'Phys Ed', accent: '#3b82f6', skin: '#f0be95', hair: '#7c7267', hairStyle: 'short_side', facialHair: 'none', glasses: false, shirt: '#172554', lanyard: '#0f172a', pants: '#c2b280', shoes: '#e2e8f0' }
  ];

  function renderPortrait(t) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 144;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const px = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x * 4, y * 4, w * 4, h * 4); };

    if (t.hairStyle === 'curly' || t.hairStyle === 'long_wavy') px(7, 4, 18, 15, t.hair);
    else if (t.hairStyle === 'bob') px(8, 4, 16, 13, t.hair);

    px(10, 4, 12, 12, t.skin);

    if (t.hairStyle === 'buzz') { px(10, 3, 12, 2, t.hair); px(10, 5, 1, 2, t.hair); px(21, 5, 1, 2, t.hair); }
    else if (t.hairStyle === 'short' || t.hairStyle === 'short_side') { px(9, 3, 14, 3, t.hair); px(9, 6, 2, 3, t.hair); px(21, 6, 2, 3, t.hair); }
    else if (t.hairStyle === 'curly') { px(8, 2, 16, 4, t.hair); px(8, 6, 3, 11, t.hair); px(21, 6, 3, 11, t.hair); }
    else if (t.hairStyle === 'long_wavy') { px(8, 2, 16, 4, t.hair); px(8, 6, 3, 13, t.hair); px(21, 6, 3, 13, t.hair); }
    else if (t.hairStyle === 'bob') { px(8, 3, 16, 4, t.hair); px(8, 7, 3, 9, t.hair); px(21, 7, 3, 9, t.hair); }

    px(11, 8, 3, 2, '#fff'); px(18, 8, 3, 2, '#fff');
    px(12, 8, 2, 2, '#1e293b'); px(18, 8, 2, 2, '#1e293b');
    px(11, 7, 3, 1, t.hair); px(18, 7, 3, 1, t.hair);

    if (t.glasses) {
      ctx.strokeStyle = t.glasses; ctx.lineWidth = 3;
      ctx.strokeRect(42, 30, 16, 12); ctx.strokeRect(70, 30, 16, 12);
      px(14, 8, 4, 1, t.glasses);
    }

    if (t.facialHair === 'light_stubble') {
      px(12, 13, 8, 2, '#e2ab84'); px(13, 13, 6, 1, '#fff');
    } else if (t.facialHair === 'full_beard') {
      px(10, 12, 12, 4, t.hair); px(14, 13, 4, 1, '#fff');
    } else {
      px(13, 13, 6, 1, '#fff'); px(14, 14, 4, 1, '#d97757');
    }

    px(9, 16, 14, 12, t.shirt);
    if (t.cardigan) { px(9, 16, 4, 12, t.cardigan); px(19, 16, 4, 12, t.cardigan); }
    if (t.svLogo) { px(13, 18, 6, 5, '#38bdf8'); px(14, 19, 4, 3, '#1d4ed8'); px(15, 20, 2, 1, '#fff'); }

    // Lanyard & Hanging ID Badge (No shirt name tags)
    px(13, 16, 1, 6, t.lanyard); px(18, 16, 1, 6, t.lanyard); px(14, 21, 4, 1, t.lanyard);
    px(14, 22, 4, 5, '#f8fafc'); px(15, 23, 2, 2, '#3b82f6'); px(15, 25, 2, 1, '#64748b');

    if (t.sleeves === 'blue_pattern') {
      px(5, 16, 4, 4, t.shirt); px(23, 16, 4, 4, t.shirt);
      px(5, 20, 4, 6, '#14171c'); px(23, 20, 4, 6, '#14171c');
      px(6, 21, 2, 1, '#67e8f9'); px(5, 23, 2, 1, '#38bdf8'); px(7, 24, 2, 1, '#67e8f9');
      px(24, 21, 2, 1, '#67e8f9'); px(25, 23, 2, 1, '#38bdf8'); px(23, 24, 2, 1, '#67e8f9');
      px(5, 26, 4, 1, '#7c2d12'); px(23, 26, 4, 1, '#1e293b');
      px(5, 27, 4, 2, t.skin); px(23, 27, 4, 2, t.skin);
    } else {
      const sc = t.cardigan || t.shirt;
      px(5, 16, 4, 10, sc); px(23, 16, 4, 10, sc);
      px(5, 26, 4, 3, t.skin); px(23, 26, 4, 3, t.skin);
    }

    px(9, 28, 6, 6, t.pants); px(17, 28, 6, 6, t.pants);
    if (t.polkaDots) { px(11, 29, 1, 1, '#fff'); px(14, 31, 1, 1, '#fff'); px(19, 30, 1, 1, '#fff'); px(21, 32, 1, 1, '#fff'); }
    px(9, 34, 6, 2, t.shoes); px(17, 34, 6, 2, t.shoes);
    return c.toDataURL('image/png');
  }

  const PORTRAITS = {};
  TEACHERS.forEach(t => { PORTRAITS[t.id] = renderPortrait(t); });

  function replaceImages() {
    document.querySelectorAll('img').forEach(img => {
      const s = (img.getAttribute('src') || '').toLowerCase();
      TEACHERS.forEach(t => { if (s.includes(t.id)) { img.src = PORTRAITS[t.id]; img.style.imageRendering = 'pixelated'; } });
    });
  }

  let lastSpace = 0, flying = false;
  let curTeacher = localStorage.getItem('mynecraft_selected_teacher') || 'macek';
  let tutStep = parseInt(localStorage.getItem('mynecraft_pro_tut_step') || '0', 10);
  const STEPS = [
    { icon: '🕹️', text: 'STEP 1: Push W A S D (or Arrow Keys) to walk!' },
    { icon: '🚀', text: 'STEP 2: Double-Tap SPACE (or click 🚀 FLY) to fly!' },
    { icon: '🧱', text: 'STEP 3: Right-Click (or tap PLACE) to build!' },
    { icon: '🎉', text: 'STEP 4: Click your Teacher at the top-right to switch characters!' }
  ];

  function doneStep(i) {
    if (tutStep === i) { tutStep++; localStorage.setItem('mynecraft_pro_tut_step', String(tutStep)); renderTut(); }
  }

  function toggleFly() {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().toUpperCase() === 'FLY');
    if (btn) btn.click();
    else {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', keyCode: 70, bubbles: true }));
      setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'f', code: 'KeyF', keyCode: 70, bubbles: true })), 40);
    }
    flying = !flying;
    updateHud();
    doneStep(1);
  }

  function updateHud() {
    const fb = document.getElementById('pro-fly-btn');
    const fk = document.getElementById('pro-fly-keys');
    if (!fb || !fk) return;
    fb.style.background = flying ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'linear-gradient(135deg,#2563eb,#0ea5e9)';
    fb.innerHTML = flying ? '🚀 FLYING: ON (2x Space to Land)' : '🚀 CLICK OR 2x SPACE TO FLY';
    fk.innerHTML = flying ? '<kbd>SPACE</kbd> ⬆️ Up · <kbd>V</kbd>/<kbd>Q</kbd> ⬇️ Down' : '<kbd>WASD</kbd> Walk · <kbd>R-CLICK</kbd> 🧱 Build · <kbd>I</kbd> 🎒 Blocks';
  }

  function renderTut() {
    const b = document.getElementById('pro-tut');
    if (!b) return;
    if (tutStep >= STEPS.length) { b.style.display = 'none'; return; }
    b.style.display = 'flex';
    b.innerHTML = `<span style="font-size:30px">${STEPS[tutStep].icon}</span><div style="flex:1"><b>${STEPS[tutStep].text}</b></div><button id="pro-tut-x" style="background:#334155;color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer">Skip ✕</button>`;
    document.getElementById('pro-tut-x').onclick = () => { tutStep = 99; localStorage.setItem('mynecraft_pro_tut_step', '99'); b.style.display = 'none'; };
  }

  function pickTeacher(id) {
    curTeacher = id;
    localStorage.setItem('mynecraft_selected_teacher', id);
    const t = TEACHERS.find(x => x.id === id) || TEACHERS[0];
    Array.from(document.querySelectorAll('button,[role="button"],input[type="radio"]')).forEach(el => {
      const txt = (el.textContent || el.value || el.getAttribute('aria-label') || '').toLowerCase();
      if (txt.includes(id) || txt.includes(t.name.toLowerCase())) el.click();
    });
    const tb = document.getElementById('pro-t-btn');
    if (tb) tb.innerHTML = `<img src="${PORTRAITS[t.id]}" style="width:26px;height:26px;image-rendering:pixelated"> ${t.name}`;
    document.querySelectorAll('.pro-t-card').forEach(c => { c.style.borderColor = c.dataset.id === id ? '#22c55e' : 'rgba(255,255,255,0.15)'; });
    doneStep(3);
  }

  function init() {
    replaceImages();
    const st = document.createElement('style');
    st.textContent = `body:not(.show-docs) details{display:none!important} .pro-pill kbd{background:#38bdf8;color:#0f172a;padding:2px 6px;border-radius:5px;font-weight:900}`;
    document.head.appendChild(st);

    const hud = document.createElement('div');
    hud.style.cssText = 'position:fixed;left:16px;bottom:84px;z-index:9000;display:flex;flex-direction:column;gap:8px;font-family:Fredoka,sans-serif';
    hud.innerHTML = `<button id="pro-fly-btn" style="cursor:pointer;border:2px solid #7dd3fc;color:#fff;padding:8px 16px;border-radius:14px;font-weight:800;font-size:15px"></button><div id="pro-fly-keys" class="pro-pill" style="background:rgba(12,17,28,0.88);color:#fff;padding:6px 12px;border-radius:12px;font-weight:700;font-size:14px;border:2px solid rgba(255,255,255,0.18)"></div>`;
    document.body.appendChild(hud);
    document.getElementById('pro-fly-btn').onclick = toggleFly;
    updateHud();

    const top = document.createElement('div');
    top.style.cssText = 'position:fixed;top:12px;right:16px;z-index:9000;display:flex;gap:8px;font-family:Fredoka,sans-serif';
    top.innerHTML = `<button id="pro-t-btn" style="cursor:pointer;background:rgba(12,17,28,0.9);border:2px solid #38bdf8;color:#fff;padding:6px 12px;border-radius:12px;font-weight:700;display:flex;align-items:center;gap:6px"></button><button id="pro-w-btn" style="cursor:pointer;background:rgba(12,17,28,0.9);border:2px solid #38bdf8;color:#fff;padding:6px 12px;border-radius:12px;font-weight:700">🧭 Warp & Menu</button>`;
    document.body.appendChild(top);

    const tut = document.createElement('div');
    tut.id = 'pro-tut';
    tut.style.cssText = 'position:fixed;top:62px;left:50%;transform:translateX(-50%);z-index:9200;background:rgba(15,23,42,0.95);border:3px solid #38bdf8;color:#fff;padding:10px 20px;border-radius:18px;display:flex;align-items:center;gap:14px;font-family:Fredoka,sans-serif;min-width:320px';
    document.body.appendChild(tut);
    renderTut();

    const modal = document.createElement('div');
    modal.id = 'pro-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(6,10,19,0.85);backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;padding:16px;font-family:Fredoka,sans-serif';
    modal.innerHTML = `<div style="background:#0f172a;border:2px solid #38bdf8;border-radius:22px;max-width:820px;width:100%;padding:22px;color:#fff;max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h2 style="margin:0;color:#38bdf8;font-family:Bungee,sans-serif">CHOOSE YOUR SPECIALS TEACHER</h2><button id="pro-close-m" style="cursor:pointer;background:#22c55e;border:none;color:#fff;padding:8px 18px;border-radius:12px;font-weight:800">▶ PLAY</button></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:18px">
        ${TEACHERS.map(t => `<div class="pro-t-card" data-id="${t.id}" style="cursor:pointer;background:#1e293b;border:2px solid rgba(255,255,255,0.15);border-radius:14px;padding:10px;text-align:center"><img src="${PORTRAITS[t.id]}" style="width:68px;height:76px;image-rendering:pixelated"><div><b>${t.name}</b></div><div style="font-size:11px;color:#94a3b8">${t.role}</div></div>`).join('')}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="pro-act" data-k="entrance" style="cursor:pointer;background:#1e293b;border:1px solid #38bdf8;color:#fff;padding:8px 12px;border-radius:10px;font-weight:700">🏫 School Entrance</button>
        <button class="pro-act" data-k="fly above" style="cursor:pointer;background:#1e293b;border:1px solid #38bdf8;color:#fff;padding:8px 12px;border-radius:10px;font-weight:700">🚀 Fly Above ECMS</button>
        <button class="pro-act" data-k="download save" style="cursor:pointer;background:#1e293b;border:1px solid #38bdf8;color:#fff;padding:8px 12px;border-radius:10px;font-weight:700">💾 Download Save</button>
        <button id="pro-docs-btn" style="cursor:pointer;background:#334155;border:none;color:#fff;padding:8px 12px;border-radius:10px;font-weight:700">⚙️ All Settings</button>
      </div>
    </div>`;
    document.body.appendChild(modal);

    document.getElementById('pro-t-btn').onclick = () => { modal.style.display = 'flex'; };
    document.getElementById('pro-w-btn').onclick = () => { modal.style.display = 'flex'; };
    document.getElementById('pro-close-m').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('pro-docs-btn').onclick = () => { document.body.classList.toggle('show-docs'); modal.style.display = 'none'; };
    modal.querySelectorAll('.pro-t-card').forEach(c => { c.onclick = () => pickTeacher(c.dataset.id); });
    modal.querySelectorAll('.pro-act').forEach(b => {
      b.onclick = () => {
        const m = Array.from(document.querySelectorAll('button,a')).find(el => (el.textContent || '').toLowerCase().includes(b.dataset.k));
        if (m) m.click();
        modal.style.display = 'none';
      };
    });

    pickTeacher(curTeacher);

    window.addEventListener('keydown', e => {
      if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) doneStep(0);
      if (e.code === 'Space' && !e.repeat) {
        const now = performance.now();
        if (now - lastSpace < 340) { toggleFly(); lastSpace = 0; return; }
        lastSpace = now;
      }
      if (e.code === 'KeyF' && !e.repeat) { flying = !flying; setTimeout(updateHud, 50); doneStep(1); }
    }, true);
    window.addEventListener('contextmenu', () => doneStep(2));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
