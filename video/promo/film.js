// Keyhole promo v2: narrated, piece-by-piece motion over the real app. Pure function of time.
// 120 bpm grid, 112 beats (56 s). Shot list: docs/shotlist.md · narration: docs/narration.md · vo.json.
import * as M from './lib/motion.js';
import * as K from './lib/kit.js';

const { W, H, FORMAT, E, prog, lerp, clamp, springU, SPRING, font, text, rrect, bump, shake } = M;
const { C, DISPLAY, UI, piece, enter, leave, backdrop, counter, cursorPath, logo, lockIcon, kinetic, spokenLine } = K;
const SQ = FORMAT.square;
let VO = null;

// ------------------------------------------------------------------ layout
const L = FORMAT.pick({
  '16x9': { tx: 120, tw: 650, ty: 330, ts: 74, sx: 840, sw: 990, sy: 70, sh: 940 },
  '1x1': { tx: 70, tw: 940, ty: 140, ts: 56, sx: 70, sw: 940, sy: 380, sh: 640 },
});
const box = (w, h) => ({ x: L.sx + (L.sw - w) / 2, y: L.sy + (L.sh - h) / 2 });

// Real-screen geometry (2x screenshots), measured with Playwright (measure3.mjs).
const CARDS = [[240, 632], [1053, 632], [1867, 632], [240, 1313], [1053, 1313], [1867, 1313]].map(([x, y]) => [x, y, 773, 641]);
const GRID = [240, 632, 2400, 1322];
const RET = [46, 173, 232, 102];
const MAIN = [240, 194, 1711, 1150];
const CHART = [298, 646, 1595, 440], STATS = [298, 1134, 1595, 152];
const LOCKED = [700, 1384, 800, 416], LOCK_AT = [1096, 1607];
const FEED_HEAD = 116, FEED_ROW = 156;
const COPY_BTN = [1518, 465, 143, 80];
const BUY_PAY = [48, 1041, 824, 108];
const CP_SAME = [328, 418, 264, 140], CP_GO = [48, 1006, 824, 108];
const SELL = [240, 537, 1711, 836], EARNED = [40, 91, 496, 102];

const HITS = [
  [0.5, 'first word', 'impact'],
  [5, 'lock shuts', 'thud'],
  [8, 'wall of traders', 'whoosh', { len: 0.4 }],
  [15.6, 'rush', 'whoosh', { len: 0.3, from: 600, to: 3000 }],
  [16, 'Meet Keyhole: drop', 'impact'],
  [17.4, 'wordmark', 'bell', { pitch: 'D6' }],
  [20, 'dive', 'riser', { len: 2 }],
  [24, 'cards', 'whoosh', { len: 0.3 }],
  [24.4, 'card', 'pop', { pitch: 'D5' }], [24.8, 'card', 'pop', { pitch: 'F5' }], [25.2, 'card', 'pop', { pitch: 'A5' }],
  [25.6, 'card', 'pop', { pitch: 'C6' }], [26, 'card', 'pop', { pitch: 'D6' }], [26.4, 'card', 'pop', { pitch: 'F6' }],
  [30, 'Mara lifts', 'whoosh', { len: 0.3, from: 2400, to: 900 }],
  [30.5, 'count', 'type', { n: 10, len: 1.2 }],
  [33.5, 'NEAR tag', 'blip', { pitch: 'A6' }],
  [36, 'record', 'whoosh', { len: 0.35, from: 2400, to: 600 }],
  [40, 'stat', 'pop', { pitch: 'D5' }], [40.6, 'stat', 'pop', { pitch: 'F5' }], [41.2, 'stat', 'pop', { pitch: 'A5' }], [41.8, 'stat', 'pop', { pitch: 'D6' }],
  [43, 'loss slides in', 'thud'],
  [46, 'private', 'sub', { len: 0.8 }],
  [47, 'lock', 'click'],
  [52.5, 'lock becomes key', 'boing', { pitch: 'A5' }],
  [56, 'key card', 'whoosh', { len: 0.4 }],
  [57.5, 'coins', 'coins'],
  [60, 'dialog', 'pop', { pitch: 'A5' }],
  [62.5, 'pay', 'click'],
  [63.2, 'paid', 'coins'],
  [66, 'feed', 'whoosh', { len: 0.35 }],
  ...Array.from({ length: 8 }, (_, i) => [66.4 + i * 0.5, 'row', 'tick']),
  [76.5, 'tap Copy', 'click'],
  [77.2, 'copy dialog', 'pop', { pitch: 'D6' }],
  [80, 'same as Mara', 'click'],
  [82, 'copy', 'click'],
  [82.6, 'copied', 'bell', { pitch: 'A6' }],
  [86, 'earnings', 'whoosh', { len: 0.35, from: 2400, to: 600 }],
  [86.6, 'count', 'type', { n: 12, len: 1.4 }],
  [93, 'phones', 'whoosh', { len: 0.4 }],
  [100, 'end card', 'impact'],
  [100.5, 'logo', 'bell', { pitch: 'D6' }],
];

// ------------------------------------------------------------------ helpers
const ACC = { private: C.violet, NEAR: C.violet, key: C.violet, instantly: C.violet, tap: C.violet, Keyhole: C.violet, trust: C.violet, loss: C.red, hidden: C.violet, coin: C.violet, right: C.violet };
function words(ctx, t, opts = {}) {
  const s = spokenLine(VO, t);
  if (!s) return;
  kinetic(ctx, t, s.line, s.end, { x: L.tx, y: L.ty, w: L.tw, size: L.ts, accent: ACC, ...opts });
}
const wordT = (line, w) => { const L0 = VO.lines[line]; const x = L0.words.find((d) => d.w.toLowerCase().startsWith(w)); return x ? x.t0 : L0.t0; };

function chipText(ctx, str, x, y, k, color = C.green) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(k * 1.5);
  const f = font(34, 600, UI);
  ctx.font = f;
  const w = ctx.measureText(str).width + 44;
  ctx.translate(x, y); ctx.scale(k, k);
  rrect(ctx, -w / 2, -32, w, 64, 32); ctx.fillStyle = C.white;
  ctx.shadowColor = 'rgba(13,17,23,0.18)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10; ctx.fill(); ctx.shadowColor = 'transparent';
  text(ctx, str, 0, 12, f, color, 'center');
  ctx.restore();
}

function phone(ctx, img, x, y, w, rot = 0) {
  const h = w / 0.462;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot); ctx.translate(-w / 2, -h / 2);
  ctx.save(); ctx.shadowColor = 'rgba(13,17,23,0.35)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30;
  rrect(ctx, -12, -12, w + 24, h + 24, 52); ctx.fillStyle = '#1B2130'; ctx.fill(); ctx.restore();
  rrect(ctx, 0, 0, w, h, 40); ctx.clip(); ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();
}

// ------------------------------------------------------------------ scenes
function s1(ctx, u, t) {
  backdrop(ctx, t, { dark: true });
  const s = spokenLine(VO, t);
  const size = FORMAT.pick({ '16x9': 124, '1x1': 98 });
  const x = SQ ? 70 : 150, w = SQ ? 940 : 1500;
  const out = leave(u, 7.4, 0.6);
  ctx.save(); ctx.translate(0, -out * H * 0.6);
  if (s) kinetic(ctx, t, s.line, 99, { x, y: H / 2 + 10, w, size, color: C.white, accent: { private: C.violet } });
  // the lock is there from frame 0, open; it snaps shut on "private"
  const tp = wordT(0, 'private');
  const k = M.spring(t + 0.25, SPRING.bouncy);
  const snap = M.spring(t - tp - 0.45, SPRING.bouncy);
  lockIcon(ctx, SQ ? W / 2 : W / 2, H / 2 - size * 1.55, (78 + 10 * snap) * k, { shut: E.outCubic(prog(t, tp + 0.4, tp + 0.7)) });
  ctx.restore();
}

function s2(ctx, u, t, IMG) {
  backdrop(ctx, t);
  const cw = 560, ch = cw * (641 / 773);
  const rush = E.inExpo(prog(u, 15.2, 16));
  ctx.save();
  M.zoomAbout(ctx, 1 + rush * 1.6, W / 2, H / 2);
  for (let col = -1; col < 5; col++) {
    for (let row = -1; row < 3; row++) {
      const idx = ((col * 3 + row * 5) % 6 + 6) % 6;
      const speed = 60 + (((col % 3) + 3) % 3) * 30;
      const x = col * (cw + 70) + 40 - (t - 4) * speed * 0.6;
      const y = row * (ch + 60) + 120 - (((t - 4) * speed) % (ch + 60)) + (((col % 2) + 2) % 2) * 200;
      piece(ctx, IMG.homeFull, CARDS[idx], x, y, cw, ch, { r: 22, blur: 7, alpha: 0.85 * (1 - rush), tilt: 0.3 * Math.sin(col + row), shadow: 0.6 });
    }
  }
  ctx.restore();
  const s = spokenLine(VO, t);
  if (s) {
    const g = ctx.createLinearGradient(0, H * 0.28, 0, H * 0.76);
    g.addColorStop(0, 'rgba(245,246,248,0)'); g.addColorStop(0.3, 'rgba(245,246,248,0.94)'); g.addColorStop(0.7, 'rgba(245,246,248,0.94)'); g.addColorStop(1, 'rgba(245,246,248,0)');
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.28, W, H * 0.48);
    kinetic(ctx, t, s.line, s.end, { x: SQ ? 70 : 160, y: H / 2 + 10, w: SQ ? 940 : 1600, size: FORMAT.pick({ '16x9': 104, '1x1': 82 }), align: 'center', accent: { good: C.violet } });
  }
}

function s3(ctx, u, t, IMG) {
  backdrop(ctx, t, { dark: true });
  const size = FORMAT.pick({ '16x9': 230, '1x1': 200 });
  const z = E.inOutCubic(prog(u, 19.6, 24));
  const tMeet = wordT(2, 'meet'), tKey = wordT(2, 'keyhole');
  const kIn = M.spring(t - tMeet + 0.05, SPRING.bouncy);
  const sc = kIn * 70 ** z;
  const cx0 = SQ ? W / 2 : W / 2 - 300, cy0 = SQ ? H / 2 - 140 : H / 2 - 40;
  const cx = lerp(cx0, W / 2, z), cy = lerp(cy0, H / 2, z);
  if (sc > 0) {
    ctx.save();
    shake(ctx, u, 16, 8, 3, 0.2);
    rrect(ctx, cx - (size * sc) / 2, cy - (size * sc) / 2, size * sc, size * sc, 9 * (size / 32) * sc);
    ctx.fillStyle = C.violet; ctx.fill();
    K.keyholePath(ctx, cx, cy, (size / 32) * sc);
    ctx.fillStyle = C.white; ctx.fill(); ctx.clip();
    const win = prog(u, 19.6, 21);
    if (win > 0) { ctx.globalAlpha = win; M.cover(ctx, IMG.home, 0, 0, W, H, { fx: SQ ? 0.12 : 0.5, fy: 0.3 }); }
    ctx.restore();
  }
  const fade = 1 - prog(u, 19.4, 20.2);
  if (fade > 0) {
    ctx.save(); ctx.globalAlpha = fade;
    const kw = M.spring(t - tKey + 0.05, SPRING.snappy);
    const wx = SQ ? W / 2 : cx0 + size / 2 + 60;
    const wy = SQ ? cy0 + size / 2 + 190 : cy0 + size * 0.3;
    if (kw > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, wy + 40); ctx.clip();
      text(ctx, 'Keyhole', wx, wy + (1 - kw) * 200, font(FORMAT.pick({ '16x9': 190, '1x1': 150 }), 600, DISPLAY), C.white, SQ ? 'center' : 'left', -3);
      ctx.restore();
    }
    const tg = E.outQuint(prog(t, tKey + 0.6, tKey + 1.4));
    if (tg > 0) {
      ctx.globalAlpha = fade * tg;
      text(ctx, 'Trade in private. Sell the view.', SQ ? W / 2 : wx + 8, wy + 100 + (1 - tg) * 20, font(FORMAT.pick({ '16x9': 52, '1x1': 44 }), 500, UI), C.night, SQ ? 'center' : 'left');
    }
    ctx.restore();
  }
  if (z >= 0.999) M.cover(ctx, IMG.home, 0, 0, W, H, { fx: SQ ? 0.12 : 0.5, fy: 0.3 });
}

function s4(ctx, u, t, IMG) {
  backdrop(ctx, t);
  const fall = E.inCubic(prog(u, 24, 25));
  if (fall < 1) { ctx.save(); ctx.globalAlpha = 1 - fall; M.zoomAbout(ctx, 1 + fall * 0.3, W / 2, H / 2); M.cover(ctx, IMG.home, 0, 0, W, H, { fx: SQ ? 0.12 : 0.5, fy: 0.3 }); ctx.restore(); }
  const gw = L.sw, sc = gw / GRID[2], gh = GRID[3] * sc;
  const { x: gx, y: gy } = box(gw, gh);
  const lift = springU(u, 30, SPRING.gentle);
  const out = leave(u, 35.5, 0.5);
  CARDS.forEach((c, i) => {
    if (i === 2) return;
    const k = enter(u, 24.1 + i * 0.4, SPRING.bouncy);
    const x = gx + (c[0] - GRID[0]) * sc, y = gy + (c[1] - GRID[1]) * sc;
    piece(ctx, IMG.homeFull, c, x, y + (1 - k) * 260 - out * 60, c[2] * sc, c[3] * sc, { r: 14, alpha: clamp(k * 1.4) * (1 - 0.65 * clamp(lift)) * (1 - out), rot: (1 - k) * (i % 2 ? 0.12 : -0.12), shadow: 0.7 });
  });
  const c = CARDS[2];
  const k = enter(u, 24.9, SPRING.bouncy);
  const bx = gx + (c[0] - GRID[0]) * sc, by = gy + (c[1] - GRID[1]) * sc, bw = c[2] * sc, bh = c[3] * sc;
  const big = SQ ? 2.1 : 2.2;
  const tw = bw * lerp(1, big, lift), th = bh * lerp(1, big, lift);
  const cx = lerp(bx + bw / 2, L.sx + L.sw / 2, lift), cy = lerp(by + bh / 2, L.sy + L.sh / 2 - (SQ ? 0 : 20), lift);
  const x = cx - tw / 2, y = cy - th / 2 + (1 - k) * 260 - out * 60;
  piece(ctx, IMG.homeFull, c, x, y, tw, th, { r: 14 * lerp(1, big, lift), alpha: clamp(k * 1.4) * (1 - out), shadow: 1 + lift });
  const cnt = prog(u, 30.5, 33);
  if (cnt > 0 && out < 1) {
    const s = tw / c[2];
    const rx = x + RET[0] * s, ry = y + RET[1] * s, rw = RET[2] * s, rh = RET[3] * s;
    ctx.save(); ctx.globalAlpha = 1 - out;
    ctx.fillStyle = C.white; ctx.fillRect(rx - 4, ry - 2, rw + 30 * s, rh + 4);
    counter(ctx, 37.4, cnt, rx, ry + rh * 0.84, font(68 * s, 600, DISPLAY), C.green, { sign: true, suffix: '%' });
    ctx.restore();
  }
  const tg = enter(u, 33.4, SPRING.bouncy);
  if (tg > 0 && out < 1) {
    const px = x + tw - 160, py = y + th + 50;
    ctx.save(); ctx.globalAlpha = 1 - out;
    ctx.strokeStyle = C.violet; ctx.lineWidth = 4; ctx.setLineDash([10, 10]);
    ctx.beginPath(); ctx.moveTo(px, y + th - 10); ctx.lineTo(px, lerp(y + th - 10, py - 30, clamp(tg))); ctx.stroke(); ctx.setLineDash([]);
    ctx.translate(px, py); ctx.scale(tg, tg);
    rrect(ctx, -150, -30, 300, 60, 30); ctx.fillStyle = C.violet; ctx.fill();
    text(ctx, 'Read from NEAR', 0, 11, font(30, 600, UI), C.white, 'center');
    ctx.restore();
  }
  words(ctx, t);
}

function s5(ctx, u, t, IMG) {
  backdrop(ctx, t);
  const k = enter(u, 35.6);
  const out = leave(u, 45.5);
  const w = L.sw, h = w * (MAIN[3] / MAIN[2]);
  const { x, y: y0 } = box(w, h);
  const y = y0 + (1 - k) * 140 - out * 60 - (SQ ? 0 : 40);
  const a = clamp(k * 1.5) * (1 - out);
  piece(ctx, IMG.trader, MAIN, x, y, w, h, { r: 24, alpha: a });
  const s = w / MAIN[2];
  const rev = E.inOutCubic(prog(u, 36.4, 39.6));
  if (a > 0) {
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = C.white;
    const cx = x + (CHART[0] - MAIN[0]) * s, cy = y + (CHART[1] - MAIN[1]) * s;
    if (rev < 1) ctx.fillRect(cx + CHART[2] * s * rev, cy - 4, CHART[2] * s * (1 - rev) + 2, CHART[3] * s + 8);
    const sx0 = x + (STATS[0] - MAIN[0]) * s, sy0 = y + (STATS[1] - MAIN[1]) * s, cw = 380.75 * s, chh = STATS[3] * s, gap = 24 * s;
    ctx.fillRect(sx0 - 4, sy0 - 4, STATS[2] * s + 8, chh + 8);
    for (let i = 0; i < 4; i++) {
      const pk = enter(u, 40 + i * 0.6, SPRING.bouncy);
      if (pk <= 0) continue;
      const px = sx0 + i * (cw + gap);
      ctx.save(); ctx.translate(px + cw / 2, sy0 + chh / 2); ctx.scale(pk, pk); ctx.translate(-(px + cw / 2), -(sy0 + chh / 2));
      ctx.drawImage(IMG.trader, STATS[0] + i * (380.75 + 24), STATS[1], 380.75, STATS[3], px, sy0, cw, chh);
      ctx.restore();
    }
    ctx.restore();
  }
  const lk = enter(u, 42.8, SPRING.bouncy);
  if (lk > 0) {
    const lw = SQ ? 420 : 440, lh = lw * (641 / 773);
    const lx = SQ ? x + w - lw + 20 : x + w - lw + 60, ly = y + h - lh * 0.55;
    const xx = lerp(W + 40, lx, lk), rot = lerp(0.2, 0.04, lk);
    piece(ctx, IMG.homeFull, CARDS[5], xx, ly, lw, lh, { r: 18, rot, alpha: 1 - out, shadow: 1.6 });
    const sc2 = lw / 773, pulse = Math.max(bump(u, 44, 0.8), bump(u, 45, 0.6));
    if (pulse > 0) {
      ctx.save(); ctx.globalAlpha = pulse * (1 - out); ctx.strokeStyle = C.red; ctx.lineWidth = 5;
      ctx.translate(xx + lw / 2, ly + lh / 2); ctx.rotate(rot); ctx.translate(-(xx + lw / 2), -(ly + lh / 2));
      rrect(ctx, xx + RET[0] * sc2 - 10, ly + RET[1] * sc2 - 10, RET[2] * sc2 + 20, RET[3] * sc2 + 20, 16); ctx.stroke();
      ctx.restore();
    }
  }
  words(ctx, t);
}

function s6(ctx, u, t, IMG) {
  backdrop(ctx, t);
  const k = enter(u, 45.6);
  const out = leave(u, 55.5);
  const w = L.sw, h = w * (LOCKED[3] / LOCKED[2]);
  const { x, y: y0 } = box(w, h);
  const y = y0 + (1 - k) * 120 - out * 60;
  piece(ctx, IMG.locked, LOCKED, x, y, w, h, { r: 24, alpha: clamp(k * 1.5) * (1 - out) });
  const s = w / LOCKED[2];
  const lx = x + (LOCK_AT[0] - LOCKED[0]) * s, ly = y + (LOCK_AT[1] - LOCKED[1]) * s;
  const tKey = wordT(5, 'key');
  const grow = enter(u, 47, SPRING.bouncy);
  const keyK = E.inOutCubic(prog(t, tKey - 0.1, tKey + 0.5));
  if (grow > 0 && out < 1) {
    ctx.save(); ctx.globalAlpha = 1 - out;
    lockIcon(ctx, lx, ly - 10 * s, (60 + 40 * keyK) * grow, { shut: E.outCubic(prog(u, 47.4, 48)), key: keyK, bg: keyK > 0.5 ? C.violet : C.ink });
    ctx.restore();
  }
  words(ctx, t);
}

function s7(ctx, u, t, IMG) {
  backdrop(ctx, t);
  const out = leave(u, 65.5);
  const kc = enter(u, 55.6, SPRING.bouncy);
  const kw = SQ ? 300 : 430, kh = kw * (740 / 642);
  const kx = L.sx + L.sw - kw - 10, ky = SQ ? 440 : (H - kh) / 2;
  const dialogK = enter(u, 59.8, SPRING.bouncy);
  piece(ctx, IMG.keycard, null, lerp(W + 50, kx, kc), ky - out * 50, kw, kh, { r: 22, alpha: 1 - out, bg: C.ink });
  const coins = ['NEAR', 'BTC', 'ETH', 'SOL', 'USDC', 'ZEC', 'USDT'];
  coins.forEach((c, i) => {
    const t0 = 56.6 + i * 0.25;
    const p = prog(u, t0, t0 + 2.6);
    if (p <= 0 || p >= 1) return;
    const ang = i * (M.TAU / coins.length) + p * 4;
    const r = lerp(330, 0, E.inCubic(p));
    const cx = kx + kw / 2 + Math.cos(ang) * r, cy = ky + kh / 2 + Math.sin(ang) * r * 0.6;
    const sz = 84 * (1 - E.inExpo(p) * 0.9) * clamp(p * 6);
    ctx.drawImage(IMG['c' + c], cx - sz / 2, cy - sz / 2, sz, sz);
  });
  const dw = SQ ? 420 : 560, dh = dw * (1280 / 920);
  const dx = SQ ? L.sx + 30 : L.sx - 10, dy = SQ ? 400 : (H - dh) / 2;
  if (dialogK > 0) {
    const yy = dy + (1 - dialogK) * 160 - out * 50;
    piece(ctx, IMG.buy, null, dx, yy, dw, dh, { r: 26, alpha: clamp(dialogK * 1.5) * (1 - out), scale: lerp(0.85, 1, dialogK), shadow: 1.4 });
    const ds = dw / 920;
    const payX = dx + (BUY_PAY[0] + BUY_PAY[2] / 2) * ds, payY = yy + (BUY_PAY[1] + BUY_PAY[3] / 2) * ds;
    cursorPath(ctx, u, [[60.5, payX + 260, payY + 120], [62.2, payX + 10, payY + 6]], [62.5], { show: [60.5, 65] });
    const fly = E.outCubic(prog(u, 63.2, 64.6));
    chipText(ctx, '+23.75 USDC to Mara', lerp(payX, kx + kw / 2, fly), lerp(payY - 50, ky - 40, fly), enter(u, 63.1, SPRING.bouncy) * (1 - out));
  }
  words(ctx, t);
}

function feedGeom() {
  const w = SQ ? 900 : 920, s = w / 1712;
  const rows = SQ ? 6 : 8;
  const h = (FEED_HEAD + rows * FEED_ROW) * s;
  const { x, y } = box(w, h);
  return { w, s, rows, h, x, y, bx: x + (COPY_BTN[0] + COPY_BTN[2] / 2) * s, by: y + (COPY_BTN[1] + COPY_BTN[3] / 2) * s };
}

function s8(ctx, u, t, IMG) {
  backdrop(ctx, t);
  const img = IMG.feed;
  const { w, s, rows, h, x, y, bx, by } = feedGeom();
  const push = E.inOutCubic(prog(u, 74.5, 76));
  ctx.save();
  ctx.translate(lerp(0, W / 2 - bx, push), lerp(0, H / 2 - by, push));
  M.zoomAbout(ctx, 1 + push * 0.9, bx, by);
  const fk = enter(u, 65.7);
  const fy = y + (1 - fk) * 80;
  ctx.save(); ctx.globalAlpha = clamp(fk * 1.5);
  ctx.shadowColor = 'rgba(13,17,23,0.16)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
  rrect(ctx, x, fy, w, h, 22); ctx.fillStyle = C.white; ctx.fill(); ctx.restore();
  ctx.save(); rrect(ctx, x, fy, w, h, 22); ctx.clip();
  ctx.globalAlpha = clamp(fk * 1.5);
  ctx.drawImage(img, 0, 0, img.width, FEED_HEAD, x, fy, w, FEED_HEAD * s);
  for (let i = 0; i < rows; i++) {
    const k = enter(u, 66.3 + i * 0.5, SPRING.snappy);
    if (k <= 0) continue;
    ctx.save(); ctx.globalAlpha = clamp(k * 1.4);
    ctx.drawImage(img, 0, FEED_HEAD + i * FEED_ROW, img.width, FEED_ROW, x + (1 - k) * 300, fy + (FEED_HEAD + i * FEED_ROW) * s, w, FEED_ROW * s);
    ctx.restore();
  }
  ctx.restore();
  ctx.restore();
  if (push < 0.4) words(ctx, t);
}

function s9(ctx, u, t, IMG) {
  backdrop(ctx, t);
  const img = IMG.feed;
  const { w, rows, h, x, y, bx, by } = feedGeom();
  const dk = enter(u, 77.1, SPRING.bouncy);
  const back = E.inOutCubic(prog(u, 77, 78));
  ctx.save();
  ctx.translate((1 - back) * (W / 2 - bx), (1 - back) * (H / 2 - by));
  M.zoomAbout(ctx, 1 + (1 - back) * 0.9, bx, by);
  ctx.globalAlpha = 1 - 0.8 * back;
  piece(ctx, img, [0, 0, img.width, FEED_HEAD + rows * FEED_ROW], x, y, w, h, { r: 22, shadow: 0.5 });
  ctx.restore();
  if (u < 77.4) cursorPath(ctx, u, [[75.8, W / 2 + 200, H / 2 + 160], [76.4, W / 2 + 6, H / 2 + 4]], [76.5], { show: [75.8, 77.4] });
  const done = u >= 82.6;
  const dw = SQ ? 470 : 540, dh = dw * (1240 / 920);
  const dx = SQ ? (W - dw) / 2 : L.sx + (L.sw - dw) / 2, dy = SQ ? 360 : (H - dh) / 2;
  const out = leave(u, 85.5);
  if (!done && dk > 0) {
    piece(ctx, IMG.copy, null, dx, dy + (1 - dk) * 140, dw, dh, { r: 28, scale: lerp(0.6, 1, dk), alpha: clamp(dk * 1.6), shadow: 1.5 });
    const ds = dw / 920;
    const sameX = dx + (CP_SAME[0] + CP_SAME[2] / 2) * ds, sameY = dy + (CP_SAME[1] + CP_SAME[3] / 2) * ds;
    const goX = dx + (CP_GO[0] + CP_GO[2] / 2) * ds, goY = dy + (CP_GO[1] + CP_GO[3] / 2) * ds;
    cursorPath(ctx, u, [[78, dx + dw + 120, dy + dh * 0.2], [79.6, sameX, sameY], [81.4, goX + 40, goY]], [80, 82], { show: [78, 82.6] });
  } else if (done) {
    const kc = enter(u, 82.5, SPRING.bouncy);
    const cw = SQ ? 560 : 600, ch = cw * (692 / 920);
    const cx = SQ ? (W - cw) / 2 : L.sx + (L.sw - cw) / 2, cy = SQ ? 440 : (H - ch) / 2;
    ctx.save(); shake(ctx, u, 82.6, 6, 4, 0.2);
    piece(ctx, IMG.copied, null, cx, cy - out * 50, cw, ch, { r: 30, scale: lerp(0.7, 1, kc), alpha: 1 - out, shadow: 1.5 });
    const rk = prog(u, 82.7, 84.2);
    if (rk > 0 && rk < 1) {
      ctx.globalAlpha = (1 - rk) * 0.7; ctx.strokeStyle = C.green; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(cx + cw / 2, cy + ch * 0.17, 40 + rk * 160, 0, M.TAU); ctx.stroke();
    }
    ctx.restore();
  }
  words(ctx, t);
}

function s10(ctx, u, t, IMG) {
  backdrop(ctx, t);
  const k = enter(u, 85.6);
  const toPhones = E.inOutCubic(prog(u, 92.6, 93.8));
  const w = L.sw, h = w * (SELL[3] / SELL[2]);
  const { x: x0, y: y0 } = box(w, h);
  const x = x0 - toPhones * (W * 0.9), y = y0 + (1 - k) * 140 - (SQ ? 0 : 30);
  const a = clamp(k * 1.5) * (1 - toPhones);
  if (a > 0) {
    piece(ctx, IMG.sell, SELL, x, y, w, h, { r: 22, alpha: a });
    const s = w / SELL[2];
    const g = E.outCubic(prog(u, 86.6, 90));
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = C.white;
    if (g < 1) ctx.fillRect(x + 40 * s, y + (873 - 537 + 110) * s, 1631 * s, 340 * s * (1 - g));
    const ex = x + EARNED[0] * s, ey = y + EARNED[1] * s, ew = EARNED[2] * s, eh = EARNED[3] * s;
    ctx.fillStyle = C.ink; ctx.fillRect(ex - 4, ey - 2, ew + 8, eh + 4);
    counter(ctx, 3522, prog(u, 86.6, 89.5), ex, ey + eh * 0.82, font(68 * s, 600, DISPLAY), C.white, { digits: 0, suffix: ' USDC' });
    ctx.restore();
  }
  if (toPhones > 0) {
    const pw = SQ ? 270 : 300, ph = pw / 0.462;
    const k1 = enter(u, 92.9, SPRING.gentle), k2 = enter(u, 93.4, SPRING.gentle);
    const out = leave(u, 99.4, 0.6);
    const cx = L.sx + L.sw / 2;
    const py = SQ ? 410 : (H - ph) / 2;
    phone(ctx, IMG.m1, lerp(W + 100, cx - pw - 30, k1) - out * W, py + 20, pw, lerp(0.2, -0.04, k1));
    phone(ctx, IMG.m2, lerp(W + 400, cx + 30, k2) + out * W, py - 20, pw, lerp(0.25, 0.04, k2));
  }
  words(ctx, t, { size: SQ ? 52 : 68 });
}

function s11(ctx, u, t) {
  backdrop(ctx, t);
  const k = enter(u, 99.6, SPRING.bouncy);
  const size = FORMAT.pick({ '16x9': 200, '1x1': 170 });
  const x = SQ ? 110 : 250, cy = SQ ? 330 : H / 2 - 100;
  if (k > 0) {
    ctx.save(); ctx.translate(x + size / 2, cy); ctx.scale(k, k); ctx.rotate((1 - k) * -0.4); ctx.translate(-(x + size / 2), -cy);
    logo(ctx, x + size / 2, cy, size); ctx.restore();
  }
  const last = VO.lines[VO.lines.length - 1];
  const kw = M.spring(t - last.t0 + 0.05, SPRING.snappy);
  if (kw > 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, cy + size * 0.3 + 40); ctx.clip();
    text(ctx, 'Keyhole', x + size + 50, cy + size * 0.27 + (1 - kw) * 200, font(FORMAT.pick({ '16x9': 170, '1x1': 140 }), 600, DISPLAY), C.ink, 'left', -3);
    ctx.restore();
  }
  const tail = { ...last, words: last.words.slice(1) };
  kinetic(ctx, t, tail, 999, { x, y: cy + size / 2 + 130, w: SQ ? 940 : 1400, size: FORMAT.pick({ '16x9': 70, '1x1': 56 }), accent: { private: C.violet, view: C.violet } });
  const t2 = E.outQuint(prog(u, 106, 107.2));
  if (t2 > 0) {
    ctx.save(); ctx.globalAlpha = t2;
    const by = cy + size / 2 + 230;
    text(ctx, 'keyhole-near.vercel.app', x, by + (1 - t2) * 16, font(FORMAT.pick({ '16x9': 44, '1x1': 38 }), 600, UI), C.violet);
    text(ctx, 'Built on NEAR Intents · NEAR HACKATHON 2026', x, by + 60 + (1 - t2) * 16, font(FORMAT.pick({ '16x9': 30, '1x1': 26 }), 500, UI), C.muted);
    ctx.restore();
  }
}

M.film({
  fonts: [font(100, 600, DISPLAY), font(40, 500, UI), font(40, 600, UI)],
  images: {
    home: 'assets/shots/d01_home.png',
    homeFull: 'assets/shots/d01_home_full.png',
    trader: 'assets/shots/d02_trader.png',
    locked: 'assets/shots/d02_trader_locked.png',
    keycard: 'assets/shots/d02_keycard.png',
    buy: 'assets/shots/d03_buy_dialog.png',
    feed: 'assets/shots/d05_feed.png',
    copy: 'assets/shots/d06_copy_dialog.png',
    copied: 'assets/shots/d07_copied_dialog.png',
    sell: 'assets/shots/d10_sell.png',
    m1: 'assets/shots/m02_trader.png',
    m2: 'assets/shots/m05_trades.png',
    cNEAR: 'assets/coins/NEAR.svg', cBTC: 'assets/coins/BTC.svg', cETH: 'assets/coins/ETH.svg', cSOL: 'assets/coins/SOL.svg',
    cUSDC: 'assets/coins/USDC.svg', cZEC: 'assets/coins/ZEC.svg', cUSDT: 'assets/coins/USDT.svg',
  },
  hits: HITS,
  samples: 10,
  async init() { VO = await fetch('vo.json').then((r) => r.json()); },
  draw(ctx, u, t, IMG) {
    if (u < 8) s1(ctx, u, t);
    else if (u < 16) s2(ctx, u, t, IMG);
    else if (u < 24) s3(ctx, u, t, IMG);
    else if (u < 36) s4(ctx, u, t, IMG);
    else if (u < 46) s5(ctx, u, t, IMG);
    else if (u < 56) s6(ctx, u, t, IMG);
    else if (u < 66) s7(ctx, u, t, IMG);
    else if (u < 76) s8(ctx, u, t, IMG);
    else if (u < 86) s9(ctx, u, t, IMG);
    else if (u < 100) s10(ctx, u, t, IMG);
    else s11(ctx, u, t);
  },
});
