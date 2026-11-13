// End-to-end browser test. Serves the production build from a SUBDIRECTORY (like GitHub Pages)
// and drives it with a real Chromium-based browser (Microsoft Edge or Chrome) via playwright-core.
//
//   npm run build && npm run test:e2e
//
// Set E2E_BROWSER_CHANNEL=chrome to use Chrome instead of Edge.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(here, '..', 'dist');
const OUT = path.resolve(here, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const shot = (name) => path.join(OUT, name);

const PREFIX = '/apps/dot-survival/';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (!url.startsWith(PREFIX)) {
    res.writeHead(404);
    return res.end();
  }
  const rel = url.slice(PREFIX.length) || 'index.html';
  const file = path.resolve(DIST, rel);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(4599, '127.0.0.1', r));
const URL = `http://127.0.0.1:4599${PREFIX}`;

let failures = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`);
  if (!ok) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'msedge', headless: true });
const errors = [];
function watch(page) {
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`);
  });
}
const snap = (page) =>
  page.evaluate(() => {
    const g = window.__dotSurvival;
    const s = g.state;
    return {
      x: s.player.x, y: s.player.y, mass: s.player.mass, r: s.player.radius, eaten: s.player.eaten,
      status: s.status, cells: s.cells.length, food: s.food.length, time: s.time,
      zoom: g.camera.zoom, camx: g.camera.x, camy: g.camera.y,
    };
  });

try {
  // ---------- Desktop ----------
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(URL);
  await page.waitForSelector('#game');
  await sleep(500);
  const s0 = await snap(page);
  check('startup: game running, 21 cells, 1200 food', s0.cells === 21 && s0.food === 1200 && s0.status === 'playing', JSON.stringify({ c: s0.cells, f: s0.food }));
  check('timer advances', s0.time > 0.2, `t=${s0.time.toFixed(2)}`);
  check('HUD shows initial mass 10', (await page.textContent('#hud-mass')) === '10');
  check('leaderboard has 5 entries', (await page.locator('#lb-list li').count()) === 5);
  await page.screenshot({ path: shot('desktop-start.png') });

  await page.mouse.move(1000, 360);
  await sleep(1500);
  const s1 = await snap(page);
  check('mouse moves player right', s1.x > s0.x + 100 && Math.abs(s1.y - s0.y) < 60, `dx=${(s1.x - s0.x).toFixed(0)} dy=${(s1.y - s0.y).toFixed(0)}`);
  check('camera follows player', Math.abs(s1.camx - s1.x) < 80, `cam-player=${(s1.camx - s1.x).toFixed(0)}`);
  await page.screenshot({ path: shot('desktop-moving.png') });

  await page.mouse.move(640, 360);
  await sleep(1200);
  const a = await snap(page);
  await sleep(500);
  const b = await snap(page);
  check('pointer on player -> player stops (no jitter)', Math.hypot(b.x - a.x, b.y - a.y) < 2, `moved=${Math.hypot(b.x - a.x, b.y - a.y).toFixed(2)}`);

  const grow = await page.evaluate(async () => {
    const s = window.__dotSurvival.state;
    const f = s.food[5];
    const m0 = s.player.mass;
    const r0 = s.player.radius;
    s.player.x = f.x;
    s.player.y = f.y;
    await new Promise((r) => setTimeout(r, 300));
    return { m0, m1: s.player.mass, r0, r1: s.player.radius, food: s.food.length };
  });
  check('eating pellet increases mass/radius, pellet count kept', grow.m1 > grow.m0 && grow.r1 >= grow.r0 && grow.food === 1200, JSON.stringify(grow));

  await page.evaluate(() => {
    const s = window.__dotSurvival.state;
    s.player.x = 30;
    s.player.y = 30;
  });
  await page.mouse.move(2, 2);
  await sleep(2000);
  const corner = await snap(page);
  check('player cannot leave arena', corner.x >= corner.r - 0.01 && corner.y >= corner.r - 0.01, `x=${corner.x.toFixed(1)} y=${corner.y.toFixed(1)} r=${corner.r.toFixed(1)}`);
  await page.screenshot({ path: shot('desktop-corner.png') });

  const zoom = await page.evaluate(async () => {
    const g = window.__dotSurvival;
    const s = g.state;
    s.player.x = 2500;
    s.player.y = 2500;
    s.player.mass = 2000;
    const z0 = g.camera.zoom;
    await new Promise((r) => setTimeout(r, 2500));
    return { z0, z1: g.camera.zoom, r: s.player.radius };
  });
  check('camera zooms out when large', zoom.z1 < zoom.z0 && zoom.z1 >= 0.45 - 0.001, JSON.stringify(zoom));
  await page.screenshot({ path: shot('desktop-large.png') });

  const eat = await page.evaluate(async () => {
    const s = window.__dotSurvival.state;
    const victim = s.cells.find((c) => !c.isPlayer);
    s.player.mass = 500;
    s.player.radius = 30;
    victim.mass = 10;
    victim.radius = 10;
    victim.x = s.player.x;
    victim.y = s.player.y;
    const e0 = s.player.eaten;
    await new Promise((r) => setTimeout(r, 200));
    return { e0, e1: s.player.eaten, n: s.cells.length, alive: s.cells.includes(victim) };
  });
  check('player eats smaller opponent; count maintained', eat.e1 === eat.e0 + 1 && eat.n === 21 && !eat.alive, JSON.stringify(eat));

  await page.evaluate(() => {
    const s = window.__dotSurvival.state;
    s.player.mass = 10;
    s.player.radius = 10;
    const h = s.cells.find((c) => !c.isPlayer);
    h.mass = 800;
    h.radius = 50;
    h.x = s.player.x;
    h.y = s.player.y;
  });
  await page.waitForSelector('#gameover:not(.hidden)', { timeout: 3000 });
  const over = await page.evaluate(() => ({
    mass: document.getElementById('go-mass').textContent,
    eaten: document.getElementById('go-eaten').textContent,
    best: document.getElementById('go-best').textContent,
    ls: localStorage.getItem('dot-survival:best-score'),
  }));
  check('game-over overlay shows stats; best saved', Number(over.best) >= 10 && over.ls === over.best, JSON.stringify(over));
  await page.screenshot({ path: shot('desktop-gameover.png') });
  const frozen1 = await snap(page);
  await sleep(400);
  const frozen2 = await snap(page);
  check('gameplay stops after death', frozen1.time === frozen2.time);
  await page.click('#go-restart');
  await sleep(400);
  const r = await snap(page);
  check('restart: fresh round', r.status === 'playing' && Math.abs(r.mass - 10) < 1 && r.eaten === 0 && r.cells === 21 && (await page.locator('#gameover.hidden').count()) === 1, JSON.stringify({ m: r.mass, e: r.eaten }));
  await page.reload();
  await sleep(400);
  check('best score persists across reload', (await page.textContent('#hud-best')) === over.best, `hud-best=${await page.textContent('#hud-best')}`);

  await page.setViewportSize({ width: 600, height: 900 });
  await sleep(300);
  const dim = await page.evaluate(() => {
    const c = document.getElementById('game');
    return { w: c.clientWidth, h: c.clientHeight };
  });
  check('canvas resizes with window', dim.w === 600 && dim.h === 900, JSON.stringify(dim));

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.mouse.move(900, 300);
  const soak = await page.evaluate(async () => {
    const s = window.__dotSurvival.state;
    const seen = new Set();
    let frames = 0;
    const t0 = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        frames++;
        for (const c of s.cells) if (c.ai) seen.add(c.ai.behavior);
        if (performance.now() - t0 < 8000) requestAnimationFrame(tick);
        else resolve();
      };
      tick();
    });
    return { fps: frames / ((performance.now() - t0) / 1000), behaviors: [...seen], status: s.status, n: s.cells.length };
  });
  check('AI shows food + flee/hunt behaviours during soak', soak.behaviors.includes('food') && (soak.behaviors.includes('flee') || soak.behaviors.includes('hunt')), JSON.stringify(soak));
  check('frame rate acceptable (headless)', soak.fps > 30, `fps=${soak.fps.toFixed(0)}`);

  const vis = await page.evaluate(async () => {
    const s = window.__dotSurvival.state;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    const t0 = s.time;
    await new Promise((r) => setTimeout(r, 1500));
    const tHidden = s.time;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 200));
    return { paused: Math.abs(tHidden - t0) < 0.1, resumeDelta: s.time - tHidden };
  });
  check('pauses when hidden, resumes without jump', vis.paused && vis.resumeDelta < 0.4, JSON.stringify(vis));
  await ctx.close();

  // ---------- Mobile (touch) ----------
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const mpage = await mctx.newPage();
  watch(mpage);
  await mpage.goto(URL);
  await sleep(500);
  const m0 = await snap(mpage);
  const cdp = await mctx.newCDPSession(mpage);
  const touch = (type, x, y) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await touch('touchStart', 195, 422);
  for (let i = 0; i <= 10; i++) {
    await touch('touchMove', 195 + i * 15, 422 - i * 10);
    await sleep(40);
  }
  await sleep(1200);
  const m1 = await snap(mpage);
  check('touch drag moves player up-right', m1.x > m0.x + 80 && m1.y < m0.y - 40, `dx=${(m1.x - m0.x).toFixed(0)} dy=${(m1.y - m0.y).toFixed(0)}`);
  await touch('touchEnd');
  await sleep(1500);
  const m2 = await snap(mpage);
  await sleep(400);
  const m3 = await snap(mpage);
  check('lifting finger stops the cell', Math.hypot(m3.x - m2.x, m3.y - m2.y) < 2);
  const scroll = await mpage.evaluate(() => ({
    ta: getComputedStyle(document.getElementById('game')).touchAction,
    ov: getComputedStyle(document.body).overflow,
    sy: window.scrollY,
  }));
  check('touch-action none / no scrolling', scroll.ta === 'none' && scroll.ov === 'hidden' && scroll.sy === 0, JSON.stringify(scroll));
  await mpage.screenshot({ path: shot('mobile-portrait.png') });
  await mpage.setViewportSize({ width: 844, height: 390 });
  await sleep(300);
  await mpage.screenshot({ path: shot('mobile-landscape.png') });
  await mpage.evaluate(() => {
    const s = window.__dotSurvival.state;
    const h = s.cells.find((c) => !c.isPlayer);
    h.mass = 900;
    h.radius = 60;
    h.x = s.player.x;
    h.y = s.player.y;
  });
  await mpage.waitForSelector('#gameover:not(.hidden)');
  const box = await mpage.locator('#go-restart').boundingBox();
  check('restart button is tap-sized', box.height >= 44 && box.width >= 44, JSON.stringify(box));
  await mpage.screenshot({ path: shot('mobile-gameover.png') });
  await mpage.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await sleep(400);
  check('tap Restart starts new round', (await snap(mpage)).status === 'playing');
  await mctx.close();

  check('no console errors/warnings/failed requests', errors.length === 0, errors.join(' | '));
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
  server.close();
}
console.log(failures === 0 ? '\nALL BROWSER CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures ? 1 : 0);
