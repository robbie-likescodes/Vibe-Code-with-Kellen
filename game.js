console.log("game.js loaded");

const DEBUG = true;

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("gameCanvas");
  const overlay = document.getElementById("overlay");

  if (!canvas) {
    document.body.innerHTML = '<div class="error">Error: game canvas not found.</div>';
    return;
  }
  console.log("canvas found");

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    document.body.innerHTML = '<div class="error">Error: 2D canvas context failed.</div>';
    return;
  }

  const W = 960;
  const H = 640;
  const TILE = 64;
  canvas.width = W;
  canvas.height = H;

  let state = "start";
  let cameraY = 0;
  let last = performance.now();
  let shake = 0;
  let bestScore = Number(localStorage.getItem("robofrog_best_score") || 0);
  let scoreboard = JSON.parse(localStorage.getItem("robofrog_scoreboard") || "[]");

  const mouse = { x: W / 2, y: H / 2 };
  const starLayers = [newStars(80, 0.12), newStars(60, 0.28), newStars(35, 0.52)];
  let lanes = [];
  let drones = [];
  let lasers = [];
  let particles = [];
  let baseScore = 0;
  let bonusScore = 0;

  const player = {
    lane: 0,
    x: W / 2,
    y: H - TILE,
    size: 38,
    hopT: 0,
    hopFrom: { lane: 0, x: W / 2 },
    hopTo: { lane: 0, x: W / 2 },
    hopGrace: 0,
    cooldown: 0,
    alive: true,
    maxLane: 0
  };

  function newStars(count, speed) {
    return Array.from({ length: count }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 2 + 0.4, s: speed }));
  }

  function laneY(i) { return H - 100 - i * TILE; }

  function makeLane(i) {
    const kinds = ["meteors", "ice", "satellite", "junk", "drone"];
    const type = i === 0 ? "safe" : kinds[(i - 1) % kinds.length];
    const speed = i === 0 ? 0 : (Math.random() * 50 + 40) * (i % 2 ? 1 : -1);
    const platforms = [];
    const count = type === "safe" ? 6 : 4 + (i % 3);
    for (let p = 0; p < count; p++) {
      const w = 82 + Math.random() * 48;
      const x = (W / count) * p + Math.random() * 70;
      platforms.push({ x, w, h: 28, scrap: Math.random() < 0.36 ? { dx: w * 0.5, taken: false } : null });
    }
    return { i, y: laneY(i), type, speed, platforms };
  }

  function resetGame() {
    lanes = Array.from({ length: 24 }, (_, i) => makeLane(i));
    drones = [];
    lanes.forEach((l) => {
      if (l.type === "drone") {
        const n = 2 + (l.i % 2);
        for (let i = 0; i < n; i++) drones.push({ lane: l.i, x: (W / n) * i + 120, r: 14, speed: l.speed * 0.8 });
      }
    });
    lasers = [];
    particles = [];
    baseScore = 0;
    bonusScore = 0;
    player.lane = 0;
    player.maxLane = 0;
    player.x = W / 2;
    player.hopFrom = { lane: 0, x: player.x };
    player.hopTo = { lane: 0, x: player.x };
    player.hopT = 0;
    player.hopGrace = 0.25;
    player.cooldown = 0;
    player.alive = true;
    cameraY = 0;
    shake = 0;
    ensureStartSupport();
  }

  function ensureStartSupport() {
    const start = lanes[0];
    if (!start.platforms.some((p) => player.x >= p.x && player.x <= p.x + p.w)) {
      start.platforms.push({ x: player.x - 60, w: 120, h: 28, scrap: null });
    }
  }

  function fire(dirX, dirY) {
    if (player.cooldown > 0 || state !== "playing") return;
    const len = Math.hypot(dirX, dirY) || 1;
    lasers.push({ x: player.x, y: laneY(player.lane), vx: (dirX / len) * 720, vy: (dirY / len) * 720, life: 0.9 });
    player.cooldown = 0.25;
  }

  function movePlayer(dx, dLane) {
    if (state !== "playing" || player.hopT > 0) return;
    player.hopFrom = { lane: player.lane, x: player.x };
    player.lane = Math.max(0, Math.min(lanes.length - 1, player.lane + dLane));
    player.x = Math.max(22, Math.min(W - 22, player.x + dx * TILE));
    player.hopTo = { lane: player.lane, x: player.x };
    player.hopT = 0.16;
    player.hopGrace = 0.18;
    if (player.lane > player.maxLane) {
      player.maxLane = player.lane;
      baseScore = player.maxLane;
    }
  }

  function killPlayer() {
    if (!player.alive) return;
    player.alive = false;
    state = "gameover";
    shake = 12;
    for (let i = 0; i < 28; i++) particles.push({ x: player.x, y: laneY(player.lane), vx: (Math.random() - 0.5) * 250, vy: (Math.random() - 0.5) * 250, life: 0.9, c: "#72ff5d" });
    const score = baseScore + bonusScore;
    bestScore = Math.max(bestScore, score);
    localStorage.setItem("robofrog_best_score", String(bestScore));
    scoreboard.unshift({ score, date: new Date().toLocaleString() });
    scoreboard = scoreboard.sort((a, b) => b.score - a.score).slice(0, 10);
    localStorage.setItem("robofrog_scoreboard", JSON.stringify(scoreboard));
  }

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "enter") {
      state = "playing";
      resetGame();
      return;
    }
    if (k === " ") fire(0, -1);
    if (["arrowleft", "a"].includes(k)) movePlayer(-1, 0);
    if (["arrowright", "d"].includes(k)) movePlayer(1, 0);
    if (["arrowup", "w"].includes(k)) movePlayer(0, 1);
    if (["arrowdown", "s"].includes(k)) movePlayer(0, -1);
  });
  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * W;
    mouse.y = ((e.clientY - r.top) / r.height) * H;
  });
  canvas.addEventListener("mousedown", () => fire(mouse.x - player.x, mouse.y - laneY(player.lane) + cameraY));

  function update(dt) {
    starLayers.flat().forEach((s) => { s.y += s.s * 80 * dt; if (s.y > H) s.y = -2; });
    if (state !== "playing") return;
    player.cooldown = Math.max(0, player.cooldown - dt);
    if (player.hopT > 0) player.hopT = Math.max(0, player.hopT - dt);
    if (player.hopGrace > 0) player.hopGrace -= dt;

    lanes.forEach((l) => l.platforms.forEach((p) => { p.x += l.speed * dt; if (p.x > W + 140) p.x = -p.w - 50; if (p.x < -p.w - 80) p.x = W + 80; }));
    drones.forEach((d) => { d.x += d.speed * dt; if (d.x > W + 30) d.x = -30; if (d.x < -30) d.x = W + 30; });

    const py = laneY(player.lane);
    if (player.lane > 3) cameraY = Math.max(cameraY, (player.lane - 3) * TILE);

    lasers.forEach((l) => { l.x += l.vx * dt; l.y += l.vy * dt; l.life -= dt; });
    lasers = lasers.filter((l) => l.life > 0 && l.x > -50 && l.x < W + 50 && l.y > -80 && l.y < H + cameraY + 80);

    for (const l of lasers) {
      for (const d of drones) {
        const dy = laneY(d.lane);
        if (Math.hypot(l.x - d.x, l.y - dy) < d.r + 9) {
          d.dead = true; l.life = 0; bonusScore += 10; shake = 7;
          for (let i = 0; i < 12; i++) particles.push({ x: d.x, y: dy, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, life: 0.6, c: "#ff5f9f" });
        }
      }
    }
    drones = drones.filter((d) => !d.dead);

    if (player.hopGrace <= 0) {
      const lane = lanes[player.lane];
      const onPlatform = lane.platforms.some((p) => player.x > p.x - 10 && player.x < p.x + p.w + 10);
      if (!onPlatform) killPlayer();

      for (const d of drones) {
        if (d.lane === player.lane && Math.abs(d.x - player.x) < d.r + player.size * 0.35) killPlayer();
      }

      lane.platforms.forEach((p) => {
        if (p.scrap && !p.scrap.taken) {
          const sx = p.x + p.scrap.dx;
          if (Math.abs(sx - player.x) < 24) { p.scrap.taken = true; bonusScore += 5; }
        }
      });
    }

    particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.vy += 220 * dt; });
    particles = particles.filter((p) => p.life > 0);
    shake *= 0.9;
  }

  function drawPlatform(lane, p, y) {
    if (lane.type === "meteors") {
      ctx.fillStyle = "#8e5325"; ctx.beginPath(); ctx.arc(p.x + p.w * 0.5, y, p.w * 0.3, 0, Math.PI * 2); ctx.fill();
    } else if (lane.type === "ice") {
      ctx.fillStyle = "#9be7ff"; ctx.beginPath(); ctx.moveTo(p.x, y + 8); ctx.lineTo(p.x + p.w * 0.35, y - 12); ctx.lineTo(p.x + p.w, y + 2); ctx.lineTo(p.x + p.w * 0.72, y + 15); ctx.closePath(); ctx.fill();
    } else if (lane.type === "satellite") {
      ctx.fillStyle = "#98a6bc"; ctx.fillRect(p.x + 20, y - 12, p.w - 40, 24); ctx.fillStyle = "#4fc3ff"; ctx.fillRect(p.x, y - 8, 20, 16); ctx.fillRect(p.x + p.w - 20, y - 8, 20, 16);
    } else if (lane.type === "junk") {
      ctx.fillStyle = "#796099"; ctx.fillRect(p.x + 8, y - 10, p.w - 16, 20); ctx.fillStyle = "#b8abc8"; ctx.fillRect(p.x + 20, y - 6, 12, 12); ctx.fillRect(p.x + p.w - 32, y - 6, 10, 10);
    } else {
      ctx.fillStyle = "#5f6f88"; ctx.fillRect(p.x, y - 12, p.w, 24);
    }
    if (p.scrap && !p.scrap.taken) {
      const sx = p.x + p.scrap.dx;
      ctx.fillStyle = "#ffdd3f"; ctx.beginPath(); ctx.arc(sx, y - 16, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawFrog(x, y) {
    const s = player.size;
    ctx.fillStyle = "#46cc55"; ctx.fillRect(x - s * 0.45, y - s * 0.3, s * 0.9, s * 0.58);
    ctx.fillStyle = "#3eb248"; ctx.fillRect(x - s * 0.36, y - s * 0.72, s * 0.72, s * 0.42);
    ctx.fillStyle = "#74f6ff"; ctx.fillRect(x - s * 0.23, y - s * 0.6, s * 0.17, s * 0.11); ctx.fillRect(x + s * 0.06, y - s * 0.6, s * 0.17, s * 0.11);
    ctx.fillStyle = "#97a1b5"; ctx.fillRect(x - 2, y - s * 0.84, 4, 8); ctx.fillRect(x - s * 0.55, y + s * 0.18, 12, 9); ctx.fillRect(x + s * 0.35, y + s * 0.18, 12, 9);
    ctx.fillStyle = "#2f3f5f"; ctx.fillRect(x - s * 0.14, y + s * 0.05, s * 0.28, s * 0.22);
  }

  function draw() {
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;
    ctx.setTransform(1, 0, 0, 1, sx, sy);
    ctx.clearRect(-20, -20, W + 40, H + 40);

    ctx.fillStyle = "#03030b"; ctx.fillRect(0, 0, W, H);
    starLayers.forEach((layer, i) => {
      ctx.fillStyle = ["#8ba0ff", "#b7d6ff", "#ffffff"][i];
      layer.forEach((s) => ctx.fillRect(s.x, s.y, s.r, s.r));
    });

    ctx.strokeStyle = "rgba(217,202,132,.35)"; ctx.lineWidth = 26; ctx.beginPath(); ctx.ellipse(710, 170, 200, 56, -0.22, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#d9bb74"; ctx.beginPath(); ctx.arc(700, 170, 110, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,245,190,.45)"; ctx.lineWidth = 12; ctx.beginPath(); ctx.ellipse(700, 170, 180, 44, -0.22, 0, Math.PI * 2); ctx.stroke();

    for (const lane of lanes) {
      const y = laneY(lane.i) + cameraY;
      if (y < -80 || y > H + 60) continue;
      ctx.fillStyle = lane.i % 2 ? "rgba(80,120,160,.18)" : "rgba(90,90,120,.2)";
      ctx.fillRect(0, y - 28, W, 56);
      lane.platforms.forEach((p) => drawPlatform(lane, p, y));
    }

    drones.forEach((d) => {
      const y = laneY(d.lane) + cameraY;
      if (y < -50 || y > H + 50) return;
      ctx.fillStyle = "#ff5f9f"; ctx.beginPath(); ctx.arc(d.x, y, d.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillRect(d.x - 6, y - 2, 12, 4);
    });

    lasers.forEach((l) => {
      ctx.strokeStyle = "#6cfeff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x - l.vx * 0.02, l.y - l.vy * 0.02); ctx.stroke();
    });

    particles.forEach((p) => { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 3, 3); ctx.globalAlpha = 1; });

    const py = laneY(player.lane) + cameraY - Math.sin((player.hopT / 0.16) * Math.PI) * 12;
    drawFrog(player.x, py);

    ctx.strokeStyle = "#6cfeff"; ctx.strokeRect(mouse.x - 6, mouse.y - 6, 12, 12);

    for (let y = 0; y < H; y += 4) { ctx.fillStyle = "rgba(0,0,0,0.06)"; ctx.fillRect(0, y, W, 1); }

    ctx.fillStyle = "#fff";
    ctx.font = "20px monospace";
    const score = baseScore + bonusScore;
    ctx.fillText(`Score: ${score}`, 16, 28);
    ctx.fillText(`Best: ${bestScore}`, W - 170, 28);
    ctx.font = "15px monospace";
    ctx.fillText("Enter: Start/Restart | Move: Arrows/WASD | Click/Space: Shoot", 16, 52);
    if (DEBUG) ctx.fillText(`debug state:${state} lane:${player.lane} lanes:${lanes.length} drones:${drones.length}`, 16, H - 16);

    if (state === "start") {
      overlay.innerHTML = `<div class="panel"><h1>RoboFrog: Rings of Saturn</h1><p>Hop across Saturn's ring lanes, blast drones, collect scrap.</p><p><strong>Press ENTER to start</strong></p></div>`;
    } else if (state === "gameover") {
      const lines = scoreboard.map((s, i) => `<div>${i + 1}. ${s.score} - ${s.date}</div>`).join("");
      overlay.innerHTML = `<div class="panel"><h1>GAME OVER</h1><p>Final Score: ${score}</p><p>Best Score: ${bestScore}</p><p><strong>Top 10 Local Scores</strong></p>${lines}<p><strong>Press ENTER to restart</strong></p></div>`;
    } else overlay.innerHTML = "";
  }

  function loop(t) {
    const dt = Math.min(0.033, (t - last) / 1000);
    last = t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  resetGame();
  console.log("game loop started");
  requestAnimationFrame(loop);
});
