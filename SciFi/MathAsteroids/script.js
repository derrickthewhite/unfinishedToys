const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const leftAnswersDiv = document.getElementById("leftAnswers");
const rightAnswersDiv = document.getElementById("rightAnswers");
const challengeInfoDiv = document.getElementById("challengeInfo");
const roundInfoDiv = document.getElementById("roundInfo");
const levelInfoDiv = document.getElementById("levelInfo");
const buildingDiv = document.getElementById("buildings");
const asteroidDiv = document.getElementById("asteroids");
const pauseBtn = document.getElementById("pauseBtn");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMessage = document.getElementById("overlayMessage");
const primaryActionBtn = document.getElementById("primaryActionBtn");
const secondaryActionBtn = document.getElementById("secondaryActionBtn");
const setupControls = document.getElementById("setupControls");
const challengeModeSelect = document.getElementById("challengeModeSelect");
const setupModeDescription = document.getElementById("setupModeDescription");
const singleTableField = document.getElementById("singleTableField");
const singleTableSelect = document.getElementById("singleTableSelect");
const specifiedTablesFields = document.getElementById("specifiedTablesFields");
const specifiedTableASelect = document.getElementById("specifiedTableASelect");
const specifiedTableBSelect = document.getElementById("specifiedTableBSelect");
const roundCountSelect = document.getElementById("roundCountSelect");
const levelSelect = document.getElementById("levelSelect");
const hallOfFameScreen = document.getElementById("hallOfFameScreen");
const hallOfFameList = document.getElementById("hallOfFameList");
const hallOfFameMessage = document.getElementById("hallOfFameMessage");
const closeHallOfFameBtn = document.getElementById("closeHallOfFameBtn");

const problemManager = window.MathAsteroidsProblemManager;
if (!problemManager) {
  throw new Error("MathAsteroidsProblemManager is required before loading script.js");
}

const {
  TABLE_VALUE_MIN,
  TABLE_VALUE_MAX,
  clampWholeNumber,
  challengeModes,
  challengeModeMap,
  DEFAULT_CHALLENGE_MODE_ID,
  normalizeDistinctTables,
  createChallenge
} = problemManager;

const config = {
  maxAsteroids: 3,
  spawnInterval: 2000,
  problemSpeed: 0.5
};

const DEFAULT_LEVEL = 4;
const DEFAULT_ROUND_COUNT = 5;
const MAX_ROUND_OPTIONS = 10;
const ANSWER_BUTTONS_PER_COLUMN = 10;
const HALL_OF_FAME_STORAGE_KEY = "mathAsteroidsHallOfFame";
const LEVEL_SETTINGS = {
  1: { maxAsteroids: 1, spawnInterval: 4000, problemSpeed: 0.25 },
  2: { maxAsteroids: 2, spawnInterval: 3200, problemSpeed: 0.33 },
  3: { maxAsteroids: 2, spawnInterval: 2500, problemSpeed: 0.42 },
  4: { maxAsteroids: 3, spawnInterval: 2000, problemSpeed: 0.5 },
  5: { maxAsteroids: 4, spawnInterval: 1600, problemSpeed: 0.62 },
  6: { maxAsteroids: 5, spawnInterval: 1300, problemSpeed: 0.74 },
  7: { maxAsteroids: 6, spawnInterval: 1000, problemSpeed: 0.9 }
};

const encouragingMessages = [
  "Great job - keep it up!",
  "Nice work - you're getting better!",
  "Well done - ready for more?",
  "Awesome - that was impressive!",
  "You rocked that round!",
  "Fantastic - you're on a roll!",
  "Nice shooting - let's go again!",
  "Excellent - keep the streak alive!",
  "Great focus - onward!",
  "Sweet! You've got this!"
];

const finalVictoryMessages = [
  "Outstanding work. You cleared every round and defended the whole city.",
  "That was a full campaign win. Excellent focus from start to finish.",
  "Mission complete. You beat the whole run and kept the defenses standing.",
  "Brilliant finish. Every round is done and the city is still here."
];

function getEncouragingMessage() {
  return encouragingMessages[Math.floor(Math.random() * encouragingMessages.length)];
}

function getFinalVictoryMessage() {
  return finalVictoryMessages[Math.floor(Math.random() * finalVictoryMessages.length)];
}

const initialRoundAsteroids = 10;
const buildingWidth = 40;
const buildingHeight = 20;

let asteroids = [];
let asteroidsComing = initialRoundAsteroids;
let totalAsteroidsThisRound = initialRoundAsteroids;
let buildings = 3;
let cooldown = false;
let laserBeams = [];
let lastAsteroidTime = 0;
let paused = false;
let animation = null;
let gameState = "setup";
let round = 1;
let roundSpawnInterval = config.spawnInterval;
let activeChallenge = null;
let stagedChallenge = null;
let currentAnswerValues = [];
let selectedLevel = DEFAULT_LEVEL;
let selectedRoundCount = DEFAULT_ROUND_COUNT;
let asteroidsDestroyedThisRun = 0;

class Asteroid {
  constructor(problem, x, y) {
    this.problem = problem;
    this.x = x;
    this.y = y;
    this.radius = 40;
    this.destroyed = false;
    this.lit = false;
    this.litTimer = 0;
  }

  draw() {
    ctx.fillStyle = this.lit ? "#ffdf70" : "#5d6777";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "20px sans-serif";
    ctx.fillText(this.problem.text, this.x, this.y + 6);
  }

  update() {
    this.y += config.problemSpeed;
    if (this.lit) {
      this.litTimer -= 1;
      if (this.litTimer <= 0) {
        this.lit = false;
      }
    }
    this.draw();
  }
}

function resizeCanvas() {
  const { clientWidth, clientHeight } = canvas;
  canvas.width = clientWidth;
  canvas.height = clientHeight;
}

function getGunX() {
  return canvas.width / 2;
}

function getGunY() {
  return canvas.height - 60;
}

function populateSelect(select, values, labelBuilder = (value) => value) {
  if (!select) {
    return;
  }

  select.innerHTML = "";
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = labelBuilder(value);
    select.appendChild(option);
  });
}

function getSelectedRoundCount() {
  return Math.max(1, parseInt(roundCountSelect ? roundCountSelect.value : DEFAULT_ROUND_COUNT, 10) || DEFAULT_ROUND_COUNT);
}

function getSelectedLevel() {
  return Math.min(7, Math.max(1, parseInt(levelSelect ? levelSelect.value : DEFAULT_LEVEL, 10) || DEFAULT_LEVEL));
}

function getLevelSettings(level) {
  return LEVEL_SETTINGS[level] || LEVEL_SETTINGS[DEFAULT_LEVEL];
}

function applyLevelSettings(level) {
  const levelSettings = getLevelSettings(level);
  selectedLevel = level;
  config.maxAsteroids = levelSettings.maxAsteroids;
  config.spawnInterval = levelSettings.spawnInterval;
  config.problemSpeed = levelSettings.problemSpeed;
  roundSpawnInterval = levelSettings.spawnInterval;
}

function updateSetupControlsVisibility(showSetupControls) {
  if (!setupControls) {
    return;
  }

  setupControls.hidden = !showSetupControls;
  setupControls.style.display = showSetupControls ? "" : "none";
  setupControls.setAttribute("aria-hidden", showSetupControls ? "false" : "true");
}

function setSetupFieldHidden(element, hidden) {
  if (!element) {
    return;
  }

  element.hidden = hidden;
  element.style.display = hidden ? "none" : "";
}

function setSecondaryAction(label, action) {
  if (!secondaryActionBtn || !label || !action) {
    if (secondaryActionBtn) {
      secondaryActionBtn.hidden = true;
      secondaryActionBtn.onclick = null;
    }
    return;
  }

  secondaryActionBtn.hidden = false;
  secondaryActionBtn.textContent = label;
  secondaryActionBtn.onclick = action;
}

function setOverlay(title, message, buttonLabel, action, options = {}) {
  const { showSetupControls = false, secondaryLabel = "", secondaryAction = null } = options;
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  primaryActionBtn.textContent = buttonLabel;
  primaryActionBtn.onclick = action;
  updateSetupControlsVisibility(showSetupControls);
  setSecondaryAction(secondaryLabel, secondaryAction);
  if (showSetupControls) {
    refreshSetupPreview();
  }
  overlay.classList.add("visible");
}

function hideOverlay() {
  setSecondaryAction("", null);
  overlay.classList.remove("visible");
}

function updateHud() {
  const visibleChallenge = activeChallenge || stagedChallenge;
  challengeInfoDiv.textContent = visibleChallenge ? visibleChallenge.label : "Math Asteroids";
  roundInfoDiv.textContent = `Round ${Math.min(round, selectedRoundCount)} / ${selectedRoundCount}`;
  levelInfoDiv.textContent = `Level ${selectedLevel}`;
  buildingDiv.textContent = `Buildings ${buildings}`;
  asteroidDiv.textContent = `Asteroids ${asteroidsComing + asteroids.length}`;
}

function drawBuildings() {
  for (let i = 0; i < buildings; i += 1) {
    const x = i * (buildingWidth + 5) + 10;
    const y = canvas.height - 30;
    ctx.fillStyle = "#3268ff";
    ctx.fillRect(x, y, buildingWidth, buildingHeight);
  }
}

function drawGun() {
  ctx.fillStyle = "#35d27b";
  ctx.fillRect(getGunX() - 20, getGunY() - 20, 40, 40);
}

function drawLasers() {
  laserBeams.forEach((beam) => {
    ctx.beginPath();
    ctx.moveTo(getGunX(), getGunY());
    if (beam.target) {
      ctx.lineTo(beam.target.x, beam.target.y);
    } else {
      ctx.lineTo(beam.x, beam.y);
    }
    ctx.strokeStyle = "#ff4d5c";
    ctx.lineWidth = 5;
    ctx.stroke();
  });
}

function getSelectedChallengeModeId() {
  if (challengeModeSelect && challengeModeMap[challengeModeSelect.value]) {
    return challengeModeSelect.value;
  }
  return DEFAULT_CHALLENGE_MODE_ID;
}

function readSetupValues() {
  const singleTable = clampWholeNumber(singleTableSelect ? singleTableSelect.value : 6, TABLE_VALUE_MIN, TABLE_VALUE_MAX, 6);
  const [specifiedTableA, specifiedTableB] = normalizeDistinctTables(
    specifiedTableASelect ? specifiedTableASelect.value : 6,
    specifiedTableBSelect ? specifiedTableBSelect.value : 8
  );
  const roundCount = getSelectedRoundCount();
  const level = getSelectedLevel();

  if (singleTableSelect) {
    singleTableSelect.value = String(singleTable);
  }
  if (specifiedTableASelect) {
    specifiedTableASelect.value = String(specifiedTableA);
  }
  if (specifiedTableBSelect) {
    specifiedTableBSelect.value = String(specifiedTableB);
  }
  if (roundCountSelect) {
    roundCountSelect.value = String(roundCount);
  }
  if (levelSelect) {
    levelSelect.value = String(level);
  }

  return {
    modeId: getSelectedChallengeModeId(),
    singleTable,
    specifiedTableA,
    specifiedTableB,
    roundCount,
    level
  };
}

function createChallengeFromSetup(setupValues = readSetupValues()) {
  try {
    return createChallenge(setupValues);
  } catch (error) {
    console.error("Failed to create challenge from setup", error);
    return null;
  }
}

function updateSetupFieldVisibility() {
  const definition = challengeModeMap[getSelectedChallengeModeId()] || challengeModeMap[DEFAULT_CHALLENGE_MODE_ID];
  const visibleFields = new Set(definition.setupFields || []);

  setSetupFieldHidden(singleTableField, !visibleFields.has("singleTable"));
  setSetupFieldHidden(specifiedTablesFields, !visibleFields.has("specifiedTables"));
}

function updateSetupDescription() {
  if (!setupModeDescription) {
    return;
  }

  const definition = challengeModeMap[getSelectedChallengeModeId()] || challengeModeMap[DEFAULT_CHALLENGE_MODE_ID];
  const levelSettings = getLevelSettings(selectedLevel);
  const summary = stagedChallenge && stagedChallenge.id === definition.id && stagedChallenge.summary
    ? ` ${stagedChallenge.summary}.`
    : "";
  setupModeDescription.textContent = `${definition.description}${summary} Level ${selectedLevel}: ${levelSettings.maxAsteroids} at a time, speed ${levelSettings.problemSpeed}, spawn ${levelSettings.spawnInterval / 1000}s.`;
}

function refreshSetupPreview() {
  if (gameState === "playing" || gameState === "paused") {
    return;
  }

  const setupValues = readSetupValues();
  selectedRoundCount = setupValues.roundCount;
  selectedLevel = setupValues.level;
  stagedChallenge = createChallengeFromSetup(setupValues);
  currentAnswerValues = stagedChallenge ? stagedChallenge.answerValues : [];
  updateSetupFieldVisibility();
  updateSetupDescription();
  renderAnswers();
  updateHud();
}

function initializeSetupControls() {
  if (!challengeModeSelect) {
    return;
  }

  setSetupFieldHidden(singleTableField, true);
  setSetupFieldHidden(specifiedTablesFields, true);

  const tableOptions = Array.from({ length: TABLE_VALUE_MAX - TABLE_VALUE_MIN + 1 }, (_, index) => index + TABLE_VALUE_MIN);
  populateSelect(challengeModeSelect, challengeModes.map((mode) => mode.id), (modeId) => challengeModeMap[modeId].label);
  populateSelect(singleTableSelect, tableOptions);
  populateSelect(specifiedTableASelect, tableOptions);
  populateSelect(specifiedTableBSelect, tableOptions);
  populateSelect(roundCountSelect, Array.from({ length: MAX_ROUND_OPTIONS }, (_, index) => index + 1));
  populateSelect(levelSelect, Array.from({ length: 7 }, (_, index) => index + 1));

  challengeModeSelect.value = DEFAULT_CHALLENGE_MODE_ID;
  singleTableSelect.value = "6";
  specifiedTableASelect.value = "6";
  specifiedTableBSelect.value = "8";
  roundCountSelect.value = String(DEFAULT_ROUND_COUNT);
  levelSelect.value = String(DEFAULT_LEVEL);

  challengeModeSelect.addEventListener("change", refreshSetupPreview);
  singleTableSelect.addEventListener("change", refreshSetupPreview);
  specifiedTableASelect.addEventListener("change", refreshSetupPreview);
  specifiedTableBSelect.addEventListener("change", refreshSetupPreview);
  roundCountSelect.addEventListener("change", refreshSetupPreview);
  levelSelect.addEventListener("change", refreshSetupPreview);
  closeHallOfFameBtn.onclick = closeHallOfFame;

  refreshSetupPreview();
}

function normalizeHallOfFameEntry(key, entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const [challengeIdFromKey = "", levelFromKey = "0"] = String(key).split("::");
  const roundsCleared = Math.max(
    0,
    parseInt(
      entry.roundsCleared ?? entry.rounds ?? entry.bestRound ?? entry.bestRounds ?? 0,
      10
    ) || 0
  );
  const asteroidsDestroyed = Math.max(
    0,
    parseInt(
      entry.asteroidsDestroyed ?? entry.asteroids ?? entry.bestAsteroids ?? 0,
      10
    ) || 0
  );
  const level = Math.max(1, parseInt(entry.level ?? levelFromKey, 10) || 1);

  return {
    challengeId: entry.challengeId || challengeIdFromKey,
    challengeLabel: entry.challengeLabel || entry.modeLabel || entry.challengeId || challengeIdFromKey,
    level,
    roundsCleared,
    asteroidsDestroyed,
    playerName: entry.playerName || entry.name || "Anonymous"
  };
}

function getHallOfFameData() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HALL_OF_FAME_STORAGE_KEY) || "{}");
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const normalizedEntries = Object.entries(parsed)
      .map(([key, entry]) => [key, normalizeHallOfFameEntry(key, entry)])
      .filter(([, entry]) => Boolean(entry));

    return Object.fromEntries(normalizedEntries);
  } catch (error) {
    console.error("Failed to read hall of fame data", error);
    return {};
  }
}

function saveHallOfFameData(data) {
  try {
    window.localStorage.setItem(HALL_OF_FAME_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save hall of fame data", error);
  }
}

function getHallOfFameKey(challengeId, level) {
  return `${challengeId}::${level}`;
}

function isBetterHallOfFameRun(candidate, existing) {
  const normalizedExisting = normalizeHallOfFameEntry(
    getHallOfFameKey(candidate.challengeId, candidate.level),
    existing
  );

  if (!normalizedExisting) {
    return true;
  }

  if (candidate.roundsCleared !== normalizedExisting.roundsCleared) {
    return candidate.roundsCleared > normalizedExisting.roundsCleared;
  }

  return candidate.asteroidsDestroyed > normalizedExisting.asteroidsDestroyed;
}

function renderHallOfFame() {
  const entries = Object.values(getHallOfFameData()).sort((left, right) => {
    if (left.challengeLabel !== right.challengeLabel) {
      return left.challengeLabel.localeCompare(right.challengeLabel);
    }
    return left.level - right.level;
  });

  hallOfFameMessage.textContent = "Best progress for each challenge and level.";
  hallOfFameList.innerHTML = "";

  if (entries.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "hall-of-fame-empty";
    emptyState.textContent = "No hall of fame entries yet. Finish a run to set the first mark.";
    hallOfFameList.appendChild(emptyState);
    return;
  }

  entries.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "hall-of-fame-entry";

    const title = document.createElement("strong");
    title.textContent = `${entry.challengeLabel} - Level ${entry.level}`;

    const player = document.createElement("span");
    player.textContent = `Best run: ${entry.playerName}`;

    const progress = document.createElement("span");
    progress.textContent = `Rounds ${entry.roundsCleared}, Asteroids ${entry.asteroidsDestroyed}`;

    item.appendChild(title);
    item.appendChild(player);
    item.appendChild(progress);
    hallOfFameList.appendChild(item);
  });
}

function openHallOfFame() {
  renderHallOfFame();
  hallOfFameScreen.classList.add("visible");
}

function closeHallOfFame() {
  hallOfFameScreen.classList.remove("visible");
}

function maybeAddHallOfFameEntry(completedRounds) {
  if (!activeChallenge) {
    return false;
  }

  const hallOfFameData = getHallOfFameData();
  const key = getHallOfFameKey(activeChallenge.id, selectedLevel);
  const candidate = {
    challengeId: activeChallenge.id,
    challengeLabel: activeChallenge.label,
    level: selectedLevel,
    roundsCleared: completedRounds,
    asteroidsDestroyed: asteroidsDestroyedThisRun
  };

  if (!isBetterHallOfFameRun(candidate, hallOfFameData[key])) {
    return false;
  }

  const playerName = window.prompt(
    "Parent or guardian: if this run should go into the Hall of Fame, enter a name or initials.",
    ""
  );

  if (!playerName || !playerName.trim()) {
    return false;
  }

  hallOfFameData[key] = {
    ...candidate,
    playerName: playerName.trim()
  };
  saveHallOfFameData(hallOfFameData);
  return true;
}

function showSetupScreen() {
  if (animation) {
    cancelAnimationFrame(animation);
    animation = null;
  }

  gameState = "setup";
  round = 1;
  activeChallenge = null;
  asteroids = [];
  laserBeams = [];
  cooldown = false;
  buildings = 3;
  asteroidsComing = initialRoundAsteroids;
  closeHallOfFame();
  updateSetupFieldVisibility();
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  setOverlay(
    "Setup",
    "Pick a challenge, rounds, and level, then press start.",
    "Start",
    startInitialGame,
    { showSetupControls: true, secondaryLabel: "Hall of Fame", secondaryAction: openHallOfFame }
  );
}

function updateLasers() {
  laserBeams = laserBeams.filter((beam) => !beam.target || !beam.target.destroyed || beam.target.lit);
}

function spawnAsteroid() {
  if (!activeChallenge) {
    return;
  }

  const problem = activeChallenge.generateProblem();
  const x = Math.random() * Math.max(canvas.width - 80, 80) + 40;
  const asteroid = new Asteroid(problem, x, -50);
  asteroids.push(asteroid);
  asteroidsComing -= 1;
  updateHud();
}

function renderAnswerColumn(container, values) {
  container.innerHTML = "";
  container.style.gridTemplateRows = `repeat(${ANSWER_BUTTONS_PER_COLUMN}, minmax(0, 1fr))`;

  Array.from({ length: ANSWER_BUTTONS_PER_COLUMN }, (_, index) => values[index] ?? null).forEach((answer) => {
    if (answer === null) {
      const spacer = document.createElement("div");
      spacer.className = "answer-spacer";
      spacer.setAttribute("aria-hidden", "true");
      container.appendChild(spacer);
      return;
    }

    const button = document.createElement("button");
    button.className = "answer-button";
    button.textContent = answer;
    button.disabled = gameState !== "playing" || cooldown;
    button.onclick = () => handleAnswer(answer);
    container.appendChild(button);
  });
}

function renderAnswers() {
  renderAnswerColumn(leftAnswersDiv, currentAnswerValues.slice(0, ANSWER_BUTTONS_PER_COLUMN));
  renderAnswerColumn(rightAnswersDiv, currentAnswerValues.slice(ANSWER_BUTTONS_PER_COLUMN, ANSWER_BUTTONS_PER_COLUMN * 2));
}

function startRound() {
  resizeCanvas();
  asteroids = [];
  laserBeams = [];
  cooldown = false;
  paused = false;
  pauseBtn.textContent = "Pause";
  gameState = "playing";
  buildings = 3;
  asteroidsComing = totalAsteroidsThisRound;
  lastAsteroidTime = performance.now();
  closeHallOfFame();
  hideOverlay();
  renderAnswers();
  updateHud();

  if (animation) {
    cancelAnimationFrame(animation);
  }
  animation = requestAnimationFrame(updateGame);
}

function startInitialGame() {
  const setupValues = readSetupValues();
  selectedRoundCount = setupValues.roundCount;
  applyLevelSettings(setupValues.level);
  activeChallenge = stagedChallenge || createChallengeFromSetup(setupValues);
  if (!activeChallenge) {
    return;
  }

  currentAnswerValues = activeChallenge.answerValues;
  round = 1;
  totalAsteroidsThisRound = initialRoundAsteroids;
  asteroidsDestroyedThisRun = 0;
  startRound();
}

function startNextRound() {
  if (!activeChallenge) {
    activeChallenge = createChallengeFromSetup();
  }

  if (!activeChallenge) {
    return;
  }

  currentAnswerValues = activeChallenge.answerValues;
  round += 1;
  totalAsteroidsThisRound += 2;
  applyLevelSettings(selectedLevel);
  startRound();
}

function endRound(title, message, buttonLabel, action, options = {}) {
  gameState = title === "Game Over" ? "lost" : "won";
  if (animation) {
    cancelAnimationFrame(animation);
    animation = null;
  }
  pauseBtn.textContent = "Pause";
  renderAnswers();
  setOverlay(title, message, buttonLabel, action, options);
}

function handleAnswer(answer) {
  if (gameState !== "playing" || cooldown) {
    return;
  }

  const target = asteroids.find((asteroid) => !asteroid.destroyed && asteroid.problem.answer === answer);
  if (target) {
    laserBeams.push({ x: target.x, y: target.y, target });
    target.lit = true;
    target.litTimer = 15;
    target.destroyed = true;
    asteroidsDestroyedThisRun += 1;
    renderAnswers();
    playLaserSound();
    return;
  }

  cooldown = true;
  laserBeams.push({ x: getGunX(), y: 0 });
  renderAnswers();
  playLaserMissSound();
  setTimeout(() => {
    cooldown = false;
    laserBeams = [];
    renderAnswers();
  }, 1000);
}

function playLaserSound() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);

  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

  oscillator.connect(gain);
  gain.connect(audioCtx.destination);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.2);
}

function playLaserMissSound() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.75);

  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.75);

  oscillator.connect(gain);
  gain.connect(audioCtx.destination);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.75);
}

function playBuildingCollapseSound() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const now = audioCtx.currentTime;
  const duration = 2;
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(1000, now);
  noiseFilter.Q.value = 0.5;

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.5, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  const clang = audioCtx.createOscillator();
  clang.type = "triangle";
  clang.frequency.setValueAtTime(600, now);

  const clang2 = audioCtx.createOscillator();
  clang2.type = "triangle";
  clang2.frequency.setValueAtTime(605, now);

  const clangGain = audioCtx.createGain();
  clangGain.gain.setValueAtTime(0.8, now);
  clangGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(noiseFilter).connect(noiseGain).connect(audioCtx.destination);
  clang.connect(clangGain).connect(audioCtx.destination);
  clang2.connect(clangGain);

  noise.start();
  clang.start();
  clang2.start();
  noise.stop(now + duration);
  clang.stop(now + duration);
  clang2.stop(now + duration);
}

function playVictorySong() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const now = audioCtx.currentTime;
  const melody = [
    { note: 523.25, duration: 0.3 },
    { note: 659.25, duration: 0.3 },
    { note: 783.99, duration: 0.3 },
    { note: 1046.5, duration: 0.3 },
    { note: 880, duration: 0.3 },
    { note: 987.77, duration: 0.3 },
    { note: 1046.5, duration: 0.6 }
  ];

  let time = now;
  melody.forEach(({ note, duration }) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(note, time);

    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain).connect(audioCtx.destination);
    osc.start(time);
    osc.stop(time + duration);
    time += duration;
  });
}

function playDefeatSong() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const now = audioCtx.currentTime;
  const melody = [
    { note: 880, duration: 0.3 },
    { note: 783.99, duration: 0.3 },
    { note: 698.46, duration: 0.3 },
    { note: 659.25, duration: 0.3 },
    { note: 440, duration: 0.6 }
  ];

  let time = now;
  melody.forEach(({ note, duration }) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(note, time);

    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain).connect(audioCtx.destination);
    osc.start(time);
    osc.stop(time + duration);
    time += duration;
  });
}

function updateGame(timestamp) {
  if (gameState !== "playing") {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = asteroids.length - 1; i >= 0; i -= 1) {
    const asteroid = asteroids[i];
    asteroid.update();

    if (!asteroid.destroyed && asteroid.y > canvas.height) {
      playBuildingCollapseSound();
      buildings -= 1;
      asteroids.splice(i, 1);
      updateHud();
      continue;
    }

    if (asteroid.destroyed && !asteroid.lit) {
      asteroids.splice(i, 1);
      updateLasers();
    }
  }

  drawBuildings();
  drawGun();
  drawLasers();
  updateHud();

  if (buildings <= 0) {
    playDefeatSong();
    maybeAddHallOfFameEntry(round - 1);
    endRound(
      "Game Over",
      `You reached round ${Math.max(1, round)} on level ${selectedLevel}. Head back to setup to try again.`,
      "Back to setup",
      showSetupScreen,
      { secondaryLabel: "Hall of Fame", secondaryAction: openHallOfFame }
    );
    return;
  }

  if (asteroidsComing + asteroids.length <= 0) {
    playVictorySong();
    if (round >= selectedRoundCount) {
      maybeAddHallOfFameEntry(selectedRoundCount);
      endRound(
        "Mission Complete",
        `${getFinalVictoryMessage()} You finished all ${selectedRoundCount} rounds on level ${selectedLevel}.`,
        "Back to setup",
        showSetupScreen,
        { secondaryLabel: "Hall of Fame", secondaryAction: openHallOfFame }
      );
    } else {
      endRound(
        "Round Cleared",
        `${getEncouragingMessage()} Round ${round} of ${selectedRoundCount} is complete.`,
        "Next round",
        startNextRound
      );
    }
    return;
  }

  if (timestamp - lastAsteroidTime > roundSpawnInterval && asteroids.length < config.maxAsteroids && asteroidsComing > 0) {
    spawnAsteroid();
    lastAsteroidTime = timestamp;
  }

  animation = requestAnimationFrame(updateGame);
}

function resumeFromPause() {
  paused = false;
  gameState = "playing";
  hideOverlay();
  pauseBtn.textContent = "Pause";
  lastAsteroidTime = performance.now();
  renderAnswers();
  animation = requestAnimationFrame(updateGame);
}

pauseBtn.onclick = () => {
  if (gameState !== "playing" && gameState !== "paused") {
    return;
  }

  if (gameState === "playing") {
    paused = true;
    gameState = "paused";
    if (animation) {
      cancelAnimationFrame(animation);
      animation = null;
    }
    setOverlay("Paused", "Game paused.", "Resume", resumeFromPause);
    pauseBtn.textContent = "Resume";
    renderAnswers();
    return;
  }

  resumeFromPause();
};

window.addEventListener("resize", () => {
  resizeCanvas();
  if (gameState !== "playing" && gameState !== "paused") {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
});

renderAnswers();
resizeCanvas();
updateHud();
initializeSetupControls();
showSetupScreen();
