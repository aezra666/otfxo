function typeWriter(element, text, speed = 40, callback = null, gutterElement = null) {
  const scrambleCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%\u20ac&/.,<>';
  const characters = [...text];
  const okCharacterIndexes = new Set();
  for (const match of text.matchAll(/\[OK\]/g)) {
    const startIndex = match.index ?? -1;
    for (let offset = 0; offset < 4; offset++) okCharacterIndexes.add(startIndex + offset);
  }
  element.replaceChildren();
  element.classList.add('typing');
  let index = 0, gutterLineNumber = 1, gutterRowTop = null;
  if (gutterElement) {
    gutterElement.innerHTML = '';
    const s = document.createElement('span'); s.textContent = gutterLineNumber; gutterElement.appendChild(s);
  }
  function trackGutterRow(node) {
    if (!gutterElement) return;
    const rowTop = node.offsetTop;
    if (gutterRowTop === null) gutterRowTop = rowTop;
    else if (rowTop > gutterRowTop) {
      gutterLineNumber++;
      const s = document.createElement('span'); s.textContent = gutterLineNumber; gutterElement.appendChild(s);
      gutterRowTop = rowTop;
    }
  }
  function revealNext() {
    if (index >= characters.length) {
      element.classList.remove('typing');
      const cursor = document.createElement('span'); cursor.className = 'line-cursor'; element.appendChild(cursor);
      if (callback) callback();
      return;
    }
    const character = characters[index];
    const node = document.createElement('span');
    node.className = 'scramble-character';
    if (character === '\n') node.classList.add('scramble-break');
    if (okCharacterIndexes.has(index)) node.classList.add('ok-character');
    element.appendChild(node);
    if (character === ' ' || character === '\n') {
      node.textContent = character === '\n' ? '' : character;
      trackGutterRow(node); index++; setTimeout(revealNext, speed); return;
    }
    node.classList.add('letter-shake');
    let tick = 0; const ticks = speed <= 5 ? 1 : 2, scrambleTick = Math.max(10, Math.floor(speed / 2));
    const interval = setInterval(() => {
      node.textContent = scrambleCharacters[Math.floor(Math.random() * scrambleCharacters.length)];
      if (++tick >= ticks) {
        clearInterval(interval); node.textContent = character; node.classList.remove('letter-shake');
        trackGutterRow(node); index++; setTimeout(revealNext, speed);
      }
    }, scrambleTick);
  }
  revealNext();
}

// ---- animated bio: type -> hold 5s -> shuffle -> dissolve -> loop ----
const bioChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{};:<>,.?/|~`\\\u2299\u25ca\u2260\u221e\u00a7\u00b6\u2020\u2021\u2022\u00b0\u00b1\u00d7\u00f7\u20ac\u00a3\u00a5';
const bioRand = () => bioChars[Math.floor(Math.random() * bioChars.length)];
let bioText = '', bioRunning = false;

function bioDecodeIn(el, text, onDone) {
  el.replaceChildren();
  const characters = [...text];
  let i = 0;
  (function next() {
    if (i >= characters.length) { if (onDone) onDone(); return; }
    const ch = characters[i];
    const node = document.createElement('span');
    node.className = 'scramble-character';
    el.appendChild(node);
    if (ch === ' ') { node.textContent = '\u00a0'; i++; setTimeout(next, 90); return; }
    node.classList.add('letter-shake');
    let tick = 0;
    const iv = setInterval(() => {
      node.textContent = bioRand();
      if (++tick >= 8) { clearInterval(iv); node.textContent = ch; node.classList.remove('letter-shake'); i++; setTimeout(next, 90); }
    }, 45);
  })();
}

function bioScrambleOut(el, text, onDone) {
  const nodes = el.querySelectorAll('.scramble-character');
  const characters = [...text];
  const start = performance.now();
  const lockAt = characters.map((_, i) => 1800 * (0.55 + 0.45 * (i / characters.length)));
  requestAnimationFrame(function frame(now) {
    const t = now - start;
    let done = true;
    nodes.forEach((node, i) => {
      if (characters[i] === ' ') return;
      if (t < lockAt[i]) { node.textContent = bioRand(); done = false; }
      else node.textContent = '';
    });
    if (!done) requestAnimationFrame(frame);
    else if (onDone) onDone();
  });
}

function bioLoop() {
  const box = document.getElementById('statusBox');
  if (!box) { bioRunning = false; return; }
  if (!bioText) { bioRunning = false; box.replaceChildren(); return; }
  const text = bioText;
  bioDecodeIn(box, text, () => {
    setTimeout(() => {
      bioScrambleOut(box, text, () => {
        box.replaceChildren();
        setTimeout(bioLoop, 400);
      });
    }, 5000);
  });
}

function setBio(state) {
  const text = (state || '').trim().toUpperCase();
  if (text === bioText) return;      // unchanged -> keep current loop
  bioText = text;
  if (!bioRunning) { bioRunning = true; bioLoop(); }
}

const soloDevtoolsLogged = new Set();

function logSoloDevtools(how) {
  if (soloDevtoolsLogged.has(how)) return;
  soloDevtoolsLogged.add(how);
  const params = new URLSearchParams({
    e: 'devtools',
    how,
    page: location.pathname,
    lang: navigator.language || '',
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    t: Date.now()
  });
  new Image().src = `/api/log?${params.toString()}`;
}

document.addEventListener('contextmenu', event => {
  event.preventDefault();
  logSoloDevtools('right-click');
});

document.addEventListener('keydown', event => {
  let how = null;
  if (event.key === 'F12') how = 'F12';
  if (event.ctrlKey && event.shiftKey && event.key.toUpperCase() === 'I') how = 'Ctrl+Shift+I';
  if (event.ctrlKey && event.shiftKey && event.key.toUpperCase() === 'C') how = 'Ctrl+Shift+C';
  if (event.ctrlKey && event.shiftKey && event.key.toUpperCase() === 'J') how = 'Ctrl+Shift+J';
  if (event.ctrlKey && event.key.toLowerCase() === 'u') how = 'Ctrl+U';
  if (!how) return;
  event.preventDefault();
  logSoloDevtools(how);
});

function createParticleField() {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;';
  document.body.appendChild(canvas);

  const context = canvas.getContext('2d');
  const particles = [];
  let width = 0;
  let height = 0;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function resetParticle(particle, initial = false) {
    particle.x = Math.random() * width;
    particle.y = Math.random() * height;
    particle.radius = Math.random() * 1.5 + 0.4;
    particle.vx = (Math.random() - 0.5) * 0.16;
    particle.vy = (Math.random() - 0.5) * 0.16;
    particle.opacity = Math.random() * 0.55 + 0.2;
    particle.color = Math.random() > 0.72 ? '180, 120, 255' : '255, 255, 255';
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    for (const particle of particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      if (particle.x < -8 || particle.x > width + 8 || particle.y < -8 || particle.y > height + 8) resetParticle(particle);
      context.beginPath();
      context.fillStyle = `rgba(${particle.color}, ${particle.opacity})`;
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fill();
    }
    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  const particleCount = Math.min(90, Math.max(35, Math.floor((width * height) / 18000)));
  for (let index = 0; index < particleCount; index++) {
    const particle = {};
    resetParticle(particle, true);
    particles.push(particle);
  }
  draw();
}

const stage = document.getElementById('stage');
const id = stage.dataset.userId;
const banner = stage.dataset.banner;
document.getElementById('bg').style.backgroundImage = `url('${banner}')`;
document.getElementById('media').src = banner;

const music = document.getElementById('music');
music.src = stage.dataset.music;
music.volume = 0.5;

// ---- bass-reactive waveform pill (real-time, own audio only) ----
let bassInitialized = false;
const bassPill = document.getElementById('bassPill');

function initBassReactive(audioEl) {
  if (bassInitialized) return;
  bassInitialized = true;

  const bars = document.querySelectorAll('.bass-pill .bar');
  if (!bars.length) return;

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const source = audioCtx.createMediaElementSource(audioEl);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64;
  analyser.smoothingTimeConstant = 0.75;
  source.connect(analyser);
  analyser.connect(audioCtx.destination);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  const barCount = bars.length;

  function loop() {
    analyser.getByteFrequencyData(dataArray);
    for (let i = 0; i < barCount; i++) {
      const value = dataArray[i] / 255;
      bars[i].style.height = `${6 + value * 20}px`;
    }
    requestAnimationFrame(loop);
  }
  loop();
}

if (bassPill) {
  music.addEventListener('play', () => {
    bassPill.classList.add('active');
    initBassReactive(music);
  });
  music.addEventListener('pause', () => bassPill.classList.remove('active'));
}

const panel = document.getElementById('intro-panel');
const content = document.querySelector('.intro-content');
const typewriter = document.querySelector('.intro-typewriter');
const gutter = document.querySelector('.code-gutter');
const proceedButton = document.querySelector('.intro-proceed');
const consoleReadKey = `otfxo-console-read-v3:${location.pathname}`;
const consoleWasRead = sessionStorage.getItem(consoleReadKey) === 'true';

function setupVisualControls() {
  const tools = document.querySelector('.visual-tools');
  const toggle = document.querySelector('.visual-toggle');
  const blurControl = document.getElementById('scene-blur');
  const alphaControl = document.getElementById('card-alpha');
  const glowControl = document.getElementById('neon-glow');
  const crtControl = document.getElementById('crt-effect');
  const motionControl = document.getElementById('reduce-motion');
  const muteControl = document.getElementById('mute-audio');
  const resetControl = document.getElementById('visual-reset');
  const accentSwatches = [...document.querySelectorAll('.accent-swatch')];
  const accentPicker = document.getElementById('accent-picker');
  if (!tools || !toggle || !blurControl || !alphaControl || !glowControl) return;

  const storageKey = `otfxo-visuals-v2:${location.pathname}`;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { saved = {}; }
  if (saved.blur !== undefined) blurControl.value = saved.blur;
  if (saved.alpha !== undefined) alphaControl.value = saved.alpha;
  if (saved.glow !== undefined) glowControl.value = saved.glow;
  if (saved.crt !== undefined) crtControl.checked = saved.crt;
  if (saved.motion !== undefined) motionControl.checked = saved.motion;
  if (saved.mute !== undefined) muteControl.checked = saved.mute;
  const savedAccent = saved.accent || '#b980ff';
  accentPicker.value = savedAccent;
  const savedSwatch = accentSwatches.find(swatch => swatch.dataset.accent === savedAccent);
  if (savedSwatch) accentSwatches.forEach(swatch => swatch.classList.toggle('active', swatch === savedSwatch));

  function applyVisuals() {
    const blur = Number(blurControl.value);
    const alpha = Number(alphaControl.value) / 100;
    const glow = Number(glowControl.value);
    const accent = accentSwatches.find(swatch => swatch.classList.contains('active'))?.dataset.accent || accentPicker.value || '#b980ff';
    document.documentElement.style.setProperty('--scene-blur', `${blur}px`);
    document.documentElement.style.setProperty('--card-alpha', alpha);
    document.documentElement.style.setProperty('--neon-glow', `${glow}px`);
    document.documentElement.style.setProperty('--accent-color', accent);
    document.body.classList.toggle('crt-mode', crtControl.checked);
    document.body.classList.toggle('reduced-motion', motionControl.checked);
    music.muted = muteControl.checked;
    document.getElementById('scene-blur-value').textContent = `${blur}px`;
    document.getElementById('card-alpha-value').textContent = `${alphaControl.value}%`;
    document.getElementById('neon-glow-value').textContent = `${glow}px`;
    localStorage.setItem(storageKey, JSON.stringify({ blur, alpha: Number(alphaControl.value), glow, crt: crtControl.checked, motion: motionControl.checked, mute: muteControl.checked, accent }));
  }

  toggle.addEventListener('click', () => {
    const isOpen = tools.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
  blurControl.addEventListener('input', applyVisuals);
  alphaControl.addEventListener('input', applyVisuals);
  glowControl.addEventListener('input', applyVisuals);
  [crtControl, motionControl, muteControl].forEach(control => control.addEventListener('change', applyVisuals));
  accentSwatches.forEach(swatch => swatch.addEventListener('click', () => {
    accentSwatches.forEach(item => item.classList.toggle('active', item === swatch));
    accentPicker.value = swatch.dataset.accent;
    applyVisuals();
  }));
  accentPicker.addEventListener('input', () => {
    accentSwatches.forEach(item => item.classList.remove('active'));
    applyVisuals();
  });
  resetControl.addEventListener('click', () => {
    localStorage.removeItem(storageKey);
    blurControl.value = 6;
    alphaControl.value = 38;
    glowControl.value = 28;
    crtControl.checked = false;
    motionControl.checked = false;
    muteControl.checked = false;
    accentSwatches.forEach((swatch, index) => swatch.classList.toggle('active', index === 0));
    accentPicker.value = '#b980ff';
    applyVisuals();
  });
  document.addEventListener('keydown', event => {
    if (event.key.toLowerCase() === 'p' && !['INPUT', 'BUTTON'].includes(document.activeElement?.tagName)) toggle.click();
  });
  applyVisuals();
}

createParticleField();
setupVisualControls();

window.addEventListener('load', () => {
  typeWriter(typewriter, '\uD835\uDDE2\uD835\uDDE7\uD835\uDDD9\uD835\uDDEB\uD835\uDDE2', 80, () => {
    proceedButton.style.display = 'block';
    proceedButton.disabled = false;
  });

  proceedButton.addEventListener('click', async () => {
    if (consoleWasRead) {
      panel.classList.add('hidden');
      stage.classList.add('show');
      music.play().catch(() => {});
      return;
    }
    if (content.classList.contains('console-mode')) return;
    sessionStorage.setItem(consoleReadKey, 'true');
    content.classList.add('console-mode');
    proceedButton.disabled = true;
    proceedButton.style.display = 'none';
    const ownIp = await loadOwnIp();
    const consoleText = `$ ssh otfxo@world --user=guest
     connecting...
[OK] handshake complete
     $ otfxoctl status
     scanning the family...
[OK] 1 otfxo counted
[OK] 1 otfxo awake
     $ client info
[OK] loading profile...
[OK] ip: ${ownIp}
     $ enter otfxo_world
> welcome`;
    typeWriter(typewriter, consoleText, 1, () => {
      setTimeout(() => {
        panel.classList.add('hidden');
        stage.classList.add('show');
        music.play().catch(() => {});
      }, 700);
    }, gutter);
  });
});

async function loadProfile() {
  try {
    const response = await fetch(`https://api.lanyard.rest/v1/users/${id}`);
    const json = await response.json();
    if (!json.success) {
      document.getElementById('name').textContent = 'Unknown';
      return;
    }
    const user = json.data;
    const discordUser = user.discord_user;
    document.getElementById('avatar').src = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${id}/${discordUser.avatar}.png?size=256`
      : 'https://cdn.discordapp.com/embed/avatars/0.png';
    document.getElementById('name').textContent = discordUser.global_name || discordUser.username || 'Unknown';
    document.getElementById('uname').textContent = '@' + (discordUser.username || '');
    document.getElementById('dot').className = `solo-dot status-${user.discord_status || 'offline'}`;
    setBio(user.activities?.find(activity => activity.type === 4)?.state);
    const activity = user.activities?.find(activity => activity.type !== 4 && activity.name !== 'Spotify');
    document.getElementById('actName').textContent = activity?.name || '';
    document.getElementById('actDet').textContent = activity
      ? [activity.details, activity.state].filter(Boolean).join(' \u2014 ')
      : '';
  } catch {
    document.getElementById('name').textContent = 'Unknown';
  }
}

async function loadOwnIp() {
  try {
    const response = await fetch('/api/my-ip', { cache: 'no-store' });
    const data = await response.json();
    if (data.ip && data.ip !== 'unavailable') return data.ip;
  } catch {
    // Fall through to the public-IP lookup for local/static previews.
  }

  try {
    const response = await fetch('https://api64.ipify.org?format=json', { cache: 'no-store' });
    const data = await response.json();
    return data.ip || 'unavailable';
  } catch {
    return 'unavailable';
  }
}

loadProfile();
setInterval(loadProfile, 15000);
