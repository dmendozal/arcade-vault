export const WORLD_WIDTH = 800;
export const WORLD_HEIGHT = 600;

// Indexados por tamaño de asteroide: 1 (pequeño), 2 (mediano), 3 (grande).
export const RADII = [0, 16, 30, 50] as const;
export const SPEEDS = [0, 85, 55, 32] as const;
export const POINTS = [0, 100, 50, 20] as const;

export const POWERUP_DROP_CHANCE = 0.15;
export const POWERUP_DURATION = 5;
export const POWERUP_TTL = 12;
export const TRIPLE_SPREAD = 0.18;
/** Muertes de asteroide sin drop tras las cuales el power-up está garantizado. */
export const POWERUP_GUARANTEED_KILLS = 5;

export const BULLET_SPEED = 520;
export const BULLET_TTL = 1.1;
export const SHOOT_COOLDOWN = 0.2;
export const SHIP_NOSE = 21;
export const SHIP_ROT = 3.5; // rad/s
export const SHIP_THRUST = 260; // px/s²
export const SHIP_DRAG = 0.987;
export const SHIP_INVINCIBLE = 3; // s
export const SHIP_COLLISION_FACTOR = 0.82;
export const RESPAWN_DELAY = 2; // s
export const SAFE_DIST = 130;
export const MAX_DT = 0.05; // s
export const INITIAL_LIVES = 3;
export const INITIAL_ASTEROIDS = 4;
