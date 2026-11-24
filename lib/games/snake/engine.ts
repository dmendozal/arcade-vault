import {
  CELL,
  COLS,
  FRUITS_PER_LEVEL,
  INITIAL_LENGTH,
  MAX_DT,
  MAX_QUEUED_TURNS,
  POINTS_PER_FRUIT,
  ROWS,
  TICK_BASE_MS,
  TICK_MIN_MS,
  TICK_STEP_MS,
} from "./constants";
import { FRUITS, FRUITS_SHEET_SRC, type SpriteRect } from "./sprites";

export const WORLD_WIDTH = 800;
export const WORLD_HEIGHT = 600;

export interface SnakeCallbacks {
  onScore?: (score: number) => void;
  onLives?: (lives: number) => void; // no se invoca: Snake no tiene vidas
  onLevel?: (level: number) => void;
  onGameOver?: (finalScore: number) => void; // choque, tablero lleno o endGame()
}

export interface SnakeEngine {
  start(): void; // carga fruits.png y arranca el loop requestAnimationFrame; escucha teclado
  pause(): void; // congela update; limpia la cola de giros; el último frame sigue visible
  resume(): void; // reinicia la referencia de tiempo y el acumulador de tick
  restart(): void; // serpiente de 3 segmentos, puntaje 0, nivel 1
  endGame(): void; // fuerza gameover con el puntaje actual
  destroy(): void; // cancela rAF y quita listeners (idempotente)
}

interface Cell {
  col: number;
  row: number;
}

interface Direction {
  dx: number;
  dy: number;
}

interface Fruit extends Cell {
  sprite: SpriteRect;
}

type GameState = "playing" | "gameover" | "win";

const LEFT: Direction = { dx: -1, dy: 0 };
const RIGHT: Direction = { dx: 1, dy: 0 };
const UP: Direction = { dx: 0, dy: -1 };
const DOWN: Direction = { dx: 0, dy: 1 };

const KEY_DIRECTIONS: Record<string, Direction> = {
  arrowleft: LEFT,
  a: LEFT,
  arrowright: RIGHT,
  d: RIGHT,
  arrowup: UP,
  w: UP,
  arrowdown: DOWN,
  s: DOWN,
};

const sameDir = (a: Direction, b: Direction) => a.dx === b.dx && a.dy === b.dy;
const oppositeDir = (a: Direction, b: Direction) =>
  a.dx === -b.dx && a.dy === -b.dy;

const BOARD_LIGHT = "#aad751";
const BOARD_DARK = "#a2d149";
const BODY_COLOR = "#4a75e8";
const HEAD_COLOR = "#3a5fc4";
const FRUIT_MAX_SIDE = CELL - 4;
const FRUIT_SPRITES = Object.values(FRUITS);

export function createSnakeEngine(
  canvas: HTMLCanvasElement,
  callbacks: SnakeCallbacks = {},
): SnakeEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");

  // ── Estado (encapsulado en el cierre) ───────────────────────────────────────
  let snake: Cell[] = []; // cabeza primero
  let direction: Direction = RIGHT;
  let turnQueue: Direction[] = [];
  let fruit: Fruit | null = null;
  let score = 0;
  let fruitsEaten = 0;
  let level = 1;
  let tickAcc = 0;
  let gameState: GameState = "playing";

  let fruitsImage: HTMLImageElement | null = null;

  let running = false;
  let paused = false;
  let rafId: number | null = null;
  let lastTime: number | null = null;

  // ── Utilidades ──────────────────────────────────────────────────────────────
  const isPlaying = () => running && !paused && gameState === "playing";

  const clearTurns = () => {
    turnQueue = [];
  };

  const tickMs = () =>
    Math.max(TICK_MIN_MS, TICK_BASE_MS - (level - 1) * TICK_STEP_MS);

  // ── Lógica ──────────────────────────────────────────────────────────────────
  const spawnFruit = () => {
    const occupied = new Set(snake.map((c) => c.row * COLS + c.col));
    const free: number[] = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      if (!occupied.has(i)) free.push(i);
    }
    if (free.length === 0) {
      fruit = null;
      return;
    }
    const idx = free[Math.floor(Math.random() * free.length)];
    fruit = {
      col: idx % COLS,
      row: Math.floor(idx / COLS),
      sprite: FRUIT_SPRITES[Math.floor(Math.random() * FRUIT_SPRITES.length)],
    };
  };

  const initGame = () => {
    const headCol = Math.floor(COLS / 2);
    const headRow = Math.floor(ROWS / 2);
    snake = Array.from({ length: INITIAL_LENGTH }, (_, i) => ({
      col: headCol - i,
      row: headRow,
    }));
    direction = RIGHT;
    clearTurns();
    score = 0;
    fruitsEaten = 0;
    level = 1;
    tickAcc = 0;
    gameState = "playing";
    spawnFruit();
    callbacks.onScore?.(0);
    callbacks.onLevel?.(1);
  };

  const finish = (state: "gameover" | "win") => {
    gameState = state;
    clearTurns();
    callbacks.onGameOver?.(score);
  };

  const tick = () => {
    // 1. Giro pendiente: se descarta el que sea igual u opuesto a la dirección.
    while (turnQueue.length > 0) {
      const next = turnQueue.shift()!;
      if (sameDir(next, direction) || oppositeDir(next, direction)) continue;
      direction = next;
      break;
    }

    // 2. Nueva cabeza y choque con el muro.
    const head = snake[0];
    const col = head.col + direction.dx;
    const row = head.row + direction.dy;
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) {
      finish("gameover");
      return;
    }

    // 3. Choque con el cuerpo: la cola se libera salvo que se coma fruta.
    const eats = fruit !== null && fruit.col === col && fruit.row === row;
    const solidLength = eats ? snake.length : snake.length - 1;
    for (let i = 0; i < solidLength; i++) {
      if (snake[i].col === col && snake[i].row === row) {
        finish("gameover");
        return;
      }
    }

    // 4. Mover.
    snake.unshift({ col, row });
    if (!eats) {
      snake.pop();
      return;
    }

    // 5. Comer, crecer y subir de nivel.
    score += POINTS_PER_FRUIT;
    fruitsEaten++;
    callbacks.onScore?.(score);
    const nextLevel = Math.floor(fruitsEaten / FRUITS_PER_LEVEL) + 1;
    if (nextLevel !== level) {
      level = nextLevel;
      callbacks.onLevel?.(level);
    }

    // 6. Tablero lleno = victoria; si no, siguiente fruta.
    if (snake.length >= COLS * ROWS) {
      fruit = null;
      finish("win");
      return;
    }
    spawnFruit();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const INSET = 3;

  const drawSegment = (cell: Cell, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(
      cell.col * CELL + INSET,
      cell.row * CELL + INSET,
      CELL - INSET * 2,
      CELL - INSET * 2,
      10,
    );
    ctx.fill();
  };

  // Rellena el hueco entre dos segmentos contiguos para que el cuerpo se vea continuo.
  const drawConnector = (a: Cell, b: Cell) => {
    const x = Math.min(a.col, b.col) * CELL + INSET;
    const y = Math.min(a.row, b.row) * CELL + INSET;
    const w = (Math.abs(a.col - b.col) + 1) * CELL - INSET * 2;
    const h = (Math.abs(a.row - b.row) + 1) * CELL - INSET * 2;
    ctx.fillStyle = BODY_COLOR;
    ctx.fillRect(x, y, w, h);
  };

  const drawEyes = (head: Cell) => {
    const cx = head.col * CELL + CELL / 2;
    const cy = head.row * CELL + CELL / 2;
    // Los ojos se separan en el eje perpendicular a la dirección.
    const px = -direction.dy;
    const py = direction.dx;
    for (const side of [-1, 1]) {
      const ex = cx + direction.dx * 7 + px * side * 8;
      const ey = cy + direction.dy * 7 + py * side * 8;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(ex, ey, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1b1b1b";
      ctx.beginPath();
      ctx.arc(ex + direction.dx * 2, ey + direction.dy * 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const draw = () => {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        ctx.fillStyle = (col + row) % 2 === 0 ? BOARD_LIGHT : BOARD_DARK;
        ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
      }
    }

    if (fruit && fruitsImage) {
      const { x, y, w, h } = fruit.sprite;
      const scale = Math.min(FRUIT_MAX_SIDE / w, FRUIT_MAX_SIDE / h);
      const dw = w * scale;
      const dh = h * scale;
      ctx.drawImage(
        fruitsImage,
        x,
        y,
        w,
        h,
        fruit.col * CELL + (CELL - dw) / 2,
        fruit.row * CELL + (CELL - dh) / 2,
        dw,
        dh,
      );
    }

    for (let i = 1; i < snake.length; i++) drawConnector(snake[i - 1], snake[i]);
    for (let i = snake.length - 1; i >= 1; i--) drawSegment(snake[i], BODY_COLOR);
    if (snake.length > 0) {
      drawSegment(snake[0], HEAD_COLOR);
      drawEyes(snake[0]);
    }
  };

  // ── Entrada ─────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const dir = KEY_DIRECTIONS[e.key.toLowerCase()];
    if (!dir || !isPlaying()) return;
    e.preventDefault();
    if (e.repeat || turnQueue.length >= MAX_QUEUED_TURNS) return;
    // Ignora repeticiones de la última dirección pedida.
    const last = turnQueue.length > 0 ? turnQueue[turnQueue.length - 1] : direction;
    if (sameDir(dir, last)) return;
    turnQueue.push(dir);
  };

  const onBlur = () => clearTurns();

  // ── Loop ────────────────────────────────────────────────────────────────────
  const loop = (ts: number) => {
    if (!running) return;
    if (!fruitsImage) {
      // Sin imagen no hay ticks; el primer dt tras cargar será 0.
      lastTime = null;
      draw();
      rafId = requestAnimationFrame(loop);
      return;
    }
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
    lastTime = ts;
    tickAcc += dt;
    while (gameState === "playing" && tickAcc >= tickMs()) {
      tickAcc -= tickMs();
      tick();
    }
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

      const img = new Image();
      img.onload = () => {
        // destroy() pudo llamarse mientras la imagen cargaba.
        if (!running) return;
        fruitsImage = img;
      };
      img.onerror = () => console.error("No se pudo cargar las frutas de Snake");
      img.src = FRUITS_SHEET_SRC;

      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("blur", onBlur);

      initGame();
      draw();
      startLoop();
    },

    pause() {
      if (!running || paused) return;
      paused = true;
      clearTurns();
      stopLoop(); // el último frame queda dibujado
    },

    resume() {
      if (!running || !paused) return;
      paused = false;
      if (gameState !== "playing") return;
      tickAcc = 0;
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
      clearTurns();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
      fruitsImage = null;
    },
  };
}
