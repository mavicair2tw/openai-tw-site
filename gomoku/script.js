const BOARD_SIZE = 15;
const boardElement = document.getElementById('board');
const undoButton = document.getElementById('undo-button');
const restartButton = document.getElementById('restart-button');
const soundToggle = document.getElementById('sound-toggle');
const aiToggle = document.getElementById('ai-toggle');
const currentPlayerIndicator = document.getElementById('current-player');
const moveCounter = document.getElementById('move-counter');
const gameStatusEl = document.getElementById('game-status');
const soundIndicator = document.getElementById('sound-indicator');
const aiIndicator = document.getElementById('ai-indicator');

const DIRECTIONS = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 1, dc: 1 },
  { dr: -1, dc: 1 },
];

let boardState = [];
let history = [];
let currentPlayer = 1; // 1 = Black (human), -1 = White (AI)
let moveCount = 0;
let cellElements = [];
let winningLine = [];
let gameEnded = false;
let aiEnabled = true;
let aiTimer = null;

const audioState = {
  context: null,
  enabled: true,
};

const playerLabels = {
  1: 'Black',
  '-1': 'White',
};

function renderBoard() {
  boardElement.innerHTML = '';
  boardElement.style.setProperty('--board-size', BOARD_SIZE);
  cellElements = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.addEventListener('click', handleCellClick);
      boardElement.appendChild(cell);
      cellElements[row][col] = cell;
    }
  }
}

function initializeGame() {
  cancelAiMove();
  boardState = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
  history = [];
  currentPlayer = 1;
  moveCount = 0;
  gameEnded = false;
  winningLine = [];

  cellElements.forEach((rowCells) => {
    rowCells.forEach((cell) => {
      if (!cell) return;
      cell.classList.remove('occupied', 'winning');
      cell.innerHTML = '';
    });
  });

  updateStatus('Game in progress');
  refreshInfoPanel();
}

function handleCellClick(event) {
  if (gameEnded || currentPlayer !== 1) {
    return;
  }

  const cell = event.currentTarget;
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);

  if (boardState[row][col] !== 0) {
    return;
  }

  placeStone(row, col);
}

function placeStone(row, col) {
  boardState[row][col] = currentPlayer;
  history.push({ row, col, player: currentPlayer });
  moveCount += 1;
  renderStone(row, col, currentPlayer);
  playPlaceSound();

  const winResult = checkWin(row, col);
  if (winResult) {
    gameEnded = true;
    winningLine = winResult;
    highlightWinningLine(winResult);
    updateStatus(`${playerLabels[currentPlayer]} wins!`);
    playWinSound();
  } else {
    currentPlayer *= -1;
    updateStatus('Game in progress');
  }

  refreshInfoPanel();
  maybeScheduleAi();
}

function renderStone(row, col, player) {
  const cell = cellElements[row][col];
  if (!cell) return;

  cell.classList.add('occupied');
  const stone = document.createElement('span');
  stone.className = `stone ${player === 1 ? 'black' : 'white'}`;
  stone.style.opacity = '0';
  stone.style.transform = 'scale(0.5)';
  cell.appendChild(stone);

  requestAnimationFrame(() => {
    stone.style.opacity = '1';
    stone.style.transform = 'scale(1)';
  });
}

function checkWin(row, col) {
  const player = boardState[row][col];
  if (!player) return null;

  for (const { dr, dc } of DIRECTIONS) {
    const line = getWinningLine(row, col, dr, dc, player);
    if (line.length >= 5) {
      return line;
    }
  }

  return null;
}

function getWinningLine(row, col, dr, dc, player) {
  const line = [{ row, col }];

  let r = row + dr;
  let c = col + dc;
  while (isInside(r, c) && boardState[r][c] === player) {
    line.push({ row: r, col: c });
    r += dr;
    c += dc;
  }

  r = row - dr;
  c = col - dc;
  while (isInside(r, c) && boardState[r][c] === player) {
    line.unshift({ row: r, col: c });
    r -= dr;
    c -= dc;
  }

  return line;
}

function isInside(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function highlightWinningLine(line) {
  clearWinningHighlight();
  line.forEach(({ row, col }) => {
    const cell = cellElements[row][col];
    if (cell) {
      cell.classList.add('winning');
    }
  });
}

function clearWinningHighlight() {
  cellElements.forEach((rowCells) => {
    rowCells.forEach((cell) => {
      if (!cell) return;
      cell.classList.remove('winning');
    });
  });
}

function undoMove() {
  if (!history.length) return;

  cancelAiMove();
  const lastMove = history.pop();
  const { row, col, player } = lastMove;
  boardState[row][col] = 0;
  const cell = cellElements[row][col];
  if (cell) {
    cell.classList.remove('occupied', 'winning');
    cell.innerHTML = '';
  }

  winningLine = [];
  gameEnded = false;
  moveCount -= 1;
  currentPlayer = player;
  if (aiEnabled && player === -1) {
    currentPlayer = 1;
  }

  clearWinningHighlight();
  playUndoSound();
  updateStatus('Move undone.');
  refreshInfoPanel();
}

function restartGame() {
  cancelAiMove();
  initializeGame();
  playResetSound();
}

function refreshInfoPanel() {
  const badge = currentPlayerIndicator.querySelector('.player-badge');
  const label = currentPlayerIndicator.querySelector('.player-text');
  if (badge) {
    badge.className = `player-badge ${currentPlayer === 1 ? 'black' : 'white'}`;
  }
  if (label) {
    label.textContent = playerLabels[currentPlayer];
  }

  moveCounter.textContent = moveCount;
  soundIndicator.textContent = audioState.enabled ? 'On' : 'Off';
  aiIndicator.textContent = aiEnabled ? 'AI opponent' : 'Human only';
  soundToggle.textContent = `Sound: ${audioState.enabled ? 'On' : 'Off'}`;
  aiToggle.textContent = `AI: ${aiEnabled ? 'On' : 'Off'}`;
  undoButton.disabled = history.length === 0;
}

function updateStatus(message) {
  gameStatusEl.textContent = message;
}

function toggleSound() {
  audioState.enabled = !audioState.enabled;
  if (audioState.enabled) {
    playPlaceSound();
  }
  refreshInfoPanel();
}

function toggleAi() {
  aiEnabled = !aiEnabled;
  cancelAiMove();
  if (!aiEnabled && !gameEnded && currentPlayer === -1) {
    currentPlayer = 1;
  }
  refreshInfoPanel();
  maybeScheduleAi();
}

function maybeScheduleAi() {
  if (aiEnabled && !gameEnded && currentPlayer === -1) {
    scheduleAiMove();
  } else {
    cancelAiMove();
  }
}

function scheduleAiMove() {
  cancelAiMove();
  aiTimer = setTimeout(() => {
    const move = pickAiMove();
    if (move && !gameEnded && currentPlayer === -1) {
      placeStone(move.row, move.col);
    }
  }, 360);
}

function cancelAiMove() {
  if (aiTimer) {
    clearTimeout(aiTimer);
    aiTimer = null;
  }
}

function pickAiMove() {
  const immediateWin = findImmediateWinningCell(-1);
  if (immediateWin) {
    return immediateWin;
  }

  const block = findImmediateWinningCell(1);
  if (block) {
    return block;
  }

  let best = null;
  let bestScore = -Infinity;
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (boardState[row][col] !== 0) continue;
      const score = evaluateCell(row, col);
      if (score > bestScore) {
        bestScore = score;
        best = { row, col };
      }
    }
  }

  if (best) return best;
  const empties = history.length > 0 ? [] : [{ row: Math.floor(BOARD_SIZE / 2), col: Math.floor(BOARD_SIZE / 2) }];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (boardState[row][col] === 0) {
        empties.push({ row, col });
      }
    }
  }
  if (!empties.length) return null;
  return empties[Math.floor(Math.random() * empties.length)];
}

function findImmediateWinningCell(player) {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (boardState[row][col] !== 0) continue;
      boardState[row][col] = player;
      const win = checkWin(row, col);
      boardState[row][col] = 0;
      if (win) {
        return { row, col };
      }
    }
  }
  return null;
}

function evaluateCell(row, col) {
  let score = 0;
  for (const { dr, dc } of DIRECTIONS) {
    const aiCount = countInDirection(row, col, dr, dc, -1) + countInDirection(row, col, -dr, -dc, -1);
    const humanCount = countInDirection(row, col, dr, dc, 1) + countInDirection(row, col, -dr, -dc, 1);
    score += aiCount * 7;
    score += humanCount * 5;
  }
  const centerBonus = 7 - Math.hypot(row - Math.floor(BOARD_SIZE / 2), col - Math.floor(BOARD_SIZE / 2));
  score += centerBonus * 0.35;
  return score + Math.random();
}

function countInDirection(row, col, dr, dc, player) {
  let count = 0;
  let r = row + dr;
  let c = col + dc;
  while (isInside(r, c) && boardState[r][c] === player) {
    count += 1;
    r += dr;
    c += dc;
  }
  return count;
}

function initializeAudio() {
  if (audioState.context) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audioState.context = new AudioContext();
}

function playTone(freq, duration = 0.15, type = 'sine', volume = 0.2) {
  if (!audioState.enabled || !audioState.context) {
    return;
  }
  if (audioState.context.state === 'suspended') {
    audioState.context.resume();
  }
  const oscillator = audioState.context.createOscillator();
  const gainNode = audioState.context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = freq;
  const now = audioState.context.currentTime;
  gainNode.gain.setValueAtTime(0.001, now);
  gainNode.gain.exponentialRampToValueAtTime(volume, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gainNode).connect(audioState.context.destination);
  oscillator.start();
  oscillator.stop(now + duration);
}

function playPlaceSound() {
  playTone(720, 0.12, 'sine', 0.3);
}

function playWinSound() {
  playTone(660, 0.25, 'triangle', 0.25);
  setTimeout(() => {
    playTone(860, 0.24, 'triangle', 0.28);
  }, 120);
}

function playUndoSound() {
  playTone(520, 0.14, 'square', 0.3);
}

function playResetSound() {
  playTone(360, 0.18, 'sine', 0.25);
  setTimeout(() => {
    playTone(460, 0.12, 'sine', 0.22);
  }, 160);
}

function primeAudio() {
  initializeAudio();
}

document.addEventListener('DOMContentLoaded', () => {
  renderBoard();
  initializeGame();
  document.body.addEventListener('pointerdown', primeAudio, { once: true });
  document.body.addEventListener('keydown', primeAudio, { once: true });
  undoButton.addEventListener('click', undoMove);
  restartButton.addEventListener('click', restartGame);
  soundToggle.addEventListener('click', toggleSound);
  aiToggle.addEventListener('click', toggleAi);
});
