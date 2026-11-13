/**
 * Central tuning configuration for Dot Survival.
 *
 * Every gameplay value that is likely to be tuned lives here. All distances are in
 * world units, all times in seconds, all speeds in world units per second, unless
 * a field name says otherwise (e.g. `...Px`).
 */
export interface OpponentTier {
  /** Number of opponents spawned in this tier at the start of a round. */
  count: number;
  minMass: number;
  maxMass: number;
}

export const DEFAULT_CONFIG = {
  world: {
    width: 5000,
    height: 5000,
  },

  player: {
    name: 'You',
    startMass: 10,
    startRadius: 10,
    minRadius: 10,
    baseSpeed: 220,
    minSpeed: 90,
    /** speed = baseSpeed / (1 + speedFalloff * (radius - startRadius)) */
    speedFalloff: 0.015,
    color: '#4cc9f0',
    outline: '#ffffff',
  },

  movement: {
    /** Exponential smoothing rate for velocity (higher = snappier). */
    velocitySmoothing: 9,
    /** Exponential smoothing rate for the visible radius catching up with mass. */
    radiusSmoothing: 10,
  },

  input: {
    /** Pointer closer than this (screen px) to the player's centre means "stop". */
    deadZonePx: 10,
    /** Pointer farther than this (screen px) from the player means full speed. */
    fullSpeedPx: 90,
  },

  food: {
    count: 1200,
    minRadius: 4,
    maxRadius: 6,
    minMass: 1,
    maxMass: 2,
    /** Replacement pellets avoid spawning within this distance of a cell edge. */
    spawnClearance: 30,
    colors: ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#c77dff', '#ff9f1c', '#f15bb5', '#9bf6ff'],
  },

  opponents: {
    tiers: [
      { count: 8, minMass: 10, maxMass: 20 },
      { count: 8, minMass: 25, maxMass: 60 },
      { count: 4, minMass: 70, maxMass: 150 },
    ] as OpponentTier[],
    /** Mass range of replacement opponents. */
    respawnMinMass: 10,
    respawnMaxMass: 20,
    /** Opponents spawn at least this far (centre to centre) from the player. */
    spawnSafeDistance: 800,
    names: [
      'Nova', 'Pixel', 'Orbit', 'Comet', 'Atom', 'Blip', 'Cosmo', 'Dash', 'Echo', 'Fizz',
      'Glow', 'Halo', 'Iris', 'Jolt', 'Kilo', 'Luna', 'Mochi', 'Nimbus', 'Opal', 'Pulse',
      'Quark', 'Ripple', 'Sprout', 'Tango', 'Umbra', 'Vortex', 'Wisp', 'Zephyr', 'Ember', 'Frost',
    ],
  },

  ai: {
    /** AI decisions per second are derived from this interval (≈ 6 per second). */
    decisionInterval: 0.17,
    /** A larger cell closer than this (edge-to-edge gap) triggers escape. */
    dangerRadius: 320,
    /** Prey must be within this (edge-to-edge gap) to be considered for hunting. */
    huntRadius: 420,
    /** Pellets within this distance are considered for food seeking. */
    foodRadius: 380,
    /** Hunters only chase prey this much smaller than the consumption threshold requires. */
    huntSizeMargin: 1.05,
    /** Ignore prey smaller than this fraction of the hunter's radius. */
    minPreyRadiusFraction: 0.25,
    /** Share of opponents that actively hunt. */
    aggressiveShare: 0.75,
    /** Speed multiplier relative to the player while collecting food or fleeing. */
    speedFactor: 0.92,
    /** Speed multiplier while hunting. */
    huntSpeedFactor: 1.0,
    /** Distance to a wall at which fleeing cells start steering away from it. */
    wallAvoidMargin: 350,
    /** Random wander targets stay this far from the walls. */
    wanderMargin: 250,
    /** How far ahead (seconds) hunters lead their prey. */
    leadTime: 0.4,
  },

  combat: {
    /** attacker.radius >= target.radius * sizeAdvantage is required to consume. */
    sizeAdvantage: 1.1,
    /**
     * The attacker must cover this fraction of the target: centre distance must be
     * less than attacker.radius - target.radius * overlapFraction. Edge contact is not enough.
     */
    overlapFraction: 0.5,
    /** Fraction of the target's mass transferred to the attacker. */
    massTransfer: 0.85,
  },

  camera: {
    /** Exponential smoothing rate for camera position. */
    followSmoothing: 6,
    /** Exponential smoothing rate for zoom. */
    zoomSmoothing: 2.5,
    /** zoom = clamp(1 / (1 + zoomFalloff * (radius - startRadius)), minZoom, maxZoom) */
    zoomFalloff: 0.003,
    minZoom: 0.45,
    maxZoom: 1.0,
    /** The camera may show this much space beyond the arena edge so the boundary is visible. */
    edgeMargin: 120,
    /** On small screens the world is shown slightly further out; value = viewport short side for 100% zoom. */
    referenceViewport: 700,
    minViewportScale: 0.6,
  },

  render: {
    maxPixelRatio: 2,
    gridSize: 100,
    /** Hide names when the on-screen radius is smaller than this (px). */
    minNameRadiusPx: 16,
    backgroundColor: '#0f1420',
    outsideColor: '#070a10',
    gridColor: 'rgba(255, 255, 255, 0.05)',
    boundaryColor: '#ff5d73',
  },

  game: {
    /** Largest simulated frame time; protects against jumps after tab switches. */
    maxFrameDelta: 0.05,
    leaderboardSize: 5,
    /** Leaderboard and HUD refresh interval (seconds). */
    uiInterval: 0.2,
    maxEffects: 40,
    effectLife: 0.7,
    textLife: 1.0,
    storageKey: 'dot-survival:best-score',
  },
};

export type GameConfig = typeof DEFAULT_CONFIG;

/** Radius multiplier so that startMass yields startRadius. */
export function radiusScale(cfg: GameConfig): number {
  return cfg.player.startRadius / Math.sqrt(cfg.player.startMass);
}
