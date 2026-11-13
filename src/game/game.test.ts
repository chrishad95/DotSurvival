import { describe, expect, it } from 'vitest';
import { Camera } from './Camera';
import { massToRadius, speedForRadius, createCell, moveCell, type Cell } from './Cell';
import { canConsume, circlesOverlap, SpatialGrid } from './Collision';
import { createInitialFood } from './Food';
import { DEFAULT_CONFIG, type GameConfig } from './GameConfig';
import { createRng, GameState } from './GameState';
import { controlFromPointer } from './Player';

function makeCfg(overrides: Partial<GameConfig> = {}): GameConfig {
  return JSON.parse(JSON.stringify({ ...DEFAULT_CONFIG, ...overrides })) as GameConfig;
}

function cell(cfg: GameConfig, mass: number, x: number, y: number, isPlayer = false): Cell {
  return createCell({ id: Math.floor(Math.random() * 1e9), name: 'T', x, y, mass, color: '#fff', outline: '#000', isPlayer }, cfg);
}

describe('growth and movement formulas', () => {
  const cfg = makeCfg();

  it('start mass yields start radius, and radius grows slower than mass', () => {
    expect(massToRadius(cfg.player.startMass, cfg)).toBeCloseTo(cfg.player.startRadius, 6);
    const r1 = massToRadius(100, cfg);
    const r2 = massToRadius(400, cfg);
    expect(r2 / r1).toBeCloseTo(2, 6); // 4x mass -> 2x radius
  });

  it('speed decreases with radius but never below the minimum', () => {
    expect(speedForRadius(10, cfg)).toBeCloseTo(cfg.player.baseSpeed, 6);
    expect(speedForRadius(60, cfg)).toBeLessThan(speedForRadius(20, cfg));
    expect(speedForRadius(100000, cfg)).toBe(cfg.player.minSpeed);
  });

  it('cells cannot leave the arena', () => {
    const c = cell(cfg, 10, 5, 5);
    c.dirX = -1;
    c.dirY = -1;
    c.throttle = 1;
    for (let i = 0; i < 200; i++) moveCell(c, 0.016, cfg);
    expect(c.x).toBeGreaterThanOrEqual(c.radius);
    expect(c.y).toBeGreaterThanOrEqual(c.radius);
    c.dirX = 1;
    c.dirY = 1;
    for (let i = 0; i < 5000; i++) moveCell(c, 0.016, cfg);
    expect(c.x).toBeLessThanOrEqual(cfg.world.width - c.radius);
    expect(c.y).toBeLessThanOrEqual(cfg.world.height - c.radius);
  });

  it('movement distance is frame-rate independent', () => {
    const run = (dt: number): number => {
      const c = cell(cfg, 10, 1000, 1000);
      c.dirX = 1;
      c.throttle = 1;
      for (let t = 0; t < 2; t += dt) moveCell(c, dt, cfg);
      return c.x - 1000;
    };
    expect(run(1 / 30)).toBeCloseTo(run(1 / 120), -1);
  });
});

describe('pointer control', () => {
  const cfg = makeCfg();
  it('stops inside the dead zone and ramps up with distance', () => {
    expect(controlFromPointer(3, 0, cfg).throttle).toBe(0);
    const mid = controlFromPointer(50, 0, cfg);
    expect(mid.throttle).toBeGreaterThan(0);
    expect(mid.throttle).toBeLessThan(1);
    expect(controlFromPointer(0, 500, cfg)).toEqual({ dirX: 0, dirY: 1, throttle: 1 });
  });
});

describe('collision', () => {
  const cfg = makeCfg();

  it('detects circle overlap', () => {
    expect(circlesOverlap(0, 0, 5, 9, 0, 5)).toBe(true);
    expect(circlesOverlap(0, 0, 5, 10, 0, 5)).toBe(false);
  });

  it('requires a size advantage and real overlap to consume', () => {
    const big = cell(cfg, 100, 0, 0);
    const small = cell(cfg, 25, 0, 0);
    expect(canConsume(big, small, cfg)).toBe(true);
    expect(canConsume(small, big, cfg)).toBe(false);

    // Edge contact is not enough.
    small.x = big.radius + small.radius - 0.5;
    expect(canConsume(big, small, cfg)).toBe(false);

    // Similar sizes can never eat each other.
    const peer = cell(cfg, 105, 0, 0);
    expect(canConsume(peer, big, cfg)).toBe(false);
    expect(canConsume(big, peer, cfg)).toBe(false);
  });

  it('spatial grid returns only items in the rectangle and supports removal', () => {
    const grid = new SpatialGrid<{ x: number; y: number; gridIndex: number }>(1000, 1000, 100);
    const a = { x: 10, y: 10, gridIndex: -1 };
    const b = { x: 900, y: 900, gridIndex: -1 };
    grid.insert(a);
    grid.insert(b);
    expect(grid.queryRect(0, 0, 100, 100, [])).toEqual([a]);
    grid.remove(a);
    expect(grid.queryRect(0, 0, 100, 100, [])).toEqual([]);
    expect(grid.size).toBe(1);
  });
});

describe('camera', () => {
  const cfg = makeCfg();

  it('zooms out gradually with radius and respects the minimum zoom', () => {
    const cam = new Camera(cfg);
    expect(cam.targetZoom(10)).toBe(1);
    expect(cam.targetZoom(60)).toBeLessThan(cam.targetZoom(30));
    expect(cam.targetZoom(100000)).toBe(cfg.camera.minZoom);
  });

  it('round-trips world and screen coordinates', () => {
    const cam = new Camera(cfg);
    cam.resize(1000, 700);
    cam.x = 2000;
    cam.y = 1500;
    cam.zoom = 0.7;
    const sx = cam.worldToScreenX(2345);
    const sy = cam.worldToScreenY(1234);
    expect(cam.screenToWorldX(sx)).toBeCloseTo(2345, 6);
    expect(cam.screenToWorldY(sy)).toBeCloseTo(1234, 6);
  });

  it('stays within the arena (plus margin) and follows the target', () => {
    const cam = new Camera(cfg);
    cam.resize(1000, 700);
    const p = cell(cfg, 10, 1, 1, true);
    for (let i = 0; i < 300; i++) cam.update(p, 0.016);
    const v = cam.visibleRect();
    expect(v.minX).toBeGreaterThanOrEqual(-cfg.camera.edgeMargin - 1e-6);
    expect(v.minY).toBeGreaterThanOrEqual(-cfg.camera.edgeMargin - 1e-6);
  });
});

describe('initial state', () => {
  it('creates the configured pellets and opponents, spread across the arena', () => {
    const s = new GameState(DEFAULT_CONFIG, createRng(1));
    expect(s.food.length).toBe(DEFAULT_CONFIG.food.count);
    expect(s.foodGrid.size).toBe(DEFAULT_CONFIG.food.count);
    const total = DEFAULT_CONFIG.opponents.tiers.reduce((n, t) => n + t.count, 0);
    expect(s.cells.length).toBe(total + 1);
    expect(new Set(s.cells.map((c) => c.id)).size).toBe(s.cells.length);
    expect(s.player.x).toBe(DEFAULT_CONFIG.world.width / 2);

    // Each quadrant has a fair share of pellets.
    const quad = [0, 0, 0, 0];
    for (const f of s.food) quad[(f.x > 2500 ? 1 : 0) + (f.y > 2500 ? 2 : 0)]++;
    for (const q of quad) expect(q).toBeGreaterThan(DEFAULT_CONFIG.food.count * 0.2);
  });

  it('createInitialFood keeps every pellet inside the arena', () => {
    for (const f of createInitialFood(DEFAULT_CONFIG, createRng(2))) {
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.x).toBeLessThanOrEqual(DEFAULT_CONFIG.world.width);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeLessThanOrEqual(DEFAULT_CONFIG.world.height);
    }
  });
});

describe('gameplay rules', () => {
  /** A state with no opponents interfering, so tests control everything. */
  function quietState(seed = 3): GameState {
    const cfg = makeCfg();
    cfg.opponents.tiers = [];
    return new GameState(cfg, createRng(seed));
  }

  it('eating a pellet grows mass and radius, and a replacement keeps the count constant', () => {
    const s = quietState();
    const food = s.food[0];
    s.player.x = food.x;
    s.player.y = food.y;
    const m0 = s.player.mass;
    s.update(0.016);
    expect(s.player.mass).toBeGreaterThan(m0);
    for (let i = 0; i < 30; i++) s.update(0.016);
    expect(s.player.radius).toBeGreaterThan(s.cfg.player.startRadius);
    expect(s.food.length).toBe(s.cfg.food.count);
    expect(s.foodGrid.size).toBe(s.cfg.food.count);
  });

  it('player eats a sufficiently smaller opponent, gaining 85% of its mass, and it is replaced', () => {
    const cfg = makeCfg();
    cfg.opponents.tiers = [{ count: 1, minMass: 10, maxMass: 10 }];
    const s = new GameState(cfg, createRng(4));
    s.player.mass = 100;
    s.player.radius = massToRadius(100, cfg);
    const victim = s.cells[1];
    const victimId = victim.id;
    victim.x = s.player.x;
    victim.y = s.player.y;
    victim.mass = 10;
    victim.radius = massToRadius(10, cfg);
    const before = s.player.mass;
    s.update(0.001);
    expect(s.player.eaten).toBe(1);
    expect(s.player.mass).toBeGreaterThanOrEqual(before + 8.5 - 1e-6);
    expect(s.cells.some((c) => c.id === victimId)).toBe(false);
    expect(s.cells.length).toBe(2); // replacement spawned
    expect(s.status).toBe('playing');
    const repl = s.cells[1];
    expect(Math.hypot(repl.x - s.player.x, repl.y - s.player.y)).toBeGreaterThanOrEqual(cfg.opponents.spawnSafeDistance);
  });

  it('a larger opponent eats the player and the game ends', () => {
    const cfg = makeCfg();
    cfg.opponents.tiers = [{ count: 1, minMass: 200, maxMass: 200 }];
    const s = new GameState(cfg, createRng(5));
    const hunter = s.cells[1];
    hunter.x = s.player.x;
    hunter.y = s.player.y;
    s.update(0.001);
    expect(s.player.dead).toBe(true);
    expect(s.status).toBe('over');
    const t = s.time;
    s.update(0.5);
    expect(s.time).toBe(t); // gameplay frozen after death
    expect(hunter.eaten).toBe(1);
  });

  it('reset starts a fresh round', () => {
    const cfg = makeCfg();
    cfg.opponents.tiers = [{ count: 1, minMass: 200, maxMass: 200 }];
    const s = new GameState(cfg, createRng(6));
    s.cells[1].x = s.player.x;
    s.cells[1].y = s.player.y;
    s.update(0.001);
    expect(s.status).toBe('over');
    s.reset();
    expect(s.status).toBe('playing');
    expect(s.player.dead).toBe(false);
    expect(s.player.mass).toBe(cfg.player.startMass);
    expect(s.player.eaten).toBe(0);
  });

  it('leaderboard is sorted by mass and limited to five', () => {
    const s = new GameState(DEFAULT_CONFIG, createRng(7));
    const lb = s.getLeaderboard();
    expect(lb.length).toBe(5);
    for (let i = 1; i < lb.length; i++) expect(lb[i - 1].mass).toBeGreaterThanOrEqual(lb[i].mass);
  });
});

describe('opponent AI (headless simulation)', () => {
  it('a small opponent flees from a much larger one', () => {
    const cfg = makeCfg();
    cfg.opponents.tiers = [
      { count: 1, minMass: 15, maxMass: 15 },
      { count: 1, minMass: 300, maxMass: 300 },
    ];
    const s = new GameState(cfg, createRng(8));
    const [, small, big] = s.cells;
    small.x = 2500;
    small.y = 2000;
    big.x = 2500 - 150;
    big.y = 2000;
    s.player.x = 4500; // keep the player out of the picture
    s.player.y = 4500;
    const start = Math.hypot(small.x - big.x, small.y - big.y);
    for (let i = 0; i < 20; i++) s.update(0.05);
    expect(small.ai?.behavior).toBe('flee');
    expect(small.x).toBeGreaterThan(2500); // moved away from the big cell on the left
    expect(Math.hypot(small.x - big.x, small.y - big.y)).toBeGreaterThan(start);
  });

  it('opponents collect food and grow over time; counts stay constant', () => {
    const s = new GameState(DEFAULT_CONFIG, createRng(9));
    // Park the player far away and inert so that it does not interfere.
    const massBefore = s.cells.filter((c) => !c.isPlayer).reduce((n, c) => n + c.mass, 0);
    const count = s.cells.length;
    for (let i = 0; i < 60 * 40; i++) s.update(1 / 60); // 40 simulated seconds
    const massAfter = s.cells.filter((c) => !c.isPlayer && !c.dead).reduce((n, c) => n + c.mass, 0);
    expect(massAfter).toBeGreaterThan(massBefore * 0.9);
    expect(s.food.length).toBe(DEFAULT_CONFIG.food.count);
    if (s.status === 'playing') expect(s.cells.length).toBe(count);
    for (const c of s.cells) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(DEFAULT_CONFIG.world.width);
      expect(Number.isFinite(c.mass)).toBe(true);
    }
  });

  it('a large opponent hunts and eats a smaller one', () => {
    const cfg = makeCfg();
    cfg.opponents.tiers = [
      { count: 1, minMass: 200, maxMass: 200 },
      { count: 1, minMass: 20, maxMass: 20 },
    ];
    const s = new GameState(cfg, createRng(10));
    const [, hunter, prey] = s.cells;
    hunter.ai!.aggressive = true;
    hunter.x = 2500;
    hunter.y = 2500;
    prey.x = 2500 + 250;
    prey.y = 2500;
    prey.ai!.aggressive = false;
    s.player.x = 100;
    s.player.y = 100;
    const preyId = prey.id;
    // Freeze the prey so that the test checks hunting, not chasing speed.
    prey.speedFactor = 0;
    prey.ai!.nextThink = Infinity;
    for (let i = 0; i < 60 * 10 && hunter.eaten === 0; i++) s.update(1 / 60);
    expect(hunter.eaten).toBeGreaterThanOrEqual(1);
    expect(s.cells.some((c) => c.id === preyId)).toBe(false);
  });
});
