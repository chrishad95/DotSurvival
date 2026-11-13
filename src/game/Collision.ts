import type { Cell } from './Cell';
import type { GameConfig } from './GameConfig';

/** Circle overlap test using squared distances (no square root). */
export function circlesOverlap(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number,
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const rr = r1 + r2;
  return dx * dx + dy * dy < rr * rr;
}

/**
 * True when `attacker` is allowed to consume `target`:
 * it must be sufficiently larger and must cover enough of the target
 * (edge contact alone is not enough).
 */
export function canConsume(attacker: Cell, target: Cell, cfg: GameConfig): boolean {
  if (attacker.dead || target.dead) return false;
  const { sizeAdvantage, overlapFraction } = cfg.combat;
  if (attacker.radius < target.radius * sizeAdvantage) return false;
  const reach = attacker.radius - target.radius * overlapFraction;
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;
  return dx * dx + dy * dy < reach * reach;
}

export interface GridItem {
  x: number;
  y: number;
  gridIndex: number;
}

/** Uniform-bucket spatial hash for fast "what is near this point" queries. */
export class SpatialGrid<T extends GridItem> {
  readonly cols: number;
  readonly rows: number;
  private readonly buckets: T[][];

  constructor(
    width: number,
    height: number,
    private readonly bucketSize: number,
  ) {
    this.cols = Math.max(1, Math.ceil(width / bucketSize));
    this.rows = Math.max(1, Math.ceil(height / bucketSize));
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
  }

  private col(x: number): number {
    return Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.bucketSize)));
  }

  private row(y: number): number {
    return Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.bucketSize)));
  }

  insert(item: T): void {
    const index = this.row(item.y) * this.cols + this.col(item.x);
    item.gridIndex = index;
    this.buckets[index].push(item);
  }

  remove(item: T): void {
    const bucket = this.buckets[item.gridIndex];
    if (!bucket) return;
    const i = bucket.indexOf(item);
    if (i >= 0) {
      bucket[i] = bucket[bucket.length - 1];
      bucket.pop();
    }
    item.gridIndex = -1;
  }

  move(item: T, x: number, y: number): void {
    this.remove(item);
    item.x = x;
    item.y = y;
    this.insert(item);
  }

  /** Fills `out` with all items whose position lies inside the rectangle. */
  queryRect(minX: number, minY: number, maxX: number, maxY: number, out: T[]): T[] {
    out.length = 0;
    const c0 = this.col(minX);
    const c1 = this.col(maxX);
    const r0 = this.row(minY);
    const r1 = this.row(maxY);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const bucket = this.buckets[r * this.cols + c];
        for (let i = 0; i < bucket.length; i++) {
          const it = bucket[i];
          if (it.x >= minX && it.x <= maxX && it.y >= minY && it.y <= maxY) out.push(it);
        }
      }
    }
    return out;
  }

  get size(): number {
    let n = 0;
    for (const b of this.buckets) n += b.length;
    return n;
  }
}
