import {
  BALL_SIZE,
  BASE_BALL_VX,
  BASE_BALL_VY,
  BLOCK_H,
  BLOCK_W,
  BLOCKS_ORIGIN_X,
  BLOCKS_ORIGIN_Y,
  INITIAL_LIVES,
  MAX_DT,
  MAX_LEVEL,
  PADDLE_H,
  PADDLE_SPEED,
  PADDLE_W,
  PADDLE_Y,
  POINTS_PER_BLOCK,
} from "./constants";
import { LEVELS } from "./levels";
import {
  EXPLOSION_DURATION,
  EXPLOSION_FRAMES,
  SPRITES,
  type BlockColor,
  type SpriteRect,
} from "./sprites";

export const WORLD_WIDTH = 800;
export const WORLD_HEIGHT = 600;

export interface ArkanoidCallbacks {
  onScore?: (score: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onGameOver?: (finalScore: number) => void; // sin vidas, nivel 5 completado o endGame()
}

export interface ArkanoidEngine {
  start(): void; // carga el spritesheet y arranca el loop requestAnimationFrame; escucha teclado y ratón
  pause(): void; // congela update; limpia las teclas pulsadas; el último frame sigue visible
  resume(): void; // reinicia la referencia de tiempo para evitar saltos
  restart(): void; // puntaje 0, vidas 3, nivel 1, paleta centrada
  endGame(): void; // fuerza gameover con el puntaje actual
  destroy(): void; // cancela rAF y quita listeners (idempotente)
}

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
}

interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number; // ms
}

type GameState = "playing" | "gameover" | "win";

const SPRITESHEET_SRC = "/games/arkanoid/spritesheet-breakout.png";
const BOUNCE_SRC = "/games/arkanoid/ball-bounce.mp3";
const BREAK_SRC = "/games/arkanoid/break-sound.mp3";

type KeyName = "ArrowLeft" | "ArrowRight";
const isGameKey = (key: string): key is KeyName =>
  key === "ArrowLeft" || key === "ArrowRight";

export function createArkanoidEngine(
  canvas: HTMLCanvasElement,
  callbacks: ArkanoidCallbacks = {},
): ArkanoidEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");

  // ── Estado (encapsulado en el cierre) ───────────────────────────────────────
  const paddle = { x: 0, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H };
  const ball = { x: 0, y: 0, w: BALL_SIZE, h: BALL_SIZE, vx: 0, vy: 0 };
  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let lives = INITIAL_LIVES;
  let score = 0;
  let currentLevel = 1;
  let gameState: GameState = "playing";
  const keys: Record<KeyName, boolean> = { ArrowLeft: false, ArrowRight: false };

  let spritesheet: HTMLImageElement | null = null;
  let bounceSound: HTMLAudioElement | null = null;
  let breakSound: HTMLAudioElement | null = null;

  let running = false;
  let paused = false;
  let rafId: number | null = null;
  let lastTime: number | null = null;

  // ── Utilidades ──────────────────────────────────────────────────────────────
  const play = (sound: HTMLAudioElement | null) => {
    if (!sound) return;
    const clone = sound.cloneNode() as HTMLAudioElement;
    // El bloqueo de autoplay del navegador no debe generar errores de consola.
    clone.play()?.catch(() => {});
  };

  const clearKeys = () => {
    keys.ArrowLeft = false;
    keys.ArrowRight = false;
  };

  const isPlaying = () => running && !paused && gameState === "playing";

  // ── Lógica ──────────────────────────────────────────────────────────────────
  const placeBall = () => {
    const { speed } = LEVELS[currentLevel - 1];
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  };

  const loadLevel = (n: number) => {
    const changed = n !== currentLevel;
    currentLevel = n;
    blocks = LEVELS[n - 1].blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    placeBall();
    if (changed) callbacks.onLevel?.(n);
  };

  const initGame = () => {
    score = 0;
    lives = INITIAL_LIVES;
    gameState = "playing";
    clearKeys();
    paddle.x = (WORLD_WIDTH - paddle.w) / 2;
    currentLevel = 1;
    loadLevel(1);
    callbacks.onScore?.(0);
    callbacks.onLives?.(INITIAL_LIVES);
    callbacks.onLevel?.(1);
  };

  const finish = (state: "gameover" | "win") => {
    gameState = state;
    clearKeys();
    callbacks.onGameOver?.(score);
  };

  const collideAABB = (b: Block): boolean =>
    ball.x < b.x + b.w &&
    ball.x + ball.w > b.x &&
    ball.y < b.y + b.h &&
    ball.y + ball.h > b.y;

  // dt en segundos, como en la referencia.
  const update = (dt: number) => {
    if (gameState !== "playing") return;

    // Paleta
    if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys.ArrowRight)
      paddle.x = Math.min(WORLD_WIDTH - paddle.w, paddle.x + PADDLE_SPEED * dt);

    // Pelota
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Rebotes en paredes (izquierda, derecha, techo)
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      play(bounceSound);
    }
    if (ball.x + ball.w >= WORLD_WIDTH) {
      ball.x = WORLD_WIDTH - ball.w;
      ball.vx = -Math.abs(ball.vx);
      play(bounceSound);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      play(bounceSound);
    }

    // Rebote en la paleta
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      play(bounceSound);
    }

    // Colisión con bloques (uno por frame)
    for (const block of blocks) {
      if (!block.alive) continue;
      if (collideAABB(block)) {
        block.alive = false;
        explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        score += POINTS_PER_BLOCK;
        callbacks.onScore?.(score);
        ball.vy = -ball.vy;
        play(breakSound);
        if (blocks.every((b) => !b.alive)) {
          if (currentLevel < MAX_LEVEL) loadLevel(currentLevel + 1);
          else finish("win");
        }
        break;
      }
    }

    // Explosiones
    for (const exp of explosions) exp.elapsed += dt * 1000;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    // Pelota perdida
    if (gameState === "playing" && ball.y > WORLD_HEIGHT) {
      lives--;
      callbacks.onLives?.(lives);
      if (lives <= 0) finish("gameover");
      else placeBall();
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const drawRect = (sp: SpriteRect, x: number, y: number, w: number, h: number) => {
    if (!spritesheet) return;
    ctx.drawImage(spritesheet, sp.sx, sp.sy, sp.sw, sp.sh, x, y, w, h);
  };

  const draw = () => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    if (!spritesheet) return; // hasta que carga solo se pinta el fondo

    for (const block of blocks) {
      if (block.alive)
        drawRect(SPRITES.blocks[block.color], block.x, block.y, block.w, block.h);
    }

    for (const exp of explosions) {
      const frameIndex = Math.min(
        Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4),
        3,
      );
      drawRect(EXPLOSION_FRAMES[exp.color][frameIndex], exp.x, exp.y, exp.w, exp.h);
    }

    drawRect(SPRITES.paddle, paddle.x, paddle.y, paddle.w, paddle.h);
    drawRect(SPRITES.ball, ball.x, ball.y, ball.w, ball.h);

    // HUD original del canvas
    if (gameState === "playing") {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`Score: ${score}`, 10, 10);
      ctx.textAlign = "center";
      ctx.fillText(`Nivel: ${currentLevel}`, WORLD_WIDTH / 2, 10);
      const ballSize = 16;
      const ballSpacing = 4;
      for (let i = 0; i < lives; i++) {
        const bx = WORLD_WIDTH - 10 - (lives - i) * (ballSize + ballSpacing);
        drawRect(SPRITES.ball, bx, 10, ballSize, ballSize);
      }
    }
  };

  // ── Entrada ─────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (!isGameKey(e.key) || !isPlaying()) return;
    e.preventDefault();
    keys[e.key] = true;
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (isGameKey(e.key)) keys[e.key] = false;
  };

  const onBlur = () => clearKeys();

  const onMouseMove = (e: MouseEvent) => {
    if (!isPlaying()) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    paddle.x = Math.max(0, Math.min(WORLD_WIDTH - paddle.w, mouseX - paddle.w / 2));
  };

  // ── Loop ────────────────────────────────────────────────────────────────────
  const loop = (ts: number) => {
    if (!running) return;
    if (!spritesheet) {
      // Sin spritesheet no hay física; el primer dt tras cargar será 0.
      lastTime = null;
      draw();
      rafId = requestAnimationFrame(loop);
      return;
    }
    const dtMs = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
    lastTime = ts;
    update(dtMs / 1000);
    draw();
    // Con la partida terminada el último frame queda dibujado y el loop se detiene.
    if (gameState !== "playing") {
      rafId = null;
      lastTime = null;
      return;
    }
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

      bounceSound = new Audio(BOUNCE_SRC);
      breakSound = new Audio(BREAK_SRC);

      const img = new Image();
      img.onload = () => {
        // destroy() pudo llamarse mientras la imagen cargaba.
        if (!running) return;
        spritesheet = img;
      };
      img.onerror = () => console.error("No se pudo cargar el spritesheet de Arkanoid");
      img.src = SPRITESHEET_SRC;

      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onBlur);
      canvas.addEventListener("mousemove", onMouseMove);

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
      if (gameState !== "playing") return;
      startLoop(); // lastTime = null: el primer dt es 0, sin saltos
    },

    restart() {
      if (!running) return;
      paused = false;
      initGame();
      draw();
      startLoop();
    },

    endGame() {
      if (!running || gameState !== "playing") return;
      stopLoop();
      finish("gameover");
    },

    destroy() {
      running = false;
      paused = false;
      stopLoop();
      clearKeys();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("mousemove", onMouseMove);
      spritesheet = null;
      bounceSound = null;
      breakSound = null;
    },
  };
}
