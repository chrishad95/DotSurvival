import type { Cell, AIState } from './Cell';
import type { SpatialGrid } from './Collision';
import type { Food, Rng } from './Food';
import type { GameConfig } from './GameConfig';

/** Everything the AI needs to read from the world. */
export interface AIContext {
  cfg: GameConfig;
  cells: Cell[];
  foodGrid: SpatialGrid<Food>;
  rng: Rng;
  /** Game time in seconds. */
  time: number;
  /** Reusable buffer for spatial queries (avoids per-decision allocation). */
  scratch: Food[];
}

export function createAIState(cfg: GameConfig, rng: Rng, time: number): AIState {
  return {
    behavior: 'food',
    targetX: 0,
    targetY: 0,
    preyId: null,
    // Desynchronise opponents so that they do not all think on the same frame.
    nextThink: time + rng() * cfg.ai.decisionInterval,
    aggressive: rng() < cfg.ai.aggressiveShare,
    wanderX: 0,
    wanderY: 0,
    hasWander: false,
  };
}

/**
 * Runs the AI for one opponent: re-decides at the configured interval, and steers
 * towards the current target every frame.
 */
export function updateAI(cell: Cell, ctx: AIContext): void {
  const ai = cell.ai;
  if (!ai) return;
  if (ctx.time >= ai.nextThink) {
    decide(cell, ai, ctx);
    ai.nextThink = ctx.time + ctx.cfg.ai.decisionInterval * (0.8 + ctx.rng() * 0.4);
  }
  steer(cell, ai);
}

function steer(cell: Cell, ai: AIState): void {
  const dx = ai.targetX - cell.x;
  const dy = ai.targetY - cell.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) {
    cell.throttle = 0;
    return;
  }
  cell.dirX = dx / d;
  cell.dirY = dy / d;
  cell.throttle = 1;
}

function decide(cell: Cell, ai: AIState, ctx: AIContext): void {
  const { cfg } = ctx;

  // 1. Escape: highest priority whenever a larger cell is dangerously close.
  if (decideFlee(cell, ai, ctx)) {
    ai.behavior = 'flee';
    ai.preyId = null;
    cell.speedFactor = cfg.ai.speedFactor;
    return;
  }

  // 2. Hunt: chase a clearly smaller, reachable cell.
  if (ai.aggressive && decideHunt(cell, ai, ctx)) {
    ai.behavior = 'hunt';
    cell.speedFactor = cfg.ai.huntSpeedFactor;
    return;
  }

  // 3. Collect food (or wander when nothing is nearby).
  ai.behavior = 'food';
  ai.preyId = null;
  cell.speedFactor = cfg.ai.speedFactor;
  decideFood(cell, ai, ctx);
}

function decideFlee(cell: Cell, ai: AIState, ctx: AIContext): boolean {
  const { cfg, cells } = ctx;
  let fx = 0;
  let fy = 0;
  let threatened = false;

  for (const other of cells) {
    if (other === cell || other.dead) continue;
    if (other.radius < cell.radius * cfg.combat.sizeAdvantage) continue;
    const dx = cell.x - other.x;
    const dy = cell.y - other.y;
    const d = Math.hypot(dx, dy) || 0.0001;
    const gap = d - other.radius - cell.radius;
    const danger = cfg.ai.dangerRadius + other.radius * 0.5;
    if (gap >= danger) continue;
    threatened = true;
    const weight = 0.2 + 1 - Math.max(0, gap) / danger;
    fx += (dx / d) * weight;
    fy += (dy / d) * weight;
  }
  if (!threatened) return false;

  // Push away from nearby walls so that fleeing cells do not pin themselves in a corner.
  const m = cfg.ai.wallAvoidMargin;
  const { width, height } = cfg.world;
  if (cell.x < m) fx += 1.5 * (1 - cell.x / m);
  if (cell.x > width - m) fx -= 1.5 * (1 - (width - cell.x) / m);
  if (cell.y < m) fy += 1.5 * (1 - cell.y / m);
  if (cell.y > height - m) fy -= 1.5 * (1 - (height - cell.y) / m);

  const len = Math.hypot(fx, fy);
  if (len < 0.0001) {
    // Perfectly balanced threats: break the tie with a random direction.
    const a = ctx.rng() * Math.PI * 2;
    fx = Math.cos(a);
    fy = Math.sin(a);
  } else {
    fx /= len;
    fy /= len;
  }
  ai.targetX = cell.x + fx * 600;
  ai.targetY = cell.y + fy * 600;
  return true;
}

function decideHunt(cell: Cell, ai: AIState, ctx: AIContext): boolean {
  const { cfg, cells } = ctx;
  const minRatio = cfg.combat.sizeAdvantage * cfg.ai.huntSizeMargin;
  let best: Cell | null = null;
  let bestGap = Infinity;

  for (const other of cells) {
    if (other === cell || other.dead) continue;
    if (cell.radius < other.radius * minRatio) continue;
    if (other.radius < cell.radius * cfg.ai.minPreyRadiusFraction) continue;
    const gap = Math.hypot(other.x - cell.x, other.y - cell.y) - other.radius - cell.radius;
    if (gap < bestGap && gap < cfg.ai.huntRadius) {
      best = other;
      bestGap = gap;
    }
  }
  if (!best) return false;

  const lead = cfg.ai.leadTime;
  ai.preyId = best.id;
  ai.targetX = clamp(best.x + best.vx * lead, 0, cfg.world.width);
  ai.targetY = clamp(best.y + best.vy * lead, 0, cfg.world.height);
  return true;
}

function decideFood(cell: Cell, ai: AIState, ctx: AIContext): void {
  const { cfg, foodGrid, scratch } = ctx;
  const r = cfg.ai.foodRadius;
  foodGrid.queryRect(cell.x - r, cell.y - r, cell.x + r, cell.y + r, scratch);

  let best: Food | null = null;
  let bestScore = -1;
  for (const f of scratch) {
    const d = Math.hypot(f.x - cell.x, f.y - cell.y);
    if (d > r) continue;
    const score = f.mass / (d + 40);
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }

  if (best) {
    ai.targetX = best.x;
    ai.targetY = best.y;
    ai.hasWander = false;
    return;
  }

  // Nothing nearby: head for a random location, picking a new one on arrival.
  if (ai.hasWander && Math.hypot(ai.wanderX - cell.x, ai.wanderY - cell.y) < 80) ai.hasWander = false;
  if (!ai.hasWander) {
    const margin = cfg.ai.wanderMargin;
    ai.wanderX = margin + ctx.rng() * (cfg.world.width - 2 * margin);
    ai.wanderY = margin + ctx.rng() * (cfg.world.height - 2 * margin);
    ai.hasWander = true;
  }
  ai.targetX = ai.wanderX;
  ai.targetY = ai.wanderY;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
