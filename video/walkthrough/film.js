// Keyhole walkthrough v2: narrated tour of the real app. Pure function of time (see lib/motion.js).
// 96 bpm grid, 218 beats (136.25 s). Shot list: docs/shotlist.md · narration: docs/narration.md · vo.json.
// Real screenshots only: a camera moves over each screen, pieces of it (cards, rows, chips) animate on
// their own, a cursor performs every tap, and the captions appear word by word as they are spoken.
import * as M from './lib/motion.js';
import * as K from './lib/kit.js';

const { W, H, E, prog, lerp, clamp, SPRING, font, text, rrect, bump, shake } = M;
const { C, DISPLAY, UI, backdrop, captionBand, cursorPath, counter, keyholeWipe, logo, piece, enter, leave } = K;
let VO = null;

const ST = { x: 210, y: 28, w: 1500, h: 938 }; // the stage: a 16:10 screen in a white card
const AR = 1.6;
const uAt = (t) => (t - M.GRID.offset) / M.GRID.period;
const wordU = (line, w) => { const L = VO.lines[line]; const x = L.words.find((d) => d.w.toLowerCase().startsWith(w)); return uAt(x ? x.t0 : L.t0); };

// Real-screen geometry (2x screenshots), measured with Playwright.
const CARDS = [[240, 632], [1053, 632], [1867, 632], [240, 1313], [1053, 1313], [1867, 1313]].map(([x, y]) => [x, y, 773, 641]);
const RET = [46, 173, 232, 102];
const FEED_HEAD = 116, FEED_ROW = 156;

// cam: [[beat, [cx, cy, w]]] in screenshot pixels · rings: [b0, b1, rect] · swaps: [b0, b1, image, rect]
// taps: cursor keys [[beat, x, y]] in screenshot pixels + tap beats.
const SHOTS = [
  { a: 14, b: 34, kind: 'home', step: '1 · Find a trader',
    cam: [[14, [1440, 1150, 2880]], [21, [1440, 1150, 2880]], [24, [2050, 1400, 1650]]],
    rings: [[25.5, 33.6, CARDS[5]]] },
  { a: 34, b: 52, kind: 'card', step: '1 · Find a trader' },
  { a: 52, b: 66, img: 'trader', kind: 'trader', step: '2 · Check the record',
    cam: [[52, [1440, 900, 2880]], [54, [1095, 800, 1900]]] },
  { a: 66, b: 73, img: 'locked', step: '2 · Check the record',
    cam: [[66, [1440, 900, 2880]], [68, [1096, 1560, 1300]]], rings: [[68.5, 72.8, [1044, 1555, 104, 104]]] },
  { a: 73, b: 80, kind: 'api', step: '2 · Check the record' },
  { a: 80, b: 83, img: 'trader', step: '3 · Buy a key',
    cam: [[80, [1440, 900, 2880]], [81.2, [2100, 700, 1800]]],
    cursor: [[80, 1700, 1200], [81.6, 2320, 758]], taps: [82.2] },
  { a: 83, b: 102, img: 'buy', step: '3 · Buy a key',
    cam: [[83, [1440, 900, 2400]], [84.5, [1440, 900, 1800]]],
    swaps: [[88, 91, 'buy90', [980, 260, 920, 1280]], [94.5, 102, 'paying', [980, 260, 920, 1280]]],
    cursor: [[84, 1900, 1100], [85.6, 1300, 630], [87.4, 1300, 753], [90.2, 1300, 630], [93.4, 1400, 1355]], taps: [86, 87.8, 90.6, 94] },
  { a: 102, b: 108, img: 'youreIn', kind: 'in', step: '3 · Buy a key',
    cam: [[102, [1440, 900, 1800]], [104, [1440, 900, 1450]]] },
  { a: 108, b: 132, kind: 'feed', step: '4 · See the trades' },
  { a: 132, b: 135, img: 'trades', step: '5 · Copy a trade',
    cam: [[132, [1440, 900, 2880]], [133.2, [1500, 850, 1800]]],
    cursor: [[132, 1300, 1300], [133.6, 1830, 875]], taps: [134.1] },
  { a: 135, b: 152, img: 'copy', kind: 'copy', step: '5 · Copy a trade',
    cam: [[135, [1440, 900, 2400]], [136.5, [1440, 900, 1800]]],
    swaps: [[141.4, 152, 'copy25', [980, 282, 920, 1240]]],
    rings: [[144, 148.6, [1050, 1080, 820, 170]]],
    cursor: [[137, 2000, 1300], [140.4, 1720, 770], [148.4, 1440, 1342]], taps: [141, 149.6] },
  { a: 152, b: 157, img: 'copied', kind: 'copied', step: '5 · Copy a trade',
    cam: [[152, [1440, 900, 1800]], [153.5, [1440, 900, 1450]]] },
  { a: 157, b: 162, img: 'after', step: '5 · Copy a trade',
    cam: [[157, [1440, 900, 2880]], [158.5, [2300, 800, 1500]]] },
  { a: 162, b: 166, kind: 'auto', step: '5 · Copy a trade' },
  { a: 166, b: 171, img: 'start', step: '6 · For traders',
    cam: [[166, [1440, 900, 2880]], [167.5, [1150, 1000, 2000]]] },
  { a: 171, b: 176, img: 'start3', step: '6 · For traders',
    cam: [[171, [1150, 1000, 2000]], [172.5, [1100, 1250, 1900]]] },
  { a: 176, b: 184, img: 'sell', kind: 'sell', step: '6 · For traders',
    cam: [[176, [1440, 900, 2880]], [178, [1240, 950, 2000]]] },
  { a: 184, b: 192, kind: 'phones', step: 'Phones' },
  { a: 192, b: 197, img: 'liveHome', step: 'Live mode',
    cam: [[192, [1440, 900, 2880]], [194, [1300, 760, 2300]]] },
  { a: 197, b: 202, img: 'liveSignin', step: 'Live mode',
    cam: [[197, [1440, 900, 2600]], [198.5, [1440, 900, 1700]]] },
  { a: 202, b: 210, img: 'livePay', step: 'Live mode',
    cam: [[202, [1440, 900, 2600]], [203.5, [1440, 880, 1500]]], rings: [[204.5, 209.6, [1056, 666, 794, 282]]] },
];

const HITS = [
  [0.5, 'title', 'impact'], [6, 'demo badge', 'thud'],
  ...SHOTS.map((s, i) => [s.a, `cut ${s.step}`, i === 0 || s.step !== SHOTS[i - 1].step ? 'whoosh' : 'click', { len: 0.35 }]),
  ...SHOTS.flatMap((s) => (s.rings || []).map((r) => [r[0], 'ring', 'tick'])),
  ...SHOTS.flatMap((s) => (s.taps || []).map((tu) => [tu, 'tap', 'click'])),
  ...Array.from({ length: 6 }, (_, i) => [14.6 + i * 0.5, 'card', 'pop', { pitch: ['D5', 'F5', 'A5', 'C6', 'D6', 'F6'][i] }]),
  ...Array.from({ length: 8 }, (_, i) => [108.6 + i * 0.5, 'row', 'tick']),
  [102, "you're in", 'coins'], [152, 'copied', 'bell', { pitch: 'A6' }], [163, 'switch', 'blip', { pitch: 'A6' }],
  [210, 'end card', 'impact'], [210.5, 'logo', 'bell', { pitch: 'F6' }],
].sort((a, b) => a[0] - b[0]);

// ------------------------------------------------------------------ camera + stage
function camAt(u, keys) {
  if (!keys) return [1440, 900, 2880];
  let v = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [u1, b] = keys[i], [u0, a] = keys[i - 1];
    if (u <= u0) break;
    const p = E.inOutCubic(prog(u, u0, u1));
    v = [lerp(a[0], b[0], p), lerp(a[1], b[1], p), a[2] * (b[2] / a[2]) ** p];
  }
  return v;
}
function srcRect(c, imgW, imgH) {
  let [cx, cy, w] = c;
  w = Math.min(w, imgW);
  let h = w / AR;
  if (h > imgH) { h = imgH; w = h * AR; }
  return [clamp(cx - w / 2, 0, imgW - w), clamp(cy - h / 2, 0, imgH - h), w, h];
}
function stageCard(ctx, draw, bg = C.white) {
  ctx.save();
  ctx.shadowColor = 'rgba(13,17,23,0.16)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 24;
  rrect(ctx, ST.x, ST.y, ST.w, ST.h, 22); ctx.fillStyle = bg; ctx.fill();
  ctx.restore();
  ctx.save(); rrect(ctx, ST.x, ST.y, ST.w, ST.h, 22); ctx.clip(); draw(); ctx.restore();
}
function ring(ctx, x, y, w, h, k, color = C.violet) {
  if (k <= 0) return;
  ctx.save(); ctx.globalAlpha = k;
  const g = (1 - k) * 22 + 10;
  ctx.strokeStyle = color; ctx.lineWidth = 6;
  rrect(ctx, x - g, y - g, w + 2 * g, h + 2 * g, 16 + g); ctx.stroke();
  ctx.restore();
}
const ringK = (u, a, b) => E.outCubic(prog(u, a, a + 0.6)) * (1 - E.inCubic(prog(u, b - 0.4, b)));

// Screenshot shot: camera over a real screen + swaps, rings and the cursor (all in screen pixels).
function screenShot(ctx, u, IMG, s) {
  const img = IMG[s.img];
  const [sx, sy, sw, sh] = srcRect(camAt(u, s.cam), img.width, img.height);
  const k = ST.w / sw;
  const map = (x, y) => [ST.x + (x - sx) * k, ST.y + (y - sy) * k];
  const mapR = ([x, y, w, h]) => [...map(x, y), w * k, h * k];
  stageCard(ctx, () => {
    ctx.drawImage(img, sx, sy, sw, sh, ST.x, ST.y, ST.w, ST.w / AR);
    for (const [a, b, key, rect] of s.swaps || []) {
      if (u >= a && u < b && IMG[key]) { const [x, y, w, h] = mapR(rect); ctx.drawImage(IMG[key], x, y, w, h); }
    }
    if (s.kind === 'trader') traderExtras(ctx, u, IMG, map, k);
    if (s.kind === 'sell') {
      const g = E.outCubic(prog(u, s.a + 0.6, s.a + 4));
      const [x, y] = map(240 + 40, 873 + 110);
      if (g < 1) { ctx.fillStyle = C.white; ctx.fillRect(x, y, 1631 * k, 340 * k * (1 - g)); }
      const [ex, ey] = map(280, 628);
      ctx.fillStyle = C.ink; ctx.fillRect(ex - 3, ey - 2, 500 * k, 106 * k);
      counter(ctx, 3522, prog(u, s.a + 0.6, s.a + 3.5), ex, ey + 84 * k, font(68 * k, 600, DISPLAY), C.white, { digits: 0, suffix: ' USDC' });
    }
  });
  for (const [a, b, rect] of s.rings || []) { const [x, y, w, h] = mapR(rect); ring(ctx, x, y, w, h, ringK(u, a, b)); }
  if (s.cursor) cursorPath(ctx, u, s.cursor.map(([cu, x, y]) => [cu, ...map(x, y)]), s.taps || [], { show: [s.cursor[0][0], s.b - 0.2] });
  if (s.kind === 'in') keyBurst(ctx, u, s.a);
  if (s.kind === 'copied') {
    const rk = prog(u, s.a + 0.1, s.a + 1.6);
    if (rk > 0 && rk < 1) { ctx.save(); ctx.globalAlpha = (1 - rk) * 0.7; ctx.strokeStyle = C.green; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(W / 2, ST.y + ST.h * 0.4, 40 + rk * 220, 0, M.TAU); ctx.stroke(); ctx.restore(); }
  }
}

// On the trader page: the chart draws itself, then the four stats snap in.
function traderExtras(ctx, u, IMG, map, k) {
  const rev = E.inOutCubic(prog(u, 53, 57));
  const [cx, cy] = map(298, 646);
  ctx.fillStyle = C.white;
  if (rev < 1) ctx.fillRect(cx + 1595 * k * rev, cy - 4, 1595 * k * (1 - rev) + 2, 448 * k);
  const [sx0, sy0] = map(298, 1134);
  ctx.fillRect(sx0 - 3, sy0 - 3, 1595 * k + 6, 158 * k);
  for (let i = 0; i < 4; i++) {
    const pk = enter(u, 57.5 + i * 0.5, SPRING.bouncy);
    if (pk <= 0) continue;
    const cw = 380.75 * k, ch = 152 * k, px = sx0 + i * (cw + 24 * k);
    ctx.save(); ctx.translate(px + cw / 2, sy0 + ch / 2); ctx.scale(pk, pk); ctx.translate(-(px + cw / 2), -(sy0 + ch / 2));
    ctx.drawImage(IMG.trader, 298 + i * (380.75 + 24), 1134, 380.75, 152, px, sy0, cw, ch);
    ctx.restore();
  }
}

function keyBurst(ctx, u, u0) {
  for (let i = 0; i < 12; i++) {
    const p = prog(u, u0 + 0.1, u0 + 2.2);
    if (p <= 0 || p >= 1) continue;
    const ang = (i / 12) * M.TAU + M.hash01(i, 4) * 0.4;
    const r = 120 + E.outCubic(p) * (260 + M.hash01(i, 7) * 160);
    const x = W / 2 + Math.cos(ang) * r, y = ST.y + ST.h * 0.45 + Math.sin(ang) * r * 0.7;
    ctx.save(); ctx.globalAlpha = 1 - E.inCubic(p);
    K.lockIcon(ctx, x, y, 22, { key: 1, bg: C.violet });
    ctx.restore();
  }
}

// ------------------------------------------------------------------ special shots
function homeShot(ctx, u, IMG, s) {
  const img = IMG.homeFull;
  const [sx, sy, sw] = srcRect(camAt(u, s.cam), img.width, img.height);
  const k = ST.w / sw;
  stageCard(ctx, () => {
    ctx.drawImage(img, 0, 0, img.width, 600, ST.x + (0 - sx) * k, ST.y + (0 - sy) * k, img.width * k, 600 * k);
    CARDS.forEach((c, i) => {
      const e = enter(u, 14.4 + i * 0.5, SPRING.bouncy);
      if (e <= 0) return;
      const x = ST.x + (c[0] - sx) * k, y = ST.y + (c[1] - sy) * k;
      piece(ctx, img, c, x, y + (1 - e) * 200, c[2] * k, c[3] * k, { r: 16 * k, rot: (1 - e) * (i % 2 ? 0.1 : -0.1), alpha: clamp(e * 1.5), shadow: 0.5 });
    });
    // the losing trader's return pulses red when it is mentioned
    const pulse = Math.max(bump(u, wordU(1, 'losing'), 1.2), bump(u, wordU(1, 'cherry'), 1.2));
    if (pulse > 0) {
      const c = CARDS[5];
      const x = ST.x + (c[0] + RET[0] - sx) * k, y = ST.y + (c[1] + RET[1] - sy) * k;
      ctx.save(); ctx.globalAlpha = pulse; ctx.strokeStyle = C.red; ctx.lineWidth = 6;
      rrect(ctx, x - 12, y - 12, RET[2] * k + 24, RET[3] * k + 24, 16); ctx.stroke(); ctx.restore();
    }
  }, C.canvas);
  for (const [a, b, rect] of s.rings || []) ring(ctx, ST.x + (rect[0] - sx) * k, ST.y + (rect[1] - sy) * k, rect[2] * k, rect[3] * k, ringK(u, a, b));
}

function cardShot(ctx, u, IMG) {
  const img = IMG.card;
  const sc = Math.min(1100 / img.width, 820 / img.height);
  const w = img.width * sc, h = img.height * sc;
  const x = (W - w) / 2, y = ST.y + (ST.h - h) / 2;
  const kIn = enter(u, 33.6, SPRING.snappy);
  piece(ctx, img, null, x, y + (1 - kIn) * 80, w, h, { r: 36, scale: lerp(0.9, 1, kIn), shadow: 1.2 });
  // return counts up; callouts as each number is named
  const cnt = prog(u, 35, 37.5);
  const rx = x + RET[0] * sc, ry = y + RET[1] * sc;
  ctx.fillStyle = C.white; ctx.fillRect(rx - 4, ry - 2, RET[2] * sc + 40, RET[3] * sc + 4);
  counter(ctx, 37.4, cnt, rx, ry + RET[3] * sc * 0.84, font(68 * sc, 600, DISPLAY), C.green, { sign: true, suffix: '%' });
  const marks = [['return', [46, 173, 232, 102]], ['wins', [24, 330, 240, 104]], ['dip', [270, 330, 240, 104]], ['private', [24, 30, 726, 110]]];
  marks.forEach(([w0, r], i) => {
    const a = wordU(2, w0), b = i < 3 ? wordU(2, marks[i + 1][0]) : 52;
    ring(ctx, x + r[0] * sc, y + r[1] * sc, r[2] * sc, r[3] * sc, ringK(u, a - 0.2, Math.max(a + 2, b)));
  });
}

function feedShot(ctx, u, IMG) {
  const img = IMG.feed;
  const w = ST.w * 0.9, s = w / img.width, x = ST.x + (ST.w - w) / 2;
  const scroll = E.inOutSine(prog(u, 121, 131.5)) * 1400;
  stageCard(ctx, () => {
    const y0 = ST.y + 30 - scroll * s;
    ctx.drawImage(img, 0, 0, img.width, FEED_HEAD, x, y0, w, FEED_HEAD * s);
    for (let i = 0; i < 18; i++) {
      const e = enter(u, 108.4 + Math.min(i, 8) * 0.5, SPRING.snappy);
      if (e <= 0) continue;
      const ry = y0 + (FEED_HEAD + i * FEED_ROW) * s;
      if (ry > ST.y + ST.h || ry + FEED_ROW * s < ST.y) continue;
      ctx.save(); ctx.globalAlpha = clamp(e * 1.4);
      ctx.drawImage(img, 0, FEED_HEAD + i * FEED_ROW, img.width, FEED_ROW, x + (1 - e) * 260, ry, w, FEED_ROW * s);
      ctx.restore();
    }
    // the row being described
    const rk = ringK(u, wordU(7, 'what'), wordU(7, 'new'));
    if (rk > 0) {
      const ry = y0 + (FEED_HEAD + 2 * FEED_ROW) * s;
      ctx.save(); ctx.globalAlpha = rk; ctx.strokeStyle = C.violet; ctx.lineWidth = 6;
      rrect(ctx, x + 6, ry + 4, w - 12, FEED_ROW * s - 8, 14); ctx.stroke(); ctx.restore();
    }
  }, C.canvas);
}

function autoShot(ctx, u, IMG) {
  const img = IMG.auto;
  const sc = Math.min(1000 / img.width, 700 / img.height);
  const w = img.width * sc, h = img.height * sc, x = (W - w) / 2, y = ST.y + (ST.h - h) / 2;
  piece(ctx, img, null, x, y, w, h, { r: 40, shadow: 1.2, scale: lerp(0.92, 1, enter(u, 161.6)) });
  // the switch flips on as the cursor taps it (cover it "off" until then)
  const on = prog(u, 163.1, 163.5);
  const swx = x + 540 * sc, swy = y + 40 * sc, sww = 104 * sc, swh = 64 * sc;
  if (on < 1) {
    ctx.save(); rrect(ctx, swx, swy, sww, swh, swh / 2); ctx.fillStyle = M.mix('#D5D9E0', '#5B3DF5', on); ctx.fill();
    ctx.beginPath(); ctx.arc(lerp(swx + swh / 2, swx + sww - swh / 2, on), swy + swh / 2, swh * 0.38, 0, M.TAU); ctx.fillStyle = C.white; ctx.fill(); ctx.restore();
  }
  cursorPath(ctx, u, [[162, x + w + 100, y + h], [162.8, swx + sww / 2, swy + swh / 2]], [163], { show: [162, 165.8] });
}

// The real response from /api/traders/<id>/trades without a key, typed out in a large card.
function apiShot(ctx, u, IMG) {
  const img = IMG.api;
  const src = [0, 50, 1240, 80];
  const w = 1400, h = w * (src[3] / src[2]);
  const x = (W - w) / 2, y = ST.y + ST.h / 2 - 40;
  const k = enter(u, 72.6);
  ctx.save(); ctx.globalAlpha = clamp(k * 1.5);
  ctx.shadowColor = 'rgba(13,17,23,0.16)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
  rrect(ctx, x - 50, y - 150, w + 100, h + 220, 28); ctx.fillStyle = C.white; ctx.fill();
  ctx.restore();
  ctx.save(); ctx.globalAlpha = clamp(k * 1.5);
  text(ctx, 'GET /api/traders/maralin.near/trades', x, y - 80, font(32, 600, UI), C.muted);
  rrect(ctx, x + w - 190, y - 118, 190, 56, 28); ctx.fillStyle = '#FDECEC'; ctx.fill();
  text(ctx, '403 · no key', x + w - 95, y - 80, font(28, 700, UI), '#B42318', 'center');
  // the refusal types itself out, character by character
  const p = prog(u, 74, 77.5);
  ctx.beginPath(); ctx.rect(x, y, w * p, h + 10); ctx.clip();
  ctx.drawImage(img, src[0], src[1], src[2], src[3], x, y, w, h);
  ctx.restore();
}

function phonesShot(ctx, u, IMG) {
  const pw = 380, ph = pw / 0.462;
  const y = ST.y + (ST.h - ph) / 2 + 10;
  const xs = [W / 2 - pw * 1.5 - 70, W / 2 - pw / 2, W / 2 + pw / 2 + 70];
  ['m1', 'm2', 'm3'].forEach((key, i) => {
    const k = enter(u, 183.6 + i * 0.6, SPRING.snappy);
    if (k <= 0) return;
    ctx.save();
    const px = xs[i], py = lerp(H + 50, y, k) + (i === 1 ? -20 : 10);
    ctx.translate(px + pw / 2, py + ph / 2); ctx.rotate((i - 1) * 0.04 + (1 - k) * 0.2); ctx.translate(-pw / 2, -ph / 2);
    ctx.save(); ctx.shadowColor = 'rgba(13,17,23,0.25)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 24;
    rrect(ctx, -10, -10, pw + 20, ph + 20, 46); ctx.fillStyle = '#1B2130'; ctx.fill(); ctx.restore();
    rrect(ctx, 0, 0, pw, ph, 36); ctx.clip(); ctx.drawImage(IMG[key], 0, 0, pw, ph);
    ctx.restore();
  });
}

// ------------------------------------------------------------------ title + end
function title(ctx, u, t) {
  backdrop(ctx, t);
  const k = enter(u, -0.3, SPRING.bouncy);
  const out = leave(u, 13.4, 0.6);
  ctx.save(); ctx.globalAlpha = 1 - out;
  ctx.save(); ctx.translate(380, 470); ctx.scale(k, k); ctx.translate(-380, -470); logo(ctx, 380, 470, 200); ctx.restore();
  const t1 = E.outQuint(prog(u, 0.8, 2.2));
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 530); ctx.clip();
  text(ctx, 'Keyhole in 2 minutes', 540, 505 + (1 - t1) * 120, font(110, 600, DISPLAY), C.ink, 'left', -2);
  ctx.restore();
  const b = enter(u, 5.8, SPRING.bouncy);
  if (b > 0) {
    ctx.save(); ctx.translate(560 + 120, 610); ctx.scale(b, b); ctx.rotate((1 - b) * -0.3);
    rrect(ctx, -120, -36, 240, 72, 36); ctx.fillStyle = '#FFF4E0'; ctx.fill();
    text(ctx, 'Demo mode', 0, 12, font(34, 600, UI), '#7A4A00', 'center');
    ctx.restore();
  }
  const t2 = E.outQuint(prog(u, 7.5, 8.8));
  ctx.globalAlpha = (1 - out) * t2;
  text(ctx, 'Simulated traders · real prices · no money moves', 840, 622, font(32, 500, UI), C.muted);
  ctx.restore();
}

function endCard(ctx, u, t) {
  backdrop(ctx, t);
  const k = enter(u, 209.6, SPRING.bouncy);
  ctx.save(); ctx.translate(380, 430); ctx.scale(k, k); ctx.translate(-380, -430); logo(ctx, 380, 430, 200); ctx.restore();
  const last = VO.lines[VO.lines.length - 1];
  const kw = M.spring(t - last.t0 + 0.05, SPRING.snappy);
  if (kw > 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 500); ctx.clip();
    text(ctx, 'Keyhole', 540, 485 + (1 - kw) * 160, font(150, 600, DISPLAY), C.ink, 'left', -3);
    ctx.restore();
  }
  K.kinetic(ctx, t, { ...last, words: last.words.slice(1) }, 999, { x: 546, y: 600, w: 1300, size: 56, accent: { private: C.violet, view: C.violet } });
  const t2 = E.outQuint(prog(u, 214, 215.2));
  ctx.save(); ctx.globalAlpha = t2;
  text(ctx, 'keyhole-near.vercel.app', 546, 690, font(40, 600, UI), C.violet);
  text(ctx, 'github.com/sarenabg/keyhole', 546, 745, font(32, 500, UI), C.muted);
  ctx.restore();
}

// ------------------------------------------------------------------ frame
function drawShot(ctx, u, t, IMG, s) {
  backdrop(ctx, t);
  const settle = 1 + 0.012 * (1 - E.outCubic(prog(u, s.a, s.a + 1)));
  ctx.save();
  M.zoomAbout(ctx, settle, W / 2, ST.y + ST.h / 2);
  if (s.kind === 'home') homeShot(ctx, u, IMG, s);
  else if (s.kind === 'card') cardShot(ctx, u, IMG);
  else if (s.kind === 'feed') feedShot(ctx, u, IMG);
  else if (s.kind === 'auto') autoShot(ctx, u, IMG);
  else if (s.kind === 'phones') phonesShot(ctx, u, IMG);
  else if (s.kind === 'api') apiShot(ctx, u, IMG);
  else screenShot(ctx, u, IMG, s);
  ctx.restore();
  captionBand(ctx, t, VO, s.step);
}

M.film({
  fonts: [font(100, 600, DISPLAY), font(40, 500, UI), font(40, 600, UI)],
  images: {
    homeFull: 'assets/shots/d01_home_full.png', card: 'assets/shots/d01_card_mara.png',
    trader: 'assets/shots/d02_trader.png', locked: 'assets/shots/d02_trader_locked.png', api: 'assets/shots/d13_api_403.png',
    buy: 'assets/shots/d03_buy.png', buy90: 'assets/shots/d03_buy_dialog_90.png', paying: 'assets/shots/d03_buy_paying.png',
    youreIn: 'assets/shots/d04_youre_in.png', trades: 'assets/shots/d05_trades.png', feed: 'assets/shots/d05_feed.png',
    copy: 'assets/shots/d06_copy.png', copy25: 'assets/shots/d06_copy_dialog_25.png', copied: 'assets/shots/d07_copied.png',
    after: 'assets/shots/d08_trades_after.png', auto: 'assets/shots/d08_autocopy_on.png',
    start: 'assets/shots/d11_start.png', start3: 'assets/shots/d11_start_3.png', sell: 'assets/shots/d10_sell.png',
    liveHome: 'assets/shots/l01_home_live.png', liveSignin: 'assets/shots/l02_signin.png', livePay: 'assets/shots/l05_pay_address.png',
    m1: 'assets/shots/m02_trader.png', m2: 'assets/shots/m05_trades.png', m3: 'assets/shots/m06_copy.png',
  },
  hits: HITS,
  samples: 8,
  async init() { VO = await fetch('vo.json').then((r) => r.json()); },
  draw(ctx, u, t, IMG) {
    if (u < 14) {
      title(ctx, u, t);
      // keyhole wipe into step 1
      keyholeWipe(ctx, prog(u, 13, 14), () => drawShot(ctx, u, t, IMG, SHOTS[0]));
      return;
    }
    if (u >= 210) return endCard(ctx, u, t);
    const i = Math.max(0, SHOTS.findIndex((x) => u >= x.a && u < x.b));
    const s = SHOTS[i];
    const prev = SHOTS[i - 1];
    // a new step opens through a keyhole; shots within a step cut
    if (prev && prev.step !== s.step && u < s.a + 1) {
      drawShot(ctx, s.a - 0.001, t, IMG, prev);
      keyholeWipe(ctx, prog(u, s.a, s.a + 1), () => drawShot(ctx, u, t, IMG, s));
      return;
    }
    drawShot(ctx, u, t, IMG, s);
  },
});
