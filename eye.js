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
stage.classList.add('show');
const customCursor = document.getElementById('custom-cursor');
if (customCursor && window.matchMedia('(pointer: fine)').matches) {
  document.addEventListener('pointermove', event => {
    customCursor.style.left = `${event.clientX}px`;
    customCursor.style.top = `${event.clientY}px`;
    customCursor.classList.add('is-visible');
    customCursor.classList.toggle('is-interactive', Boolean(event.target.closest('button, a, input, label')));
  });
  document.addEventListener('pointerleave', () => customCursor.classList.remove('is-visible'));
}
const id = stage.dataset.userId;
document.querySelectorAll('.social-icon[data-icon]').forEach(icon => {
  if (icon.dataset.icon) {
    icon.src = icon.dataset.icon;
    icon.closest('.social-link')?.classList.add('has-icon');
  }
});

const banner = window.OTFXO_PROFILES?.[id]?.banner || '';
const background = document.getElementById('bg');
if (background) background.style.backgroundImage = `url('${banner}')`;

const music = document.getElementById('music');
music.src = window.OTFXO_PROFILES?.[id]?.music || '';
music.volume = 0.8;
let userPausedMusic = false;

const cardWrap = document.querySelector('.card-wrap');
const soloCard = document.querySelector('.solo-card');

let cardTilt = { rotateX: 0, rotateY: 0 };
function updateCardTransform() {
  if (!soloCard) return;
  soloCard.style.transform = `perspective(900px) rotateX(${cardTilt.rotateX}deg) rotateY(${cardTilt.rotateY}deg) translateY(-5px) scale(1.015)`;
}

if (cardWrap && soloCard) {
  cardWrap.addEventListener('click', event => {
    if (event.target.closest('button, a, input, label')) return;
    cardWrap.classList.remove('is-tilting');
    soloCard.classList.toggle('is-flipped');
    soloCard.classList.toggle('is-focused');
    updateCardTransform();
  });

  cardWrap.addEventListener('pointermove', event => {
    cardWrap.classList.add('is-tilting');
    const bounds = cardWrap.getBoundingClientRect();
    const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5;
    const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;
    const rotateY = horizontal * 12;
    const rotateX = vertical * -12;
    cardTilt = { rotateX, rotateY };
    updateCardTransform();
  });

  cardWrap.addEventListener('pointerleave', () => {
    cardWrap.classList.remove('is-tilting');
    cardTilt = { rotateX: 0, rotateY: 0 };
    updateCardTransform();
  });
}

// Coming back to the page (back button, tab switch, lock screen): iOS suspends the
// audio graph and pauses media. Wake both up again instead of needing a reload.
function wakeMusic() {
  const intro = document.getElementById('intro-panel');
  const introVisible = intro && !intro.classList.contains('hidden');
  if (!introVisible && !userPausedMusic && stage.classList.contains('show') && music.paused) music.play().catch(() => {});
}
window.addEventListener('pageshow', event => { if (event.persisted) wakeMusic(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wakeMusic(); });
window.addEventListener('focus', wakeMusic);

const panel = document.getElementById('intro-panel');
const content = document.querySelector('.intro-content');
const typewriter = document.querySelector('.intro-typewriter');
const gutter = document.querySelector('.code-gutter');
const proceedButton = document.querySelector('.intro-proceed');
const introPanel = document.getElementById('intro-panel');
let introTextFinished = true;
let introAvatarReady = false;
function updateIntroButton() {
  if (proceedButton) proceedButton.disabled = !(introTextFinished && introAvatarReady);
}
if (typewriter) {
  typewriter.textContent = '';
  introTextFinished = true;
  updateIntroButton();
}
if (proceedButton && introPanel) {
  proceedButton.disabled = false;
  proceedButton.addEventListener('click', () => {
    userPausedMusic = false;
    music.play().catch(() => {});
    introPanel.classList.add('hidden');
    setTimeout(() => { introPanel.style.display = 'none'; }, 850);
  });
}
const consoleReadKey = `otfxo-console-read-v3:${location.pathname}`;
const consoleWasRead = sessionStorage.getItem(consoleReadKey) === 'true';

function setupAudioToggle() {
  const audioToggle = document.getElementById('audio-toggle');
  const audioPlayer = document.getElementById('audio-player');
  if (!audioToggle && !audioPlayer) return;

  if (audioPlayer) {
    const playButton = audioPlayer.querySelector('[data-audio-action="toggle"]');
    const progress = document.getElementById('audio-progress');
    const progressFill = document.getElementById('audio-progress-fill');
    const currentTime = document.getElementById('audio-current-time');
    const duration = document.getElementById('audio-duration');
    const volumeControl = document.getElementById('audio-volume');
    let idleTimer;
    const resetPlayerIdle = () => {
      audioPlayer.classList.remove('is-idle');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => audioPlayer.classList.add('is-idle'), 2800);
    };
    const formatTime = value => {
      if (!Number.isFinite(value)) return '0:00';
      return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
    };
    const syncPlayer = () => {
      const isPaused = music.paused;
      playButton.classList.toggle('is-playing', !isPaused);
      playButton.setAttribute('aria-label', isPaused ? 'Play music' : 'Pause music');
      playButton.setAttribute('aria-pressed', String(!isPaused));
      audioPlayer.classList.toggle('is-paused', isPaused);
      const percent = music.duration ? (music.currentTime / music.duration) * 100 : 0;
      progressFill.style.width = `${percent}%`;
      progress.setAttribute('aria-valuenow', String(Math.round(percent)));
      currentTime.textContent = formatTime(music.currentTime);
      duration.textContent = formatTime(music.duration);
    };
    const seekFromEvent = event => {
      if (!music.duration) return;
      const bounds = progress.getBoundingClientRect();
      music.currentTime = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * music.duration;
    };
    playButton.addEventListener('click', () => {
      if (music.paused) {
        userPausedMusic = false;
        music.play().catch(() => {});
      } else {
        userPausedMusic = true;
        music.pause();
      }
    });
    audioPlayer.querySelector('[data-audio-action="back"]').addEventListener('click', () => { music.currentTime = 0; });
    audioPlayer.querySelector('[data-audio-action="forward"]').addEventListener('click', () => { music.currentTime = Math.min(music.duration || 0, music.currentTime + 10); });
    progress.addEventListener('click', seekFromEvent);
    progress.addEventListener('keydown', event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { music.currentTime += event.key === 'ArrowRight' ? 5 : -5; } });
    volumeControl.addEventListener('input', event => { music.volume = Number(event.target.value); });
    ['pointerenter', 'pointermove', 'focusin', 'click', 'input'].forEach(type => audioPlayer.addEventListener(type, resetPlayerIdle));
    music.addEventListener('timeupdate', syncPlayer);
    music.addEventListener('loadedmetadata', syncPlayer);
    music.addEventListener('play', syncPlayer);
    music.addEventListener('pause', syncPlayer);
    music.addEventListener('error', syncPlayer);
    syncPlayer();
    resetPlayerIdle();
  }

  if (!audioToggle) return;

  const syncButton = () => {
    const isPaused = music.paused;
    audioToggle.textContent = isPaused ? 'Play' : 'Pause';
    audioToggle.setAttribute('aria-label', isPaused ? 'Play music' : 'Pause music');
  };

  audioToggle.addEventListener('click', () => {
    if (music.paused) {
      userPausedMusic = false;
      music.play().catch(() => {});
    } else {
      userPausedMusic = true;
      music.pause();
    }
    syncButton();
  });

  music.addEventListener('play', syncButton);
  music.addEventListener('pause', syncButton);
  syncButton();
}

createParticleField();
document.body.classList.add('crt-mode');
setupAudioToggle();

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
    const profileTitle = discordUser.global_name || discordUser.username || 'otfxo';
    document.title = profileTitle;
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${id}/${discordUser.avatar}.png?size=256`
      : 'https://cdn.discordapp.com/embed/avatars/0.png';
    const favicon = document.getElementById('profile-favicon');
    if (favicon) favicon.href = avatarUrl;
    document.getElementById('avatar').src = avatarUrl;
    const introAvatar = document.getElementById('intro-avatar');
    const introFrame = document.getElementById('intro-avatar-frame');
    if (introAvatar) introAvatar.src = avatarUrl;
    if (introFrame) introFrame.classList.add('loaded');
    introAvatarReady = true;
    updateIntroButton();
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
  const outputs = document.querySelectorAll('.visitor-count');
  if (!outputs.length) return;

  try {
    const response = await fetch(`/api/visits?page=${encodeURIComponent(location.pathname)}`, { cache: 'no-store' });
    const data = await response.json();
    if (typeof data.count === 'number') {
      const target = Math.max(1, data.count);
      const duration = 1100;
      const startedAt = performance.now();

      function animateCount(now) {
        const progress = Math.min(1, (now - startedAt) / duration);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(1 + (target - 1) * easedProgress);
        outputs.forEach(output => { output.textContent = current.toLocaleString(); });
        if (progress < 1) requestAnimationFrame(animateCount);
      }

      requestAnimationFrame(animateCount);
    }
  } catch {
    outputs.forEach(output => { output.textContent = '\u2014'; });
  }
}

loadProfile();
setInterval(loadProfile, 15000);
loadVisitCount();
