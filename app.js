let songs = [];
let songIndex = 0;
let currentSong = null;
let isPlaying = false;
let embedController = null;
let IFrameAPI = null;

const bingoColors = ['bingo-green', 'bingo-yellow', 'bingo-pink', 'bingo-blue', 'bingo-purple'];

function applyBingoColor() {
  const body = document.body;
  bingoColors.forEach(c => body.classList.remove(c));
  const color = bingoColors[Math.floor(Math.random() * bingoColors.length)];
  body.classList.add(color);
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

function togglePlay() {
  if (embedController) {
    if (isPlaying) {
      embedController.pause();
    } else {
      embedController.resume();
    }
  }
}

function updatePlayBtn() {
  const btn = document.getElementById("playPauseBtn");
  if (btn) {
    btn.innerHTML = isPlaying ? '⏸️ Pause' : '▶️ Play';
  }
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
          '<p class="guessing-hint">Press Reveal to play & see the answer</p>' +
        '</div>' +
        '<button class="play-btn" id="playPauseBtn" onclick="togglePlay()">' + (isPlaying ? '⏸️ Pause' : '▶️ Play') + '</button>' +
      '</div>';
  } else {
    const escape = t => { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; };
    cardContent.innerHTML =
      '<div class="card-answer">' +
        '<div class="card-content">' +
          '<div class="song-year">' + currentSong.year + '</div>' +
          '<div class="song-title">' + escape(currentSong.name) + '</div>' +
          '<div class="song-artist">' + escape(currentSong.artist) + '</div>' +
          '<div class="song-genre">' + currentSong.genre + '</div>' +
        '</div>' +
        '<button class="play-btn" id="playPauseBtn" onclick="togglePlay()">' + (isPlaying ? '⏸️ Pause' : '▶️ Play') + '</button>' +
      '</div>';
  }
}

function selectSet(set) {
  songs = shuffle(SONGS[set]);
  songIndex = 0;
  embedController = null;
  isPlaying = false;

  const names = { standard: "Standard", rock: "Rock", hiphop: "Hip Hop" };
  document.getElementById("setLabel").textContent = names[set];
  document.getElementById("totalCount").textContent = songs.length;
  document.getElementById("playedCount").textContent = "0";
  document.getElementById("setSelection").classList.add("hidden");
  document.getElementById("gameArea").classList.remove("hidden");

  document.getElementById("playerContainer").innerHTML =
    '<div class="card-wrapper">' +
      '<div id="cardContent"></div>' +
      '<div id="embedContainer" class="embed-container"></div>' +
    '</div>';

  document.getElementById("cardContent").innerHTML =
    '<div class="empty-state"><p class="empty-icon">🎵</p><p>Press "Draw Card" to start</p></div>';

  document.getElementById("drawBtn").classList.remove("hidden");
  document.getElementById("revealBtn").classList.add("hidden");
  document.getElementById("nextBtn").classList.add("hidden");

  // Create the controller once with the first song
  const container = document.getElementById("embedContainer");
  if (container && IFrameAPI) {
    IFrameAPI.createController(container, {
      uri: `spotify:track:${songs[0].id}`,
      height: 152,
      width: '100%'
    }, (controller) => {
      embedController = controller;
      controller.addListener('playback_update', (e) => {
        isPlaying = !e.data.isPaused;
        updatePlayBtn();
      });
    });
  }
}

function drawCard() {
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
  applyBingoColor();

  document.getElementById("playedCount").textContent = songIndex;
  updateCardContent(true); // Show guessing state (not revealed)

  // Start playback (in user gesture context) - wrapped in try/catch so UI always works
  try {
    if (embedController) {
      embedController.play();
      isPlaying = true;
      updatePlayBtn();
    }
  } catch (e) {
    console.error('Playback error:', e);
  }

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
  applyBingoColor();

  document.getElementById("playedCount").textContent = songIndex;
  updateCardContent(true); // Show guessing state

  // Load new track and play (in user gesture context) - wrapped in try/catch
  try {
    if (embedController) {
      embedController.loadUri(`spotify:track:${currentSong.id}`);
      embedController.seek(0);
      embedController.play();
      isPlaying = true;
      updatePlayBtn();
    }
  } catch (e) {
    console.error('Load/play error:', e);
  }

  document.getElementById("drawBtn").classList.add("hidden");
  document.getElementById("revealBtn").classList.remove("hidden");
  document.getElementById("nextBtn").classList.add("hidden");
}

function revealSong() {
  if (!currentSong) return;

  updateCardContent(false); // Show revealed content (song already playing)

  document.getElementById("revealBtn").classList.add("hidden");
  document.getElementById("nextBtn").classList.remove("hidden");
}

function goBack() {
  document.getElementById("gameArea").classList.add("hidden");
  document.getElementById("setSelection").classList.remove("hidden");

  if (embedController && isPlaying) {
    embedController.pause();
  }

  songs = [];
  songIndex = 0;
  currentSong = null;
  embedController = null;
  isPlaying = false;
  clearBingoColor();
}
