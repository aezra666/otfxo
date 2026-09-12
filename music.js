(() => {
  // Add your MP3 files to this list. Use paths relative to index.html.
  const tracks = [
    { title: 'Track One', artist: 'Your Artist', file: 'https://file.garden/ap_Ebnzi9V7bLTDs/aezra.mp3' },
    { title: 'Track Two', artist: 'Your Artist', file: "https://file.garden/ap_Ebnzi9V7bLTDs/El%20De%20Las%20R's%20-%20La%20Cheyenne%20(Lyrics).mp3" },
  ];

  const player = new Audio();
  player.preload = 'metadata';
  player.volume = 0.35;

  function createPlayer() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    const musicButton = navbar.querySelector('.navbar-music-button');
    const musicMenu = navbar.querySelector('.music-menu');
    if (!musicButton || !musicMenu) return;

    const trackList = musicMenu.querySelector('.music-track-list');
    const closeButton = musicMenu.querySelector('.music-close');
    const musicStatus = musicMenu.querySelector('.music-status');
    const playButton = musicMenu.querySelector('[data-action="play"]');
    const previousButton = musicMenu.querySelector('[data-action="previous"]');
    const nextButton = musicMenu.querySelector('[data-action="next"]');
    const volumeSlider = musicMenu.querySelector('.music-volume input');
    let currentTrackButton = null;
    let currentTrackIndex = -1;

    function updatePlayButton() {
      const isPlaying = !player.paused;
      playButton.textContent = isPlaying ? '❚❚' : '▶';
      playButton.setAttribute('aria-label', isPlaying ? 'Pause song' : 'Play song');
      musicButton.classList.toggle('is-playing', isPlaying);
    }

    function selectTrack(trackIndex) {
      if (!tracks.length) return;

      currentTrackIndex = (trackIndex + tracks.length) % tracks.length;
      const track = tracks[currentTrackIndex];
      player.src = track.file;
      player.load();
      musicStatus.textContent = `Loading ${track.title}...`;
      if (currentTrackButton) currentTrackButton.classList.remove('is-playing');
      currentTrackButton = trackList.children[currentTrackIndex];
      currentTrackButton.classList.add('is-playing');
      player.play().then(() => {
        musicStatus.textContent = `Playing ${track.title}`;
        updatePlayButton();
      }).catch(() => {
        musicStatus.textContent = 'Playback was blocked. Click play to try again.';
        updatePlayButton();
      });
    }

    function renderTracks() {
      if (!tracks.length) {
        trackList.innerHTML = '<p class="music-empty">Add tracks in music.js</p>';
        return;
      }

      tracks.forEach((track, trackIndex) => {
        const trackButton = document.createElement('button');
        trackButton.className = 'music-track-button';
        trackButton.type = 'button';
        trackButton.innerHTML = `
          <span class="music-track-number">${String(trackIndex + 1).padStart(2, '0')}</span>
          <span class="music-track-details">
            <strong>${track.title}</strong>
            <small>${track.artist}</small>
          </span>
        `;

        trackButton.addEventListener('click', () => selectTrack(trackIndex));

        trackList.appendChild(trackButton);
      });
    }

    function closeMenu() {
      musicMenu.hidden = true;
      musicButton.setAttribute('aria-expanded', 'false');
    }

    musicButton.addEventListener('click', () => {
      musicMenu.hidden = !musicMenu.hidden;
      musicButton.setAttribute('aria-expanded', String(!musicMenu.hidden));
    });

    closeButton.addEventListener('click', closeMenu);
    playButton.addEventListener('click', () => {
      if (currentTrackIndex === -1) {
        selectTrack(0);
        return;
      }

      if (player.paused) {
        player.play().then(updatePlayButton).catch(() => {
          musicStatus.textContent = 'Playback was blocked. Click play to try again.';
        });
      } else {
        player.pause();
        updatePlayButton();
        musicStatus.textContent = 'Paused';
      }
    });
    previousButton.addEventListener('click', () => {
      if (currentTrackIndex === -1) return;
      if (player.currentTime > 3) {
        player.currentTime = 0;
        return;
      }
      selectTrack(currentTrackIndex - 1);
    });
    nextButton.addEventListener('click', () => selectTrack(currentTrackIndex === -1 ? 0 : currentTrackIndex + 1));
    volumeSlider.addEventListener('input', () => {
      player.volume = Number(volumeSlider.value);
    });
    player.addEventListener('error', () => {
      musicStatus.textContent = 'This audio file could not be loaded.';
      updatePlayButton();
    });
    player.addEventListener('ended', () => selectTrack(currentTrackIndex + 1));
    player.addEventListener('pause', updatePlayButton);
    player.addEventListener('play', updatePlayButton);
    document.addEventListener('click', event => {
      if (!musicMenu.contains(event.target) && event.target !== musicButton) closeMenu();
    });

    renderTracks();
    navbar.append(musicButton, musicMenu);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createPlayer, { once: true });
  } else {
    createPlayer();
  }
})();
