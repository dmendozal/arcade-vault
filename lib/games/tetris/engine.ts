import {
  BLOCK,
  BOARD_X,
  COLORS,
  COLS,
  GRID_COLOR,
  LINE_SCORES,
  MAX_DT,
  MAX_SCORE,
  PANEL_X,
  ROWS,
} from "./constants";
import {
  createBoard,
  randomPiece,
  rotateCW,
  type Board,
  type Piece,
  type Shape,
} from "./utils";

export const WORLD_WIDTH = 800;
export const WORLD_HEIGHT = 600;

export interface TetrisCallbacks {
  onScore?: (score: number) => void;
  onLives?: (lives: number) => void; // no se invoca: Tetris no tiene vidas
  onLevel?: (level: number) => void;
  onGameOver?: (finalScore: number) => void; // spawn bloqueado, tope de puntaje o endGame()
}

export interface TetrisEngine {
  start(): void; // inicia el loop requestAnimationFrame y escucha teclado
  pause(): void; // congela update; el último frame sigue visible
  resume(): void; // reinicia la referencia de tiempo para evitar saltos
  restart(): void; // tablero vacío, puntaje 0, líneas 0, nivel 1
  endGame(): void; // fuerza gameover con el puntaje actual
  destroy(): void; // cancela rAF y quita listeners (idempotente)
}

const GAME_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowDown",
  "ArrowUp",
  "KeyX",
  "Space",
]);

const KICKS = [0, -1, 1, -2, 2];
const NEXT_BLOCK = 30;
const NEXT_BOX = 120;
const PANEL_FONT = "monospace";

export function createTetrisEngine(
  canvas: HTMLCanvasElement,
  callbacks: TetrisCallbacks = {},
): TetrisEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");

  // ── Estado (encapsulado en el cierre) ───────────────────────────────────────
  let board: Board = createBoard();
  let current: Piece = randomPiece();
  let next: Piece = randomPiece();
  let score = 0;
  let lines = 0;
  let level = 1;
  let dropAccum = 0;
  let dropInterval = 1000;
  let over = false;

  let running = false;
  let paused = false;
  let rafId: number | null = null;
  let lastTime: number | null = null;

  // ── Lógica ──────────────────────────────────────────────────────────────────
  const collide = (shape: Shape, ox: number, oy: number): boolean => {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  };

  const finish = () => {
    if (over) return;
    over = true;
    callbacks.onGameOver?.(score);
  };

  // Única vía para sumar puntaje: aplica el tope y termina la partida al alcanzarlo.
  const addScore = (points: number) => {
    if (over || points <= 0) return;
    const value = Math.min(score + points, MAX_SCORE);
    if (value === score) return;
    score = value;
    callbacks.onScore?.(score);
    if (score >= MAX_SCORE) finish();
  };

  const setLevel = (value: number) => {
    if (value === level) return;
    level = value;
    callbacks.onLevel?.(level);
  };

  const tryRotate = () => {
    const rotated = rotateCW(current.shape);
    for (const kick of KICKS) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  };

  const merge = () => {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          board[current.y + r][current.x + c] = current.shape[r][c];
  };

  const clearLines = () => {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (!cleared) return;
    lines += cleared;
    addScore((LINE_SCORES[cleared] || 0) * level);
    setLevel(Math.floor(lines / 10) + 1);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  };

  const ghostY = (): number => {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  };

  const spawn = () => {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) finish();
  };

  const lockPiece = () => {
    merge();
    clearLines();
    if (over) return; // el tope de puntaje ya terminó la partida
    spawn();
  };

  const hardDrop = () => {
    const gy = ghostY();
    addScore((gy - current.y) * 2);
    current.y = gy;
    if (over) return;
    lockPiece();
  };

  const softDrop = () => {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      addScore(1);
    } else {
      lockPiece();
    }
  };

  const initGame = () => {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    dropAccum = 0;
    over = false;
    next = randomPiece();
    spawn();
    // Sincroniza el HUD externo con el estado inicial.
    callbacks.onScore?.(score);
    callbacks.onLevel?.(level);
  };

  const update = (dt: number) => {
    dropAccum += dt;
    if (dropAccum < dropInterval) return;
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) current.y++;
    else lockPiece();
  };

  // ── Entrada ─────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (!GAME_KEYS.has(e.code)) return;
    // Solo se captura mientras se juega; en pausa o fin las teclas quedan libres.
    if (paused || over) return;
    e.preventDefault();
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
    draw(); // refleja la acción de inmediato, también si el loop está detenido
  };

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  const drawBlock = (
    px: number,
    py: number,
    colorIndex: number,
    alpha = 1,
  ) => {
    if (!colorIndex) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS[colorIndex] ?? "#fff";
    ctx.fillRect(px + 1, py + 1, BLOCK - 2, BLOCK - 2);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(px + 1, py + 1, BLOCK - 2, 4);
    ctx.globalAlpha = 1;
  };

  const drawGrid = () => {
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X + c * BLOCK, 0);
      ctx.lineTo(BOARD_X + c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X, r * BLOCK);
      ctx.lineTo(BOARD_X + COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }
  };

  const drawPanelStat = (label: string, value: string, y: number) => {
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#8a8aa0";
    ctx.font = `13px ${PANEL_FONT}`;
    ctx.fillText(label, PANEL_X, y);
    ctx.fillStyle = "#fff";
    ctx.font = `bold 24px ${PANEL_FONT}`;
    ctx.fillText(value, PANEL_X, y + 30);
  };

  const drawNext = () => {
    const boxY = 345;
    ctx.fillStyle = "#8a8aa0";
    ctx.font = `13px ${PANEL_FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("NEXT", PANEL_X, boxY - 14);
    ctx.fillStyle = "#11111a";
    ctx.fillRect(PANEL_X, boxY, NEXT_BOX, NEXT_BOX);
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(PANEL_X + 0.5, boxY + 0.5, NEXT_BOX - 1, NEXT_BOX - 1);

    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(
          PANEL_X + (offX + c) * NEXT_BLOCK,
          boxY + (offY + r) * NEXT_BLOCK,
          shape[r][c],
        );
  };

  const draw = () => {
    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Tablero
    ctx.fillStyle = "#11111a";
    ctx.fillRect(BOARD_X, 0, COLS * BLOCK, ROWS * BLOCK);
    drawGrid();
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        drawBlock(BOARD_X + c * BLOCK, r * BLOCK, board[r][c]);

    // Pieza fantasma y pieza actual
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(
          BOARD_X + (current.x + c) * BLOCK,
          (gy + r) * BLOCK,
          current.shape[r][c],
          0.2,
        );
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(
          BOARD_X + (current.x + c) * BLOCK,
          (current.y + r) * BLOCK,
          current.shape[r][c],
        );

    // Panel
    drawPanelStat("SCORE", score.toLocaleString("es-ES"), 60);
    drawPanelStat("LINES", String(lines), 150);
    drawPanelStat("LEVEL", String(level).padStart(2, "0"), 240);
    drawNext();
  };

  // ── Loop ────────────────────────────────────────────────────────────────────
  const loop = (ts: number) => {
    if (!running) return;
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
    lastTime = ts;
    update(dt);
    draw();
    // Con la partida terminada el último frame queda dibujado y el loop se detiene.
    if (over) {
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
      window.addEventListener("keydown", onKeyDown);
      initGame();
      draw();
      startLoop();
    },

    pause() {
      if (!running || paused) return;
      paused = true;
      stopLoop(); // el último frame queda dibujado
    },

    resume() {
      if (!running || !paused) return;
      paused = false;
      if (over) return;
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
      if (!running || over) return;
      stopLoop();
      finish();
    },

    destroy() {
      running = false;
      paused = false;
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
