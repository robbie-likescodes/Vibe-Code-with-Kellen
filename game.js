(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const startScreen = document.getElementById("startScreen");
  const gameOverScreen = document.getElementById("gameOverScreen");
  const finalScoreEl = document.getElementById("finalScore");
  const finalBestEl = document.getElementById("finalBest");
  const scoreboardList = document.getElementById("scoreboardList");
  const startBtn = document.getElementById("startBtn");
  const restartBtn = document.getElementById("restartBtn");

  const BEST_KEY = "robofrog_best_score";
  const BOARD_KEY = "robofrog_scoreboard";

  const W = canvas.width;
  const H = canvas.height;
  const laneGap = 70;

  let gameState = "start";
  let cameraY = 0;
  let score = 0;
  let bestScore = Number(localStorage.getItem(BEST_KEY) || 0);
  let highestLaneReached = 0;
  let mouse = { x: W / 2, y: H / 2 };

  const stars = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: Math.random() * H * 8, r: Math.random() * 2 + 0.5 }));

  let frog;
  let platforms;
  let drones;
  let lasers;
  let particles;

  function resetGame() {
    score = 0;
    cameraY = 0;
    highestLaneReached = 0;
    frog = {
      x: W / 2,
      y: H - 90,
      lane: 0,
      r: 16,
      alive: true,
      cooldown: 0
    };
    platforms = [];
    drones = [];
    lasers = [];
    particles = [];

    for (let lane = -2; lane < 60; lane++) generateLane(lane);
    scoreEl.textContent = score;
    bestEl.textContent = bestScore;
  }

  function generateLane(lane) {
    const y = H - 90 - lane * laneGap;
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const kind = ["meteor", "satellite", "junk"][Math.floor(Math.random() * 3)];
      const width = 80 + Math.random() * 70;
      platforms.push({
        kind,
        lane,
        x: Math.random() * (W - width),
        y,
        w: width,
        h: 18,
        speed: (Math.random() * 1.1 + 0.3) * (Math.random() < 0.5 ? -1 : 1)
      });
    }
    if (Math.random() < 0.45 && lane > 2) {
      drones.push({ x: Math.random() * (W - 120) + 60, y: y - 20, vx: (Math.random() * 1.8 + 0.8) * (Math.random() < 0.5 ? -1 : 1), r: 12 });
    }
  }

  function hop(dx, dy) {
    if (gameState !== "playing" || !frog.alive) return;
    frog.x += dx * 90;
    frog.y -= dy * laneGap;
    frog.lane += dy;
    frog.x = Math.max(20, Math.min(W - 20, frog.x));

    if (frog.lane > highestLaneReached) {
      score += (frog.lane - highestLaneReached) * 10;
      highestLaneReached = frog.lane;
      scoreEl.textContent = score;
    }
    ensureGenerated();
  }

  function ensureGenerated() {
    const neededTopLane = frog.lane + 20;
    const existingTop = Math.max(...platforms.map(p => p.lane));
    for (let lane = existingTop + 1; lane <= neededTopLane; lane++) generateLane(lane);

    platforms = platforms.filter(p => p.lane > frog.lane - 8);
    drones = drones.filter(d => d.y < frog.y + 600);
  }

  function shoot() {
    if (gameState !== "playing" || frog.cooldown > 0) return;
    const angle = Math.atan2(mouse.y - (frog.y - cameraY), mouse.x - frog.x);
    lasers.push({ x: frog.x, y: frog.y, vx: Math.cos(angle) * 9, vy: Math.sin(angle) * 9, life: 45 });
    frog.cooldown = 14;
  }

  function addExplosion(x, y, color = "#ff9") {
    for (let i = 0; i < 16; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 30, color });
  }

  function update() {
    if (gameState !== "playing") return;

    frog.cooldown = Math.max(0, frog.cooldown - 1);
    cameraY = Math.min(cameraY, frog.y - H * 0.62);

    for (const p of platforms) {
      p.x += p.speed;
      if (p.x < -p.w) p.x = W;
      if (p.x > W) p.x = -p.w;
    }

    let onPlatform = false;
    for (const p of platforms) {
      if (Math.abs(frog.y - p.y) < 10 && frog.x > p.x && frog.x < p.x + p.w) {
        frog.x += p.speed;
        onPlatform = true;
      }
    }

    if (!onPlatform) return gameOver();

    for (const d of drones) {
      d.x += d.vx;
      if (d.x < d.r || d.x > W - d.r) d.vx *= -1;
      if (Math.hypot(d.x - frog.x, d.y - frog.y) < d.r + frog.r - 3) return gameOver();
    }

    lasers = lasers.filter(l => l.life-- > 0);
    for (const l of lasers) {
      l.x += l.vx;
      l.y += l.vy;
      particles.push({ x: l.x, y: l.y, vx: 0, vy: 0, life: 6, color: "#6ef7ff" });

      for (let i = drones.length - 1; i >= 0; i--) {
        const d = drones[i];
        if (Math.hypot(d.x - l.x, d.y - l.y) < d.r + 4) {
          drones.splice(i, 1);
          l.life = 0;
          score += 35;
          scoreEl.textContent = score;
          addExplosion(d.x, d.y, "#ff4dff");
          break;
        }
      }
    }

    particles = particles.filter(p => p.life-- > 0);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
    }
  }

  function gameOver() {
    frog.alive = false;
    gameState = "gameover";
    bestScore = Math.max(bestScore, score);
    localStorage.setItem(BEST_KEY, String(bestScore));

    const board = JSON.parse(localStorage.getItem(BOARD_KEY) || "[]");
    board.push({ score, date: new Date().toLocaleString() });
    board.sort((a, b) => b.score - a.score);
    const top10 = board.slice(0, 10);
    localStorage.setItem(BOARD_KEY, JSON.stringify(top10));

    finalScoreEl.textContent = score;
    finalBestEl.textContent = bestScore;
    bestEl.textContent = bestScore;
    renderScoreboard(top10);

    gameOverScreen.classList.add("visible");
  }

  function renderScoreboard(entries) {
    scoreboardList.innerHTML = "";
    entries.forEach((e) => {
      const li = document.createElement("li");
      li.textContent = `${e.score} pts — ${e.date}`;
      scoreboardList.appendChild(li);
    });
  }

  function drawBackground() {
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      const sy = ((s.y - cameraY * 0.35) % (H * 8) + H * 8) % (H * 8);
      if (sy < H) {
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillRect(s.x, sy, s.r, s.r);
      }
    }

    // Saturn
    const saturnY = 140 - cameraY * 0.15;
    ctx.save();
    ctx.translate(W - 170, saturnY);
    ctx.fillStyle = "#d6b37f";
    ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(220,210,180,0.6)";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.ellipse(0, 0, 95, 24, -0.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    drawBackground();

    for (const p of platforms) {
      const y = p.y - cameraY;
      if (y < -60 || y > H + 60) continue;
      ctx.fillStyle = p.kind === "meteor" ? "#8a8173" : p.kind === "satellite" ? "#8899cc" : "#5f6475";
      ctx.fillRect(p.x, y, p.w, p.h);
      if (p.kind === "satellite") { ctx.fillStyle = "#6ef7ff"; ctx.fillRect(p.x + p.w * 0.5 - 6, y - 5, 12, 4); }
    }

    for (const d of drones) {
      const y = d.y - cameraY;
      ctx.fillStyle = "#ff6b6b";
      ctx.beginPath(); ctx.arc(d.x, y, d.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#111";
      ctx.fillRect(d.x - 7, y - 2, 14, 4);
    }

    for (const l of lasers) {
      ctx.strokeStyle = "#6ef7ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y - cameraY);
      ctx.lineTo(l.x - l.vx * 1.6, l.y - l.vy * 1.6 - cameraY);
      ctx.stroke();
    }

    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y - cameraY, 2, 2);
    }

    if (frog && frog.alive) {
      const fy = frog.y - cameraY;
      ctx.fillStyle = "#7aff73";
      ctx.fillRect(frog.x - 14, fy - 12, 28, 20);
      ctx.fillStyle = "#333";
      ctx.fillRect(frog.x - 10, fy - 8, 20, 8);
      ctx.fillStyle = "#6ef7ff";
      ctx.fillRect(frog.x - 6, fy - 18, 12, 6);
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  function startGame() {
    resetGame();
    gameState = "playing";
    startScreen.classList.remove("visible");
    gameOverScreen.classList.remove("visible");
  }

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "enter" && gameState !== "playing") return startGame();
    if (k === "w" || k === "arrowup") hop(0, 1);
    if (k === "s" || k === "arrowdown") hop(0, -1);
    if (k === "a" || k === "arrowleft") hop(-1, 0);
    if (k === "d" || k === "arrowright") hop(1, 0);
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * W;
    mouse.y = ((e.clientY - rect.top) / rect.height) * H;
  });
  canvas.addEventListener("click", shoot);

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);

  renderScoreboard(JSON.parse(localStorage.getItem(BOARD_KEY) || "[]"));
  bestEl.textContent = bestScore;
  loop();
})();
