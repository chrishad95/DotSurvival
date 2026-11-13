import type { Camera } from './Camera';
import { controlFromPointer, NO_CONTROL, type Control } from './Player';
import type { GameConfig } from './GameConfig';

/**
 * Tracks the mouse / one-finger touch via Pointer Events and converts the pointer
 * position, relative to the player's on-screen position, into a steering request.
 */
export class Input {
  private px = 0;
  private py = 0;
  private active = false;
  private activePointerId: number | null = null;
  /** Called once, the first time the user gives any pointer input. */
  onFirstInput: (() => void) | null = null;
  private seenInput = false;

  constructor(
    private readonly target: HTMLElement,
    private readonly cfg: GameConfig,
  ) {
    // `touch-action: none` (CSS) plus these handlers stop the page from scrolling or zooming during play.
    target.addEventListener('pointerdown', this.onDown);
    target.addEventListener('pointermove', this.onMove);
    target.addEventListener('pointerup', this.onUp);
    target.addEventListener('pointercancel', this.onUp);
    target.addEventListener('touchmove', preventDefault, { passive: false });
    target.addEventListener('contextmenu', preventDefault);
    window.addEventListener('blur', this.onBlur);
  }

  private markInput(): void {
    if (!this.seenInput) {
      this.seenInput = true;
      this.onFirstInput?.();
    }
  }

  private onDown = (e: PointerEvent): void => {
    if (e.pointerType === 'touch' && this.activePointerId !== null) return; // one finger only
    if (e.pointerType === 'touch') {
      this.activePointerId = e.pointerId;
      try {
        this.target.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best-effort */
      }
    }
    this.px = e.clientX;
    this.py = e.clientY;
    this.active = true;
    this.markInput();
    e.preventDefault();
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerType === 'touch' && e.pointerId !== this.activePointerId) return;
    this.px = e.clientX;
    this.py = e.clientY;
    this.active = true;
    this.markInput();
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') return;
    if (e.pointerId !== this.activePointerId) return;
    this.activePointerId = null;
    this.active = false; // lifting the finger stops the cell
  };

  private onBlur = (): void => {
    this.activePointerId = null;
  };

  /** Returns the current steering request for a player drawn at the given screen position. */
  getControl(camera: Camera, playerWorldX: number, playerWorldY: number): Control {
    if (!this.active) return NO_CONTROL;
    const sx = camera.worldToScreenX(playerWorldX);
    const sy = camera.worldToScreenY(playerWorldY);
    return controlFromPointer(this.px - sx, this.py - sy, this.cfg);
  }

  /** Stops steering until the next pointer input (used when a round ends). */
  reset(): void {
    this.active = false;
    this.activePointerId = null;
  }

  dispose(): void {
    this.target.removeEventListener('pointerdown', this.onDown);
    this.target.removeEventListener('pointermove', this.onMove);
    this.target.removeEventListener('pointerup', this.onUp);
    this.target.removeEventListener('pointercancel', this.onUp);
    this.target.removeEventListener('touchmove', preventDefault);
    this.target.removeEventListener('contextmenu', preventDefault);
    window.removeEventListener('blur', this.onBlur);
  }
}

function preventDefault(e: Event): void {
  e.preventDefault();
}
