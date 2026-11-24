"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import {
  createArkanoidEngine,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type ArkanoidCallbacks,
  type ArkanoidEngine,
} from "@/lib/games/arkanoid/engine";

export interface ArkanoidCanvasHandle {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  endGame: () => void;
}

interface ArkanoidCanvasProps extends ArkanoidCallbacks {
  ref?: Ref<ArkanoidCanvasHandle>;
}

export function ArkanoidCanvas({
  ref,
  onScore,
  onLives,
  onLevel,
  onGameOver,
}: ArkanoidCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ArkanoidEngine | null>(null);

  // Los callbacks se leen desde una ref para no recrear el motor si cambian.
  const callbacksRef = useRef<ArkanoidCallbacks>({});
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

    const engine = createArkanoidEngine(canvas, {
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
