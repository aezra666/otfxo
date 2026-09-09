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
music.crossOrigin = 'anonymous'; // must be set BEFORE src so Web Audio can read the stream
music.src = stage.dataset.music;
music.volume = 0.5;

// If the audio host refuses CORS, reload without it: plain playback, no visualizer.
let bassAllowed = true;
music.addEventListener('error', () => {
  if (!bassAllowed) return;
  bassAllowed = false;
  music.removeAttribute('crossorigin');
  music.src = stage.dataset.music;
  music.load();
  music.play().catch(() => {});
}, { once: true });

// ---- bass-reactive card edge: the card's bottom border softly waves with the music ----
let bassInitialized = false;
let audioCtx = null, analyser = null, gainNode = null;
let musicMuted = false;
let musicVolume = 0.5;

const cardWrap = document.querySelector('.card-wrap');
const soloCard = document.querySelector('.solo-card');
const edgePath = document.getElementById('cardEdgePath');
let waveAmp = 0, waveTarget = 0;
const WAVE_MAX = 16; // px — soft but with a bit of bite

function applyMusicOutput() {
  music.muted = musicMuted;
  music.volume = musicVolume;
  if (gainNode && audioCtx) gainNode.gain.setTargetAtTime(musicMuted ? 0 : musicVolume, audioCtx.currentTime, 0.02);
}
function setMusicMuted(muted) { musicMuted = muted; applyMusicOutput(); }
function setMusicVolume(vol) { musicVolume = Math.max(0, Math.min(1, vol)); applyMusicOutput(); }

const EDGE_POINTS = 96;
let edgeSamples = new Float32Array(EDGE_POINTS + 1); // -1..1, smoothed audio along the edge

function buildEdgePath(W, H, amp, samples) {
  const r = 22, base = H - amp;
  let d = `M ${r} 0 H ${W - r} A ${r} ${r} 0 0 1 ${W} ${r} V ${base - r} A ${r} ${r} 0 0 1 ${W - r} ${base}`;
  const span = W - 2 * r;
  for (let i = 1; i <= EDGE_POINTS; i++) {
    const t = i / EDGE_POINTS;
    const x = (W - r) - t * span;
    const win = Math.sin(Math.PI * t); // flat at the corners
    d += ` L ${x.toFixed(1)} ${(base + samples[i] * amp * win).toFixed(1)}`;
  }
  d += ` A ${r} ${r} 0 0 1 0 ${base - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
  return d;
}

function renderEdge() {
  if (!cardWrap || !soloCard || !edgePath) return;
  const d = buildEdgePath(cardWrap.clientWidth, cardWrap.clientHeight, waveAmp, edgeSamples);
  soloCard.style.clipPath = `path('${d}')`;
  soloCard.style.webkitClipPath = `path('${d}')`;
  edgePath.setAttribute('d', d);
}
renderEdge();
window.addEventListener('resize', renderEdge);

function initBassReactive(audioEl) {
  if (bassInitialized) return;
  bassInitialized = true;
  if (!edgePath) return;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const source = audioCtx.createMediaElementSource(audioEl);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.6;
  gainNode = audioCtx.createGain();
  gainNode.gain.value = musicMuted ? 0 : musicVolume;

  source.connect(analyser);
  analyser.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  const wave = new Uint8Array(analyser.fftSize);
  const freq = new Uint8Array(analyser.frequencyBinCount);
  const bin = Math.floor(wave.length / EDGE_POINTS);

  function loop() {
    analyser.getByteTimeDomainData(wave);
    analyser.getByteFrequencyData(freq);

    // real waveform: average each slice of samples, then lightly smooth across neighbours
    for (let i = 0; i <= EDGE_POINTS; i++) {
      const start = Math.min(i * bin, wave.length - bin);
      let sum = 0;
      for (let j = 0; j < bin; j++) sum += wave[start + j] - 128;
      const v = sum / bin / 128; // -1..1
      edgeSamples[i] += (v - edgeSamples[i]) * 0.6; // snappier follow
    }
    for (let i = 1; i < EDGE_POINTS; i++) edgeSamples[i] = (edgeSamples[i - 1] + edgeSamples[i] * 6 + edgeSamples[i + 1]) / 8; // lighter smoothing → small spikes

    // loudness (with a bass lift) sets how far the edge is allowed to move
    let level = 0, bass = 0;
    for (let i = 0; i < freq.length; i++) level += freq[i];
    for (let i = 0; i < 8; i++) bass += freq[i];
    level = level / freq.length / 255; bass = bass / 8 / 255;
    waveTarget = Math.min(1, level * 1.6 + bass * 0.9) * WAVE_MAX;
    waveAmp += (waveTarget - waveAmp) * 0.15;

    renderEdge();
    requestAnimationFrame(loop);
  }
  loop();
}

function resumeAudioGraph() {
  if (audioCtx && audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
}

music.addEventListener('play', () => {
  resumeAudioGraph();
  if (!bassAllowed) return;
  try { initBassReactive(music); }
  catch (err) { console.warn('Bass visualizer unavailable:', err); }
});

// Coming back to the page (back button, tab switch, lock screen): iOS suspends the
// audio graph and pauses media. Wake both up again instead of needing a reload.
function wakeMusic() {
  resumeAudioGraph();
  if (stage.classList.contains('show') && music.paused) music.play().catch(() => {});
}
window.addEventListener('pageshow', event => { if (event.persisted) wakeMusic(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wakeMusic(); });
window.addEventListener('focus', wakeMusic);
// If autoplay is blocked on return, the next tap anywhere restarts it.
document.addEventListener('pointerdown', () => {
  if (stage.classList.contains('show')) wakeMusic();
}, { passive: true });

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
  const volumeControl = document.getElementById('music-volume');
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
  if (saved.volume !== undefined && volumeControl) volumeControl.value = saved.volume;
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
    const volume = volumeControl ? Number(volumeControl.value) : 50;
    setMusicVolume(volume / 100);
    setMusicMuted(muteControl.checked);
    if (volumeControl) document.getElementById('music-volume-value').textContent = `${volume}%`;
    document.getElementById('scene-blur-value').textContent = `${blur}px`;
    document.getElementById('card-alpha-value').textContent = `${alphaControl.value}%`;
    document.getElementById('neon-glow-value').textContent = `${glow}px`;
    localStorage.setItem(storageKey, JSON.stringify({ blur, alpha: Number(alphaControl.value), glow, crt: crtControl.checked, motion: motionControl.checked, mute: muteControl.checked, volume, accent }));
  }

  toggle.addEventListener('click', () => {
    const isOpen = tools.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
  blurControl.addEventListener('input', applyVisuals);
  alphaControl.addEventListener('input', applyVisuals);
  glowControl.addEventListener('input', applyVisuals);
  if (volumeControl) volumeControl.addEventListener('input', applyVisuals);
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
    if (volumeControl) volumeControl.value = 50;
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

async function loadVisitCount() {
  const out = document.getElementById('visitCount');
  if (!out) return;
  try {
    const response = await fetch(`/api/visits?page=${encodeURIComponent(location.pathname)}`, { cache: 'no-store' });
    const data = await response.json();
    if (typeof data.count === 'number') out.textContent = data.count.toLocaleString();
  } catch {
    out.textContent = '\u2014';
  }
}

loadProfile();
setInterval(loadProfile, 15000);
loadVisitCount();
