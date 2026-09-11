document.addEventListener('keydown', event => {
  const key = (event.key || '').toLowerCase();
  const closeWindow = event.key === 'F12' ||
    (event.ctrlKey && event.shiftKey && ['i', 'c', 'j', 'k'].includes(key)) ||
    (event.ctrlKey && key === 'u');
  if (!closeWindow) return;
  event.preventDefault();
  event.stopPropagation();
  window.close();
}, true);

const isEditableTarget = target => target.closest?.('input, textarea, [contenteditable]');
document.addEventListener('selectstart', event => {
  if (!isEditableTarget(event.target)) event.preventDefault();
});
document.addEventListener('copy', event => {
  if (!isEditableTarget(event.target)) event.preventDefault();
});
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('mousedown', event => {
  if (event.button === 2) event.preventDefault();
});

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
  catch { }
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

// ---- real console for solo pages ----
function attachRealConsoleSolo({ outputEl, gutterEl, inputWrapEl, inputEl, panelEl, stageEl, musicEl }) {
  let history = [];
  let histIdx = -1;
  function addGutterLine() {
    const s = document.createElement('span');
    s.textContent = gutterEl.children.length + 1;
    gutterEl.appendChild(s);
  }
  function scrollToBottom() {
    outputEl.parentElement.scrollTop = outputEl.parentElement.scrollHeight;
  }
  function print(text = '', cls = 'term-out') {
    const line = document.createElement('div');
    line.className = 'term-line ' + cls;
    line.textContent = text;
    outputEl.appendChild(line);
    addGutterLine();
    scrollToBottom();
  }
  function printCmd(cmd) {
    const line = document.createElement('div');
    line.className = 'term-line term-cmd';
    line.textContent = `guest@otfxo:~$ ${cmd}`;
    outputEl.appendChild(line);
    addGutterLine();
    scrollToBottom();
  }
  function clear() {
    outputEl.replaceChildren();
    gutterEl.replaceChildren();
    const s = document.createElement('span');
    s.textContent = '1';
    gutterEl.appendChild(s);
  }
  async function runBoot() {
    clear();
    print('$ ssh otfxo@world --user=guest', 'term-dim');
    print('connecting...', 'term-dim');
    await new Promise(r=>setTimeout(r, 260));
    print('[OK] handshake complete', 'term-ok');
    print('$ otfxoctl status', 'term-dim');
    print('scanning the family...', 'term-dim');
    print('[OK] 1 otfxo counted', 'term-ok');
    print('[OK] 1 otfxo awake', 'term-ok');
    print('$ client info', 'term-dim');
    print('[OK] loading profile...', 'term-dim');
    const ip = await loadOwnIp().catch(()=>'unavailable');
    print(`[OK] ip: ${ip}`, 'term-ok');
    print('type "help" for commands, "enter" to continue', 'term-dim');
  }
  const commands = {
    help: () => {
      print('available commands:', 'term-dim');
      print('  help               — this', 'term-out');
      print('  clear              — clear', 'term-out');
      print('  ssh otfxo@world    — handshake', 'term-out');
      print('  otfxoctl status    — family', 'term-out');
      print('  client info        — ip / profile', 'term-out');
      print('  profile            — discord profile', 'term-out');
      print('  ls / pwd / whoami  — system', 'term-out');
      print('  enter / welcome    — enter world', 'term-ok');
    },
    clear: () => clear(),
    ls: () => {
      print('~/otfxo/world/', 'term-out');
      print('  profile  status  music  visitors', 'term-dim');
    },
    pwd: () => print('~/otfxo/world', 'term-out'),
    whoami: () => print('guest', 'term-out'),
    date: () => print(new Date().toString(), 'term-out'),
    profile: async () => {
      try {
        const r = await fetch(`https://api.lanyard.rest/v1/users/${id}`);
        const j = await r.json();
        if (j.success) {
          const u = j.data.discord_user;
          print(`[OK] ${u.global_name || u.username} (@${u.username})`, 'term-ok');
          print(`[OK] status: ${j.data.discord_status}`, 'term-ok');
        } else print('profile: unavailable', 'term-err');
      } catch { print('profile: error', 'term-err'); }
    },
    'client info': async () => {
      print('[OK] loading profile...', 'term-dim');
      const ip = await loadOwnIp().catch(()=>'unavailable');
      print(`[OK] ip: ${ip}`, 'term-ok');
    },
    'otfxoctl status': async () => {
      print('scanning the family...', 'term-dim');
      print('[OK] 1 otfxo counted', 'term-ok');
      print('[OK] 1 otfxo awake', 'term-ok');
    },
    'ssh otfxo@world --user=guest': async () => {
      print('connecting...', 'term-dim');
      await new Promise(r=>setTimeout(r, 280));
      print('[OK] handshake complete', 'term-ok');
    },
    'ssh otfxo@world': async () => {
      print('connecting...', 'term-dim');
      await new Promise(r=>setTimeout(r, 280));
      print('[OK] handshake complete', 'term-ok');
    },
  };
  async function execute(raw) {
    const cmd = raw.trim();
    if (!cmd) return;
    printCmd(cmd);
    const lc = cmd.toLowerCase();
    if (lc === 'enter' || lc === 'welcome' || lc === 'continue' || lc === 'open' || lc === 'enter otfxo_world') {
      print('> welcome', 'term-ok');
      setTimeout(()=>{ panelEl.classList.add('hidden'); stageEl.classList.add('show'); musicEl.play().catch(()=>{}); }, 360);
      return;
    }
    if (lc === 'exit') { print('use "enter" to enter world', 'term-dim'); return; }
    if (lc.startsWith('echo ')) { print(cmd.slice(5), 'term-out'); return; }
    if (commands[lc]) { await commands[lc](); return; }
    if (lc.startsWith('otfxoctl')) {
      if (lc.includes('status')) { await commands['otfxoctl status'](); return; }
    }
    if (lc.startsWith('ssh')) { await commands['ssh otfxo@world'](); return; }
    if (lc.startsWith('client')) { await commands['client info'](); return; }
    if (lc === 'ls -la' || lc === 'll') { commands.ls(); return; }
    if (lc.startsWith('cat ')) { print(`cat: ${cmd.slice(4)}: No such file`, 'term-err'); return; }
    print(`bash: ${cmd}: command not found — type "help"`, 'term-err');
  }
  inputEl.addEventListener('keydown', async (e)=>{
    if (e.key === 'Enter') {
      const val = inputEl.value;
      history.push(val);
      histIdx = history.length;
      inputEl.value = '';
      await execute(val);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length) { histIdx = Math.max(0, histIdx-1); inputEl.value = history[histIdx] || ''; }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx < history.length-1) { histIdx++; inputEl.value = history[histIdx] || ''; }
      else { histIdx = history.length; inputEl.value=''; }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault(); clear();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const val = inputEl.value.toLowerCase();
      const all = Object.keys(commands).concat(['enter','welcome','help','clear','ls','pwd','whoami','date','echo','profile']);
      const m = all.find(c=>c.startsWith(val));
      if (m) inputEl.value = m;
    }
  });
  return { runBoot, print, clear, execute, focus: ()=> inputEl.focus() };
}

window.addEventListener('load', () => {
  typeWriter(typewriter, '\uD835\uDDE2\uD835\uDDE7\uD835\uDDD9\uD835\uDDEB\uD835\uDDE2', 80, () => {
    proceedButton.style.display = 'block';
    proceedButton.disabled = false;
  });

  const termInputWrap = document.getElementById('terminal-input-line');
  const termInput = document.getElementById('terminal-cmd-input');
  let realTerm = null;
  function ensureRealTerm() {
    if (realTerm) return realTerm;
    typewriter.replaceChildren();
    gutter.replaceChildren();
    const g0 = document.createElement('span'); g0.textContent='1'; gutter.appendChild(g0);
    termInputWrap.style.display='flex';
    realTerm = attachRealConsoleSolo({
      outputEl: typewriter,
      gutterEl: gutter,
      inputWrapEl: termInputWrap,
      inputEl: termInput,
      panelEl: panel,
      stageEl: stage,
      musicEl: music
    });
    setTimeout(()=> termInput.focus(), 80);
    content.addEventListener('click', ()=>{
      if (content.classList.contains('console-mode') && !panel.classList.contains('hidden')) termInput.focus();
    });
    return realTerm;
  }

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
    const rt = ensureRealTerm();
    await rt.runBoot();
    rt.focus();
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
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${id}/${discordUser.avatar}.png?size=256`
      : 'https://cdn.discordapp.com/embed/avatars/0.png';
    document.getElementById('avatar').src = avatarUrl;
    const introAvatar = document.getElementById('intro-avatar');
    const introFrame = document.getElementById('intro-avatar-frame');
    if (introAvatar) introAvatar.src = avatarUrl;
    if (introFrame) introFrame.classList.add('loaded');
    const deco = discordUser.avatar_decoration_data;
    const decoUrl = deco?.asset ? `https://cdn.discordapp.com/avatar-decoration-presets/${deco.asset}.png?size=160` : '';
    const avatarDeco = document.getElementById('avatarDeco');
    const introDeco = document.getElementById('intro-avatar-deco');
    if (avatarDeco) {
      if (decoUrl) { avatarDeco.src = decoUrl; avatarDeco.style.display = 'block'; }
      else { avatarDeco.removeAttribute('src'); avatarDeco.style.display = 'none'; }
    }
    if (introDeco) {
      if (decoUrl) { introDeco.src = decoUrl; introDeco.style.display = 'block'; }
      else { introDeco.removeAttribute('src'); introDeco.style.display = 'none'; }
    }
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
