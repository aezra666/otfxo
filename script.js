   const logged = new Set();

  function logEvent(type, extra = {}) {
    if (logged.has(type)) return; // once per page load per type
    logged.add(type);

    const params = new URLSearchParams({
      e: type,
      how: extra.how || '',
      page: location.pathname,
      ref: document.referrer || '',
      lang: navigator.language || '',
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      screen: `${screen.width}x${screen.height}`,
      vp: `${window.innerWidth}x${window.innerHeight}`,
      touch: navigator.maxTouchPoints > 0 ? '1' : '0',
      t: Date.now()
    });
    const url = `/api/log?${params.toString()}`;

    // Plain GET via an image request: survives window.close(), no CORS/body rules.
    const img = new Image();
    img.src = url;
    // Belt and braces: keepalive fetch as well (deduped server-side by nothing,
    // so only fire it if the image path is unavailable).
    if (!('Image' in window)) {
      fetch(url, { keepalive: true }).catch(() => {});
    }
  }

  let lockedDown = false;
  function lockdown() {
    if (lockedDown) return;
    lockedDown = true;

    // wipe the page
    try {
      document.documentElement.innerHTML =
        '<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#39ff14;font-family:monospace;font-size:1.2rem;">nice try.</body>';
    } catch (e) {}

    // freeze devtools: pauses on this line every tick while devtools is open
    setInterval(() => {
      (function () { debugger; })();
    }, 100);

    // send them away
    setTimeout(() => {
      try { window.location.replace('about:blank'); } catch (e) {}
    }, 1500);
  }

  function devtoolsAttempt(how) {
    logEvent('devtools', { how });
    window.close();   // works only if the site opened the tab
    lockdown();       // the real deterrent
  }

  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });

  document.addEventListener('keydown', (e) => {
    let how = null;
    if (e.key === 'F12') how = 'F12';
    if (e.ctrlKey && e.shiftKey && e.key === 'I') how = 'Ctrl+Shift+I';
    if (e.ctrlKey && e.shiftKey && e.key === 'C') how = 'Ctrl+Shift+C';
    if (e.ctrlKey && e.shiftKey && e.key === 'J') how = 'Ctrl+Shift+J';
    if (e.ctrlKey && e.shiftKey && e.key === 'K') how = 'Ctrl+Shift+K';
    if (e.ctrlKey && e.key === 'u') how = 'Ctrl+U';
    if (how) {
      e.preventDefault();
      devtoolsAttempt(how);
      return false;
    }
  });

  document.addEventListener('selectstart', (e) => {
    e.preventDefault();
    return false;
  });

  document.addEventListener('copy', (e) => {
    e.preventDefault();
    return false;
  });

  const threshold = 160;
  setInterval(() => {
    if (window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold) {
      devtoolsAttempt('docked-devtools');
    }
  }, 100);

  // Catches DevTools even when undocked: the console only evaluates this
  // getter when it renders the object, i.e. when DevTools is open.
  const devtoolsProbe = {};
  Object.defineProperty(devtoolsProbe, 'id', {
    get() {
      devtoolsAttempt('devtools-open');
      return '';
    }
  });
  setInterval(() => {
    console.log('%c', 'padding:0', devtoolsProbe);
    console.clear();
  }, 1000);

  document.addEventListener('mousedown', (e) => {
    if (e.button === 2) {
      devtoolsAttempt('right-click');
    }
  });

  const aboutText = ``;

  let isTyping = false;

  function typeWriter(element, text, speed = 40, callback = null, gutterElement = null) {
    const scrambleCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%€&/.,<>';
    const characters = [...text];
    const okCharacterIndexes = new Set();
    for (const match of text.matchAll(/\[OK\]/g)) {
      const startIndex = match.index ?? -1;
      for (let offset = 0; offset < 4; offset++) {
        okCharacterIndexes.add(startIndex + offset);
      }
    }

    element.replaceChildren();
    element.classList.add('typing');
    let index = 0;

    let gutterLineNumber = 1;
    let gutterRowTop = null;
    if (gutterElement) {
      gutterElement.innerHTML = '';
      const firstLineSpan = document.createElement('span');
      firstLineSpan.textContent = gutterLineNumber;
      gutterElement.appendChild(firstLineSpan);
    }

    function trackGutterRow(node) {
      if (!gutterElement) return;
      const rowTop = node.offsetTop;
      if (gutterRowTop === null) {
        gutterRowTop = rowTop;
      } else if (rowTop > gutterRowTop) {
        gutterLineNumber++;
        const lineSpan = document.createElement('span');
        lineSpan.textContent = gutterLineNumber;
        gutterElement.appendChild(lineSpan);
        gutterRowTop = rowTop;
      }
    }

    function revealNext() {
      if (index >= characters.length) {
        element.classList.remove('typing');
        const cursorNode = document.createElement('span');
        cursorNode.className = 'line-cursor';
        element.appendChild(cursorNode);
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
        trackGutterRow(node);
        index++;
        setTimeout(revealNext, speed);
        return;
      }

      node.classList.add('letter-shake');
      const scrambleTicks = 2;
      let tick = 0;
      const scrambleTick = Math.max(10, Math.floor(speed / 2));
      const scrambleInterval = setInterval(() => {
        node.textContent = scrambleCharacters[Math.floor(Math.random() * scrambleCharacters.length)];
        tick++;
        if (tick >= scrambleTicks) {
          clearInterval(scrambleInterval);
          node.textContent = character;
          node.classList.remove('letter-shake');
          trackGutterRow(node);
          index++;
          setTimeout(revealNext, speed);
        }
      }, scrambleTick);
    }

    revealNext();
  }

  async function getFamilyStatus() {
    const total = discordUsers.length;
    let awake = 0;

    await Promise.all(discordUsers.map(async (user) => {
      try {
        const res = await fetch(`https://api.lanyard.rest/v1/users/${user.id}`);
        const json = await res.json();
        if (json.success && json.data.discord_status && json.data.discord_status !== 'offline') {
          awake++;
        }
      } catch (err) {
        console.error('Lanyard status fetch error', err);
      }
    }));

    return { total, awake };
  }

  function getBrowserInfo() {
    const ua = navigator.userAgent;
    const brands = navigator.userAgentData?.brands || [];
    const brandNames = brands.map((brand) => brand.brand).join(' ');
    let browser = 'Unknown Browser';

    if (ua.includes('Edg/') || brandNames.includes('Edge')) browser = 'Edge';
    else if (ua.includes('OPR/') || ua.includes('Opera') || brandNames.includes('Opera')) browser = 'Opera';
    else if (ua.includes('SamsungBrowser/')) browser = 'Samsung Internet';
    else if (ua.includes('Firefox/')) browser = 'Firefox';
    else if (ua.includes('CriOS/') || brandNames.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';

    let os = 'Unknown OS';
    const platform = navigator.userAgentData?.platform || ua;
    if (platform.includes('Android')) os = 'Android';
    else if (platform.includes('iPhone') || platform.includes('iPad') || platform.includes('iOS')) os = 'iOS';
    else if (platform.includes('Windows')) os = 'Windows';
    else if (platform.includes('Mac')) os = 'macOS';
    else if (platform.includes('Linux')) os = 'Linux';

    return { browser, os };
  }

  window.addEventListener('load', () => {
    const consoleReadKey = 'otfxo-console-read-v3';
    const introPanel = document.getElementById('intro-panel');
    const introContent = document.querySelector('.intro-content');
    const introTypewriter = document.querySelector('.intro-typewriter');
    const proceedBtn = document.querySelector('.intro-proceed');
    const introGutter = document.querySelector('.code-gutter');

    if (!introPanel || !introContent || !introTypewriter || !proceedBtn) return;

    const consoleWasRead = sessionStorage.getItem(consoleReadKey) === 'true';
    const familyStatusPromise = getFamilyStatus();

    typeWriter(introTypewriter, '𝗢𝗧𝗙𝗫𝗢', 80, () => {
      proceedBtn.style.display = 'block';
      proceedBtn.disabled = false;

      const otfxoShuffleInterval = setInterval(() => {
        const stillOnLogoScreen =
          !introContent.classList.contains('console-mode') &&
          !introPanel.classList.contains('hidden');

        if (!stillOnLogoScreen) {
          clearInterval(otfxoShuffleInterval);
          return;
        }

        typeWriter(introTypewriter, '𝗢𝗧𝗙𝗫𝗢', 80);
      }, 5000);
    });

    proceedBtn.addEventListener('click', async () => {
      if (consoleWasRead) {
        introPanel.classList.add('hidden');
        return;
      }

      if (!introContent.classList.contains('console-mode')) {
        sessionStorage.setItem(consoleReadKey, 'true');
        introContent.classList.add('console-mode');
        proceedBtn.disabled = true;
        proceedBtn.style.display = 'none';

        const { browser, os } = getBrowserInfo();
        const { total, awake } = await familyStatusPromise;
        const consoleText = `$ ssh otfxo@world --user=guest
connecting...
[OK] handshake complete
$ otfxoctl status
scanning the family...
[OK] ${total} otfxo counted
[OK] ${awake} otfxo awake
$ client info
[OK] browser: ${browser}
[OK] os: ${os}
$ enter otfxo_world
> welcome`;

        typeWriter(introTypewriter, consoleText, 14, () => {
          setTimeout(() => {
            introPanel.classList.add('hidden');
          }, 700);
        }, introGutter);
        return;
      }

      introPanel.classList.add('hidden');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !proceedBtn.disabled) {
        e.preventDefault();
        proceedBtn.click();
      }
    });
  });

  document.querySelectorAll('.nav-link').forEach(link => {
    const sectionId = link.dataset.section;
    if (!sectionId) return;

    link.addEventListener('click', function(e) {
      e.preventDefault();
      document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
      });
      document.getElementById(sectionId).classList.add('active');
      document.body.classList.toggle('dashboard-view', sectionId === 'about');
      if (sectionId === 'about') {
        const typewriterElement = document.querySelector('.typewriter-text');
        typeWriter(typewriterElement, aboutText);
      }
    });
  });

  const historyLogo = document.querySelector('.spinning-history-logo img');
  const historyTextBox = document.querySelector('.history-text-box');

  if (historyLogo && historyTextBox) {
    historyLogo.addEventListener('mouseenter', () => {
      historyTextBox.style.display = 'block';
    });

    historyLogo.addEventListener('mouseleave', () => {
      historyTextBox.style.display = 'none';
    });

    const historyContainer = document.querySelector('.spinning-history-logo');
    historyContainer.addEventListener('mouseenter', () => {
      historyTextBox.style.display = 'block';
    });

    historyContainer.addEventListener('mouseleave', () => {
      historyTextBox.style.display = 'none';
    });
  };

   const discordUsers = [
    {
      "id": "1034804876733071382",
      "banner": "https://file.garden/aWlfqGYgcVhFp7er/banner.png",
      "music": "https://file.garden/aWlfqGYgcVhFp7er/vxc.mp3"
    },
      {
         "id": "1102372152507912264"
      }
  ];

  async function fetchDiscordInfoMembers(discordId) {
    try {
      const res = await fetch(`https://api.lanyard.rest/v1/users/${discordId}`);
      const json = await res.json();
      if (json.success) {
        const u = json.data.discord_user;
        const avatarUrl = `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=512`;
        return {
          displayName: u.display_name || u.username,
          username: u.username,
          avatar: avatarUrl
        };
      }
    } catch(err) {
      console.error('Lanyard fetch error', err);
    }
    return { displayName: 'Unknown', username: 'Unknown', avatar: '' };
  }

  const dracGrid = document.querySelector('.drac-grid');
  const bannerBg = document.querySelector('.banner-bg');

  (async () => {
    if (!dracGrid) return;

    for (const user of discordUsers) {
      const info = await fetchDiscordInfoMembers(user.id);

      const drac = document.createElement('div');
      drac.classList.add('drac');

      drac.innerHTML = `
        <div class="drac-banner" style="background-image:url('${user.banner}'); opacity:0.35;"></div>
        <div class="drac-content">
          <div class="avatar" style="background-image:url('${info.avatar}')"></div>
          <div class="info">
            <h1>${info.displayName}</h1>
            <p>@${info.username}</p>
          </div>
        </div>
      `;

      const audio = document.createElement('audio');
      audio.src = user.music;
      audio.preload = "auto";
      audio.volume = 0.5;
      drac.appendChild(audio);

      drac.addEventListener('mouseenter', () => {
        const dracBannerBg = document.querySelector('.drac-banner-bg');
        if (dracBannerBg) {
          dracBannerBg.style.backgroundImage = `url('${user.banner}')`;
          dracBannerBg.style.opacity = '1';
        }
        audio.currentTime = 0;
        audio.play().catch(() => {});
      });

      drac.addEventListener('mouseleave', () => {
        const dracBannerBg = document.querySelector('.drac-banner-bg');
        if (dracBannerBg) {
          dracBannerBg.style.opacity = '0';
        }
        audio.pause();
        audio.currentTime = 0;
      });

      dracGrid.appendChild(drac);
    }
  })();

function renderDiscordEmoji(emoji) {
  if (!emoji) return "";
  if (emoji.id) {
    const ext = emoji.animated ? "gif" : "png";
    return `<img src="https://cdn.discordapp.com/emojis/${emoji.id}.${ext}" alt="${emoji.name}" style="width:20px;height:20px;vertical-align:middle;margin-right:4px;">`;
  }
  return emoji.name || "";
}

const activityIcons = {
  "Roblox": "https://www.roblox.com/favicon.ico",
  "Visual Studio Code": "https://code.visualstudio.com/favicon.ico",
  "Discord": "https://discord.com/favicon.ico",
  "Chrome": "https://www.google.com/chrome/static/images/favicons/favicon.ico",
  "Firefox": "https://www.mozilla.org/media/img/favicons/firefox/favicon.ico",
  "Steam": "https://steamcommunity-a.akamaihd.net/favicon.ico",
  "VALORANT": "https://img.icons8.com/?size=96&id=aUZxT3Erwill&format=png",
  "League of Legends": "https://images.seeklogo.com/logo-png/38/1/league-of-legends-logo-png_seeklogo-385125.png",
  "Minecraft": "https://static.cdnlogo.com/logos/m/26/minecraft.svg",
  "Fortnite": "https://www.epicgames.com/favicon.ico",
  "Call of Duty": "https://store.steampowered.com/public/images/apps/310650/capsule_231x87.jpg",
  "Spotify": "https://www.spotify.com/favicon.ico",
  "Netflix": "https://www.netflix.com/favicon.ico",
  "Twitch": "https://www.twitch.tv/favicon.ico",
  "CrossFire": "https://file.garden/aN0Uo2YmaWI-OmAY/crossfire-z8games-smilegate-logo-download-cf-a610310d8f7ca8528c9da8061f46431b.png",
  "Among Us": "https://upload.wikimedia.org/wikipedia/en/f/f2/Among_Us_mascots.png",
  "Genshin Impact": "https://webstatic.hoyoverse.com/upload/favicon/favicon.ico",
  "Adobe Photoshop": "https://www.adobe.com/favicon.ico",
  "Nba 2k23": "https://www.2k.com/favicon.ico",
  "Animal Crossing": "https://upload.wikimedia.org/wikipedia/en/1/1d/Animal_Crossing_New_Horizons.png",
  "Apex Legends": "https://www.ea.com/favicon.ico",
  "Cyberpunk 2077": "https://www.cyberpunk.net/favicon.ico",
  "Dota 2": "https://www.dota2.com/favicon.ico",
  "Overwatch": "https://upload.wikimedia.org/wikipedia/en/5/51/Overwatch_cover_art.jpg",
  "Rocket League": "https://upload.wikimedia.org/wikipedia/en/e/e3/Rocket_League_Cover_Art.jpg",
  "PUBG": "https://www.pubg.com/favicon.ico",
  "PUBG: BATTLEGROUNDS": "https://www.pubg.com/favicon.ico",
  "Hearthstone": "https://upload.wikimedia.org/wikipedia/en/0/0f/Hearthstone_logo.png",
  "World of Warcraft": "https://worldofwarcraft.com/favicon.ico",
  "Final Fantasy XIV": "https://na.finalfantasyxiv.com/favicon.ico",
  "Fivem": "https://img.icons8.com/?size=96&id=gdOksUo2UvLH&format=png",
  "Grand Theft Auto V Legacy": "https://img.icons8.com/?size=128&id=79082&format=png",
  "Read Dead Redemption 2": "https://www.rockstargames.com/favicon.ico",
  "Bloodstrike": "https://cdn2.steamgriddb.com/icon_thumb/7e89f702c876c07b698b5b315807e0c5.png",
};

let signedInUserId = null;
try {
  const storedSession = localStorage.getItem('discord_session') || sessionStorage.getItem('discord_session') || '{}';
  signedInUserId = JSON.parse(storedSession).user?.id || null;
} catch {
  signedInUserId = null;
}

document.querySelectorAll(".card").forEach(card => {
  const userId = card.dataset.userId || signedInUserId;
  if (!userId) return;

  const avatar = card.querySelector(".avatar-image");
  const avatarDecoration = card.querySelector(".avatar-decoration");
  const displayName = card.querySelector(".display-name");
  const username = card.querySelector(".username");
  const statusDot = card.querySelector(".status-dot");
  const statusBox = card.querySelector(".status-box");
  const activityName = card.querySelector(".activity-name");
  const activityDetails = card.querySelector(".activity-details");
  const activityIconsContainer = card.querySelector(".activity-icons-container");
  const spotifyAlbum = card.querySelector(".spotify-album");
  const spotifySong = card.querySelector(".spotify-song");
  const spotifyArtist = card.querySelector(".spotify-artist");
  const spotifyProgressFill = card.querySelector(".spotify-progress-fill");
  const spotifyContainer = card.querySelector(".spotify-container");

  const ws = new WebSocket("wss://api.lanyard.rest/socket");
  let heartbeatTimer = null;

  const renderActivities = (activities = []) => {
    const visibleActivities = activities.filter(activity => activity.type !== 4 && activity.name !== 'Spotify');
    activityIconsContainer.innerHTML = '';

    if (visibleActivities.length === 0) {
      activityName.textContent = 'No Current Activity';
      activityDetails.textContent = '';
      return;
    }

    const primaryActivity = visibleActivities[0];
    activityName.textContent = primaryActivity.name;
    const details = [primaryActivity.state, primaryActivity.details].filter(Boolean);
    activityDetails.textContent = details.join(' - ');

    const seenActivityNames = new Set();
    visibleActivities.forEach(activity => {
      if (seenActivityNames.has(activity.name)) return;
      seenActivityNames.add(activity.name);

      const iconUrl = activityIcons[activity.name] || activityIcons[activity.name?.toUpperCase()];
      if (!iconUrl) return;

      const iconDiv = document.createElement('div');
      iconDiv.className = 'activity-icon-img';
      iconDiv.title = activity.name;
      const img = document.createElement('img');
      img.src = iconUrl;
      img.alt = activity.name;
      iconDiv.appendChild(img);
      activityIconsContainer.appendChild(iconDiv);
    });
  };

  const renderSpotify = (spotify) => {
    if (!spotify) {
      spotifyContainer.style.display = 'none';
      card.spotifyData = null;
      return;
    }

    spotifyContainer.style.display = 'block';
    spotifyAlbum.src = spotify.album_art_url || '';
    spotifySong.textContent = spotify.song || 'Unknown Song';
    spotifyArtist.textContent = spotify.artist || 'Unknown Artist';
    card.spotifyData = spotify;
  };

  const renderAvatarDecoration = (discordUser) => {
    const decoration = discordUser?.avatar_decoration_data;
    if (!decoration?.asset) {
      avatarDecoration.removeAttribute('src');
      avatarDecoration.style.display = 'none';
      return;
    }

    avatarDecoration.src = `https://cdn.discordapp.com/avatar-decoration-presets/${decoration.asset}.png?size=160`;
    avatarDecoration.style.display = 'block';
  };

  const applyInitialDiscordInfo = async () => {
    try {
      const response = await fetch(`https://api.lanyard.rest/v1/users/${userId}`);
      const json = await response.json();
      const user = json.success ? json.data : null;
      if (!user) return;

      const discordUser = user.discord_user;
      if (discordUser) {
        avatar.src = discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.png?size=256`
          : `https://cdn.discordapp.com/embed/avatars/${Number(userId) % 5}.png`;
        displayName.textContent = discordUser.global_name || discordUser.username || 'Unknown';
        username.textContent = '@' + (discordUser.username || 'Unknown');
        renderAvatarDecoration(discordUser);
      }

      statusDot.className = `status-dot status-${user.discord_status || 'offline'}`;
      const customStatus = user.activities?.find(activity => activity.type === 4);
      statusBox.textContent = customStatus?.state || '';
      renderActivities(user.activities);
      renderSpotify(user.spotify);
    } catch (error) {
      console.error('Lanyard profile fetch error', error);
    }
  };

  applyInitialDiscordInfo();
  setInterval(applyInitialDiscordInfo, 15000);

  ws.onmessage = event => {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }
    if (payload.op === 1) {
      heartbeatTimer = setInterval(() => {
        ws.send(JSON.stringify({ op: 3 }));
      }, payload.d.heartbeat_interval);
      ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: userId } }));
      return;
    }

    if (payload.op !== 0 || !payload.d?.discord_user) return;
    const user = payload.d;

    if (user.discord_user?.avatar) {
      avatar.src = `https://cdn.discordapp.com/avatars/${userId}/${user.discord_user.avatar}.png?size=256`;
    }

    renderAvatarDecoration(user.discord_user);

    const globalName = user.discord_user?.global_name || user.discord_user?.username || "Unknown";
    const discordUsername = user.discord_user?.username || "Unknown";
    displayName.textContent = globalName;
    username.textContent = '@' + discordUsername;

    statusDot.className = `status-dot status-${user.discord_status}`;

    const customStatus = user.activities?.find(a => a.type === 4);
    if (customStatus && (customStatus.emoji || customStatus.state)) {
      const emoji = renderDiscordEmoji(customStatus.emoji) || "";
      const state = customStatus.state || "";
      statusBox.innerHTML = emoji + state;
    } else {
    }

    renderActivities(user.activities);

    renderSpotify(user.spotify);
  };

  ws.onerror = () => {
    ws.close();
  };

  ws.onclose = () => {
    clearInterval(heartbeatTimer);
  };
});

setInterval(() => {
  document.querySelectorAll(".card").forEach(card => {
    const spotifyProgressFill = card.querySelector(".spotify-progress-fill");
    const spotifyContainer = card.querySelector(".spotify-container");
    if (card.spotifyData?.timestamps?.start && card.spotifyData?.timestamps?.end) {
      const duration = card.spotifyData.timestamps.end - card.spotifyData.timestamps.start;
      const elapsed = Math.max(0, Date.now() - card.spotifyData.timestamps.start);

      if (elapsed >= duration) {
        spotifyContainer.style.display = "none";
        card.spotifyData = null;
        spotifyProgressFill.style.width = "0%";
      } else {
        const percentage = Math.min(100, (elapsed / duration) * 100);
        spotifyProgressFill.style.width = percentage + "%";
      }
    }
  });
}, 100);

const cards = document.querySelectorAll('.card');
const audio = document.getElementById('audio');
const songs = [
  "https://file.garden/ap_Ebnzi9V7bLTDs/Janice%20STFU.mp3"
];

cards.forEach((card, index) => {
  card.dataset.audio = songs[index];
});

cards.forEach(card => {
  card.addEventListener('mouseenter', () => {
    audio.src = card.dataset.audio;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  });

  card.addEventListener('mouseleave', () => {
    audio.pause();
  });
});
