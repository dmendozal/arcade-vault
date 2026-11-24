export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30;

export const LINE_SCORES = [0, 100, 300, 500, 800];
export const MAX_SCORE = 1_000_000;
export const MAX_DT = 50; // ms

// Origen del tablero y del panel dentro del canvas 800×600.
export const BOARD_X = 155;
export const PANEL_X = 485;

// Color fijo de la cuadrícula (la referencia lo leía de una variable CSS).
export const GRID_COLOR = "#22222e";

// Indexados por tipo de pieza (1–8); el índice 0 es vacío.
export const COLORS: readonly (string | null)[] = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - pale blue
  "#ffb74d", // L - orange
];

export const PIECES: readonly (readonly (readonly number[])[] | null)[] = [
  null,
  [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
  [[2, 2], [2, 2]], // O
  [[0, 3, 0], [3, 3, 3], [0, 0, 0]], // T
  [[0, 4, 4], [4, 4, 0], [0, 0, 0]], // S
  [[5, 5, 0], [0, 5, 5], [0, 0, 0]], // Z
  [[6, 0, 0], [6, 6, 6], [0, 0, 0]], // J
  [[0, 0, 7], [7, 7, 7], [0, 0, 0]], // L
];
