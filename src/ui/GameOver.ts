import { byId } from './HUD';

/** Compact game-over dialog with final stats and a Restart button. */
export class GameOver {
  private readonly root = byId('gameover');
  private readonly mass = byId('go-mass');
  private readonly eaten = byId('go-eaten');
  private readonly best = byId('go-best');
  private readonly button = byId('go-restart');

  constructor(onRestart: () => void) {
    this.button.addEventListener('click', () => onRestart());
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden');
  }

  show(finalMass: number, eaten: number, best: number): void {
    this.mass.textContent = String(Math.floor(finalMass));
    this.eaten.textContent = String(eaten);
    this.best.textContent = String(Math.floor(best));
    this.root.classList.remove('hidden');
    this.button.focus({ preventScroll: true });
  }

  hide(): void {
    this.root.classList.add('hidden');
  }
}
