import type { GameConfig } from './GameConfig';

export type Rng = () => number;

export interface Food {
  x: number;
  y: number;
  radius: number;
  mass: number;
  color: string;
  /** Index of the spatial-grid bucket holding this pellet (managed by SpatialGrid). */
  gridIndex: number;
}

export function createFood(x: number, y: number, cfg: GameConfig, rng: Rng): Food {
  const f = cfg.food;
  const t = rng();
  return {
    x,
    y,
    radius: f.minRadius + (f.maxRadius - f.minRadius) * t,
    mass: f.minMass + (f.maxMass - f.minMass) * t,
    color: f.colors[Math.floor(rng() * f.colors.length) % f.colors.length],
    gridIndex: -1,
  };
}

/**
 * Creates the initial pellets using jittered-grid sampling so they are spread evenly
 * across the arena rather than clumping.
 */
export function createInitialFood(cfg: GameConfig, rng: Rng): Food[] {
  const { width, height } = cfg.world;
  const count = cfg.food.count;
  const cols = Math.max(1, Math.ceil(Math.sqrt((count * width) / height)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const cw = width / cols;
  const ch = height / rows;

  const slots: number[] = [];
  for (let i = 0; i < cols * rows; i++) slots.push(i);
  // Fisher-Yates shuffle so that dropping surplus slots does not bias one side.
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  const food: Food[] = [];
  for (let n = 0; n < count; n++) {
    const slot = slots[n];
    const cx = slot % cols;
    const cy = Math.floor(slot / cols);
    food.push(createFood((cx + rng()) * cw, (cy + rng()) * ch, cfg, rng));
  }
  return food;
}
