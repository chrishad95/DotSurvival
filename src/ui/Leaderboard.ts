import type { LeaderboardEntry } from '../game/GameState';
import { byId } from './HUD';

/** Upper-right top-five list. Names are set via textContent, never innerHTML. */
export class Leaderboard {
  private readonly list = byId('lb-list');

  update(entries: LeaderboardEntry[]): void {
    this.list.textContent = '';
    for (const e of entries) {
      const li = document.createElement('li');
      if (e.isPlayer) li.className = 'me';
      const name = document.createElement('span');
      name.className = 'lb-name';
      name.textContent = e.name;
      const mass = document.createElement('span');
      mass.className = 'lb-mass';
      mass.textContent = String(Math.floor(e.mass));
      li.append(name, mass);
      this.list.append(li);
    }
  }
}
