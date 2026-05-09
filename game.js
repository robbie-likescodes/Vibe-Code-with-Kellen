const canvas = document.getElementById('gameCanvas');
const overlay = document.getElementById('overlay');

if (!canvas) {
  throw new Error('Missing #gameCanvas element');
}

const ctx = canvas.getContext('2d');
if (!ctx) {
  throw new Error('2D canvas context is unavailable');
}

const W = 960;
const H = 640;
canvas.width = W;
canvas.height = H;

const keys = new Set();
const stars = Array.from({ length: 160 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  r: Math.random() * 2 + 0.5,
  s: Math.random() * 0.5 + 0.3
}));

const planets = [
  { x: 740, y: 150, r: 110, hue: 38 },
  { x: 180, y: 110, r: 48, hue: 208 }
];

const game = {
  state: 'start',
  score: 0,
  best: Number(localStorage.getItem('space_dog_best') || 0),
  spawnTimer: 0,
  enemyTimer: 0
};

const dog = {
  x: 190,
  y: H - 150,
  w: 66,
  h: 44,
  vx: 0,
  vy: 0,
  grounded: true,
  tilt: 0,
  squash: 1,
  stretch: 1,
  wasGrounded: true,
  upHopCooldown: 0,
  chargeTime: 0,
  charging: false,
  shotCooldown: 0
};
const camera = { y: 0 };
const physics = {
  gravity: 1800,
  moveAccel: 2800,
  moveDecel: 1800,
  moveMaxSpeed: 360,
  airControl: 0.65,
  baseJump: -640,
  hopImpulse: -700,
  chargedJumpMin: -760,
  chargedJumpMax: -1260,
  chargeDurationMax: 1.2
};

let obstacles = [];
let enemies = [];
let lasers = [];
let particles = [];

function resetGame() {
  game.state = 'playing';
  game.score = 0;
  game.spawnTimer = 0.8;
  game.enemyTimer = 1.7;
  obstacles = [];
  enemies = [];
  lasers = [];
  particles = [];
  dog.x = 190;
  dog.y = H - 150;
  dog.vx = 0;
  dog.vy = 0;
  dog.grounded = true;
  dog.tilt = 0;
  dog.squash = 1;
  dog.stretch = 1;
  dog.wasGrounded = true;
  dog.chargeTime = 0;
  dog.charging = false;
  dog.upHopCooldown = 0;
  dog.shotCooldown = 0;
  camera.y = 0;
}

function hopUp() {
  if (game.state !== 'playing') return;
  if (dog.upHopCooldown > 0) return;
  dog.vy = physics.hopImpulse;
  dog.grounded = false;
  dog.upHopCooldown = 0.12;
  spawnJumpTrail(10, '#8cf9ff');
}

function beginCharge() {
  if (game.state !== 'playing') return;
  dog.charging = true;
  dog.chargeTime = 0;
}

function releaseCharge() {
  if (game.state !== 'playing' || !dog.charging) return;
  dog.charging = false;
  const t = Math.min(1, dog.chargeTime / physics.chargeDurationMax);
  const launch = physics.chargedJumpMin + (physics.chargedJumpMax - physics.chargedJumpMin) * t;
  dog.vy = Math.min(dog.vy, launch);
  dog.grounded = false;
  dog.stretch = 1.18;
  spawnJumpTrail(20 + Math.floor(24 * t), '#7ef3ff');
  for (let i = 0; i < 8 + t * 14; i++) {
    particles.push({
      x: dog.x + dog.w / 2,
      y: dog.y + dog.h * 0.95,
      vx: (Math.random() - 0.5) * (200 + t * 220),
      vy: -120 - Math.random() * 280 - t * 180,
      life: 0.3 + Math.random() * 0.25,
      c: '#6cf6ff'
    });
  }
}

function spawnJumpTrail(count, color) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: dog.x + 16 + Math.random() * 30,
      y: dog.y + dog.h - 2 + Math.random() * 10,
      vx: (Math.random() - 0.5) * 150,
      vy: -80 - Math.random() * 180,
      life: 0.22 + Math.random() * 0.25,
      c: color
    });
  }
}

function shoot() {
  if (game.state !== 'playing' || dog.shotCooldown > 0) return;
  lasers.push({ x: dog.x + dog.w * 0.7, y: dog.y + 8, vx: 820, life: 1.1 });
  dog.shotCooldown = 0.22;
}

function addObstacle() {
  const tall = Math.random() < 0.4;
  obstacles.push({
    x: W + 30,
    y: H - (tall ? 185 : 145),
    w: tall ? 48 : 62,
    h: tall ? 125 : 85,
    speed: 290 + Math.random() * 130,
    ring: Math.random() < 0.6
  });
}

function addEnemy() {
  enemies.push({
    x: W + 30,
    y: 180 + Math.random() * 260,
    r: 20,
    vx: 200 + Math.random() * 120,
    phase: Math.random() * Math.PI * 2,
    hp: 2
  });
}

function hit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function kill() {
  game.state = 'gameover';
  game.best = Math.max(game.best, Math.floor(game.score));
  localStorage.setItem('space_dog_best', String(game.best));
  for (let i = 0; i < 30; i++) {
    particles.push({
      x: dog.x + dog.w / 2,
      y: dog.y + dog.h / 2,
      vx: (Math.random() - 0.5) * 380,
      vy: (Math.random() - 0.5) * 380,
      life: 0.9,
      c: i % 2 ? '#7fffd4' : '#ff5ca8'
    });
  }
}

function update(dt) {
  stars.forEach((s) => {
    s.x -= s.s * 40 * dt;
    if (s.x < -2) s.x = W + 2;
  });

  particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 420 * dt;
    p.life -= dt;
  });
  particles = particles.filter((p) => p.life > 0);

  if (game.state !== 'playing') return;

  game.score += dt * 18;
  dog.shotCooldown = Math.max(0, dog.shotCooldown - dt);
  dog.upHopCooldown = Math.max(0, dog.upHopCooldown - dt);

  const movingLeft = keys.has('a') || keys.has('arrowleft');
  const movingRight = keys.has('d') || keys.has('arrowright');
  let targetDir = 0;
  if (movingLeft) targetDir -= 1;
  if (movingRight) targetDir += 1;
  const accel = physics.moveAccel * (dog.grounded ? 1 : physics.airControl);
  const decel = physics.moveDecel * (dog.grounded ? 1 : 0.55);
  if (targetDir !== 0) {
    dog.vx += targetDir * accel * dt;
  } else if (Math.abs(dog.vx) < decel * dt) {
    dog.vx = 0;
  } else {
    dog.vx -= Math.sign(dog.vx) * decel * dt;
  }
  dog.vx = Math.max(-physics.moveMaxSpeed, Math.min(physics.moveMaxSpeed, dog.vx));
  dog.x = Math.max(40, Math.min(W - 120, dog.x + dog.vx * dt));
  dog.tilt += (((dog.vx / physics.moveMaxSpeed) * 0.22) - dog.tilt) * Math.min(1, dt * 12);

  if (dog.charging) {
    dog.chargeTime = Math.min(physics.chargeDurationMax, dog.chargeTime + dt);
    if (Math.random() < 0.45) {
      particles.push({
        x: dog.x + dog.w / 2 + (Math.random() - 0.5) * 24,
        y: dog.y + dog.h + 4,
        vx: (Math.random() - 0.5) * 70,
        vy: -120 - Math.random() * 80,
        life: 0.14 + Math.random() * 0.2,
        c: '#92f4ff'
      });
    }
  }

  dog.vy += physics.gravity * dt;
  dog.y += dog.vy * dt;
  const groundY = H - 150;
  if (dog.y >= groundY) {
    dog.y = groundY;
    if (!dog.wasGrounded) {
      const impact = Math.min(1, Math.abs(dog.vy) / 1100);
      dog.vy = -100 * impact;
      dog.squash = 1 + 0.28 * impact;
      dog.stretch = 1 - 0.14 * impact;
      for (let i = 0; i < 8 + impact * 18; i++) {
        particles.push({
          x: dog.x + dog.w / 2,
          y: groundY + dog.h,
          vx: (Math.random() - 0.5) * (220 + impact * 200),
          vy: -40 - Math.random() * 120,
          life: 0.2 + Math.random() * 0.2,
          c: '#ffe08a'
        });
      }
    } else {
      dog.vy = 0;
    }
    dog.grounded = true;
  } else {
    dog.grounded = false;
  }
  dog.wasGrounded = dog.grounded;
  dog.squash += (1 - dog.squash) * Math.min(1, dt * 10);
  dog.stretch += (1 - dog.stretch) * Math.min(1, dt * 10);
  const targetCamY = Math.max(-2400, Math.min(0, (H * 0.58) - (dog.y + dog.h * 0.5)));
  camera.y += (targetCamY - camera.y) * Math.min(1, dt * 5);

  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    addObstacle();
    game.spawnTimer = 0.85 + Math.random() * 1.1;
  }

  game.enemyTimer -= dt;
  if (game.enemyTimer <= 0) {
    addEnemy();
    game.enemyTimer = 1.1 + Math.random() * 1.4;
  }

  obstacles.forEach((o) => (o.x -= o.speed * dt));
  enemies.forEach((e, i) => {
    e.x -= e.vx * dt;
    e.y += Math.sin(performance.now() * 0.003 + e.phase + i) * 0.8;
  });

  lasers.forEach((l) => {
    l.x += l.vx * dt;
    l.life -= dt;
  });

  for (const l of lasers) {
    for (const e of enemies) {
      if (Math.hypot(l.x - e.x, l.y - e.y) < e.r + 8) {
        l.life = 0;
        e.hp -= 1;
        particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 220, life: 0.4, c: '#79f7ff' });
      }
    }
  }

  enemies = enemies.filter((e) => {
    if (e.hp <= 0) {
      game.score += 12;
      return false;
    }
    return e.x > -80;
  });
  obstacles = obstacles.filter((o) => o.x > -100);
  lasers = lasers.filter((l) => l.life > 0 && l.x < W + 100);

  const dogBox = { x: dog.x + 10, y: dog.y + 4, w: dog.w - 16, h: dog.h - 8 };
  for (const o of obstacles) if (hit(dogBox, o)) kill();
  for (const e of enemies) if (Math.hypot(dog.x + dog.w / 2 - e.x, dog.y + dog.h / 2 - e.y) < e.r + 20) kill();
}

function drawSaturnSky() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#02040b');
  grad.addColorStop(0.45, '#07172c');
  grad.addColorStop(1, '#010204');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#756b61';
  ctx.beginPath();
  ctx.arc(planets[0].x, planets[0].y, planets[0].r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(157,173,188,0.3)';
  ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.ellipse(planets[0].x, planets[0].y, 210, 62, -0.2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(196,211,230,0.42)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.ellipse(planets[0].x, planets[0].y, 182, 50, -0.2, 0, Math.PI * 2);
  ctx.stroke();

  const coldPlanet = ctx.createRadialGradient(planets[1].x - 14, planets[1].y - 20, 8, planets[1].x, planets[1].y, planets[1].r);
  coldPlanet.addColorStop(0, '#b0cee9');
  coldPlanet.addColorStop(1, '#36516d');
  ctx.fillStyle = coldPlanet;
  ctx.beginPath();
  ctx.arc(planets[1].x, planets[1].y, planets[1].r, 0, Math.PI * 2);
  ctx.fill();

  stars.forEach((s) => {
    ctx.shadowColor = 'rgba(220,238,255,0.9)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#f3f7ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

function drawDog() {
  const x = dog.x;
  const y = dog.y;
  const cx = x + dog.w / 2;
  const cy = y + dog.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dog.tilt);
  ctx.scale(dog.stretch, dog.squash);
  ctx.translate(-dog.w / 2, -dog.h / 2);
  const shell = ctx.createLinearGradient(0, 0, dog.w, dog.h);
  shell.addColorStop(0, '#8d98a7');
  shell.addColorStop(0.55, '#535e6f');
  shell.addColorStop(1, '#2c323d');
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.roundRect(6, 8, 46, 24, 8);
  ctx.fill();
  ctx.fillStyle = '#b7c0ca';
  ctx.beginPath();
  ctx.roundRect(44, 12, 18, 16, 7);
  ctx.fill();
  ctx.fillStyle = '#79e7ff';
  ctx.beginPath();
  ctx.ellipse(53, 20, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3b434f';
  ctx.fillRect(12, 30, 9, 12);
  ctx.fillRect(34, 30, 9, 12);
  ctx.fillStyle = '#d6a75d';
  ctx.fillRect(4, 15, 4, 7);
  ctx.restore();
}

function draw() {
  drawSaturnSky();
  ctx.save();
  ctx.translate(0, camera.y);

  ctx.fillStyle = 'rgba(88,146,255,0.2)';
  for (let i = 0; i < 8; i++) {
    const y = H - 75 - i * 20;
    ctx.fillRect(0, y, W, 6);
  }

  obstacles.forEach((o) => {
    const meteor = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y + o.h);
    meteor.addColorStop(0, '#8e8479');
    meteor.addColorStop(1, '#4d433a');
    ctx.fillStyle = meteor;
    ctx.beginPath();
    ctx.roundRect(o.x, o.y, o.w, o.h, 13);
    ctx.fill();
    ctx.strokeStyle = 'rgba(233,220,208,0.45)';
    ctx.stroke();
    if (o.ring) {
      ctx.strokeStyle = 'rgba(161,201,229,0.6)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(o.x + o.w / 2, o.y + 14, o.w * 0.88, 9, -0.25, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  enemies.forEach((e) => {
    ctx.shadowColor = 'rgba(91, 208, 255, 0.8)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#5f6d7c';
    ctx.fillRect(e.x - e.r, e.y - 8, e.r * 2, 16);
    ctx.fillStyle = '#91a8ba';
    ctx.fillRect(e.x - 7, e.y - e.r, 14, e.r * 2);
    ctx.fillStyle = '#9ef0ff';
    ctx.fillRect(e.x - 5, e.y - 2, 10, 4);
    ctx.shadowBlur = 0;
  });

  lasers.forEach((l) => {
    ctx.shadowColor = '#74f5ff';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#74f5ff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(l.x - 24, l.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  });

  particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.c;
    ctx.fillRect(p.x, p.y, 3, 3);
    ctx.globalAlpha = 1;
  });

  drawDog();
  if (dog.charging) {
    const chargeRatio = Math.min(1, dog.chargeTime / physics.chargeDurationMax);
    ctx.strokeStyle = `rgba(108,246,255,${0.55 + chargeRatio * 0.4})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(dog.x + dog.w / 2, dog.y + dog.h + 14, 8 + chargeRatio * 26, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(3, 13, 33, 0.72)';
  ctx.fillRect(14, 12, 210, 60);
  ctx.strokeStyle = 'rgba(111, 242, 255, 0.85)';
  ctx.strokeRect(14, 12, 210, 60);
  ctx.fillStyle = '#e9f7ff';
  ctx.font = 'bold 21px Inter, sans-serif';
  ctx.fillText(`Score: ${Math.floor(game.score)}`, 24, 36);
  ctx.font = '18px Inter, sans-serif';
  ctx.fillText(`Best: ${Math.floor(game.best)}`, 24, 60);
  ctx.font = '15px Inter, sans-serif';
  ctx.fillText('Move: A/D or ←/→  Hop: W/↑  Charged Jump: Hold+Release Space  Shoot: J', 20, H - 20);

  if (game.state === 'start') {
    overlay.innerHTML = '<div class="panel"><h1>Orbital Junkyard K9</h1><p>Dash through hyper-real debris fields, ruined satellites, and meteor junk.</p><p><strong>Press Enter to begin</strong></p></div>';
  } else if (game.state === 'gameover') {
    overlay.innerHTML = `<div class="panel"><h1>Mission Failed</h1><p>Score: ${Math.floor(game.score)}</p><p>Best: ${Math.floor(game.best)}</p><p><strong>Press Enter to restart</strong></p></div>`;
  } else {
    overlay.innerHTML = '';
  }
}

let last = performance.now();
function loop(t) {
  const dt = Math.min(0.033, (t - last) / 1000);
  last = t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === 'enter') {
    resetGame();
    return;
  }
  if (k === 'j') shoot();
  if (k === ' ' || k === 'spacebar') {
    e.preventDefault();
    if (!e.repeat) beginCharge();
  }
  if ((k === 'w' || k === 'arrowup') && !e.repeat) hopUp();
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  keys.delete(k);
  if (k === ' ' || k === 'spacebar') releaseCharge();
});

requestAnimationFrame(loop);
