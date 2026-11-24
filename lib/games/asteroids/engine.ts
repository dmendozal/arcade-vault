import {
  INITIAL_ASTEROIDS,
  INITIAL_LIVES,
  MAX_DT,
  POINTS,
  POWERUP_DROP_CHANCE,
  POWERUP_DURATION,
  POWERUP_GUARANTEED_KILLS,
  RESPAWN_DELAY,
  SAFE_DIST,
  SHIP_COLLISION_FACTOR,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./constants";
import {
  Asteroid,
  Bullet,
  Particle,
  PowerUp,
  Ship,
  type HeldKeys,
} from "./entities";
import { dist, rand } from "./utils";

export { WORLD_WIDTH, WORLD_HEIGHT };

export type AsteroidsStatus = "playing" | "dead" | "gameover";

export interface AsteroidsCallbacks {
  onScore?: (score: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onGameOver?: (finalScore: number) => void; // vidas = 0 o endGame()
}

export interface AsteroidsEngine {
  start(): void; // inicia el loop requestAnimationFrame y escucha teclado
  pause(): void; // congela update; el último frame sigue visible
  resume(): void;
  restart(): void; // reinicia puntaje, vidas y nivel
  endGame(): void; // fuerza gameover con el puntaje actual
  destroy(): void; // cancela rAF y quita listeners
}

const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "Space"]);

export function createAsteroidsEngine(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks = {},
): AsteroidsEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");

  // ── Estado (encapsulado en el cierre) ───────────────────────────────────────
  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let powerUps: PowerUp[] = [];
  let score = 0;
  let lives = INITIAL_LIVES;
  let level = 1;
  let state: AsteroidsStatus = "playing";
  let deadTimer = 0;
  let powerUpSpawned = false;
  let killsSinceSpawn = 0;

  let running = false;
  let paused = false;
  let rafId: number | null = null;
  let lastTime: number | null = null;

  const keys: HeldKeys = {};
  const justPressed: HeldKeys = {};

  // ── Entrada ─────────────────────────────────────────────────────────────────
  const pressed = (code: string): boolean => {
    const val = !!justPressed[code];
    justPressed[code] = false;
    return val;
  };

  const clearKeys = () => {
    for (const k of Object.keys(keys)) keys[k] = false;
    for (const k of Object.keys(justPressed)) justPressed[k] = false;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!GAME_KEYS.has(e.code)) return;
    // Solo se captura mientras se juega; en pausa o fin las teclas quedan libres.
    if (paused || state === "gameover") return;
    e.preventDefault();
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (!GAME_KEYS.has(e.code)) return;
    keys[e.code] = false;
  };

  const onBlur = () => clearKeys();

  // ── Lógica ──────────────────────────────────────────────────────────────────
  const setScore = (value: number) => {
    if (value === score) return;
    score = value;
    callbacks.onScore?.(score);
  };

  const setLives = (value: number) => {
    if (value === lives) return;
    lives = value;
    callbacks.onLives?.(lives);
  };

  const setLevel = (value: number) => {
    if (value === level) return;
    level = value;
    callbacks.onLevel?.(level);
  };

  const spawnAsteroids = (count: number) => {
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      do {
        x = rand(0, WORLD_WIDTH);
        y = rand(0, WORLD_HEIGHT);
      } while (
        Math.hypot(x - WORLD_WIDTH / 2, y - WORLD_HEIGHT / 2) < SAFE_DIST
      );
      asteroids.push(new Asteroid(x, y, 3));
    }
  };

  const initGame = () => {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    state = "playing";
    deadTimer = 0;
    clearKeys();
    spawnAsteroids(INITIAL_ASTEROIDS);
    score = 0;
    lives = INITIAL_LIVES;
    level = 1;
    // Sincroniza el HUD externo con el estado inicial.
    callbacks.onScore?.(score);
    callbacks.onLives?.(lives);
    callbacks.onLevel?.(level);
  };

  const nextLevel = () => {
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset();
    setLevel(level + 1);
    spawnAsteroids(3 + level);
  };

  const explode = (x: number, y: number, count = 8) => {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  };

  const killShip = () => {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    setLives(lives - 1);
    if (lives <= 0) {
      state = "gameover";
      clearKeys();
      callbacks.onGameOver?.(score);
    } else {
      state = "dead";
      deadTimer = RESPAWN_DELAY;
    }
  };

  const updateParticles = (dt: number) => {
    particles.forEach((p) => p.update(dt));
    particles = particles.filter((p) => !p.dead);
  };

  const update = (dt: number) => {
    if (state === "gameover") {
      updateParticles(dt);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      updateParticles(dt);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    // Disparar
    if (pressed("Space")) bullets.push(...ship.tryShoot());

    ship.update(dt, keys);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);

    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    let gained = 0;
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          gained += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!powerUpSpawned) {
            killsSinceSpawn++;
            const guaranteed = killsSinceSpawn >= POWERUP_GUARANTEED_KILLS;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              powerUps.push(new PowerUp(a.x, a.y));
              powerUpSpawned = true;
            }
          }
        }
      }
    }
    if (gained > 0) setScore(score + gained);
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    // Nave vs asteroide
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * SHIP_COLLISION_FACTOR) {
          killShip();
          break;
        }
      }
    }

    // Nivel completado
    if (state === "playing" && asteroids.length === 0) nextLevel();
  };

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  const drawLifeIcon = (x: number, y: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  };

  const drawHUD = () => {
    ctx.fillStyle = "#fff";
    ctx.font = "15px monospace";
    ctx.textBaseline = "alphabetic";

    ctx.textAlign = "left";
    ctx.fillText(`SCORE  ${score}`, 14, 26);

    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${level}`, WORLD_WIDTH / 2, 26);

    for (let i = 0; i < lives; i++) drawLifeIcon(WORLD_WIDTH - 16 - i * 22, 18);

    if (ship.tripleShot > 0) {
      ctx.textAlign = "left";
      ctx.fillStyle = "#0ff";
      ctx.fillText(`3x  ${ship.tripleShot.toFixed(1)}s`, 14, 46);
    }
  };

  const draw = () => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    particles.forEach((p) => p.draw(ctx));
    asteroids.forEach((a) => a.draw(ctx));
    powerUps.forEach((p) => p.draw(ctx));
    bullets.forEach((b) => b.draw(ctx));
    ship.draw(ctx);

    drawHUD();
  };

  // ── Loop ────────────────────────────────────────────────────────────────────
  const loop = (ts: number) => {
    if (!running) return;
    const dt =
      lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  };

  const stopLoop = () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    lastTime = null;
  };

  const startLoop = () => {
    stopLoop();
    rafId = requestAnimationFrame(loop);
  };

  // ── API ─────────────────────────────────────────────────────────────────────
  return {
    start() {
      if (running) return;
      running = true;
      paused = false;
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onBlur);
      initGame();
      draw();
      startLoop();
    },

    pause() {
      if (!running || paused) return;
      paused = true;
      clearKeys();
      stopLoop(); // el último frame queda dibujado
    },

    resume() {
      if (!running || !paused) return;
      paused = false;
      startLoop(); // lastTime = null: el primer dt es 0, sin saltos
    },

    restart() {
      if (!running) return;
      paused = false;
      initGame();
      startLoop();
    },

    endGame() {
      if (!running || state === "gameover") return;
      state = "gameover";
      clearKeys();
      callbacks.onGameOver?.(score);
    },

    destroy() {
      running = false;
      paused = false;
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },
  };
}
