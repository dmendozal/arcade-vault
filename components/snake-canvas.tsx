"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import {
  createSnakeEngine,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type SnakeCallbacks,
  type SnakeEngine,
} from "@/lib/games/snake/engine";

export interface SnakeCanvasHandle {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  endGame: () => void;
}

interface SnakeCanvasProps extends SnakeCallbacks {
  ref?: Ref<SnakeCanvasHandle>;
}

export function SnakeCanvas({
  ref,
  onScore,
  onLives,
  onLevel,
  onGameOver,
}: SnakeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SnakeEngine | null>(null);

  // Los callbacks se leen desde una ref para no recrear el motor si cambian.
  const callbacksRef = useRef<SnakeCallbacks>({});
  useEffect(() => {
    callbacksRef.current = { onScore, onLives, onLevel, onGameOver };
  });

  useImperativeHandle(ref, () => ({
    pause: () => engineRef.current?.pause(),
    resume: () => engineRef.current?.resume(),
    restart: () => engineRef.current?.restart(),
    endGame: () => engineRef.current?.endGame(),
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = createSnakeEngine(canvas, {
      onScore: (v) => callbacksRef.current.onScore?.(v),
      onLives: (v) => callbacksRef.current.onLives?.(v),
      onLevel: (v) => callbacksRef.current.onLevel?.(v),
      onGameOver: (v) => callbacksRef.current.onGameOver?.(v),
    });
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={WORLD_WIDTH}
      height={WORLD_HEIGHT}
      style={{ display: "block", width: "100%", height: "auto" }}
    />
  );
}
