import type { Cell } from './Cell';
import type { GameConfig } from './GameConfig';

export interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Follows a target with smoothing, zooms out as it grows, and converts between
 * world and screen coordinates. Screen units are CSS pixels.
 */
export class Camera {
  x: number;
  y: number;
  zoom = 1;
  viewW = 800;
  viewH = 600;

  constructor(private readonly cfg: GameConfig) {
    this.x = cfg.world.width / 2;
    this.y = cfg.world.height / 2;
  }

  resize(w: number, h: number): void {
    this.viewW = Math.max(1, w);
    this.viewH = Math.max(1, h);
  }

  /** World-to-screen scale: gameplay zoom times a factor that keeps small screens playable. */
  get scale(): number {
    const c = this.cfg.camera;
    const vs = clamp(Math.min(this.viewW, this.viewH) / c.referenceViewport, c.minViewportScale, 1);
    return this.zoom * vs;
  }

  targetZoom(radius: number): number {
    const c = this.cfg.camera;
    const raw = 1 / (1 + c.zoomFalloff * (radius - this.cfg.player.startRadius));
    return clamp(raw, c.minZoom, c.maxZoom);
  }

  /** Jump straight to the target (used on start and restart). */
  snap(target: Cell): void {
    this.zoom = this.targetZoom(target.radius);
    this.x = target.x;
    this.y = target.y;
    this.clampToArena();
  }

  update(target: Cell, dt: number): void {
    const c = this.cfg.camera;
    const kPos = 1 - Math.exp(-c.followSmoothing * dt);
    const kZoom = 1 - Math.exp(-c.zoomSmoothing * dt);
    this.x += (target.x - this.x) * kPos;
    this.y += (target.y - this.y) * kPos;
    this.zoom += (this.targetZoom(target.radius) - this.zoom) * kZoom;
    this.clampToArena();
  }

  /** Keeps the view within the arena (plus a small margin so that the boundary can be seen). */
  clampToArena(): void {
    const { width, height } = this.cfg.world;
    const margin = this.cfg.camera.edgeMargin;
    const s = this.scale;
    const hw = this.viewW / 2 / s;
    const hh = this.viewH / 2 / s;
    this.x = hw * 2 >= width + margin * 2 ? width / 2 : clamp(this.x, hw - margin, width - hw + margin);
    this.y = hh * 2 >= height + margin * 2 ? height / 2 : clamp(this.y, hh - margin, height - hh + margin);
  }

  worldToScreenX(wx: number): number {
    return (wx - this.x) * this.scale + this.viewW / 2;
  }

  worldToScreenY(wy: number): number {
    return (wy - this.y) * this.scale + this.viewH / 2;
  }

  screenToWorldX(sx: number): number {
    return (sx - this.viewW / 2) / this.scale + this.x;
  }

  screenToWorldY(sy: number): number {
    return (sy - this.viewH / 2) / this.scale + this.y;
  }

  /** The world-space rectangle currently visible, expanded by `pad` world units. */
  visibleRect(pad = 0): Rect {
    const s = this.scale;
    const hw = this.viewW / 2 / s + pad;
    const hh = this.viewH / 2 / s + pad;
    return { minX: this.x - hw, minY: this.y - hh, maxX: this.x + hw, maxY: this.y + hh };
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
