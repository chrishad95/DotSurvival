# Dot Survival — Game Development Specification

**Version:** 1.0  
**Project type:** Browser-based 2D arcade game  
**Genre:** Agar.io-style growth and survival  
**Initial release:** Single-player with computer-controlled opponents

## 1. Project Overview

Create a lightweight, browser-based arcade game inspired by the core mechanics of Agar.io. The player controls a circular cell in a large arena, collects food pellets to grow, consumes smaller computer-controlled opponents, and avoids larger cells.

The game should be immediately playable without an account, installation, or complicated menus.

### Design principles

- Smooth, responsive movement.
- Satisfying growth and consumption mechanics.
- Simple, believable AI opponents.
- Minimal, readable interface.
- Fast startup and low loading overhead.
- Support for desktop and mobile browsers.
- Original game name, visuals, and implementation.

The first version is a single-player game. Online multiplayer is explicitly out of scope.

## 2. Recommended Technology

| Component | Technology |
|---|---|
| Language | TypeScript |
| Rendering | HTML5 Canvas 2D |
| Framework | Vanilla TypeScript |
| Development server and build | Vite |
| Styling | CSS |
| Persistence | `localStorage` for best score |
| Hosting | Static hosting, including GitHub Pages |

The game should run entirely in the browser. Do not add a backend, database, account system, or multiplayer server in version 1.0. Avoid large game engines and unnecessary dependencies.

## 3. Game Screen and Visual Design

Use nearly the entire browser window for the game.

### Main view

Show:
- A large arena that extends beyond the viewport.
- The player's cell.
- Colorful food pellets.
- Computer-controlled opponent cells.
- A visible arena boundary.
- A small statistics display.
- A leaderboard in the upper-right corner.

The camera follows the player so that the player generally remains near the center while the world moves around them.

### Visual style

Use a clean, colorful, minimalist style:
- A light or dark background.
- Small, colorful circular pellets.
- Cells in distinct colors.
- A subtle outline around the player's cell.
- A faint background grid or dot pattern.
- Smooth edges and restrained animations.

Use simple geometric shapes; external artwork is not required. Display cell names inside cells when there is enough room.

### Interface

**Upper-left:** current mass/size, opponents eaten, and optionally elapsed time.  
**Upper-right:** top five cells by mass.  
**Center:** gameplay.  
**Game over:** a compact overlay showing final mass, opponents eaten, best score, and a Restart button.

Do not create a complicated main menu or separate page for game over.

## 4. Game World

Start with a configurable world of approximately **5,000 × 5,000 world units**. The arena should be larger than the visible viewport.

The camera viewport matches the browser window. The camera follows the player and gradually zooms out as the player grows.

### Arena boundaries

Cells must not leave the playable area. Clamp their positions to the arena boundaries and render the boundary clearly enough for the player to recognize it.

## 5. Player Cell and Controls

Create the player near the center of the arena.

Suggested starting values:
- Starting mass: `10`.
- Starting radius: approximately `10` world units.
- Base movement speed: approximately `220` world units per second.
- Minimum radius: `10` world units.

Treat these as tuning values, not immutable requirements.

### Desktop controls

- The player moves toward the mouse pointer.
- Interpret the pointer position relative to the player's screen position.
- Movement must be smooth, not teleportation.
- Slow or stop movement when the pointer is very close to the player to prevent jitter.

### Mobile controls

- Support one-finger touch and drag to direct the cell.
- Prevent accidental page scrolling during active gameplay.
- Ensure the game remains usable in portrait and landscape orientations.

### Movement physics

Use world coordinates and delta time so movement is consistent across frame rates. The player's speed should gradually decrease as its radius increases.

A possible starting formula is:

```text
speed = baseSpeed / (1 + 0.015 * (radius - startingRadius))
```

Tune this formula and apply a configurable minimum speed so large cells remain controllable.

## 6. Food Pellets and Growth

### Pellet generation

Start with approximately **1,200 pellets**, distributed randomly across the arena. Keep the count configurable.

Each pellet has:
- Position (`x`, `y`).
- Radius.
- Color.
- Mass value.

Avoid concentrating all pellets in one area.

### Pellet consumption

When a cell overlaps a pellet:
1. Remove the pellet.
2. Add its mass to the cell.
3. Spawn a replacement pellet elsewhere in the arena.
4. Avoid spawning replacement pellets directly on the player or another cell when practical.

Maintain approximately the configured pellet count throughout gameplay.

### Growth formula

Radius should increase with mass, but more slowly than mass itself. Use a square-root relationship:

```text
radius = radiusScale * sqrt(mass)
```

Choose `radiusScale` so the starting mass yields the desired starting radius. Growth should appear smooth and continuous.

## 7. Opponent Cells

Start with approximately **20 AI opponents**, configurable in one central settings file.

Each opponent should have:
- Unique ID.
- Name.
- Position.
- Mass and radius.
- Movement speed.
- Color.
- Current AI behavior state.

Use a range of starting sizes, for example:

| Category | Number | Starting mass |
|---|---:|---:|
| Small | 8 | 10–20 |
| Medium | 8 | 25–60 |
| Large | 4 | 70–150 |

The player should initially be vulnerable to some opponents. Opponents must be able to grow by eating pellets and other cells.

Use simple names such as Nova, Pixel, Orbit, and Comet.

## 8. Opponent AI

Use a lightweight behavior system with three main behaviors:

1. **Collect food**
2. **Hunt a smaller cell**
3. **Escape a larger cell**

### Food seeking

When there is no immediate threat and no suitable prey, move toward nearby pellets. If none are suitable or nearby, choose a random target location.

### Hunting

If a smaller cell is within detection range and can be consumed safely, an opponent may pursue it. Avoid chasing targets that are too large or impractical to catch.

### Escape

If a larger cell comes within a configurable danger radius, prioritize moving away from it. Escape behavior takes precedence over food seeking and hunting when a threat is immediate.

### AI update frequency

Rendering should run through the normal browser animation loop. AI decision-making can run approximately 4–8 times per second, while movement and collision checks run as often as needed. This avoids recalculating every decision on every render frame.

## 9. Cell Consumption

A cell may consume another cell only when:
1. The cells are within the required overlap/consumption distance.
2. The attacker has the required size advantage.
3. The target is eligible to be consumed.

A suggested size rule is:

```text
attacker.radius >= target.radius * 1.2
```

Make the threshold configurable and tune it during playtesting. Edge contact alone should not allow a smaller cell to eat a larger one.

### On consumption

- Remove the target from active gameplay.
- Transfer most of its mass to the attacker; a starting value is 85%.
- Recalculate the attacker's radius.
- Increment the attacker's opponents-eaten counter.
- Update the leaderboard.
- Optionally show a brief floating score indicator.

The mass-transfer percentage should be configurable.

### Player death

If an opponent consumes the player:
- Stop normal gameplay updates.
- Show the game-over overlay.
- Display final statistics.
- Save the best score if appropriate.
- Allow an immediate restart without reloading the browser page.

## 10. Camera

### Following

Keep the player generally centered in the viewport using smooth interpolation rather than snapping. Keep the camera within the arena bounds.

### Zoom

Gradually zoom out as the player grows so more of the arena is visible. Avoid sudden changes or zooming out so far that the player becomes hard to see.

A possible starting formula is:

```text
zoom = clamp(
  1 / (1 + 0.003 * (radius - startingRadius)),
  minimumZoom,
  1.0
)
```

A starting `minimumZoom` of `0.45` can be tested and adjusted.

### Coordinate conversion

Store all entities in world coordinates and convert them to screen coordinates during rendering using the camera position and zoom. Apply the same transformation to pellets, cells, names, grid, and arena boundaries.

## 11. Collision Detection and Performance

Use circular collision checks. For circles with centers `(x1, y1)` and `(x2, y2)`:

```text
dx = x2 - x1
dy = y2 - y1
distanceSquared = dx * dx + dy * dy

circlesOverlap =
  distanceSquared < (radius1 + radius2) * (radius1 + radius2)
```

Use squared distances to avoid square-root calculations when only comparing distances. Apply separate size and eligibility rules for consumption.

The initial workload is approximately:
- 1,200 pellets.
- 20 opponents.
- 1 player.

Avoid comparing every entity with every other entity unnecessarily. If performance becomes an issue, implement a spatial grid or spatial hash to find nearby entities.

## 12. Interface and Feedback

### Statistics

Display:
- Current mass.
- Current size or radius, if useful.
- Opponents eaten.
- Best score.

Mass is the primary statistic. Keep text readable and unobtrusive.

### Leaderboard

Show the top five cells by mass, including rank, name, and mass. Highlight the player when they appear in the top five. Update periodically rather than sorting every render frame.

### Feedback

- Eating food updates mass and radius.
- Eating an opponent produces a brief, more noticeable visual effect.
- Statistics and leaderboard update promptly.
- Animations must not interfere with control.

### Game-over overlay

Show:
- **GAME OVER**
- Final mass.
- Opponents eaten.
- Best score.
- Restart button.

Persist the best score in `localStorage`.

## 13. Game Loop and State

Use `requestAnimationFrame` for rendering and game updates. Separate game-state updates from drawing.

A typical frame should:
1. Calculate elapsed time.
2. Read player input.
3. Update player movement.
4. Update opponent movement.
5. Run AI decisions when scheduled.
6. Check and resolve collisions.
7. Consume pellets.
8. Resolve cell consumption.
9. Respawn consumed opponents.
10. Update the camera.
11. Update interface elements when needed.
12. Render the visible world.

Use delta time for movement. Clamp unusually large delta-time values so the game does not jump after a tab becomes inactive. Pause or safely suspend gameplay when the document is hidden, then resume without a large movement jump.

## 14. Opponent Respawning

When an opponent is consumed:
- Remove it from active play.
- Spawn a replacement with a small starting mass.
- Give it a name and color.
- Place it at a safe random location.
- Avoid spawning it directly beside the player.

Maintain the configured opponent count during normal gameplay. Do not automatically respawn the player after death; show the game-over overlay instead.

## 15. Game Balance

The game should be challenging but fair.

At the beginning:
- The player can find food without immediately fighting.
- Larger opponents pose a meaningful threat.
- Smaller opponents can become potential prey.
- The player can grow without having to fight immediately.

As the player grows:
- Food becomes less important relative to eating opponents.
- More opponents become vulnerable.
- Movement becomes slower.
- The camera reveals more of the arena.

Avoid making the game either trivial or so aggressive that a new player is eliminated within seconds. Tune these values through actual playtesting.

## 16. Audio (Optional)

Audio is optional and must not delay the initial release. If added, keep it minimal:
- Subtle food-eating sound.
- More noticeable opponent-consumption sound.
- Short game-over sound.

Never autoplay loud audio on page load. The game must be fully playable without sound.

## 17. Browser and Device Compatibility

Support current versions of:
- Chrome.
- Firefox.
- Safari.
- Edge.

Support desktop computers, laptops, Android phones, iPhones, and tablets.

Requirements:
- Resize the canvas when the browser window changes dimensions.
- Scale for device pixel ratio to keep rendering sharp.
- Cap effective pixel ratio if needed for performance.
- Keep HUD elements readable on small screens.
- Make the Restart button easy to tap.
- Support mouse and touch controls.
- Prevent unintended scrolling during touch gameplay.

## 18. Suggested Project Structure

```text
dot-survival/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── public/
│   └── favicon.svg
└── src/
    ├── main.ts
    ├── styles.css
    ├── game/
    │   ├── Game.ts
    │   ├── GameState.ts
    │   ├── GameConfig.ts
    │   ├── Player.ts
    │   ├── Cell.ts
    │   ├── Food.ts
    │   ├── OpponentAI.ts
    │   ├── Camera.ts
    │   ├── Collision.ts
    │   ├── Input.ts
    │   └── Renderer.ts
    └── ui/
        ├── HUD.ts
        ├── Leaderboard.ts
        └── GameOver.ts
```

The coding assistant may adjust the structure when a simpler design is justified. Keep the code understandable and avoid unnecessary abstractions.

## 19. Central Configuration

Keep important tuning values in one configuration module, including:
- Arena dimensions.
- Starting player mass and radius.
- Base and minimum movement speed.
- Pellet count.
- Opponent count and mass distribution.
- Minimum size advantage for consumption.
- Mass-transfer percentage.
- AI detection and danger radii.
- AI decision interval.
- Camera zoom settings.
- Maximum frame delta.
- `localStorage` key.

## 20. Implementation Requirements

Build a real, playable game, not a static mockup. It must include:

1. HTML5 Canvas rendering.
2. Arena and boundaries.
3. Controllable player cell.
4. Mouse and touch controls.
5. Pellet generation and consumption.
6. Player growth.
7. Multiple AI opponents.
8. AI food seeking, hunting, and escape behavior.
9. Cell-versus-cell consumption.
10. Player death and game-over handling.
11. Smooth camera following and zoom.
12. Leaderboard and HUD.
13. Restart mechanism.
14. Persistent best score.
15. Responsive layout.
16. Setup and deployment documentation.

All essential features must work together. Do not use scripted visual effects or fake movement as substitutes for actual mechanics.

## 21. Testing and Acceptance Criteria

### Startup
- Opening the site starts a playable game.
- The player and arena are visible.
- No account or setup is required.

### Movement
- Mouse control works.
- Touch control works.
- Movement is smooth and frame-rate independent.
- The player cannot leave the arena.

### Growth
- Pellets are visible and collectible.
- Eating a pellet increases mass and radius.
- Replacement pellets appear.

### Opponents
- Opponents move independently and collect food.
- Opponents grow over time.
- Larger opponents can consume smaller opponents.
- Smaller opponents try to escape larger threats.
- The player can consume sufficiently smaller opponents.

### Camera
- The camera follows the player.
- Zoom changes gradually with player size.
- The player remains visible and controllable.
- The arena boundary renders correctly.

### Game over and restart
- A sufficiently large opponent can consume the player.
- The game-over overlay shows final statistics.
- Restart begins a fresh round.
- Best score persists across restarts and page reloads.

### Performance and reliability
- Gameplay remains responsive at the configured entity counts.
- The browser console has no recurring errors.
- Resizing does not break gameplay.
- Mobile gameplay is usable.

### Deployment
- The production build succeeds.
- The game works when hosted from a subdirectory, as may be needed for GitHub Pages.
- The README explains installation, local development, production build, and deployment.

## 22. Out-of-Scope Features

Do not implement these in version 1.0:
- Online multiplayer.
- Accounts or profiles.
- Server-side database.
- Chat or friends lists.
- Teams or clans.
- Skins or cosmetic shop.
- In-game currency or purchases.
- Advertisements.
- Multiple game modes.
- Missions or quests.
- Equipment or upgrades.
- Split-cell mechanics.
- Mass-ejection mechanics.
- Advanced physics.
- Complex audio systems.

These can be considered later only after the core game is fun and stable.

## 23. Development Workflow

### Phase 1: Project setup
- Create the Vite and TypeScript project.
- Set up the HTML page and responsive canvas.
- Implement the animation loop.
- Confirm the game runs locally.

### Phase 2: Core gameplay
- Add arena and boundaries.
- Add player cell and controls.
- Add pellets and growth.
- Add the camera.

**Milestone:** The player can move around the arena and grow by eating food.

### Phase 3: Opponents
- Add opponent cells and movement.
- Implement food seeking.
- Implement hunting and escape.
- Implement consumption rules.

**Milestone:** The player can eat smaller opponents and be eaten by larger opponents.

### Phase 4: Interface
- Add statistics and leaderboard.
- Add game-over overlay.
- Implement restart and persistent best score.

### Phase 5: Polish and test
- Tune movement and growth.
- Improve camera behavior.
- Verify mobile controls.
- Test collision and game-over cases.
- Check performance and remove console errors.

### Phase 6: Deployment
- Verify the production build.
- Confirm static hosting works from a subdirectory.
- Write the README with setup and deployment instructions.

Do not stop after creating initial project files. Implement and test the game until the acceptance criteria are met. If browser testing tools are available, test the running game and fix issues found.

## 24. Final Deliverable

Deliver a complete, working browser game with:
- All source code and configuration files.
- A working local development setup.
- A successful production build.
- A README covering setup and deployment.

The player should be able to open the game, understand the objective within a few seconds, and begin playing without reading instructions.

**Core gameplay loop:** Move → Eat → Grow → Hunt → Survive → Repeat.
