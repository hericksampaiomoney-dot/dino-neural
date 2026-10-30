const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const brainCanvas = document.getElementById("brain");
const brainCtx = brainCanvas.getContext("2d");
const fitnessCanvas = document.getElementById("fitness-chart");
const fitnessCtx = fitnessCanvas.getContext("2d");

const el = {
  gen: document.getElementById("stat-gen"),
  alive: document.getElementById("stat-alive"),
  best: document.getElementById("stat-best"),
  score: document.getElementById("stat-score"),
  speed: document.getElementById("speed"),
  speedValue: document.getElementById("speed-value"),
  cactusShare: document.getElementById("cactus-share"),
  cactusValue: document.getElementById("cactus-value"),
  birdShare: document.getElementById("bird-share"),
  birdValue: document.getElementById("bird-value"),
  autoObstacleMix: document.getElementById("auto-obstacle-mix"),
  mode: document.getElementById("mode"),
};

const SAVE_KEY = "dino-ia-best-brain";
const HISTORY_KEY = "dino-ia-fitness-history";

const state = {
  mode: "train",
  world: new World(),
  population: newPopulation(),
  generation: 1,
  bestEver: 0,
  bestBrain: null,
  human: new Dino(),
  keys: { jump: false, duck: false },
  last: 0,
  timeAccumulator: 0,
  history: [],
};

loadBest();
loadHistory();

function loadBest() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    state.bestBrain = NeuralNet.fromJSON(JSON.parse(raw));
  } catch {
    state.bestBrain = null;
  }
}

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    if (Array.isArray(saved)) {
      state.history = saved.filter((entry) =>
        Number.isFinite(entry.generation) && Number.isFinite(entry.fitness) && Number.isFinite(entry.record)
      ).slice(-120);
      if (state.history.length) {
        const latest = state.history[state.history.length - 1];
        state.generation = latest.generation + 1;
        state.bestEver = Math.max(state.bestEver, latest.record);
      }
    }
  } catch {
    state.history = [];
  }
}

function recordGeneration(fitness) {
  const previousRecord = state.history.length ? state.history[state.history.length - 1].record : 0;
  state.history.push({
    generation: state.generation,
    fitness,
    record: Math.max(previousRecord, state.bestEver, fitness),
  });
  state.history = state.history.slice(-120);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history)); } catch { /* The chart still works for this session. */ }
}

function clearHistory() {
  state.history = [];
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* History is optional. */ }
}

function saveBest(brain, fitness) {
  if (fitness < state.bestEver) return;
  state.bestEver = fitness;
  state.bestBrain = brain.clone();
  localStorage.setItem(SAVE_KEY, JSON.stringify(brain.toJSON()));
}

function startTrain() {
  state.mode = "train";
  state.timeAccumulator = 0;
  el.mode.textContent = "Treino (evolução)";
  state.world.reset();
  for (const d of state.population) d.reset();
}

function startHuman() {
  state.mode = "human";
  el.mode.textContent = "Você joga";
  state.world.reset();
  state.human = new Dino();
}

function startChampion() {
  state.mode = "champ";
  el.mode.textContent = "Melhor rede";
  state.world.reset();
  const brain = state.bestBrain || state.population[0].brain;
  state.population = [new Dino(brain.clone())];
}

document.getElementById("btn-train").onclick = startTrain;
document.getElementById("btn-play").onclick = startHuman;
document.getElementById("btn-champ").onclick = startChampion;
document.getElementById("btn-reset").onclick = () => {
  localStorage.removeItem(SAVE_KEY);
  clearHistory();
  state.bestEver = 0;
  state.bestBrain = null;
  state.generation = 1;
  state.population = newPopulation();
  startTrain();
};

function updateSpeedLabel() {
  const speed = Number(el.speed.value);
  el.speedValue.value = `${speed.toString().replace(".", ",")}x`;
}

function updateObstacleControls(source) {
  if (source === "cactus") el.birdShare.value = String(100 - Number(el.cactusShare.value));
  else el.cactusShare.value = String(100 - Number(el.birdShare.value));
  el.cactusValue.value = `${el.cactusShare.value}%`;
  el.birdValue.value = `${el.birdShare.value}%`;
  setObstacleMix(el.cactusShare.value, el.birdShare.value);
}

el.speed.addEventListener("input", updateSpeedLabel);
el.cactusShare.addEventListener("input", () => updateObstacleControls("cactus"));
el.birdShare.addEventListener("input", () => updateObstacleControls("bird"));
updateSpeedLabel();
updateObstacleControls("cactus");

function randomizeObstacleMix() {
  const previous = Number(el.cactusShare.value);
  let cactusShare = 20 + Math.floor(Math.random() * 61);
  if (cactusShare === previous) cactusShare = cactusShare === 80 ? 79 : cactusShare + 1;
  el.cactusShare.value = String(cactusShare);
  updateObstacleControls("cactus");
}

const modelStatus = document.getElementById("model-status");
const networkFile = document.getElementById("network-file");

function setModelStatus(message, isError = false) {
  modelStatus.textContent = message;
  modelStatus.style.color = isError ? "#ff9b91" : "#82949e";
}

const gameViewport = document.getElementById("game-viewport");
const enterFullscreenButton = document.getElementById("btn-fullscreen");
const exitFullscreenButton = document.getElementById("btn-exit-fullscreen");

function syncFullscreenButtons() {
  const isFullscreen = document.fullscreenElement === gameViewport;
  enterFullscreenButton.hidden = isFullscreen;
  exitFullscreenButton.hidden = !isFullscreen;
}

enterFullscreenButton.onclick = async () => {
  try {
    if (!gameViewport.requestFullscreen) throw new Error("Tela cheia não está disponível neste navegador.");
    await gameViewport.requestFullscreen();
  } catch (error) {
    setModelStatus(error.message || "Não foi possível expandir a simulação.", true);
  }
};
exitFullscreenButton.onclick = async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
};
document.addEventListener("fullscreenchange", syncFullscreenButtons);
syncFullscreenButtons();

function currentBestBrain() {
  const individual = bestIndividual();
  if (state.bestBrain && (!individual || state.bestEver >= individual.fitness)) return state.bestBrain;
  return individual?.brain || state.bestBrain || null;
}

function exportNetwork() {
  const brain = currentBestBrain();
  if (!brain) {
    setModelStatus("Ainda não há uma rede para salvar.", true);
    return;
  }
  const fileData = {
    format: "dino-ia-network",
    version: 1,
    createdAt: new Date().toISOString(),
    architecture: brain.sizes,
    fitness: state.bestEver,
    network: brain.toJSON(),
  };
  const blob = new Blob([JSON.stringify(fileData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dino-ia-rede-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setModelStatus("Rede exportada em JSON. Você pode importá-la em outra cópia do projeto.");
}

function parseNetworkFile(fileData) {
  if (!fileData || typeof fileData !== "object") {
    throw new Error("O JSON precisa conter os dados de uma rede.");
  }
  if (fileData.format && fileData.format !== "dino-ia-network") {
    throw new Error("Este arquivo não foi exportado pelo Dino IA.");
  }
  const data = fileData.network || fileData.brain || fileData;
  if (!Array.isArray(data.sizes) || JSON.stringify(data.sizes) !== JSON.stringify(NET_SIZES)) {
    throw new Error(`A arquitetura precisa ser ${NET_SIZES.join("–")} (entradas–ocultos–saídas).`);
  }
  if (!Array.isArray(data.weights) || data.weights.length !== data.sizes.length - 1) {
    throw new Error("O arquivo não contém todos os pesos da rede.");
  }
  for (let layer = 0; layer < data.weights.length; layer++) {
    const expectedLength = data.sizes[layer + 1] * (data.sizes[layer] + 1);
    if (!Array.isArray(data.weights[layer]) || data.weights[layer].length !== expectedLength ||
        !data.weights[layer].every((weight) => typeof weight === "number" && Number.isFinite(weight))) {
      throw new Error(`Os pesos da camada ${layer + 1} estão incompletos ou inválidos.`);
    }
  }
  return NeuralNet.fromJSON(data);
}

document.getElementById("btn-save-network").onclick = exportNetwork;
document.getElementById("btn-load-network").onclick = () => networkFile.click();
networkFile.addEventListener("change", async () => {
  const file = networkFile.files?.[0];
  if (!file) return;
  try {
    const brain = parseNetworkFile(JSON.parse(await file.text()));
    state.bestBrain = brain.clone();
    state.bestEver = 0;
    state.generation = 1;
    clearHistory();
    state.population = newPopulation(brain);
    startTrain();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(brain.toJSON())); } catch { /* File import still works if storage is unavailable. */ }
    setModelStatus("Rede carregada. Uma nova espécie começou com a rede original e cópias mutantes.");
  } catch (error) {
    setModelStatus(error instanceof SyntaxError ? "Não foi possível ler o JSON. Confira se o arquivo está íntegro." : error.message, true);
  } finally {
    networkFile.value = "";
  }
});

window.addEventListener("keydown", (e) => {
  if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
  if (e.code === "Space" || e.code === "ArrowUp") state.keys.jump = true;
  if (e.code === "ArrowDown") state.keys.duck = true;
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") state.keys.jump = false;
  if (e.code === "ArrowDown") state.keys.duck = false;
});

function actWithBrain(dino) {
  if (!dino.alive) return;
  const action = dino.brain.decide(sensors(dino, state.world));
  dino.duck(action === "duck");
  if (action === "jump") dino.jump();
}

function step(dt) {
  if (state.mode === "human") {
    if (!state.human.alive && state.keys.jump) {
      state.world.reset();
      state.human.reset();
    }
    state.human.duck(state.keys.duck);
    if (state.keys.jump) state.human.jump();
    if (state.human.alive) {
      state.world.update(dt, [state.human]);
    }
  } else {
    for (const dino of state.population) actWithBrain(dino);
    state.world.update(dt, state.population);
    const living = state.population.filter((d) => d.alive);
    if (living.length === 0) {
      const { population, best } = nextGeneration(state.population);
      saveBest(best.brain, best.fitness);
      state.bestEver = Math.max(state.bestEver, best.fitness);
      recordGeneration(best.fitness);
      state.population = population;
      state.generation += 1;
      if (el.autoObstacleMix.checked) randomizeObstacleMix();
      state.world.reset();
      if (state.mode === "champ") startChampion();
    }
  }
}

const INPUT_LABELS = ["Distância", "Altura obs.", "Largura obs.", "É pássaro?", "Dino no ar", "Velocidade"];
const OUTPUT_LABELS = ["PULAR", "AGACHAR"];

function fitCanvasToPanel(canvas, context) {
  const bounds = canvas.getBoundingClientRect?.();
  const width = bounds?.width || canvas.clientWidth || canvas.width;
  const height = bounds?.height || canvas.clientHeight || canvas.height;
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(width * scale));
  const pixelHeight = Math.max(1, Math.round(height * scale));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  context.setTransform?.(scale, 0, 0, scale, 0, 0);
  return { width, height };
}

function bestIndividual() {
  if (state.mode === "champ") return state.population[0] || null;
  let best = null;
  for (const dino of state.population) {
    if (!best || dino.fitness > best.fitness) best = dino;
  }
  return best;
}

function drawBrain(dino) {
  const { width: w, height: h } = fitCanvasToPanel(brainCanvas, brainCtx);
  brainCtx.fillStyle = "#101821";
  brainCtx.fillRect(0, 0, w, h);
  const brain = dino?.brain;
  if (!brain) return;

  const layers = brain.sizes;
  const inputs = sensors(dino, state.world);
  const acts = brain.activations(inputs);
  const decision = brain.decide(inputs);
  const inset = Math.max(145, Math.min(178, w * 0.17));
  const verticalInset = Math.min(78, Math.max(42, h * 0.24));
  const xs = layers.map((_, i) => inset + (i * (w - inset * 2)) / (layers.length - 1));
  const nodes = layers.map((n, li) =>
    Array.from({ length: n }, (_, i) => ({
      x: xs[li],
      y: verticalInset + (i * (h - verticalInset * 2)) / Math.max(1, n - 1),
    }))
  );

  const layerNames = ["SENSORES", ...layers.slice(1, -1).map((_, i) => `CAMADA OCULTA ${i + 1}`), "AÇÕES"];
  brainCtx.textAlign = "center";
  brainCtx.textBaseline = "middle";
  brainCtx.font = w < 620 ? "600 8px ui-monospace, Consolas, monospace" : "600 11px ui-monospace, Consolas, monospace";
  const headerHalf = Math.min(48, (xs[1] - xs[0]) * 0.38);
  for (let li = 0; li < nodes.length; li++) {
    brainCtx.fillStyle = li === 0 ? "#62d9b5" : li === nodes.length - 1 ? "#69c8ed" : "#91a2ac";
    brainCtx.fillText(layerNames[li], xs[li], 32);
    brainCtx.strokeStyle = "#293943";
    brainCtx.lineWidth = 1;
    brainCtx.beginPath();
    brainCtx.moveTo(xs[li] - headerHalf, 48);
    brainCtx.lineTo(xs[li] + headerHalf, 48);
    brainCtx.stroke();
  }

  for (let l = 0; l < brain.weights.length; l++) {
    const src = nodes[l];
    const dst = nodes[l + 1];
    const weights = brain.weights[l];
    const inSize = layers[l];
    for (let o = 0; o < dst.length; o++) {
      for (let i = 0; i < src.length; i++) {
        const val = weights[o * (inSize + 1) + i];
        const mag = Math.min(1, Math.abs(val));
        brainCtx.strokeStyle =
          val >= 0
            ? `rgba(85,225,178,${0.1 + mag * 0.68})`
            : `rgba(255,155,117,${0.1 + mag * 0.68})`;
        brainCtx.lineWidth = 0.55 + mag * 2.5;
        brainCtx.beginPath();
        brainCtx.moveTo(src[i].x, src[i].y);
        brainCtx.lineTo(dst[o].x, dst[o].y);
        brainCtx.stroke();
      }
    }
  }

  brainCtx.font = "11px ui-sans-serif, system-ui, sans-serif";
  brainCtx.textBaseline = "middle";
  for (let li = 0; li < nodes.length; li++) {
    for (let i = 0; i < nodes[li].length; i++) {
      const n = nodes[li][i];
      const v = acts[li] ? acts[li][i] : 0;
      const t = Math.max(0, Math.min(1, (v + 1) / 2));
      const radius = 7 + Math.min(2, Math.abs(v) * 2);
      const isInput = li === 0;
      const isOutput = li === nodes.length - 1;
      const color = isInput
        ? `rgb(${Math.round(18 + t * 18)},${Math.round(70 + t * 125)},${Math.round(68 + t * 76)})`
        : isOutput
          ? `rgb(${Math.round(24 + t * 24)},${Math.round(83 + t * 105)},${Math.round(118 + t * 91)})`
          : v < 0
            ? `rgb(${Math.round(112 + (1 - t) * 55)},${Math.round(70 + t * 25)},${Math.round(72 + t * 20)})`
            : `rgb(${Math.round(44 + t * 40)},${Math.round(68 + t * 125)},${Math.round(77 + t * 50)})`;
      brainCtx.beginPath();
      brainCtx.shadowColor = isInput ? "#45e0b2" : isOutput ? "#62c9ef" : v < 0 ? "#ff9b75" : "#64dfb6";
      brainCtx.shadowBlur = 2 + Math.abs(v) * 9;
      brainCtx.fillStyle = color;
      brainCtx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      brainCtx.fill();
      brainCtx.shadowBlur = 0;
      brainCtx.strokeStyle = isInput ? "#7de8c5" : isOutput ? "#91ddf6" : "#acbac2";
      brainCtx.lineWidth = 1.2;
      brainCtx.stroke();

      if (isOutput && ((decision === "jump" && i === 0) || (decision === "duck" && i === 1))) {
        brainCtx.beginPath();
        brainCtx.arc(n.x, n.y, radius + 5, 0, Math.PI * 2);
        brainCtx.strokeStyle = "#f4cf73";
        brainCtx.lineWidth = 1.5;
        brainCtx.stroke();
      }

      if (li === 0) {
        brainCtx.fillStyle = "#bcc9ce";
        brainCtx.textAlign = "right";
        brainCtx.fillText(`${INPUT_LABELS[i] || `Entrada ${i + 1}`}  ${v.toFixed(2)}`, n.x - 16, n.y);
      }
      if (isOutput) {
        brainCtx.fillStyle = "#dce9ed";
        brainCtx.textAlign = "left";
        const name = OUTPUT_LABELS[i] || `out${i}`;
        brainCtx.font = "700 11px ui-monospace, Consolas, monospace";
        brainCtx.fillText(`${name}  ${v.toFixed(2)}`, n.x + 17, n.y);
        brainCtx.font = "11px ui-sans-serif, system-ui, sans-serif";
      }
    }
  }

  const shape = document.getElementById("brain-shape");
  if (shape) shape.textContent = `${layers[0]} entradas · ${layers.slice(1, -1).join(" + ")} ocultos · ${layers[layers.length - 1]} saídas`;
  brainCtx.textAlign = "right";
  brainCtx.textBaseline = "middle";
  brainCtx.font = "600 10px ui-monospace, Consolas, monospace";
  brainCtx.fillStyle = "#f4cf73";
  brainCtx.fillText(`DECISÃO: ${decision === "jump" ? "PULAR" : decision === "duck" ? "AGACHAR" : "CORRER"}`, w - 24, h - 18);
}

function drawFitnessChart() {
  const { width: w, height: h } = fitCanvasToPanel(fitnessCanvas, fitnessCtx);
  const pad = { left: 58, right: 24, top: 18, bottom: 34 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  fitnessCtx.clearRect(0, 0, w, h);
  fitnessCtx.fillStyle = "#121a22";
  fitnessCtx.fillRect(0, 0, w, h);

  if (!state.history.length) {
    fitnessCtx.fillStyle = "#82949e";
    fitnessCtx.font = "14px ui-sans-serif, system-ui, sans-serif";
    fitnessCtx.textAlign = "center";
    fitnessCtx.textBaseline = "middle";
    fitnessCtx.fillText("O gráfico será preenchido ao concluir a primeira geração", w / 2, h / 2);
    document.getElementById("fitness-summary").textContent = "Aguardando primeira geração";
    return;
  }

  const largest = Math.max(1, ...state.history.map((entry) => Math.max(entry.fitness, entry.record)));
  const unit = 10 ** Math.floor(Math.log10(largest));
  const yMax = Math.ceil(largest / unit) * unit;
  const xAt = (index) => pad.left + (state.history.length < 2 ? plotW / 2 : (index / (state.history.length - 1)) * plotW);
  const yAt = (value) => pad.top + plotH - (value / yMax) * plotH;

  fitnessCtx.font = "11px ui-monospace, Consolas, monospace";
  fitnessCtx.textAlign = "right";
  fitnessCtx.textBaseline = "middle";
  for (let tick = 0; tick <= 4; tick++) {
    const value = (yMax * tick) / 4;
    const y = yAt(value);
    fitnessCtx.strokeStyle = "#293742";
    fitnessCtx.lineWidth = 1;
    fitnessCtx.beginPath();
    fitnessCtx.moveTo(pad.left, y);
    fitnessCtx.lineTo(w - pad.right, y);
    fitnessCtx.stroke();
    fitnessCtx.fillStyle = "#81939d";
    fitnessCtx.fillText(String(Math.round(value)), pad.left - 9, y);
  }

  const drawLine = (key, color, width) => {
    fitnessCtx.beginPath();
    fitnessCtx.strokeStyle = color;
    fitnessCtx.lineWidth = width;
    state.history.forEach((entry, index) => {
      const x = xAt(index);
      const y = yAt(entry[key]);
      if (index === 0) fitnessCtx.moveTo(x, y);
      else fitnessCtx.lineTo(x, y);
    });
    fitnessCtx.stroke();
    const last = state.history[state.history.length - 1];
    fitnessCtx.beginPath();
    fitnessCtx.fillStyle = color;
    fitnessCtx.arc(xAt(state.history.length - 1), yAt(last[key]), 4, 0, Math.PI * 2);
    fitnessCtx.fill();
  };
  drawLine("record", "#7cffb2", 2.5);
  drawLine("fitness", "#6dcfff", 1.7);

  fitnessCtx.fillStyle = "#81939d";
  fitnessCtx.textAlign = "left";
  fitnessCtx.textBaseline = "top";
  fitnessCtx.fillText(`G${state.history[0].generation}`, pad.left, h - pad.bottom + 9);
  fitnessCtx.textAlign = "right";
  fitnessCtx.fillText(`G${state.history[state.history.length - 1].generation}`, w - pad.right, h - pad.bottom + 9);
  document.getElementById("fitness-summary").textContent = `${state.history.length} gerações · recorde ${Math.floor(state.bestEver)}`;
}

function frame(t) {
  const dt = Math.min(0.033, (t - state.last) / 1000 || 0.016);
  state.last = t;
  state.timeAccumulator += Number(el.speed.value);
  const steps = Math.floor(state.timeAccumulator);
  state.timeAccumulator -= steps;
  for (let i = 0; i < steps; i++) step(dt);

  const best = bestIndividual();
  const actors =
    state.mode === "human" ? [] : state.population.filter((d) => d.alive);
  drawWorld(
    ctx,
    state.world,
    actors,
    state.mode === "human" ? state.human : null,
    best
  );

  const alive =
    state.mode === "human"
      ? state.human.alive
        ? 1
        : 0
      : state.population.filter((d) => d.alive).length;
  el.gen.textContent = String(state.generation);
  el.alive.textContent = String(alive);
  el.best.textContent = String(Math.floor(state.bestEver));
  el.score.textContent = String(state.world.score);

  drawBrain(best);
  drawFitnessChart();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
