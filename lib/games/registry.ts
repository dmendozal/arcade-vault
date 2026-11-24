import {
  createElement as h,
  type ComponentType,
  type ReactNode,
  type Ref,
} from "react";
import { AsteroidsCanvas } from "@/components/asteroids-canvas";
import { TetrisCanvas } from "@/components/tetris-canvas";

// Solo se importa desde Client Components (components/game-player.tsx).

export interface GameCanvasHandle {
  pause(): void;
  resume(): void;
  restart(): void;
  endGame(): void;
}

export interface GameCanvasProps {
  ref?: Ref<GameCanvasHandle>;
  onScore?: (score: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
}

export interface RegisteredGame {
  Canvas: ComponentType<GameCanvasProps>;
  hasLives: boolean; // false → el HUD muestra "—" en Vidas
  controls: ReactNode; // nota de controles bajo el CRT
}

const key = (label: string) => h("kbd", null, label);

const controlsNote = (...items: ReactNode[]) =>
  h(
    "p",
    { className: "controls-note" },
    ...items.map((item, i) => h("span", { key: i }, item)),
  );

export const GAME_REGISTRY: Record<string, RegisteredGame> = {
  asteroids: {
    Canvas: AsteroidsCanvas,
    hasLives: true,
    controls: controlsNote(
      [key("←"), " ", key("→"), " girar"],
      [key("↑"), " propulsar"],
      [key("Espacio"), " disparar"],
    ),
  },
  tetris: {
    Canvas: TetrisCanvas,
    hasLives: false,
    controls: controlsNote(
      [key("←"), " ", key("→"), " mover"],
      [key("↑"), " o ", key("X"), " rotar"],
      [key("↓"), " bajar"],
      [key("Espacio"), " caída rápida"],
    ),
  },
};
