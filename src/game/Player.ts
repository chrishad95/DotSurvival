import type { Cell } from './Cell';
import type { GameConfig } from './GameConfig';

/** Steering request produced by the input layer, in screen space (unit direction + 0..1 throttle). */
export interface Control {
  dirX: number;
  dirY: number;
  throttle: number;
}

export const NO_CONTROL: Control = { dirX: 0, dirY: 0, throttle: 0 };

/** Applies a control request to the player cell. */
export function applyControl(player: Cell, control: Control): void {
  player.dirX = control.dirX;
  player.dirY = control.dirY;
  player.throttle = control.throttle;
}

/**
 * Converts a pointer offset from the player's on-screen position (CSS px) into a control request.
 * Close to the player the cell slows down and then stops, preventing jitter.
 */
export function controlFromPointer(
  offsetX: number,
  offsetY: number,
  cfg: GameConfig,
): Control {
  const d = Math.hypot(offsetX, offsetY);
  const { deadZonePx, fullSpeedPx } = cfg.input;
  if (d <= deadZonePx) return NO_CONTROL;
  const throttle = Math.min(1, (d - deadZonePx) / Math.max(1, fullSpeedPx - deadZonePx));
  return { dirX: offsetX / d, dirY: offsetY / d, throttle };
}
