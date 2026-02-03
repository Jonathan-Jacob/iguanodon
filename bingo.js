// Bingo Card Logic
const BINGO_COLORS = ['green', 'yellow', 'pink', 'blue', 'purple'];

let bingoCard = [];
let filledCells = [];
let currentColor = null;
let currentAnswer = '';
let wasCorrect = false;
let answerHistory = [];
let bingoAchieved = false;
let scrollPositions = { 1: 0, 2: 0, 3: 0 };
let currentPhase = 1;
let hasVisitedPhase3 = false;

// Save bingo state to sessionStorage
function saveBingoState() {
  const answerInput = document.getElementById('bingoAnswer');
  const state = {
    bingoCard,
    filledCells,
    answerHistory,
    bingoAchieved,
    // Current turn state
    pendingColor: currentColor,
    pendingAnswer: answerInput ? answerInput.value : '',
    pendingPhase: currentPhase,
    pendingCurrentAnswer: currentAnswer // The submitted answer (used in phase 2)
  };
  sessionStorage.setItem('bingo_state', JSON.stringify(state));
}

// Load bingo state from sessionStorage
function loadBingoState() {
  const saved = sessionStorage.getItem('bingo_state');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return null;
    }
  }
  return null;
}

// Clear bingo state from sessionStorage
function clearBingoState() {
  sessionStorage.removeItem('bingo_state');
}

// Check if there's an active game worth resuming
function hasActiveGame() {
  const state = loadBingoState();
  if (!state || state.bingoAchieved) return false;
  // Has answers, has pending turn in progress, or is waiting for correct/wrong
  const hasAnswers = state.answerHistory && state.answerHistory.length > 0;
  const hasPending = state.pendingColor || state.pendingAnswer;
  const isInPhase2 = state.pendingPhase === 2;
  return hasAnswers || hasPending || isInPhase2;
}

// Generate a valid bingo card
// 5x5 grid, 5 of each color, no more than 2 of same color in any row/column/diagonal
function generateBingoCard() {
  const maxAttempts = 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const card = tryGenerateCard();
    if (card && isValidCard(card)) {
      return card;
    }
  }

  // Fallback: just return a shuffled card (might not be perfectly valid)
  console.warn('Could not generate perfectly valid card, using best effort');
  return tryGenerateCard();
}

function tryGenerateCard() {
  // Create array with 5 of each color
  const colors = [];
  BINGO_COLORS.forEach(color => {
    for (let i = 0; i < 5; i++) colors.push(color);
  });

  // Shuffle
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }

  // Convert to 5x5 grid
  const card = [];
  for (let row = 0; row < 5; row++) {
    card.push(colors.slice(row * 5, row * 5 + 5));
  }

  return card;
}

function isValidCard(card) {
  // Check rows
  for (let row = 0; row < 5; row++) {
    if (!isValidLine(card[row])) return false;
  }

  // Check columns
  for (let col = 0; col < 5; col++) {
    const column = [];
    for (let row = 0; row < 5; row++) {
      column.push(card[row][col]);
    }
    if (!isValidLine(column)) return false;
  }

  // Check diagonals
  const diag1 = [];
  const diag2 = [];
  for (let i = 0; i < 5; i++) {
    diag1.push(card[i][i]);
    diag2.push(card[i][4 - i]);
  }
  if (!isValidLine(diag1)) return false;
  if (!isValidLine(diag2)) return false;

  return true;
}

function isValidLine(line) {
  const counts = {};
  line.forEach(color => {
    counts[color] = (counts[color] || 0) + 1;
  });

  // No color should appear more than 2 times
  return Object.values(counts).every(count => count <= 2);
}

function checkBingo() {
  // Check rows
  for (let row = 0; row < 5; row++) {
    if (isLineFilled(row, 0, 0, 1)) return true;
  }

  // Check columns
  for (let col = 0; col < 5; col++) {
    if (isLineFilled(0, col, 1, 0)) return true;
  }

  // Check diagonals
  if (isLineFilled(0, 0, 1, 1)) return true;
  if (isLineFilled(0, 4, 1, -1)) return true;

  return false;
}

function isLineFilled(startRow, startCol, rowDir, colDir) {
  for (let i = 0; i < 5; i++) {
    const row = startRow + i * rowDir;
    const col = startCol + i * colDir;
    const idx = row * 5 + col;
    if (!filledCells.includes(idx)) return false;
  }
  return true;
}

function initBingo() {
  bingoCard = generateBingoCard();
  filledCells = [];
  currentColor = null;
  currentAnswer = '';
  wasCorrect = false;
  answerHistory = [];
  bingoAchieved = false;
  scrollPositions = { 1: 0, 2: 0, 3: 0 };
  currentPhase = 1;
  hasVisitedPhase3 = false;

  clearBingoState();
  showPhase(1);
  renderBingoGrid();

  // Hide win, history, instruction, skip button, no cells; show footer
  document.getElementById('bingoInstruction').classList.add('hidden');
  document.getElementById('bingoSkipCell').classList.add('hidden');
  document.getElementById('bingoWin').classList.add('hidden');
  document.getElementById('bingoHistory').classList.add('hidden');
  document.getElementById('bingoNoCells').classList.add('hidden');
  document.querySelector('.bingo-footer').classList.remove('hidden');

  // Ensure toggle button is visible if music is playing
  if (typeof hasMusicPlaying === 'function' && hasMusicPlaying()) {
    document.getElementById('toggleToMusic').classList.remove('hidden');
  }
}

function resumeBingo() {
  const state = loadBingoState();
  if (!state) {
    initBingo();
    return;
  }

  bingoCard = state.bingoCard;
  filledCells = state.filledCells;
  answerHistory = state.answerHistory;
  bingoAchieved = state.bingoAchieved;
  currentColor = state.pendingColor || null;
  currentAnswer = state.pendingCurrentAnswer || '';
  wasCorrect = false;
  scrollPositions = { 1: 0, 2: 0, 3: 0 };
  hasVisitedPhase3 = false;

  // Determine which phase to restore to
  const savedPhase = state.pendingPhase || 1;

  renderBingoGrid();

  // Hide win, history, instruction, skip button, no cells; show footer
  document.getElementById('bingoInstruction').classList.add('hidden');
  document.getElementById('bingoSkipCell').classList.add('hidden');
  document.getElementById('bingoWin').classList.add('hidden');
  document.getElementById('bingoHistory').classList.add('hidden');
  document.getElementById('bingoNoCells').classList.add('hidden');
  document.querySelector('.bingo-footer').classList.remove('hidden');

  if (savedPhase === 2 && currentColor && currentAnswer) {
    // Restore to phase 2 (correct/wrong selection)
    const display = document.getElementById('answerDisplay');
    display.innerHTML = `<span class="color-dot" style="background: ${getColorHex(currentColor)}"></span>${escapeHtml(currentAnswer)}`;
    showPhase(2);
  } else {
    // Restore to phase 1 (entering answer)
    showPhase(1);

    // Restore pending turn state (after showPhase which resets them)
    if (state.pendingColor) {
      currentColor = state.pendingColor;
      document.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.color === state.pendingColor);
      });
    }
    if (state.pendingAnswer) {
      document.getElementById('bingoAnswer').value = state.pendingAnswer;
    }
  }

  // Ensure toggle button is visible if music is playing
  if (typeof hasMusicPlaying === 'function' && hasMusicPlaying()) {
    document.getElementById('toggleToMusic').classList.remove('hidden');
  }
}

function showPhase(phase) {
  // Hide all phases
  document.getElementById('bingoPhase1').classList.add('hidden');
  document.getElementById('bingoPhase2').classList.add('hidden');

  // Show the target phase
  document.getElementById('bingoPhase' + phase).classList.remove('hidden');

  // Card is faded when overlay phases are active
  document.getElementById('bingoStage').classList.add('faded');

  currentPhase = phase;

  if (phase === 1) {
    // Reset selections
    document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('bingoAnswer').value = '';
    currentColor = null;
    currentAnswer = '';
  }
}

function renderBingoGrid() {
  const grid = document.getElementById('bingoGrid');
  grid.innerHTML = '';

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const idx = row * 5 + col;
      const color = bingoCard[row][col];
      const cell = document.createElement('div');
      cell.className = `bingo-cell cell-${color}`;
      cell.dataset.idx = idx;
      cell.dataset.color = color;

      if (filledCells.includes(idx)) {
        cell.classList.add('filled');
      }

      cell.addEventListener('click', () => onCellClick(idx, color));
      grid.appendChild(cell);
    }
  }
}

function updateSelectableCells() {
  document.querySelectorAll('.bingo-cell').forEach(cell => {
    cell.classList.remove('selectable');
    if (wasCorrect && cell.dataset.color === currentColor && !filledCells.includes(parseInt(cell.dataset.idx))) {
      cell.classList.add('selectable');
    }
  });
}

function hasUnfilledCellsOfColor(color) {
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const idx = row * 5 + col;
      if (bingoCard[row][col] === color && !filledCells.includes(idx)) {
        return true;
      }
    }
  }
  return false;
}

function showNoCellsMessage(color) {
  document.getElementById('noCellsMessage').textContent = `No ${color} cells left!`;
  document.getElementById('bingoPhase1').classList.add('hidden');
  document.getElementById('bingoPhase2').classList.add('hidden');
  document.getElementById('bingoNoCells').classList.remove('hidden');
  document.getElementById('bingoStage').classList.add('faded');
}

function hideNoCellsMessage() {
  document.getElementById('bingoNoCells').classList.add('hidden');
}

function onCellClick(idx, color) {
  if (!wasCorrect) return;
  if (color !== currentColor) return;
  if (filledCells.includes(idx)) return;

  filledCells.push(idx);
  wasCorrect = false; // Consume the correct answer
  currentColor = null; // Clear color after cell is filled
  saveBingoState();
  renderBingoGrid();
  updateSelectableCells();

  // Hide skip button
  document.getElementById('bingoSkipCell').classList.add('hidden');

  // Flash the instruction briefly, then advance
  const instruction = document.getElementById('bingoInstruction');
  instruction.textContent = 'Nice!';
  instruction.classList.add('flash');

  setTimeout(() => {
    instruction.classList.remove('flash');
    if (checkBingo()) {
      bingoAchieved = true;
      saveBingoState();
      instruction.classList.add('hidden');
      document.getElementById('bingoWin').classList.remove('hidden');
    } else {
      instruction.classList.add('hidden');
      showPhase(1);
    }
  }, 800);
}

function showHistory() {
  // Render answer history
  const list = document.getElementById('historyList');
  list.innerHTML = '';

  answerHistory.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <span class="color-dot" style="background: ${getColorHex(item.color)}; color: ${getColorHex(item.color)}"></span>
      <span class="answer-text">${escapeHtml(item.answer)}</span>
      <span class="status ${item.correct ? 'correct' : 'wrong'}">${item.correct ? '✓' : '✗'}</span>
    `;
    list.appendChild(div);
  });

  // Show the main card at full opacity
  document.getElementById('bingoStage').classList.remove('faded');
  document.getElementById('bingoWin').classList.add('hidden');
  document.getElementById('bingoPhase1').classList.add('hidden');
  document.getElementById('bingoPhase2').classList.add('hidden');
  document.getElementById('bingoInstruction').classList.add('hidden');
  document.getElementById('bingoHistory').classList.remove('hidden');
  document.querySelector('.bingo-footer').classList.add('hidden');
}

function getColorHex(color) {
  const colors = {
    green: '#39ff14',
    yellow: '#ffff00',
    pink: '#ff1493',
    blue: '#00bfff',
    purple: '#bf00ff'
  };
  return colors[color] || '#fff';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message) {
  const toast = document.getElementById('bingoToast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

function showConfirmDialog(message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-dialog">
      <p>${message}</p>
      <div class="confirm-buttons">
        <button class="btn btn-ghost" id="confirmNo">Cancel</button>
        <button class="btn btn-primary" id="confirmYes">Yes</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#confirmNo').addEventListener('click', () => {
    overlay.remove();
  });

  overlay.querySelector('#confirmYes').addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });
}

// Event listeners
document.getElementById('openBingoBtn').addEventListener('click', () => {
  document.getElementById('setSelection').classList.add('hidden');
  document.getElementById('bingoArea').classList.remove('hidden');

  // If music is active, show toggle button and mini player
  if (typeof hasMusicPlaying === 'function' && hasMusicPlaying()) {
    document.getElementById('toggleToMusic').classList.remove('hidden');
    showMiniPlayer();
  } else {
    document.getElementById('toggleToMusic').classList.add('hidden');
  }

  if (hasActiveGame()) {
    showResumeDialog();
  } else {
    initBingo();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

function showResumeDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-dialog">
      <p>You have an unfinished game. Resume or start new?</p>
      <div class="confirm-buttons">
        <button class="btn btn-ghost" id="startNewGame">New Game</button>
        <button class="btn btn-primary" id="resumeGame">Resume</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#startNewGame').addEventListener('click', () => {
    overlay.remove();
    initBingo();
  });

  overlay.querySelector('#resumeGame').addEventListener('click', () => {
    overlay.remove();
    resumeBingo();
  });
}

document.getElementById('bingoBackBtn').addEventListener('click', () => {
  // Save current state before going home (including pending turn)
  if (!bingoAchieved) {
    saveBingoState();
  }

  // Always go home
  document.getElementById('bingoArea').classList.add('hidden');
  document.getElementById('gameArea').classList.add('hidden');
  document.getElementById('setSelection').classList.remove('hidden');
  document.getElementById('toggleToBingo').classList.add('hidden');
  document.getElementById('toggleToMusic').classList.add('hidden');

  // Show mini player if music is active
  if (typeof showMiniPlayer === 'function') showMiniPlayer();
});

document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    currentColor = btn.dataset.color;
    saveBingoState();
  });
});

// Save state when typing answer
document.getElementById('bingoAnswer').addEventListener('input', () => {
  saveBingoState();
});

document.getElementById('bingoSubmitAnswer').addEventListener('click', () => {
  if (!currentColor) {
    showToast('Please select a color first');
    return;
  }

  currentAnswer = document.getElementById('bingoAnswer').value.trim();
  if (!currentAnswer) {
    showToast('Please enter an answer');
    return;
  }

  // Show phase 2
  const display = document.getElementById('answerDisplay');
  display.innerHTML = `<span class="color-dot" style="background: ${getColorHex(currentColor)}"></span>${escapeHtml(currentAnswer)}`;
  showPhase(2);
  saveBingoState(); // Save state so phase 2 can be restored
});

document.getElementById('bingoCorrect').addEventListener('click', () => {
  answerHistory.push({ color: currentColor, answer: currentAnswer, correct: true });
  // Clear phase 2 state - answer has been judged
  const answeredColor = currentColor;
  currentAnswer = '';
  currentPhase = 1;
  document.getElementById('bingoAnswer').value = '';

  // Check if there are any unfilled cells of this color
  if (!hasUnfilledCellsOfColor(answeredColor)) {
    // No cells left - show message and proceed to next round
    currentColor = null;
    saveBingoState();
    showNoCellsMessage(answeredColor);
    return;
  }

  // There are cells to fill
  wasCorrect = true;
  saveBingoState();

  // Show instruction, hide button overlay, show card
  const instruction = document.getElementById('bingoInstruction');
  instruction.textContent = `Tap a ${answeredColor} cell to fill it in`;
  instruction.classList.remove('hidden');
  document.getElementById('bingoSkipCell').classList.remove('hidden');
  document.getElementById('bingoStage').classList.remove('faded');
  document.getElementById('bingoPhase1').classList.add('hidden');
  document.getElementById('bingoPhase2').classList.add('hidden');
  updateSelectableCells();
});

document.getElementById('bingoSkipCell').addEventListener('click', () => {
  // Undo the "correct" - remove last history entry and reset
  if (answerHistory.length > 0 && answerHistory[answerHistory.length - 1].correct) {
    answerHistory.pop();
    saveBingoState();
  }
  wasCorrect = false;
  document.getElementById('bingoSkipCell').classList.add('hidden');
  document.getElementById('bingoInstruction').classList.add('hidden');
  updateSelectableCells();
  showPhase(1);
});

document.getElementById('bingoWrong').addEventListener('click', () => {
  wasCorrect = false;
  answerHistory.push({ color: currentColor, answer: currentAnswer, correct: false });
  // Clear phase 2 state - answer has been judged
  currentAnswer = '';
  currentColor = null;
  currentPhase = 1;
  document.getElementById('bingoAnswer').value = '';
  saveBingoState();

  // Show instruction briefly, then advance
  const instruction = document.getElementById('bingoInstruction');
  instruction.textContent = 'Better luck next time!';
  instruction.classList.remove('hidden');
  instruction.classList.add('flash');
  document.getElementById('bingoStage').classList.remove('faded');
  document.getElementById('bingoPhase1').classList.add('hidden');
  document.getElementById('bingoPhase2').classList.add('hidden');

  setTimeout(() => {
    instruction.classList.remove('flash');
    instruction.classList.add('hidden');
    showPhase(1);
  }, 1200);
});

document.getElementById('noCellsOk').addEventListener('click', () => {
  hideNoCellsMessage();
  showPhase(1);
});

document.getElementById('bingoQuit').addEventListener('click', () => {
  showConfirmDialog('End game?', () => {
    clearBingoState();
    showHistory();
  });
});

document.getElementById('bingoShowHistory').addEventListener('click', () => {
  clearBingoState();
  showHistory();
});

document.getElementById('bingoNewGame').addEventListener('click', () => {
  document.getElementById('bingoHistory').classList.add('hidden');
  initBingo();
});

document.getElementById('bingoBackHome').addEventListener('click', () => {
  document.getElementById('bingoArea').classList.add('hidden');
  document.getElementById('gameArea').classList.add('hidden');
  document.getElementById('setSelection').classList.remove('hidden');
  document.getElementById('toggleToBingo').classList.add('hidden');
  document.getElementById('toggleToMusic').classList.add('hidden');

  // Show mini player if music is active
  if (typeof showMiniPlayer === 'function') showMiniPlayer();
});

// Allow Enter key in answer input
document.getElementById('bingoAnswer').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('bingoSubmitAnswer').click();
  }
});
