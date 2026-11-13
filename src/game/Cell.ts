import { radiusScale, type GameConfig } from './GameConfig';

export type AIBehavior = 'food' | 'hunt' | 'flee';

/** Per-opponent AI bookkeeping. */
export interface AIState {
  behavior: AIBehavior;
  /** Where the cell is currently steering. */
  targetX: number;
  targetY: number;
  /** Id of the cell being hunted, if any. */
  preyId: number | null;
  /** Game time at which the next decision is due. */
  nextThink: number;
  /** Whether this opponent hunts other cells at all. */
  aggressive: boolean;
  /** Current random wander destination (used when no food is near). */
  wanderX: number;
  wanderY: number;
  hasWander: boolean;
}

export interface Cell {
  id: number;
  name: string;
  isPlayer: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  /** Current (smoothed) radius, used for rendering and collisions. */
  radius: number;
  color: string;
  outline: string;
  /** Opponents eaten by this cell. */
  eaten: number;
  /** Desired movement direction (unit vector or zero) and throttle in [0, 1]. */
  dirX: number;
  dirY: number;
  throttle: number;
  /** Multiplier on top of the size-based speed. */
  speedFactor: number;
  /** Set when the cell has been consumed and must be removed. */
  dead: boolean;
  ai: AIState | null;
}

export function massToRadius(mass: number, cfg: GameConfig): number {
  return Math.max(cfg.player.minRadius, radiusScale(cfg) * Math.sqrt(Math.max(0, mass)));
}

/** Maximum speed for a cell of the given radius (before the per-cell speed factor). */
export function speedForRadius(radius: number, cfg: GameConfig): number {
  const p = cfg.player;
  const raw = p.baseSpeed / (1 + p.speedFalloff * (radius - p.startRadius));
  return Math.max(p.minSpeed, raw);
}

export interface CellInit {
  id: number;
  name: string;
  x: number;
  y: number;
  mass: number;
  color: string;
  outline: string;
  isPlayer?: boolean;
  speedFactor?: number;
  ai?: AIState | null;
}

export function createCell(init: CellInit, cfg: GameConfig): Cell {
  return {
    id: init.id,
    name: init.name,
    isPlayer: init.isPlayer ?? false,
    x: init.x,
    y: init.y,
    vx: 0,
    vy: 0,
    mass: init.mass,
    radius: massToRadius(init.mass, cfg),
    color: init.color,
    outline: init.outline,
    eaten: 0,
    dirX: 0,
    dirY: 0,
    throttle: 0,
    speedFactor: init.speedFactor ?? 1,
    dead: false,
    ai: init.ai ?? null,
  };
}

export function addMass(cell: Cell, amount: number): void {
  cell.mass += amount;
}

/**
 * Eases the radius towards the value implied by mass,
 * so growth looks smooth and continuous.
 */
export function updateSize(cell: Cell, dt: number, cfg: GameConfig): void {
  const target = massToRadius(cell.mass, cfg);
  const k = 1 - Math.exp(-cfg.movement.radiusSmoothing * dt);
  cell.radius += (target - cell.radius) * k;
}

/** Moves the cell using its direction/throttle with smoothed velocity, and keeps it inside the arena. */
export function moveCell(cell: Cell, dt: number, cfg: GameConfig): void {
  const speed = speedForRadius(cell.radius, cfg) * cell.speedFactor * cell.throttle;
  const k = 1 - Math.exp(-cfg.movement.velocitySmoothing * dt);
  cell.vx += (cell.dirX * speed - cell.vx) * k;
  cell.vy += (cell.dirY * speed - cell.vy) * k;
  cell.x += cell.vx * dt;
  cell.y += cell.vy * dt;
  clampToArena(cell, cfg);
}

export function clampToArena(cell: Cell, cfg: GameConfig): void {
  const { width, height } = cfg.world;
  const r = cell.radius;
  if (cell.x < r) {
    cell.x = r;
    if (cell.vx < 0) cell.vx = 0;
  } else if (cell.x > width - r) {
    cell.x = width - r;
    if (cell.vx > 0) cell.vx = 0;
  }
  if (cell.y < r) {
    cell.y = r;
    if (cell.vy < 0) cell.vy = 0;
  } else if (cell.y > height - r) {
    cell.y = height - r;
    if (cell.vy > 0) cell.vy = 0;
  }
}
