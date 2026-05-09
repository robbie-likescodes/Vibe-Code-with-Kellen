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
  vy: 0,
  grounded: true,
  jumpCount: 0,
  maxJumps: 2,
  shotCooldown: 0
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
  dog.vy = 0;
  dog.grounded = true;
  dog.jumpCount = 0;
  dog.shotCooldown = 0;
}

function jump() {
  if (game.state !== 'playing') return;
  if (dog.jumpCount >= dog.maxJumps) return;
  dog.vy = -620;
  dog.grounded = false;
  dog.jumpCount += 1;
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

  dog.vy += 1300 * dt;
  dog.y += dog.vy * dt;
  const groundY = H - 150;
  if (dog.y >= groundY) {
    dog.y = groundY;
    dog.vy = 0;
    dog.grounded = true;
    dog.jumpCount = 0;
  }

  if (keys.has('arrowup') || keys.has('w')) {
    // holding up gives tiny thrust feel
    dog.vy -= 180 * dt;
  }

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
  grad.addColorStop(0, '#120f2d');
  grad.addColorStop(0.5, '#0b1236');
  grad.addColorStop(1, '#04060f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#d9be7a';
  ctx.beginPath();
  ctx.arc(planets[0].x, planets[0].y, planets[0].r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,224,154,0.42)';
  ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.ellipse(planets[0].x, planets[0].y, 210, 62, -0.2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,240,193,0.65)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.ellipse(planets[0].x, planets[0].y, 182, 50, -0.2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#6bb8ff';
  ctx.beginPath();
  ctx.arc(planets[1].x, planets[1].y, planets[1].r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  stars.forEach((s) => ctx.fillRect(s.x, s.y, s.r, s.r));
}

function drawDog() {
  const x = dog.x;
  const y = dog.y;
  ctx.strokeStyle = 'rgba(125, 248, 255, 0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 6, y + 6, 56, 36);
  ctx.fillStyle = '#a9b7ff';
  ctx.fillRect(x + 8, y + 8, 44, 24);
  ctx.fillStyle = '#d6e2ff';
  ctx.fillRect(x + 43, y + 12, 18, 16);
  ctx.fillStyle = '#6cf6ff';
  ctx.fillRect(x + 49, y + 16, 8, 6);
  ctx.fillStyle = '#6b7ecf';
  ctx.fillRect(x + 12, y + 30, 8, 12);
  ctx.fillRect(x + 35, y + 30, 8, 12);
  ctx.fillStyle = '#92a3f0';
  ctx.fillRect(x + 4, y + 14, 6, 7);
}

function draw() {
  drawSaturnSky();

  ctx.fillStyle = 'rgba(88,146,255,0.2)';
  for (let i = 0; i < 8; i++) {
    const y = H - 75 - i * 20;
    ctx.fillRect(0, y, W, 6);
  }

  obstacles.forEach((o) => {
    ctx.fillStyle = '#8f8ca8';
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = '#dde4ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(o.x, o.y, o.w, o.h);
    if (o.ring) {
      ctx.strokeStyle = 'rgba(255,218,133,0.55)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(o.x + o.w / 2, o.y + 16, o.w * 0.85, 10, -0.25, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  enemies.forEach((e) => {
    ctx.shadowColor = 'rgba(255, 80, 170, 0.8)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ff4da6';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(e.x - 8, e.y - 3, 16, 6);
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

  ctx.fillStyle = 'rgba(3, 13, 33, 0.72)';
  ctx.fillRect(14, 12, 210, 60);
  ctx.strokeStyle = 'rgba(111, 242, 255, 0.85)';
  ctx.strokeRect(14, 12, 210, 60);
  ctx.fillStyle = '#e9f7ff';
  ctx.font = 'bold 21px monospace';
  ctx.fillText(`Score: ${Math.floor(game.score)}`, 24, 36);
  ctx.font = '18px monospace';
  ctx.fillText(`Best: ${Math.floor(game.best)}`, 24, 60);
  ctx.font = '15px monospace';
  ctx.fillStyle = 'rgba(2, 8, 26, 0.78)';
  ctx.fillRect(14, H - 42, 520, 28);
  ctx.strokeStyle = 'rgba(90, 180, 255, 0.6)';
  ctx.strokeRect(14, H - 42, 520, 28);
  ctx.fillStyle = '#d9f7ff';
  ctx.fillText('Move: A/D or ←/→  Jump: W/↑ (double jump)  Shoot: Space', 20, H - 20);

  if (game.state === 'start') {
    overlay.innerHTML = '<div class="panel"><h1>Saturn Space Dog</h1><p>Jump through ring obstacles and blast enemy drones.</p><p><strong>Press Enter to begin</strong></p></div>';
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
  if (k === ' ' || k === 'spacebar') {
    e.preventDefault();
    shoot();
  }
  if (k === 'w' || k === 'arrowup') jump();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (game.state !== 'playing') return;
  if (k === 'a' || k === 'arrowleft') dog.x = Math.max(40, dog.x - 28);
  if (k === 'd' || k === 'arrowright') dog.x = Math.min(W - 120, dog.x + 28);
});

requestAnimationFrame(loop);
