import type { Camera } from './Camera';
import type { Cell } from './Cell';
import type { GameConfig } from './GameConfig';
import type { GameState } from './GameState';

/** Draws the visible part of the world. It reads game state but never changes it. */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  cssWidth = 0;
  cssHeight = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly cfg: GameConfig,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not supported in this browser.');
    this.ctx = ctx;
  }

  /** Matches the canvas backing store to the window size and device pixel ratio. */
  resize(): void {
    this.cssWidth = Math.max(1, window.innerWidth);
    this.cssHeight = Math.max(1, window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, this.cfg.render.maxPixelRatio);
    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);
    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;
  }

  render(state: GameState, camera: Camera): void {
    const { ctx, cfg } = this;
    const r = cfg.render;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = r.outsideColor;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    // Everything below is drawn in world coordinates via one camera transform.
    const s = camera.scale;
    ctx.setTransform(
      this.dpr * s,
      0,
      0,
      this.dpr * s,
      this.dpr * (this.cssWidth / 2 - camera.x * s),
      this.dpr * (this.cssHeight / 2 - camera.y * s),
    );

    const view = camera.visibleRect(0);
    this.drawArena(camera, view);
    this.drawFood(state, view);
    this.drawCells(state, camera, view);
    this.drawEffects(state);
    this.drawBoundary(s);
  }

  private drawArena(camera: Camera, view: { minX: number; minY: number; maxX: number; maxY: number }): void {
    const { ctx, cfg } = this;
    const { width, height } = cfg.world;
    ctx.fillStyle = cfg.render.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    const g = cfg.render.gridSize;
    const x0 = Math.max(0, Math.floor(view.minX / g) * g);
    const x1 = Math.min(width, view.maxX);
    const y0 = Math.max(0, Math.floor(view.minY / g) * g);
    const y1 = Math.min(height, view.maxY);
    ctx.beginPath();
    for (let x = x0; x <= x1; x += g) {
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
    }
    for (let y = y0; y <= y1; y += g) {
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
    }
    ctx.strokeStyle = cfg.render.gridColor;
    ctx.lineWidth = 1 / camera.scale;
    ctx.stroke();
  }

  private drawBoundary(scale: number): void {
    const { ctx, cfg } = this;
    ctx.strokeStyle = cfg.render.boundaryColor;
    ctx.lineWidth = 4 / scale;
    ctx.strokeRect(0, 0, cfg.world.width, cfg.world.height);
  }

  private drawFood(state: GameState, view: { minX: number; minY: number; maxX: number; maxY: number }): void {
    const { ctx } = this;
    const pad = this.cfg.food.maxRadius;
    const visible = state.foodGrid.queryRect(view.minX - pad, view.minY - pad, view.maxX + pad, view.maxY + pad, this.visibleFood);
    // Batch by colour to limit fillStyle changes.
    const colors = this.cfg.food.colors;
    for (const color of colors) {
      ctx.fillStyle = color;
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < visible.length; i++) {
        const f = visible[i];
        if (f.color !== color) continue;
        ctx.moveTo(f.x + f.radius, f.y);
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        any = true;
      }
      if (any) ctx.fill();
    }
  }
  private readonly visibleFood: import('./Food').Food[] = [];

  private drawCells(
    state: GameState,
    camera: Camera,
    view: { minX: number; minY: number; maxX: number; maxY: number },
  ): void {
    // Draw smaller cells first so larger ones cover them; the player is highlighted by an outline.
    const sorted = this.sortedCells;
    sorted.length = 0;
    for (const c of state.cells) {
      if (c.dead) continue;
      if (c.x + c.radius < view.minX || c.x - c.radius > view.maxX) continue;
      if (c.y + c.radius < view.minY || c.y - c.radius > view.maxY) continue;
      sorted.push(c);
    }
    sorted.sort((a, b) => a.radius - b.radius);
    for (const c of sorted) this.drawCell(c, camera.scale);
  }
  private readonly sortedCells: Cell[] = [];

  private drawCell(c: Cell, scale: number): void {
    const { ctx, cfg } = this;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
    ctx.fillStyle = c.color;
    ctx.fill();
    ctx.lineWidth = (c.isPlayer ? 3 : 2) / scale;
    ctx.strokeStyle = c.outline;
    ctx.stroke();

    // Names, only when they fit.
    if (c.radius * scale >= cfg.render.minNameRadiusPx) {
      const fontPx = Math.max(10, Math.min(c.radius * scale * 0.45, 28));
      ctx.font = `600 ${fontPx / scale}px -apple-system, "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3 / scale;
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.strokeText(c.name, c.x, c.y);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(c.name, c.x, c.y);
    }
  }

  private drawEffects(state: GameState): void {
    const { ctx } = this;
    for (const e of state.effects) {
      const t = 1 - e.life / e.maxLife; // 0 -> 1
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * (1 + t * 1.2), 0, Math.PI * 2);
      ctx.lineWidth = 6 * (1 - t) + 1;
      ctx.strokeStyle = e.color;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const t of state.texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.font = '700 20px -apple-system, "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
