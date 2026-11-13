import { Camera } from './Camera';
import { DEFAULT_CONFIG, type GameConfig } from './GameConfig';
import { GameState } from './GameState';
import { Input } from './Input';
import { Renderer } from './Renderer';
import { GameOver } from '../ui/GameOver';
import { HUD, byId } from '../ui/HUD';
import { Leaderboard } from '../ui/Leaderboard';
import { BestScore } from '../ui/Storage';

/** Wires simulation, input, camera, renderer, and UI together and runs the animation loop. */
export class Game {
  readonly state: GameState;
  private readonly camera: Camera;
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly hud = new HUD();
  private readonly leaderboard = new Leaderboard();
  private readonly gameOver: GameOver;
  private readonly storage: BestScore;
  private readonly hint = byId('hint');

  private best: number;
  private lastTime = 0;
  private uiTimer = 0;
  private rafId = 0;
  private running = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly cfg: GameConfig = DEFAULT_CONFIG,
  ) {
    this.state = new GameState(cfg);
    this.camera = new Camera(cfg);
    this.renderer = new Renderer(canvas, cfg);
    this.input = new Input(canvas, cfg);
    this.storage = new BestScore(cfg.game.storageKey);
    this.best = this.storage.load();
    this.gameOver = new GameOver(() => this.restart());

    this.input.onFirstInput = () => this.hint.classList.add('hidden');

    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('keydown', this.onKey);

    this.onResize();
    this.camera.snap(this.state.player);
    this.refreshUI(true);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  restart(): void {
    this.state.reset();
    this.input.reset();
    this.camera.snap(this.state.player);
    this.gameOver.hide();
    this.lastTime = performance.now();
    this.uiTimer = 0;
    this.refreshUI(true);
    this.canvas.focus({ preventScroll: true });
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);

    // Clamp the delta so a stalled tab or a slow frame cannot teleport anything.
    const dt = Math.min(Math.max((now - this.lastTime) / 1000, 0), this.cfg.game.maxFrameDelta);
    this.lastTime = now;

    const { state, camera } = this;
    const wasPlaying = state.status === 'playing';
    if (wasPlaying) {
      const control = this.input.getControl(camera, state.player.x, state.player.y);
      state.update(dt, control);
      if (state.status === 'over') this.onPlayerDied();
    }
    // The camera keeps tracking the last player position, so the world does not freeze abruptly.
    camera.update(state.player, dt);

    this.uiTimer -= dt;
    if (this.uiTimer <= 0 && state.status === 'playing') {
      this.uiTimer = this.cfg.game.uiInterval;
      this.refreshUI(false);
    }

    this.renderer.render(state, camera);
  };

  private refreshUI(force: boolean): void {
    const { state } = this;
    if (force || state.status === 'playing') {
      this.hud.update(state.player.mass, state.player.eaten, Math.max(this.best, state.player.mass), state.time);
      this.leaderboard.update(state.getLeaderboard());
    }
  }

  private onPlayerDied(): void {
    const finalMass = Math.floor(this.state.player.mass);
    if (finalMass > this.best) {
      this.best = finalMass;
      this.storage.save(this.best);
    }
    this.hud.update(finalMass, this.state.player.eaten, this.best, this.state.time);
    this.leaderboard.update(this.state.getLeaderboard());
    this.gameOver.show(finalMass, this.state.player.eaten, this.best);
  }

  private onResize = (): void => {
    this.renderer.resize();
    this.camera.resize(this.renderer.cssWidth, this.renderer.cssHeight);
    this.camera.clampToArena();
  };

  /** Suspend on hide; on show, reset the clock so the first frame has no huge delta. */
  private onVisibility = (): void => {
    if (document.hidden) {
      this.stop();
    } else {
      this.start();
    }
  };

  private onKey = (e: KeyboardEvent): void => {
    if (this.gameOver.visible && (e.key === 'Enter' || e.key === ' ') && document.activeElement?.id !== 'go-restart') {
      e.preventDefault();
      this.restart();
    }
  };
}
