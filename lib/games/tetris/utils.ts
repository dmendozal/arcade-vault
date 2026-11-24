import { COLS, PIECES, ROWS } from "./constants";

export type Shape = number[][];
export type Board = number[][];

export interface Piece {
  type: number;
  shape: Shape;
  x: number;
  y: number;
}

export const createBoard = (): Board =>
  Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));

export const rotateCW = (shape: Shape): Shape => {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: Shape = Array.from({ length: cols }, () =>
    new Array<number>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
};

export const randomPiece = (): Piece => {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type]!.map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
};
