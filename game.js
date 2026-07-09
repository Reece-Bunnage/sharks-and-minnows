/* Sharks and Minnows — a small canvas arcade game.
   Everything is drawn programmatically; no external assets. */

(() => {
  "use strict";

  // ---------------------------------------------------------------------------
  // Setup & constants
  // ---------------------------------------------------------------------------

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const W = 960;
  const H = 600;

  const SHORE_W = 96;            // width of each sand shore
  const WATER_LEFT = SHORE_W;
  const WATER_RIGHT = W - SHORE_W;
  const WATER_TOP = 26;          // small margin so fins never clip the frame
  const WATER_BOTTOM = H - 26;

  const PLAYER_SPEED = 215;
  const PLAYER_R = 11;

  const DASH_SPEED_MULT = 2.65;
  const DASH_DURATION = 0.22;
  const DASH_COOLDOWN = 2.2;

  const TEAMMATE_COUNT = 4;

  const MAX_DIFFICULTY_ROUND = 10; // scaling caps here; later rounds stay this hard

  const TAU = Math.PI * 2;

  // HUD elements
  const hudEl = document.getElementById("hud");
  const hudRoundEl = document.getElementById("hud-round");
  const hudTeamEl = document.getElementById("hud-team");
  const dashFillEl = document.getElementById("dash-fill");

  // Handle high-DPI displays: render at devicePixelRatio, keep logical coords.
  function fitCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fitCanvas();
  window.addEventListener("resize", fitCanvas);

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  };

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  const keys = new Set();
  let dashPressed = false;
  let confirmPressed = false;

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) {
      e.preventDefault();
    }
    if (!e.repeat) {
      if (k === " " || k === "shift") dashPressed = true;
      if (k === " " || k === "enter") confirmPressed = true;
    }
    keys.add(k);
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  function moveInput() {
    let x = 0, y = 0;
    if (keys.has("arrowleft") || keys.has("a")) x -= 1;
    if (keys.has("arrowright") || keys.has("d")) x += 1;
    if (keys.has("arrowup") || keys.has("w")) y -= 1;
    if (keys.has("arrowdown") || keys.has("s")) y += 1;
    if (x && y) { // normalize diagonals
      const inv = 1 / Math.SQRT2;
      x *= inv; y *= inv;
    }
    return { x, y };
  }

  // ---------------------------------------------------------------------------
  // Difficulty ramp
  // ---------------------------------------------------------------------------

  function difficultyFor(round) {
    const r = Math.min(round, MAX_DIFFICULTY_ROUND);
    return {
      sharkCount: Math.min(2 + Math.floor((r - 1) * 0.8), 9),
      speedMult: 1 + (r - 1) * 0.085,
    };
  }

  // ---------------------------------------------------------------------------
  // Particles (dash trail, splash rings, shimmer)
  // ---------------------------------------------------------------------------

  const particles = [];

  function spawnTrail(x, y, color) {
    particles.push({
      kind: "trail", x, y,
      vx: rand(-15, 15), vy: rand(-15, 15),
      r: rand(3, 6), life: 0.35, age: 0, color,
    });
  }

  function spawnRing(x, y, color) {
    particles.push({ kind: "ring", x, y, r: 6, life: 0.55, age: 0, color });
  }

  function spawnBubbles(x, y, n) {
    for (let i = 0; i < n; i++) {
      particles.push({
        kind: "bubble", x: x + rand(-8, 8), y: y + rand(-8, 8),
        vx: rand(-20, 20), vy: rand(-55, -20),
        r: rand(2, 5), life: rand(0.5, 0.9), age: 0,
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      if (p.kind === "trail" || p.kind === "bubble") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else if (p.kind === "ring") {
        p.r += 90 * dt;
      }
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const t = p.age / p.life;
      ctx.globalAlpha = 1 - t;
      if (p.kind === "trail") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 - t * 0.6), 0, TAU);
        ctx.fill();
      } else if (p.kind === "ring") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5 * (1 - t);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.stroke();
      } else if (p.kind === "bubble") {
        ctx.strokeStyle = "rgba(230, 248, 255, 0.9)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Ambient shimmer flecks drifting in the water
  const shimmer = Array.from({ length: 36 }, () => ({
    x: rand(WATER_LEFT, WATER_RIGHT),
    y: rand(WATER_TOP, WATER_BOTTOM),
    r: rand(1, 2.6),
    speed: rand(4, 12),
    phase: rand(0, TAU),
  }));

  // ---------------------------------------------------------------------------
  // Entities
  // ---------------------------------------------------------------------------

  function makePlayer() {
    return {
      x: SHORE_W * 0.55,
      y: H / 2,
      vx: 0, vy: 0,
      facing: 0,           // radians; 0 = facing right
      tailPhase: 0,
      dashTimer: 0,        // time left in active dash
      dashCooldown: 0,     // time until dash is ready again
    };
  }

  const TEAMMATE_COLORS = ["#ffd166", "#95e06c", "#c9a7ff", "#6be3c2"];

  function makeTeammates() {
    const mates = [];
    for (let i = 0; i < TEAMMATE_COUNT; i++) {
      mates.push({
        x: rand(20, SHORE_W - 18),
        y: lerp(H * 0.2, H * 0.8, i / (TEAMMATE_COUNT - 1)) + rand(-20, 20),
        vx: 0, vy: 0,
        facing: 0,
        tailPhase: rand(0, TAU),
        speed: rand(105, 150),
        wobbleFreq: rand(1.2, 2.2),
        wobblePhase: rand(0, TAU),
        wobbleAmp: rand(30, 60),
        startDelay: rand(0.2, 1.4),
        t: 0,
        color: TEAMMATE_COLORS[i % TEAMMATE_COLORS.length],
        alive: true,
        safe: false,
      });
    }
    return mates;
  }

  // Shark personalities: all randomized wandering, never player-seeking.
  //  - patroller: sweeps edge-to-edge with occasional speed changes
  //  - lurker:    hangs around a home spot mid-pool, slow menacing drift
  //  - jitter:    fast, changes heading often, erratic
  //  - drifter:   roams the whole pool at moderate pace
  const PERSONALITIES = ["patroller", "lurker", "jitter", "drifter"];

  function makeShark(index, speedMult) {
    const kind = PERSONALITIES[index % PERSONALITIES.length];
    const shark = {
      kind,
      x: rand(WATER_LEFT + 120, WATER_RIGHT - 120),
      y: rand(WATER_TOP + 60, WATER_BOTTOM - 60),
      vx: 0, vy: 0,
      facing: 0,
      r: 20,
      tailPhase: rand(0, TAU),
      retargetIn: 0,
      speedMult,
      homeX: 0, homeY: 0,
      baseSpeed: 0,
    };

    switch (kind) {
      case "patroller":
        shark.baseSpeed = rand(85, 115);
        shark.dir = Math.random() < 0.5 ? 1 : -1;
        break;
      case "lurker":
        shark.baseSpeed = rand(45, 70);
        shark.homeX = rand(WATER_LEFT + 200, WATER_RIGHT - 200);
        shark.homeY = rand(WATER_TOP + 100, WATER_BOTTOM - 100);
        shark.x = shark.homeX;
        shark.y = shark.homeY;
        break;
      case "jitter":
        shark.baseSpeed = rand(130, 165);
        shark.r = 17;
        break;
      case "drifter":
        shark.baseSpeed = rand(70, 100);
        break;
    }
    retargetShark(shark);
    return shark;
  }

  function retargetShark(s) {
    const speed = s.baseSpeed * s.speedMult * rand(0.75, 1.25);
    switch (s.kind) {
      case "patroller": {
        // mostly vertical sweeps with a little horizontal lean
        if (s.y < WATER_TOP + 70) s.dir = 1;
        else if (s.y > WATER_BOTTOM - 70) s.dir = -1;
        else if (Math.random() < 0.2) s.dir *= -1;
        const angle = s.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        const lean = rand(-0.45, 0.45);
        s.vx = Math.cos(angle + lean) * speed;
        s.vy = Math.sin(angle + lean) * speed;
        s.retargetIn = rand(1.4, 3.2);
        break;
      }
      case "lurker": {
        // drift back toward home with a random offset — stays in its territory
        const tx = s.homeX + rand(-110, 110);
        const ty = s.homeY + rand(-90, 90);
        const a = Math.atan2(ty - s.y, tx - s.x);
        s.vx = Math.cos(a) * speed;
        s.vy = Math.sin(a) * speed;
        s.retargetIn = rand(1.2, 2.6);
        break;
      }
      case "jitter": {
        const a = rand(0, TAU);
        s.vx = Math.cos(a) * speed;
        s.vy = Math.sin(a) * speed;
        s.retargetIn = rand(0.35, 1.0);
        break;
      }
      case "drifter": {
        const a = rand(0, TAU);
        s.vx = Math.cos(a) * speed;
        s.vy = Math.sin(a) * speed;
        s.retargetIn = rand(1.5, 3.5);
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------------

  const game = {
    state: "title",       // title | playing | caught | roundComplete
    round: 1,
    player: makePlayer(),
    teammates: [],
    sharks: [],
    stateTimer: 0,
    time: 0,
    bestRound: 1,
  };

  function startRound(round) {
    game.round = round;
    game.bestRound = Math.max(game.bestRound, round);
    game.player = makePlayer();
    game.teammates = makeTeammates();
    const diff = difficultyFor(round);
    game.sharks = Array.from({ length: diff.sharkCount }, (_, i) =>
      makeShark(i, diff.speedMult));
    game.state = "playing";
    hudRoundEl.textContent = `Round ${round}`;
    hudEl.classList.remove("hidden");
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  function updatePlayer(p, dt) {
    const input = moveInput();

    if (dashPressed && p.dashCooldown <= 0) {
      p.dashTimer = DASH_DURATION;
      p.dashCooldown = DASH_COOLDOWN;
      spawnRing(p.x, p.y, "rgba(190, 240, 255, 0.9)");
    }

    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.dashTimer = Math.max(0, p.dashTimer - dt);

    const dashing = p.dashTimer > 0;
    const speed = PLAYER_SPEED * (dashing ? DASH_SPEED_MULT : 1);

    p.vx = input.x * speed;
    p.vy = input.y * speed;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Player may stand on either shore but not leave the frame.
    p.x = clamp(p.x, 16, W - 16);
    p.y = clamp(p.y, WATER_TOP + 4, WATER_BOTTOM - 4);

    const moving = input.x !== 0 || input.y !== 0;
    if (moving) p.facing = Math.atan2(p.vy, p.vx);
    p.tailPhase += dt * (moving ? (dashing ? 26 : 14) : 5);

    if (dashing && moving) {
      spawnTrail(p.x - Math.cos(p.facing) * 10, p.y - Math.sin(p.facing) * 10,
        "rgba(160, 230, 255, 0.8)");
    }
  }

  function updateTeammate(m, dt) {
    if (!m.alive || m.safe) return;
    m.t += dt;
    if (m.t < m.startDelay) return;

    // Base drive: swim right with a sinusoidal vertical wander.
    let dirX = 1;
    let dirY = Math.cos(m.t * m.wobbleFreq + m.wobblePhase) * m.wobbleAmp / 60;

    // Simple avoidance: veer away from any nearby shark. Not smart, just skittish.
    for (const s of game.sharks) {
      const d2 = dist2(m.x, m.y, s.x, s.y);
      if (d2 < 110 * 110) {
        const d = Math.sqrt(d2) || 1;
        const push = (110 - d) / 110 * 2.2;
        dirX += (m.x - s.x) / d * push;
        dirY += (m.y - s.y) / d * push;
      }
    }

    const len = Math.hypot(dirX, dirY) || 1;
    m.vx = dirX / len * m.speed;
    m.vy = dirY / len * m.speed;
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.y = clamp(m.y, WATER_TOP + 10, WATER_BOTTOM - 10);
    m.x = clamp(m.x, 14, W - 14);
    m.facing = Math.atan2(m.vy, m.vx);
    m.tailPhase += dt * 13;

    if (m.x > WATER_RIGHT + 20) {
      m.safe = true;
      spawnRing(m.x, m.y, "rgba(255, 255, 255, 0.7)");
    }
  }

  function updateShark(s, dt) {
    s.retargetIn -= dt;
    if (s.retargetIn <= 0) retargetShark(s);

    s.x += s.vx * dt;
    s.y += s.vy * dt;

    // Bounce off the water bounds (sharks stay out of the shallows).
    const margin = s.r + 6;
    if (s.x < WATER_LEFT + margin) { s.x = WATER_LEFT + margin; s.vx = Math.abs(s.vx); }
    if (s.x > WATER_RIGHT - margin) { s.x = WATER_RIGHT - margin; s.vx = -Math.abs(s.vx); }
    if (s.y < WATER_TOP + margin) { s.y = WATER_TOP + margin; s.vy = Math.abs(s.vy); }
    if (s.y > WATER_BOTTOM - margin) { s.y = WATER_BOTTOM - margin; s.vy = -Math.abs(s.vy); }

    // Smoothly turn the body toward the velocity.
    const target = Math.atan2(s.vy, s.vx);
    let delta = target - s.facing;
    while (delta > Math.PI) delta -= TAU;
    while (delta < -Math.PI) delta += TAU;
    s.facing += delta * Math.min(1, dt * 4);

    s.tailPhase += dt * 7;
  }

  function checkCollisions() {
    const p = game.player;
    // Player is only in danger while actually in the water.
    const playerInWater = p.x > WATER_LEFT - 4 && p.x < WATER_RIGHT + 4;

    for (const s of game.sharks) {
      const bite = (s.r * 0.72 + PLAYER_R) ** 2;
      if (playerInWater && dist2(p.x, p.y, s.x, s.y) < bite) {
        game.state = "caught";
        game.stateTimer = 0;
        spawnRing(p.x, p.y, "rgba(255, 120, 100, 0.95)");
        spawnBubbles(p.x, p.y, 14);
        return;
      }
      for (const m of game.teammates) {
        if (!m.alive || m.safe) continue;
        if (m.x <= WATER_LEFT || m.x >= WATER_RIGHT) continue;
        if (dist2(m.x, m.y, s.x, s.y) < bite) {
          m.alive = false;
          spawnBubbles(m.x, m.y, 10);
          spawnRing(m.x, m.y, "rgba(255, 255, 255, 0.8)");
        }
      }
    }
  }

  function update(dt) {
    game.time += dt;

    // Shimmer drifts regardless of state.
    for (const f of shimmer) {
      f.x += f.speed * dt;
      if (f.x > WATER_RIGHT) f.x = WATER_LEFT;
    }

    updateParticles(dt);

    if (game.state === "playing") {
      updatePlayer(game.player, dt);
      for (const m of game.teammates) updateTeammate(m, dt);
      for (const s of game.sharks) updateShark(s, dt);
      checkCollisions();

      if (game.state === "playing" && game.player.x > WATER_RIGHT + 24) {
        game.state = "roundComplete";
        game.stateTimer = 0;
        spawnRing(game.player.x, game.player.y, "rgba(140, 255, 180, 0.9)");
      }

      // HUD
      const alive = game.teammates.filter(m => m.alive && !m.safe).length;
      const safe = game.teammates.filter(m => m.safe).length;
      hudTeamEl.textContent = `Minnows: ${alive} swimming · ${safe} safe`;
      const ready = game.player.dashCooldown <= 0;
      dashFillEl.style.width =
        `${(1 - game.player.dashCooldown / DASH_COOLDOWN) * 100}%`;
      dashFillEl.classList.toggle("ready", ready);
    } else if (game.state === "roundComplete") {
      game.stateTimer += dt;
      // Let sharks keep swimming behind the banner.
      for (const s of game.sharks) updateShark(s, dt);
      if (game.stateTimer > 1.5) startRound(game.round + 1);
    } else if (game.state === "caught") {
      game.stateTimer += dt;
      for (const s of game.sharks) updateShark(s, dt);
      if (game.stateTimer > 0.8 && confirmPressed) startRound(1);
    } else if (game.state === "title") {
      for (const s of game.sharks) updateShark(s, dt);
      if (confirmPressed) startRound(1);
    }

    dashPressed = false;
    confirmPressed = false;
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  function drawWater() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#3aa9c9");
    g.addColorStop(0.5, "#2b8fb5");
    g.addColorStop(1, "#1f6f96");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Gentle moving wave lines.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const baseY = H * (0.14 + i * 0.18);
      ctx.beginPath();
      for (let x = 0; x <= W; x += 12) {
        const y = baseY +
          Math.sin(x * 0.014 + game.time * 0.9 + i * 1.7) * 7 +
          Math.sin(x * 0.006 - game.time * 0.5 + i) * 5;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Shimmer flecks.
    for (const f of shimmer) {
      const a = 0.10 + 0.10 * Math.sin(game.time * 2 + f.phase);
      ctx.fillStyle = `rgba(255, 255, 255, ${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, TAU);
      ctx.fill();
    }
  }

  function drawShore(x, w, flip) {
    const g = ctx.createLinearGradient(flip ? x + w : x, 0, flip ? x : x + w, 0);
    g.addColorStop(0, "#eed9a4");
    g.addColorStop(0.75, "#e3c98e");
    g.addColorStop(1, "#d9bc7d");
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w, H);

    // Foam edge where sand meets water.
    const edgeX = flip ? x : x + w;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let y = 0; y <= H; y += 10) {
      const ox = Math.sin(y * 0.05 + game.time * 1.6) * 3;
      if (y === 0) ctx.moveTo(edgeX + ox, y);
      else ctx.lineTo(edgeX + ox, y);
    }
    ctx.stroke();

    // A few pebbles for texture.
    ctx.fillStyle = "rgba(190, 160, 105, 0.5)";
    for (let i = 0; i < 7; i++) {
      const px = x + ((i * 37 + 13) % (w - 24)) + 12;
      const py = ((i * 149 + 60) % (H - 80)) + 40;
      ctx.beginPath();
      ctx.ellipse(px, py, 5, 3.4, i, 0, TAU);
      ctx.fill();
    }
  }

  function drawShoreLabels() {
    ctx.save();
    ctx.fillStyle = "rgba(120, 90, 45, 0.55)";
    ctx.font = "700 13px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.save();
    ctx.translate(SHORE_W / 2, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("S T A R T", 0, 5);
    ctx.restore();
    ctx.save();
    ctx.translate(W - SHORE_W / 2, H / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText("S A F E", 0, 5);
    ctx.restore();
    ctx.restore();
  }

  function drawMinnow(x, y, facing, tailPhase, color, scale, dashing) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facing);
    ctx.scale(scale, scale);

    if (dashing) { // squash & stretch during a dash
      ctx.scale(1.25, 0.82);
    }

    // Tail — a small flicking fin behind the body.
    const flick = Math.sin(tailPhase) * 0.5;
    ctx.save();
    ctx.translate(-9, 0);
    ctx.rotate(flick);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-9, -6, -11, -7);
    ctx.quadraticCurveTo(-8, 0, -11, 7);
    ctx.quadraticCurveTo(-9, 6, 0, 0);
    ctx.fill();
    ctx.restore();

    // Body — rounded teardrop.
    const bodyGrad = ctx.createLinearGradient(0, -8, 0, 8);
    bodyGrad.addColorStop(0, color);
    bodyGrad.addColorStop(1, shade(color, -18));
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.quadraticCurveTo(9, -8, -2, -6.5);
    ctx.quadraticCurveTo(-10, -4, -10, 0);
    ctx.quadraticCurveTo(-10, 4, -2, 6.5);
    ctx.quadraticCurveTo(9, 8, 11, 0);
    ctx.fill();

    // Eye.
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.beginPath();
    ctx.arc(5.5, -2, 2.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#25303a";
    ctx.beginPath();
    ctx.arc(6.1, -2, 1.2, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  function drawShark(s) {
    ctx.save();
    ctx.translate(s.x, s.y + Math.sin(game.time * 1.8 + s.tailPhase) * 2);
    ctx.rotate(s.facing);
    const L = s.r * 2.4; // body half-length-ish scale

    // Tail fin.
    const flick = Math.sin(s.tailPhase * 2) * 0.35;
    ctx.save();
    ctx.translate(-L * 0.82, 0);
    ctx.rotate(flick);
    ctx.fillStyle = "#4d5d6c";
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.quadraticCurveTo(-L * 0.32, -s.r * 0.85, -L * 0.4, -s.r * 0.95);
    ctx.quadraticCurveTo(-L * 0.22, 0, -L * 0.4, s.r * 0.8);
    ctx.quadraticCurveTo(-L * 0.32, s.r * 0.7, 2, 0);
    ctx.fill();
    ctx.restore();

    // Body — sleek torpedo with belly gradient.
    const g = ctx.createLinearGradient(0, -s.r, 0, s.r);
    g.addColorStop(0, "#5f7080");
    g.addColorStop(0.62, "#54646f");
    g.addColorStop(0.63, "#8fa1ad");
    g.addColorStop(1, "#a9bac4");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(L, 0);
    ctx.quadraticCurveTo(L * 0.62, -s.r * 0.95, -L * 0.15, -s.r * 0.8);
    ctx.quadraticCurveTo(-L * 0.72, -s.r * 0.42, -L * 0.85, 0);
    ctx.quadraticCurveTo(-L * 0.72, s.r * 0.42, -L * 0.15, s.r * 0.8);
    ctx.quadraticCurveTo(L * 0.62, s.r * 0.95, L, 0);
    ctx.fill();

    // Dorsal fin.
    ctx.fillStyle = "#4d5d6c";
    ctx.beginPath();
    ctx.moveTo(L * 0.12, -s.r * 0.7);
    ctx.quadraticCurveTo(-L * 0.05, -s.r * 1.55, -L * 0.3, -s.r * 1.3);
    ctx.quadraticCurveTo(-L * 0.28, -s.r * 0.85, -L * 0.32, -s.r * 0.62);
    ctx.closePath();
    ctx.fill();

    // Side fin.
    ctx.fillStyle = "rgba(70, 85, 98, 0.9)";
    ctx.beginPath();
    ctx.moveTo(L * 0.05, s.r * 0.35);
    ctx.quadraticCurveTo(-L * 0.12, s.r * 1.1, -L * 0.3, s.r * 1.05);
    ctx.quadraticCurveTo(-L * 0.18, s.r * 0.5, -L * 0.2, s.r * 0.3);
    ctx.closePath();
    ctx.fill();

    // Eye.
    ctx.fillStyle = "#1d262e";
    ctx.beginPath();
    ctx.arc(L * 0.62, -s.r * 0.25, 2.6, 0, TAU);
    ctx.fill();

    // Gill lines.
    ctx.strokeStyle = "rgba(40, 52, 62, 0.5)";
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(L * 0.3 - i * 5, 0, s.r * 0.5, -0.5, 0.5);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Darken/lighten a hex color by amt (-255..255).
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = clamp((n >> 16) + amt, 0, 255);
    const g = clamp(((n >> 8) & 0xff) + amt, 0, 255);
    const b = clamp((n & 0xff) + amt, 0, 255);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function drawOverlayPanel(alpha) {
    ctx.fillStyle = `rgba(8, 30, 44, ${0.55 * alpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  function drawCenteredText(lines) {
    ctx.textAlign = "center";
    let y = H / 2 - (lines.length - 1) * 24;
    for (const line of lines) {
      ctx.font = line.font;
      ctx.fillStyle = line.color;
      if (line.glow) {
        ctx.shadowColor = line.glow;
        ctx.shadowBlur = 24;
      }
      ctx.fillText(line.text, W / 2, y + (line.dy || 0));
      ctx.shadowBlur = 0;
      y += line.gap || 48;
    }
  }

  function draw() {
    drawWater();
    drawShore(0, SHORE_W, false);
    drawShore(W - SHORE_W, SHORE_W, true);
    drawShoreLabels();

    for (const s of game.sharks) drawShark(s);

    if (game.state === "playing" || game.state === "roundComplete") {
      for (const m of game.teammates) {
        if (m.alive && !m.safe) {
          drawMinnow(m.x, m.y, m.facing, m.tailPhase, m.color, 0.85, false);
        } else if (m.safe) {
          // Safe minnows rest by the far shore, gently bobbing.
          drawMinnow(W - SHORE_W * 0.45,
            m.y + Math.sin(game.time * 2 + m.wobblePhase) * 3,
            Math.PI, m.tailPhase, m.color, 0.85, false);
        }
      }
      const p = game.player;
      drawMinnow(p.x, p.y, p.facing, p.tailPhase, "#ff8a5c", 1.1, p.dashTimer > 0);
    }

    drawParticles();

    const font = "'Avenir Next', 'Segoe UI', sans-serif";

    if (game.state === "title") {
      drawOverlayPanel(1);
      drawCenteredText([
        { text: "SHARKS", font: `800 64px ${font}`, color: "#eaf6fb",
          glow: "rgba(107, 227, 255, 0.8)", dy: -60, gap: 52 },
        { text: "&  MINNOWS", font: `800 40px ${font}`, color: "#8fd8ef", dy: -58, gap: 70 },
        { text: "Swim across the pool. Don't get caught.", font: `500 19px ${font}`,
          color: "#cfe9f4", dy: -34, gap: 36 },
        { text: "Move: WASD / Arrow keys    Dash: Space or Shift", font: `500 16px ${font}`,
          color: "#9fc5d6", dy: -30, gap: 60 },
        { text: "One shark bite sends you all the way back to Round 1.", font: `600 15px ${font}`,
          color: "#ffb59b", dy: -40, gap: 56 },
        { text: "Press  ENTER  to  dive  in", font: `700 20px ${font}`,
          color: pulseColor(), dy: -20 },
      ]);
    } else if (game.state === "caught") {
      const a = Math.min(1, game.stateTimer * 2.4);
      drawOverlayPanel(a);
      ctx.globalAlpha = a;
      drawCenteredText([
        { text: "CHOMP!", font: `800 58px ${font}`, color: "#ff9b85",
          glow: "rgba(255, 110, 90, 0.85)", dy: -40, gap: 56 },
        { text: `A shark got you on Round ${game.round}.`, font: `500 19px ${font}`,
          color: "#f0d9d2", dy: -26, gap: 40 },
        { text: "Back to Round 1 — that's the rule of the pool.", font: `500 16px ${font}`,
          color: "#d8b8ae", dy: -24, gap: 52 },
        game.stateTimer > 0.8
          ? { text: "Press  ENTER  to  try  again", font: `700 19px ${font}`,
              color: pulseColor(), dy: -10 }
          : { text: "", font: `16px ${font}`, color: "#fff" },
      ]);
      ctx.globalAlpha = 1;
    } else if (game.state === "roundComplete") {
      const a = Math.min(1, game.stateTimer * 3);
      ctx.globalAlpha = a;
      drawCenteredText([
        { text: "SAFE!", font: `800 54px ${font}`, color: "#b8ffd4",
          glow: "rgba(120, 255, 170, 0.8)", dy: -20, gap: 50 },
        { text: `Round ${game.round + 1} incoming — the water gets busier…`,
          font: `600 18px ${font}`, color: "#e5fff0", dy: -12 },
      ]);
      ctx.globalAlpha = 1;
    }
  }

  function pulseColor() {
    const t = 0.6 + 0.4 * Math.sin(game.time * 4);
    return `rgba(255, 255, 255, ${t.toFixed(2)})`;
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------

  // A few ambient sharks cruise behind the title screen.
  game.sharks = Array.from({ length: 3 }, (_, i) => makeShark(i, 0.8));

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 20); // clamp big tab-switch gaps
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
