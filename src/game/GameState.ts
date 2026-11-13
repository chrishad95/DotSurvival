import {
  addMass,
  createCell,
  moveCell,
  updateSize,
  type Cell,
} from './Cell';
import { canConsume, circlesOverlap, SpatialGrid } from './Collision';
import { createFood, createInitialFood, type Food, type Rng } from './Food';
import { DEFAULT_CONFIG, type GameConfig } from './GameConfig';
import { createAIState, updateAI, type AIContext } from './OpponentAI';
import { applyControl, NO_CONTROL, type Control } from './Player';

export type GameStatus = 'playing' | 'over';

/** A short expanding ring drawn where a cell was eaten. */
export interface RingEffect {
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

/** A floating "+mass" text. */
export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface LeaderboardEntry {
  id: number;
  name: string;
  mass: number;
  isPlayer: boolean;
}

const OPPONENT_COLORS = [
  '#f72585', '#b5179e', '#7209b7', '#560bad', '#3a0ca3', '#3f37c9', '#4361ee', '#4895ef',
  '#43aa8b', '#90be6d', '#f9c74f', '#f8961e', '#f3722c', '#f94144', '#e76f51', '#2a9d8f',
];

/** Small deterministic PRNG (mulberry32) so tests are repeatable. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The complete simulation state. It has no dependency on the DOM or the canvas,
 * so it can be driven headlessly (see GameState.test.ts).
 */
export class GameState {
  readonly cfg: GameConfig;
  readonly rng: Rng;
  status: GameStatus = 'playing';
  time = 0;

  player!: Cell;
  /** Player plus opponents. The player is always at index 0 while alive. */
  cells: Cell[] = [];
  food: Food[] = [];
  foodGrid!: SpatialGrid<Food>;
  effects: RingEffect[] = [];
  texts: FloatingText[] = [];
  /** Highest mass the player reached this round. */
  peakMass = 0;

  private nextId = 1;
  private readonly scratch: Food[] = [];
  private readonly aiCtx: AIContext;

  constructor(cfg: GameConfig = DEFAULT_CONFIG, rng: Rng = Math.random) {
    this.cfg = cfg;
    this.rng = rng;
    this.aiCtx = {
      cfg,
      cells: this.cells,
      // Replaced in reset(); assigned here to satisfy the type checker.
      foodGrid: undefined as unknown as SpatialGrid<Food>,
      rng,
      time: 0,
      scratch: [],
    };
    this.reset();
  }

  /** Starts a fresh round. */
  reset(): void {
    const { cfg, rng } = this;
    this.status = 'playing';
    this.time = 0;
    this.nextId = 1;
    this.effects.length = 0;
    this.texts.length = 0;
    this.cells.length = 0;

    this.foodGrid = new SpatialGrid<Food>(cfg.world.width, cfg.world.height, 200);
    this.food = createInitialFood(cfg, rng);
    for (const f of this.food) this.foodGrid.insert(f);
    this.aiCtx.foodGrid = this.foodGrid;

    this.player = createCell(
      {
        id: this.nextId++,
        name: cfg.player.name,
        x: cfg.world.width / 2,
        y: cfg.world.height / 2,
        mass: cfg.player.startMass,
        color: cfg.player.color,
        outline: cfg.player.outline,
        isPlayer: true,
      },
      cfg,
    );
    this.cells.push(this.player);
    this.peakMass = this.player.mass;

    for (const tier of cfg.opponents.tiers) {
      for (let i = 0; i < tier.count; i++) {
        const mass = tier.minMass + rng() * (tier.maxMass - tier.minMass);
        this.cells.push(this.spawnOpponent(mass));
      }
    }
  }

  /** Advances the simulation by `dt` seconds (already clamped by the caller). */
  update(dt: number, control: Control = NO_CONTROL): void {
    if (this.status !== 'playing') return;
    this.time += dt;
    this.aiCtx.time = this.time;

    // Input and movement.
    applyControl(this.player, control);
    for (const cell of this.cells) {
      if (!cell.isPlayer) updateAI(cell, this.aiCtx);
      moveCell(cell, dt, this.cfg);
      updateSize(cell, dt, this.cfg);
    }

    this.consumePellets();
    this.resolveCellConsumption();
    this.respawnOpponents();
    this.updateEffects(dt);

    if (this.player.mass > this.peakMass) this.peakMass = this.player.mass;
    if (this.player.dead) this.status = 'over';
  }

  /** Top cells by mass. Called periodically by the UI, not every frame. */
  getLeaderboard(): LeaderboardEntry[] {
    return this.cells
      .filter((c) => !c.dead)
      .sort((a, b) => b.mass - a.mass)
      .slice(0, this.cfg.game.leaderboardSize)
      .map((c) => ({ id: c.id, name: c.name, mass: c.mass, isPlayer: c.isPlayer }));
  }

  // ---------------------------------------------------------------- pellets

  private consumePellets(): void {
    const buf = this.scratch;
    for (const cell of this.cells) {
      if (cell.dead) continue;
      const reach = cell.radius + this.cfg.food.maxRadius;
      this.foodGrid.queryRect(cell.x - reach, cell.y - reach, cell.x + reach, cell.y + reach, buf);
      for (let i = 0; i < buf.length; i++) {
        const f = buf[i];
        if (circlesOverlap(cell.x, cell.y, cell.radius, f.x, f.y, f.radius)) {
          addMass(cell, f.mass);
          this.replaceFood(f);
        }
      }
    }
  }

  /** Moves a consumed pellet to a new random spot, preferably clear of every cell. */
  private replaceFood(f: Food): void {
    const { width, height } = this.cfg.world;
    const clearance = this.cfg.food.spawnClearance;
    let x = 0;
    let y = 0;
    for (let attempt = 0; attempt < 12; attempt++) {
      x = this.rng() * width;
      y = this.rng() * height;
      if (!this.isNearAnyCell(x, y, clearance)) break;
    }
    const fresh = createFood(x, y, this.cfg, this.rng);
    this.foodGrid.remove(f);
    f.x = fresh.x;
    f.y = fresh.y;
    f.radius = fresh.radius;
    f.mass = fresh.mass;
    f.color = fresh.color;
    this.foodGrid.insert(f);
  }

  private isNearAnyCell(x: number, y: number, clearance: number): boolean {
    for (const c of this.cells) {
      const r = c.radius + clearance;
      const dx = c.x - x;
      const dy = c.y - y;
      if (dx * dx + dy * dy < r * r) return true;
    }
    return false;
  }

  // ------------------------------------------------------------ cell vs cell

  private resolveCellConsumption(): void {
    const cells = this.cells;
    for (let i = 0; i < cells.length; i++) {
      const a = cells[i];
      if (a.dead) continue;
      for (let j = i + 1; j < cells.length; j++) {
        const b = cells[j];
        if (b.dead || a.dead) continue;
        if (canConsume(a, b, this.cfg)) this.consume(a, b);
        else if (canConsume(b, a, this.cfg)) this.consume(b, a);
      }
    }
  }

  private consume(attacker: Cell, target: Cell): void {
    const gained = target.mass * this.cfg.combat.massTransfer;
    target.dead = true;
    addMass(attacker, gained);
    attacker.eaten += 1;

    if (target.isPlayer || attacker.isPlayer) {
      this.addEffect(target.x, target.y, target.radius, target.color);
    }
    if (attacker.isPlayer) {
      this.addText(target.x, target.y - target.radius, `+${Math.round(gained)}`, attacker.color);
    }
  }

  private respawnOpponents(): void {
    let removed = 0;
    for (let i = this.cells.length - 1; i >= 1; i--) {
      if (this.cells[i].dead) {
        this.cells.splice(i, 1);
        removed++;
      }
    }
    const o = this.cfg.opponents;
    for (let n = 0; n < removed; n++) {
      const mass = o.respawnMinMass + this.rng() * (o.respawnMaxMass - o.respawnMinMass);
      this.cells.push(this.spawnOpponent(mass));
    }
  }

  /** Creates an opponent at a random spot that is clear of other cells and far from the player. */
  private spawnOpponent(mass: number): Cell {
    const { cfg, rng } = this;
    const { width, height } = cfg.world;
    const safe = cfg.opponents.spawnSafeDistance;
    let x = width / 2;
    let y = height / 2;
    for (let attempt = 0; attempt < 30; attempt++) {
      x = 100 + rng() * (width - 200);
      y = 100 + rng() * (height - 200);
      const farFromPlayer = !this.player || this.player.dead || Math.hypot(x - this.player.x, y - this.player.y) >= safe;
      if (farFromPlayer && !this.isNearAnyCell(x, y, 150)) break;
    }
    const cell = createCell(
      {
        id: this.nextId++,
        name: this.pickName(),
        x,
        y,
        mass,
        color: OPPONENT_COLORS[Math.floor(rng() * OPPONENT_COLORS.length)],
        outline: 'rgba(0, 0, 0, 0.25)',
        ai: createAIState(cfg, rng, this.time),
      },
      cfg,
    );
    cell.speedFactor = cfg.ai.speedFactor;
    return cell;
  }

  private pickName(): string {
    const names = this.cfg.opponents.names;
    const used = new Set(this.cells.map((c) => c.name));
    const free = names.filter((n) => !used.has(n));
    if (free.length > 0) return free[Math.floor(this.rng() * free.length)];
    return `${names[Math.floor(this.rng() * names.length)]}${Math.floor(this.rng() * 90) + 10}`;
  }

  // ----------------------------------------------------------------- effects

  private addEffect(x: number, y: number, radius: number, color: string): void {
    if (this.effects.length >= this.cfg.game.maxEffects) this.effects.shift();
    const life = this.cfg.game.effectLife;
    this.effects.push({ x, y, radius, color, life, maxLife: life });
  }

  private addText(x: number, y: number, text: string, color: string): void {
    if (this.texts.length >= this.cfg.game.maxEffects) this.texts.shift();
    const life = this.cfg.game.textLife;
    this.texts.push({ x, y, text, color, life, maxLife: life });
  }

  private updateEffects(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].life -= dt;
      if (this.effects[i].life <= 0) this.effects.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 40 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }
}
