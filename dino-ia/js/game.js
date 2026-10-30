const GROUND_Y = 220;
const GRAVITY = 2200;
const JUMP_V = -620;
const START_SPEED = 320;
const obstacleMix = { cactus: 72, bird: 28 };

function setObstacleMix(cactusPercent, birdPercent) {
  const cactus = Math.max(0, Number(cactusPercent) || 0);
  const bird = Math.max(0, Number(birdPercent) || 0);
  const total = cactus + bird;
  obstacleMix.cactus = total === 0 ? 100 : (cactus / total) * 100;
  obstacleMix.bird = total === 0 ? 0 : (bird / total) * 100;
}

class Dino {
  constructor(brain = null) {
    this.brain = brain;
    this.reset();
  }

  reset() {
    this.x = 70;
    this.y = GROUND_Y;
    this.vy = 0;
    this.w = 44;
    this.h = 46;
    this.ducking = false;
    this.alive = true;
    this.fitness = 0;
    this.jumps = 0;
  }

  get hitbox() {
    if (this.ducking && this.y >= GROUND_Y) {
      return { x: this.x + 4, y: this.y + 20, w: 52, h: 26 };
    }
    return { x: this.x + 8, y: this.y + 4, w: 28, h: this.h - 6 };
  }

  jump() {
    if (this.y >= GROUND_Y) {
      this.vy = JUMP_V;
      this.ducking = false;
      this.jumps += 1;
    }
  }

  duck(on) {
    this.ducking = on && this.y >= GROUND_Y;
  }

  update(dt) {
    this.vy += GRAVITY * dt;
    this.y += this.vy * dt;
    if (this.y >= GROUND_Y) {
      this.y = GROUND_Y;
      this.vy = 0;
    }
  }
}

function makeObstacle(speed, score) {
  const birdChance = obstacleMix.bird / (obstacleMix.cactus + obstacleMix.bird);
  if (Math.random() < birdChance) {
    const lanes = [GROUND_Y - 8, GROUND_Y - 48, GROUND_Y - 88];
    const y = lanes[(Math.random() * lanes.length) | 0];
    return { type: "bird", x: 860, y, w: 46, h: 28, passed: false };
  }
  const tall = Math.random() < 0.35;
  const count = Math.random() < 0.25 && score > 120 ? 2 : 1;
  const h = tall ? 52 : 34;
  const w = 18 * count + (count - 1) * 6;
  return { type: "cactus", x: 860, y: GROUND_Y + 46 - h, w, h, count, passed: false };
}

class World {
  constructor() {
    this.reset();
  }

  reset() {
    this.speed = START_SPEED;
    this.distance = 0;
    this.score = 0;
    this.time = 0;
    this.obstacles = [makeObstacle(this.speed, 0)];
    this.groundOffset = 0;
    this.clouds = [
      { x: 200, y: 48, s: 18 },
      { x: 520, y: 28, s: 28 },
      { x: 740, y: 62, s: 16 },
    ];
  }

  nextObstacle(fromX) {
    let best = null;
    for (const o of this.obstacles) {
      if (o.x + o.w > fromX && (!best || o.x < best.x)) best = o;
    }
    return best;
  }

  update(dt, dinos) {
    this.time += dt;
    this.speed = Math.min(720, START_SPEED + this.distance * 0.012);
    const move = this.speed * dt;
    this.distance += move;
    this.score = Math.floor(this.distance / 10);
    this.groundOffset = (this.groundOffset + move) % 24;

    for (const c of this.clouds) {
      c.x -= move * 0.25;
      if (c.x < -80) {
        c.x = 900 + Math.random() * 120;
        c.y = 24 + Math.random() * 50;
      }
    }

    const last = this.obstacles[this.obstacles.length - 1];
    const gap = 240 + Math.random() * 180 + this.speed * 0.12;
    if (!last || last.x < 800 - gap) {
      this.obstacles.push(makeObstacle(this.speed, this.score));
    }

    for (const o of this.obstacles) o.x -= move;
    this.obstacles = this.obstacles.filter((o) => o.x + o.w > -40);

    for (const dino of dinos) {
      if (!dino.alive) continue;
      dino.update(dt);
      const box = dino.hitbox;
      for (const o of this.obstacles) {
        if (rectsOverlap(box, o)) {
          dino.alive = false;
          dino.fitness = this.distance + dino.jumps * 8;
        } else if (!o.passed && o.x + o.w < dino.x) {
          o.passed = true;
        }
      }
      if (dino.alive) dino.fitness = this.distance + dino.jumps * 8;
    }
  }
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function sensors(dino, world) {
  const obs = world.nextObstacle(dino.x);
  const dist = obs ? (obs.x - dino.x) / 800 : 1;
  const h = obs ? obs.h / 80 : 0;
  const w = obs ? obs.w / 80 : 0;
  const air = obs && obs.type === "bird" ? 1 : 0;
  const y = (GROUND_Y - dino.y) / 120;
  const spd = world.speed / 720;
  return [
    clamp(dist, 0, 1),
    clamp(h, 0, 1),
    clamp(w, 0, 1),
    air,
    clamp(y, 0, 1),
    clamp(spd, 0, 1),
  ];
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function drawWorld(ctx, world, dinos, human, highlight) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f4f4f4";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#d7dde5";
  for (const c of world.clouds) {
    rounded(ctx, c.x, c.y, c.s * 2.2, c.s, 10);
    ctx.fill();
  }

  ctx.strokeStyle = "#535353";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 46);
  ctx.lineTo(w, GROUND_Y + 46);
  ctx.stroke();
  ctx.fillStyle = "#535353";
  for (let x = -world.groundOffset; x < w; x += 24) {
    ctx.fillRect(x, GROUND_Y + 50, 12, 2);
  }

  for (const o of world.obstacles) {
    ctx.fillStyle = "#3a3a3a";
    if (o.type === "cactus") {
      for (let i = 0; i < (o.count || 1); i++) {
        const x = o.x + i * 24;
        ctx.fillRect(x, o.y, 16, o.h);
        ctx.fillRect(x - 6, o.y + 12, 8, 8);
        ctx.fillRect(x + 14, o.y + 18, 8, 10);
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(o.x + 22, o.y + 14, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(o.x + 18, o.y - 4, 18, 8);
    }
  }

  const living = dinos.filter((d) => d.alive);
  living.forEach((dino) => {
    const isBest = dino === highlight;
    ctx.globalAlpha = isBest || living.length === 1 ? 1 : 0.22;
    drawDino(ctx, dino, isBest ? "#3a3a3a" : "#5aa7ff");
  });
  ctx.globalAlpha = 1;

  if (human && human.alive) drawDino(ctx, human, "#d95d39");

  ctx.fillStyle = "#3a3a3a";
  ctx.font = "16px ui-monospace, Consolas, monospace";
  ctx.textAlign = "right";
  ctx.fillText(String(world.score).padStart(5, "0"), w - 18, 28);
}

function drawDino(ctx, dino, color) {
  const duck = dino.ducking && dino.y >= GROUND_Y;
  ctx.fillStyle = color;
  if (duck) {
    ctx.fillRect(dino.x, dino.y + 20, 54, 26);
    ctx.fillRect(dino.x + 40, dino.y + 16, 16, 12);
  } else {
    ctx.fillRect(dino.x + 6, dino.y, 28, 40);
    ctx.fillRect(dino.x + 24, dino.y - 10, 18, 16);
    ctx.fillRect(dino.x + 8, dino.y + 38, 8, 10);
    ctx.fillRect(dino.x + 22, dino.y + 38, 8, 10);
    ctx.fillStyle = "#f4f4f4";
    ctx.fillRect(dino.x + 34, dino.y - 6, 4, 4);
  }
}

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

