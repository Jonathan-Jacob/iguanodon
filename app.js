let songs = [];
let songIndex = 0;
let currentSong = null;
let isRevealed = false;
let playbackStarted = false;
let isPaused = true;
let wantToPlay = false;
let embedController = null;
let IFrameAPI = null;
let hasFullTracks = false;
let currentSet = null;
let activeSet = null; // The set that currently has music playing

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const bingoColors = ['bingo-green', 'bingo-yellow', 'bingo-pink', 'bingo-blue', 'bingo-purple'];
let currentBingoColor = null;

// Mini player elements
const miniPlayer = document.getElementById('miniPlayer');
const miniPlayerToggle = document.getElementById('miniPlayerToggle');
const miniPlayIcon = document.getElementById('miniPlayIcon');
const miniPauseIcon = document.getElementById('miniPauseIcon');

// Session storage for progress
function saveProgress() {
  if (!currentSet) return;
  const data = { songs, songIndex, currentSong, isRevealed, bingoColor: currentBingoColor };
  sessionStorage.setItem(`hitschter_${currentSet}`, JSON.stringify(data));
}

function loadProgress(set) {
  const saved = sessionStorage.getItem(`hitschter_${set}`);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return null;
    }
  }
  return null;
}

function applyBingoColor() {
  const body = document.body;
  bingoColors.forEach(c => body.classList.remove(c));
  currentBingoColor = bingoColors[Math.floor(Math.random() * bingoColors.length)];
  body.classList.add(currentBingoColor);
}

function restoreBingoColor() {
  if (currentBingoColor) {
    const body = document.body;
    bingoColors.forEach(c => body.classList.remove(c));
    body.classList.add(currentBingoColor);
  }
}

function clearBingoColor() {
  bingoColors.forEach(c => document.body.classList.remove(c));
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

window.onSpotifyIframeApiReady = (api) => {
  IFrameAPI = api;
};

document.querySelectorAll(".set-btn").forEach(btn => {
  btn.addEventListener("click", () => selectSet(btn.dataset.set));
});
document.getElementById("drawBtn").addEventListener("click", drawCard);
document.getElementById("revealBtn").addEventListener("click", revealSong);
document.getElementById("nextBtn").addEventListener("click", nextSong);
document.getElementById("backBtn").addEventListener("click", goBack);

// Mini player event listeners
miniPlayerToggle.addEventListener("click", togglePlay);

function isActuallyPlaying() {
  return playbackStarted && !isPaused;
}

function togglePlay() {
  if (embedController) {
    if (isActuallyPlaying()) {
      embedController.pause();
      wantToPlay = false;
    } else {
      embedController.resume();
      wantToPlay = true;
    }
  }
}

function updatePlayBtn() {
  const btn = document.getElementById("playPauseBtn");
  if (btn) {
    btn.innerHTML = isActuallyPlaying() ? '⏸️ Pause' : '▶️ Play';
  }
  // Also update mini player icons
  if (miniPlayIcon && miniPauseIcon) {
    if (isActuallyPlaying()) {
      miniPlayIcon.classList.add('hidden');
      miniPauseIcon.classList.remove('hidden');
    } else {
      miniPlayIcon.classList.remove('hidden');
      miniPauseIcon.classList.add('hidden');
    }
  }
}

function showMiniPlayer() {
  if (embedController && currentSong) {
    // Set correct icon state
    if (isActuallyPlaying()) {
      miniPlayIcon.classList.add('hidden');
      miniPauseIcon.classList.remove('hidden');
    } else {
      miniPlayIcon.classList.remove('hidden');
      miniPauseIcon.classList.add('hidden');
    }
    miniPlayer.classList.remove('hidden');
    document.querySelector('.app').classList.add('has-mini-player');
  }
  updatePlayingIndicator();
}

function hideMiniPlayer() {
  miniPlayer.classList.add('hidden');
  document.querySelector('.app').classList.remove('has-mini-player');
}

function hasMusicPlaying() {
  return !!(embedController && currentSong);
}

function updatePlayingIndicator() {
  const glowColors = ['glow-green', 'glow-yellow', 'glow-pink', 'glow-blue', 'glow-purple'];
  // Remove playing and glow classes from all set buttons
  document.querySelectorAll('.set-btn[data-set]').forEach(btn => {
    btn.classList.remove('playing', ...glowColors);
  });
  // Add playing class and glow color to active set button if music is playing
  if (activeSet && embedController) {
    const activeBtn = document.querySelector(`.set-btn[data-set="${activeSet}"]`);
    if (activeBtn) {
      activeBtn.classList.add('playing');
      // Convert 'bingo-green' to 'glow-green'
      if (currentBingoColor) {
        const glowClass = currentBingoColor.replace('bingo-', 'glow-');
        activeBtn.classList.add(glowClass);
      }
    }
  }
}

function setupControllerListeners(controller) {
  controller.addListener('playback_started', (e) => {
    playbackStarted = true;
    wantToPlay = false;
    updatePlayBtn();
  });

  controller.addListener('playback_update', (e) => {
    // Track isPaused state and update button
    const wasPaused = isPaused;
    isPaused = e.data.isPaused;
    if (wasPaused !== isPaused) {
      updatePlayBtn();
    }

    // If we want to play but track is paused and ready (not buffering), retry with resume
    if (wantToPlay && e.data.isPaused && !e.data.isBuffering) {
      embedController.resume();
    }

    // Check track duration to detect if user has full tracks or just previews
    if (e.data.duration > 35000 && !hasFullTracks) {
      hasFullTracks = true;
    }
    // Loop 30s previews when they end
    if (e.data.duration > 0 && e.data.duration <= 35000) {
      if (e.data.position >= e.data.duration - 500 && !e.data.isPaused) {
        playbackStarted = false;
        if (currentSong) {
          embedController.loadUri(`spotify:track:${currentSong.id}`);
          embedController.resume();
        }
      }
    }
  });
}

function updateCardContent(showGuessing) {
  const cardContent = document.getElementById("cardContent");
  if (!cardContent) return;

  if (showGuessing) {
    cardContent.innerHTML =
      '<div class="card-guessing">' +
        '<div class="card-content">' +
          '<div class="guessing-icon">🎵</div>' +
          '<p class="guessing-title">Ready!</p>' +
          '<p class="guessing-hint">Press Reveal to see the answer</p>' +
        '</div>' +
        '<button class="play-btn" id="playPauseBtn" onclick="togglePlay()">' + (isActuallyPlaying() ? '⏸️ Pause' : '▶️ Play') + '</button>' +
      '</div>';
  } else {
    const escape = t => { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; };
    cardContent.innerHTML =
      '<div class="card-answer">' +
        '<div class="card-content">' +
          '<div class="song-year">' + (currentSong.year || '?') + '</div>' +
          '<div class="song-title">' + escape(currentSong.name) + '</div>' +
          '<div class="song-artist">' + escape(currentSong.artist) + '</div>' +
          '<div class="song-genre">' + currentSong.genre + '</div>' +
        '</div>' +
        '<button class="play-btn" id="playPauseBtn" onclick="togglePlay()">' + (isActuallyPlaying() ? '⏸️ Pause' : '▶️ Play') + '</button>' +
      '</div>';
  }
}

function selectSet(set) {
  if (!set) return;

  // Check if returning to the same set that has music playing
  const isReturningToActiveSet = (set === activeSet && embedController);

  // Only stop music if switching to a different set
  if (!isReturningToActiveSet && activeSet) {
    stopMusic();
  }

  currentSet = set;
  const saved = loadProgress(set);

  if (saved) {
    songs = saved.songs;
    songIndex = saved.songIndex;
    currentSong = saved.currentSong || null;
    isRevealed = saved.isRevealed || false;
    currentBingoColor = saved.bingoColor || null;
  } else {
    songs = shuffle(SONGS[set]);
    songIndex = 0;
    currentSong = null;
    isRevealed = false;
    currentBingoColor = null;
  }

  const names = { standard: "Standard", rock: "Rock", hiphop: "Hip Hop" };
  document.getElementById("setLabel").textContent = names[set];
  document.getElementById("totalCount").textContent = songs.length;
  document.getElementById("playedCount").textContent = songIndex;
  document.getElementById("setSelection").classList.add("hidden");
  document.getElementById("gameArea").classList.remove("hidden");
  document.getElementById("toggleToBingo").classList.remove("hidden");

  // If returning to active set, don't recreate the player - just hide mini player
  if (isReturningToActiveSet) {
    hideMiniPlayer();
    restoreBingoColor();
    // Just update the card content and buttons
    if (currentSong) {
      updateCardContent(!isRevealed);
      document.getElementById("drawBtn").classList.add("hidden");
      if (isRevealed) {
        document.getElementById("revealBtn").classList.add("hidden");
        document.getElementById("nextBtn").classList.remove("hidden");
      } else {
        document.getElementById("revealBtn").classList.remove("hidden");
        document.getElementById("nextBtn").classList.add("hidden");
      }
    }
    return;
  }

  // Create fresh player container
  document.getElementById("playerContainer").innerHTML =
    '<div class="card-wrapper">' +
      '<div id="cardContent"></div>' +
      '<div id="embedContainer" class="embed-container"></div>' +
    '</div>';

  // Has saved progress with a current song - restore and create controller
  if (currentSong) {
    updateCardContent(!isRevealed);
    restoreBingoColor();
    document.getElementById("drawBtn").classList.add("hidden");
    if (isRevealed) {
      document.getElementById("revealBtn").classList.add("hidden");
      document.getElementById("nextBtn").classList.remove("hidden");
    } else {
      document.getElementById("revealBtn").classList.remove("hidden");
      document.getElementById("nextBtn").classList.add("hidden");
    }
    // Create controller for the saved song
    const container = document.getElementById("embedContainer");
    if (container && IFrameAPI) {
      IFrameAPI.createController(container, {
        uri: `spotify:track:${currentSong.id}`,
        height: 152,
        width: '100%'
      }, (controller) => {
        embedController = controller;
        setupControllerListeners(controller);
        activeSet = set;
        playbackStarted = false;
        isPaused = true;
      });
    }
  } else {
    // No current song - show empty state
    document.getElementById("cardContent").innerHTML =
      '<div class="empty-state">' +
        '<p class="empty-icon">🎵</p>' +
        '<p>Press "Draw Card" to start</p>' +
      '</div>';
    document.getElementById("drawBtn").classList.remove("hidden");
    document.getElementById("revealBtn").classList.add("hidden");
    document.getElementById("nextBtn").classList.add("hidden");
    embedController = null;
    playbackStarted = false;
    isPaused = true;
  }
}

function drawCard() {
  // Hide mini player since we're playing in the main player now
  hideMiniPlayer();

  if (songIndex >= songs.length) {
    document.getElementById("cardContent").innerHTML =
      '<div class="empty-state"><p class="empty-icon">🎉</p><p>All songs played!</p></div>';
    document.getElementById("drawBtn").classList.add("hidden");
    document.getElementById("revealBtn").classList.add("hidden");
    document.getElementById("nextBtn").classList.add("hidden");
    clearBingoColor();
    return;
  }

  currentSong = songs[songIndex];
  songIndex++;
  isRevealed = false;
  activeSet = currentSet;
  applyBingoColor();
  saveProgress();

  document.getElementById("playedCount").textContent = songIndex;

  // Create embed container if it doesn't exist
  if (!document.getElementById("embedContainer")) {
    document.getElementById("playerContainer").innerHTML =
      '<div class="card-wrapper">' +
        '<div id="cardContent"></div>' +
        '<div id="embedContainer" class="embed-container"></div>' +
      '</div>';
  }

  // Create or reuse the controller
  const container = document.getElementById("embedContainer");
  if (!embedController && container && IFrameAPI) {
    IFrameAPI.createController(container, {
      uri: `spotify:track:${currentSong.id}`,
      height: 152,
      width: '100%'
    }, (controller) => {
      embedController = controller;
      setupControllerListeners(controller);

      // Desktop: autoplay, Mobile: start paused
      if (!isMobile) {
        playbackStarted = true;
        isPaused = false;
        wantToPlay = true;
        embedController.resume();
      }
    });
  } else if (embedController) {
    // Load the new song into existing controller
    embedController.loadUri(`spotify:track:${currentSong.id}`);

    // Desktop: autoplay, Mobile: start paused
    if (isMobile) {
      playbackStarted = false;
      isPaused = true;
      wantToPlay = false;
    } else {
      playbackStarted = true;
      isPaused = false;
      wantToPlay = true;
      embedController.resume();
    }
  }

  // Desktop: autoplay, Mobile: start paused (for initial state before controller callback)
  if (isMobile) {
    playbackStarted = false;
    isPaused = true;
    wantToPlay = false;
  }

  updateCardContent(true);

  document.getElementById("drawBtn").classList.add("hidden");
  document.getElementById("revealBtn").classList.remove("hidden");
  document.getElementById("nextBtn").classList.add("hidden");
}

function nextSong() {
  if (songIndex >= songs.length) {
    document.getElementById("cardContent").innerHTML =
      '<div class="empty-state"><p class="empty-icon">🎉</p><p>All songs played!</p></div>';
    document.getElementById("drawBtn").classList.add("hidden");
    document.getElementById("revealBtn").classList.add("hidden");
    document.getElementById("nextBtn").classList.add("hidden");
    clearBingoColor();
    return;
  }

  currentSong = songs[songIndex];
  songIndex++;
  isRevealed = false;
  applyBingoColor();
  saveProgress();

  document.getElementById("playedCount").textContent = songIndex;

  // Load new track, Desktop: autoplay, Mobile: start paused
  if (embedController) {
    embedController.loadUri(`spotify:track:${currentSong.id}`);
    if (isMobile) {
      playbackStarted = false;
      isPaused = true;
      wantToPlay = false;
    } else {
      playbackStarted = true; // Assume it will start soon
      isPaused = false;
      wantToPlay = true;
      embedController.resume();
    }
  }

  updateCardContent(true);

  document.getElementById("drawBtn").classList.add("hidden");
  document.getElementById("revealBtn").classList.remove("hidden");
  document.getElementById("nextBtn").classList.add("hidden");
}

function revealSong() {
  if (!currentSong) return;

  isRevealed = true;
  saveProgress();
  updateCardContent(false);

  document.getElementById("revealBtn").classList.add("hidden");
  document.getElementById("nextBtn").classList.remove("hidden");
}

function goBack() {
  // Save current state before leaving
  saveProgress();

  document.getElementById("gameArea").classList.add("hidden");
  document.getElementById("setSelection").classList.remove("hidden");
  document.getElementById("toggleToBingo").classList.add("hidden");

  // Show mini player if music is active
  if (embedController && currentSong) {
    showMiniPlayer();
  } else {
    updatePlayingIndicator();
  }

  clearBingoColor();
}

function stopMusic() {
  if (embedController) {
    embedController.pause();
  }
  hideMiniPlayer();
  embedController = null;
  playbackStarted = false;
  isPaused = true;
  wantToPlay = false;
  activeSet = null;
  updatePlayingIndicator();
}

document.getElementById("toggleToBingo").addEventListener("click", () => {
  // Save music state before switching
  saveProgress();

  document.getElementById("gameArea").classList.add("hidden");
  document.getElementById("bingoArea").classList.remove("hidden");
  document.getElementById("toggleToMusic").classList.remove("hidden");

  // Show mini player when switching to bingo
  if (embedController && currentSong) {
    showMiniPlayer();
  }

  // When toggling, just resume if there's a game, otherwise init
  if (typeof hasActiveGame === 'function' && hasActiveGame()) {
    if (typeof resumeBingo === 'function') resumeBingo();
  } else if (typeof initBingo === 'function') {
    initBingo();
  }
});

document.getElementById("toggleToMusic").addEventListener("click", () => {
  document.getElementById("bingoArea").classList.add("hidden");
  document.getElementById("gameArea").classList.remove("hidden");
  document.getElementById("toggleToBingo").classList.remove("hidden");
  hideMiniPlayer();
  restoreBingoColor();
});
