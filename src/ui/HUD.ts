import { formatTime } from './Storage';

/** Upper-left statistics panel. Writes to the DOM only when a value changes. */
export class HUD {
  private readonly mass = byId('hud-mass');
  private readonly eaten = byId('hud-eaten');
  private readonly best = byId('hud-best');
  private readonly time = byId('hud-time');
  private last = { mass: '', eaten: '', best: '', time: '' };

  update(mass: number, eaten: number, best: number, seconds: number): void {
    set(this.mass, this.last, 'mass', String(Math.floor(mass)));
    set(this.eaten, this.last, 'eaten', String(eaten));
    set(this.best, this.last, 'best', String(Math.floor(best)));
    set(this.time, this.last, 'time', formatTime(seconds));
  }
}

function set<K extends string>(el: HTMLElement, last: Record<K, string>, key: K, value: string): void {
  if (last[key] !== value) {
    last[key] = value;
    el.textContent = value;
  }
}

export function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}
