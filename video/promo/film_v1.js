// Keyhole promo: pure function of time. window.seek(t) paints frame t (see lib/motion.js).
// Timing is in beats (u) on the measured grid (120 bpm). docs/shotlist.md is the plan.
import * as M from './lib/motion.js';

const { W, H, FORMAT, E, prog, lerp, clamp, springU, SPRING, wobble, font, layout, glyph, text, fill, rrect, shake, bump } = M;

const C = { ink: '#0D1117', canvas: '#F5F6F8', violet: '#5B3DF5', white: '#FFFFFF', muted: '#5B6474', green: '#047857', night: '#AEB6C4' };
const DISPLAY = 'Display', UI = 'UI';
const SQ = FORMAT.square;

const HITS = [
  [0, 'hook word 1', 'impact'],
  [0.45, 'word', 'tick'], [0.9, 'word', 'tick'], [1.35, 'word', 'tick'], [1.8, 'word', 'tick'],
  [2.25, 'private', 'pop', { pitch: 'D6' }],
  [3, 'lock drops', 'thud'],
  [4, 'locked card', 'whoosh', { len: 0.4 }],
  [4.6, 'question', 'pop', { pitch: 'A5' }],
  [8, 'logo', 'bell', { pitch: 'D6' }],
  [9, 'wordmark', 'tick'],
  [10.5, 'tagline', 'blip', { pitch: 'A5' }],
  [16, 'drop: into the app', 'impact', { riser: true }],
  [18, 'card lifts', 'pop', { pitch: 'D6' }],
  [20, 'return pulse', 'blip', { pitch: 'F#6' }],
  [22, 'return pulse', 'blip', { pitch: 'A6' }],
  [24, 'record', 'whoosh', { len: 0.35, from: 2400, to: 600 }],
  [28, 'stat', 'pop', { pitch: 'D5' }], [28.75, 'stat', 'pop', { pitch: 'F5' }], [29.5, 'stat', 'pop', { pitch: 'A5' }], [30.25, 'stat', 'pop', { pitch: 'D6' }],
  [32, 'private', 'sub', { len: 0.8 }],
  [36, 'lock close', 'thud'],
  [40, 'key card', 'whoosh', { len: 0.4 }],
  [43, 'buy dialog', 'pop', { pitch: 'A5' }],
  [46.5, 'pay', 'click'],
  [48, "you're in", 'coins'],
  [51.6, 'whip', 'whoosh', { len: 0.3, from: 600, to: 3000 }],
  [54, 'trade', 'tick'], [56, 'trade', 'tick'], [58, 'trade', 'tick'], [60, 'trade', 'tick'],
  [62, 'copy dialog', 'whoosh', { len: 0.35 }],
  [66, 'same as Mara', 'click'],
  [68, 'copied', 'bell', { pitch: 'A6' }],
  [72, 'earnings', 'whoosh', { len: 0.35, from: 2400, to: 600 }],
  [73, 'bars', 'tick'], [74, 'bars', 'tick'], [75, 'bars', 'tick'],
  [78, 'paid', 'coins'],
  [80, 'phones', 'whoosh', { len: 0.4 }],
  [84, 'end card', 'impact'],
  [84.5, 'logo', 'bell', { pitch: 'D6' }],
];

// ------------------------------------------------------------------ layout per format
const LAY = FORMAT.pick({
  '16x9': { tx: 130, tw: 640, ty: null, sx: 830, sw: 990, sy: 70, sh: 940, cap: 92, sub: 34 },
  '1x1': { tx: 80, tw: 920, ty: 120, sx: 80, sw: 920, sy: 330, sh: 680, cap: 74, sub: 30 },
});

// ------------------------------------------------------------------ helpers

// A real screenshot (or a crop of one) in a white rounded card with a soft shadow.
function card(ctx, img, src, x, y, w, h, { r = 28, shadow = 1, alpha = 1 } = {}) {
  if (!img || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (shadow) {
    ctx.save();
    ctx.shadowColor = `rgba(13,17,23,${0.16 * shadow})`; ctx.shadowBlur = 70; ctx.shadowOffsetY = 26;
    rrect(ctx, x, y, w, h, r); ctx.fillStyle = C.white; ctx.fill();
    ctx.restore();
  }
  rrect(ctx, x, y, w, h, r); ctx.clip();
  if (src) ctx.drawImage(img, src[0], src[1], src[2], src[3], x, y, w, h);
  else ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

// Words that spring up one by one from behind their own baseline. lines: [[word, color?], ...][]
function words(ctx, u, lines, { x, y, size, lineH = size * 1.02, u0, step = 0.18, color = C.ink, family = DISPLAY, weight = 600, exit = null, align = 'left' }) {
  const f = font(size, weight, family);
  const track = -0.025 * size;
  let i = 0;
  lines.forEach((line, li) => {
    const str = line.map((w) => w[0]).join(' ');
    const L = layout(ctx, str, f, track);
    const base = y + li * lineH;
    const ox = align === 'center' ? x - L.width / 2 : x;
    let gi = 0;
    line.forEach(([w, col]) => {
      const start = u0 + i * step;
      const k = springU(u, start, SPRING.snappy);
      const ex = exit ? E.inBack(prog(u, exit + i * 0.03, exit + 0.4 + i * 0.03), 1.3) : 0;
      [...w].forEach(() => {
        const g = L.glyphs[gi++];
        if (k <= 0) return;
        ctx.save();
        ctx.beginPath(); ctx.rect(0, base - size * 1.1, W, size * 1.4); ctx.clip();
        glyph(ctx, g.ch, ox + g.cx, base + (1 - k) * size * 1.1 - ex * size * 1.4, f, col ?? color);
        ctx.restore();
      });
      gi++; // the space
      i++;
    });
  });
}

// Plain sentence → lines of [word] for words().
const W_ = (s, accent = {}) => s.split('\n').map((l) => l.split(' ').map((w) => [w, accent[w]]));

// Caption block in the format's text area: a big line and an optional small line under it.
function caption(ctx, u, big, small, u0, u1, opts = {}) {
  const size = opts.size ?? LAY.cap;
  const lines = W_(big, opts.accent);
  const x = LAY.tx;
  const y = LAY.ty !== null ? LAY.ty + size * 0.8 : H / 2 - ((lines.length - 1) * size * 1.02) / 2 + size * 0.3 - (small ? 30 : 0);
  words(ctx, u, lines, { x, y, size, u0, exit: u1, color: opts.color ?? C.ink });
  if (small) {
    const k = E.outQuint(prog(u, u0 + 1, u0 + 1.8)) * (1 - prog(u, u1, u1 + 0.4));
    if (k > 0) {
      ctx.save(); ctx.globalAlpha = k;
      const sy = LAY.ty !== null ? y + size * (lines.length - 1) * 1.02 + 58 : y + (lines.length - 1) * size * 1.02 + 70;
      text(ctx, small, x + 4, sy + (1 - k) * 18, font(LAY.sub, 500, UI), opts.subColor ?? C.muted);
      ctx.restore();
    }
  }
}

// Keyhole glyph geometry in the 32-unit logo box (from the real logo SVG).
function keyholePath(ctx, cx, cy, s) {
  // s = px per logo unit; (cx, cy) = logo box centre.
  const X = (v) => cx + (v - 16) * s, Y = (v) => cy + (v - 16) * s;
  ctx.beginPath();
  ctx.arc(X(16), Y(13.667), 3.333 * s, 0, M.TAU);
  ctx.moveTo(X(14.4), Y(16)); ctx.lineTo(X(13.333), Y(22)); ctx.lineTo(X(18.667), Y(22)); ctx.lineTo(X(17.6), Y(16)); ctx.closePath();
}

function logo(ctx, cx, cy, size, { keyFill = C.white } = {}) {
  const s = size / 32;
  rrect(ctx, cx - size / 2, cy - size / 2, size, size, 9 * s);
  ctx.fillStyle = C.violet; ctx.fill();
  keyholePath(ctx, cx, cy, s);
  ctx.fillStyle = keyFill; ctx.fill('nonzero');
}

function lockIcon(ctx, cx, cy, r, color = C.white, bg = C.violet) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, M.TAU); ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = r * 0.14; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const bw = r * 0.82, bh = r * 0.62;
  rrect(ctx, cx - bw / 2, cy - bh * 0.15, bw, bh, r * 0.12); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy - bh * 0.15, bw * 0.3, Math.PI, 0); ctx.lineTo(cx + bw * 0.3, cy - bh * 0.15); ctx.moveTo(cx - bw * 0.3, cy - bh * 0.15); ctx.stroke();
  ctx.restore();
}

// A pulsing violet ring around a box (to point at something on a real screen).
function ringAt(ctx, x, y, w, h, k, r = 18) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = k;
  ctx.strokeStyle = C.violet; ctx.lineWidth = 6;
  const g = (1 - k) * 18 + 8;
  rrect(ctx, x - g, y - g, w + 2 * g, h + 2 * g, r + g); ctx.stroke();
  ctx.restore();
}

function phone(ctx, img, x, y, w, rot = 0) {
  const h = w / 0.462;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot); ctx.translate(-w / 2, -h / 2);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30;
  rrect(ctx, -12, -12, w + 24, h + 24, 52); ctx.fillStyle = '#1B2130'; ctx.fill(); ctx.restore();
  card(ctx, img, null, 0, 0, w, h, { r: 40, shadow: 0 });
  ctx.restore();
}

// ------------------------------------------------------------------ scenes

function s1Hook(ctx, u) {
  fill(ctx, C.ink);
  const size = FORMAT.pick({ '16x9': 150, '1x1': 118 });
  const x = FORMAT.pick({ '16x9': 160, '1x1': 80 });
  const y = H / 2 - size * 0.25;
  const lines = [[['The'], ['best'], ['traders']], [['trade'], ['in'], ['private.', C.violet]]];
  words(ctx, u, lines.map((l) => l.map(([w, c]) => [w, c ?? C.white])), { x, y, size, u0: -0.2, step: 0.45, exit: 3.55 });
  // the lock drops onto "private."
  const f = font(size, 600, DISPLAY);
  const L = layout(ctx, 'trade in private.', f, -0.025 * size);
  const px = x + L.glyphs[9].x + layout(ctx, 'private.', f, -0.025 * size).width * 0.45;
  const k = springU(u, 2.75, SPRING.bouncy);
  const ex = E.inBack(prog(u, 3.6, 3.95), 1.3);
  if (k > 0) lockIcon(ctx, px, y + size * 1.02 - size * 1.05 - (1 - k) * 260 - ex * 400, size * 0.3, C.white, C.violet);
}

const LOCKED_SRC = [700, 1384, 800, 416];
function s2Question(ctx, u, IMG) {
  fill(ctx, C.canvas);
  const k = springU(u, 3.3, SPRING.snappy);
  const out = E.inCubic(prog(u, 7.5, 8));
  const w = FORMAT.pick({ '16x9': 960, '1x1': 900 });
  const h = w * (LOCKED_SRC[3] / LOCKED_SRC[2]);
  const x = SQ ? (W - w) / 2 : LAY.sx + (LAY.sw - w) / 2;
  const y0 = SQ ? 520 : (H - h) / 2;
  const y = lerp(H + 40, y0, k) - out * 60;
  card(ctx, IMG.locked, LOCKED_SRC, x, y, w, h, { r: 26, alpha: 1 - out });
  caption(ctx, u, "So who's\nactually good?", null, 4.6, 7.55);
}

function s3Reveal(ctx, u, IMG) {
  fill(ctx, C.ink);
  const size = FORMAT.pick({ '16x9': 230, '1x1': 200 });
  const z = E.inOutCubic(prog(u, 12.6, 16)); // zoom progress
  const cx0 = SQ ? W / 2 : W / 2 - 300, cy0 = SQ ? H / 2 - 150 : H / 2 - 70;
  // the zoom heads for the keyhole and grows in log space
  const kIn = springU(u, 7.8, SPRING.bouncy);
  const sc = kIn * (1 * (70 / 1) ** z);
  const focusY = cy0 + (15 - 16) * (size / 32);
  const cx = lerp(cx0, W / 2, z), cy = lerp(cy0, H / 2 + (cy0 - focusY) * 0, z);
  const s = (size / 32) * sc;
  if (sc > 0) {
    // violet tile
    rrect(ctx, cx - (size * sc) / 2, cy - (size * sc) / 2, size * sc, size * sc, 9 * s);
    ctx.fillStyle = C.violet; ctx.fill();
    // keyhole: white, then a window onto the real app as we push through
    ctx.save();
    keyholePath(ctx, cx, cy - (15 - 16) * s * 0 , s);
    ctx.fillStyle = C.white; ctx.fill();
    ctx.clip();
    const win = prog(u, 12.6, 14);
    if (win > 0 && IMG.home) {
      ctx.globalAlpha = win;
      M.cover(ctx, IMG.home, 0, 0, W, H, { fx: SQ ? 0.12 : 0.5, fy: 0.3 });
    }
    ctx.restore();
  }
  // wordmark + tagline leave as the zoom starts
  const fade = 1 - prog(u, 12.4, 13.2);
  if (fade > 0) {
    ctx.save(); ctx.globalAlpha = fade;
    const wx = SQ ? W / 2 : cx0 + size / 2 + 60;
    words(ctx, u, [[['Keyhole', C.white]]], { x: wx, y: SQ ? cy0 + size / 2 + 190 : cy0 + size * 0.28, size: FORMAT.pick({ '16x9': 190, '1x1': 150 }), u0: 8.9, align: SQ ? 'center' : 'left' });
    const tk = E.outQuint(prog(u, 10.4, 11.4));
    if (tk > 0) {
      ctx.globalAlpha = fade * tk;
      text(ctx, 'Trade in private. Sell the view.', SQ ? W / 2 : wx + 8, (SQ ? cy0 + size / 2 + 290 : cy0 + size * 0.28 + 110) + (1 - tk) * 20, font(FORMAT.pick({ '16x9': 54, '1x1': 46 }), 500, UI), C.night, SQ ? 'center' : 'left');
    }
    ctx.restore();
  }
  // final beat: the window is the whole frame
  if (z >= 0.999 && IMG.home) M.cover(ctx, IMG.home, 0, 0, W, H, { fx: SQ ? 0.12 : 0.5, fy: 0.3 });
}

const RET_REL = [46, 173, 232, 102];
function s4Records(ctx, u, IMG) {
  fill(ctx, C.canvas);
  // the home screen we came through, drifting and dimming as the card lifts out
  const dim = E.outCubic(prog(u, 17.4, 18.6));
  const push = 1 + 0.06 * prog(u, 16, 24);
  ctx.save();
  M.zoomAbout(ctx, push, W / 2, H * 0.4);
  M.cover(ctx, IMG.home, 0, 0, W, H, { fx: SQ ? 0.12 : 0.5, fy: 0.3 });
  ctx.restore();
  if (dim > 0) { ctx.fillStyle = `rgba(245,246,248,${0.95 * dim})`; ctx.fillRect(0, 0, W, H); }
  const k = springU(u, 17.8, SPRING.bouncy);
  const out = E.inCubic(prog(u, 23.5, 24));
  if (k > 0) {
    const w = FORMAT.pick({ '16x9': 700, '1x1': 620 });
    const h = w * (644 / 774);
    const x = SQ ? (W - w) / 2 : LAY.sx + (LAY.sw - w) / 2;
    const y = SQ ? 400 : (H - h) / 2;
    const sc = lerp(0.7, 1, k);
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2 + out * -40); ctx.scale(sc, sc); ctx.translate(-(x + w / 2), -(y + h / 2));
    ctx.globalAlpha = clamp(k * 1.4) * (1 - out);
    card(ctx, IMG.card, null, x, y, w, h, { r: 30 });
    const s = w / 774;
    const pk = Math.max(bump(u, 20, 0.9), bump(u, 22, 0.9));
    ringAt(ctx, x + RET_REL[0] * s, y + RET_REL[1] * s, RET_REL[2] * s, RET_REL[3] * s, pk, 14);
    ctx.restore();
  }
  caption(ctx, u, 'Every record is\nread straight\nfrom NEAR.', null, 18.6, 23.5, { accent: { 'NEAR.': C.violet } });
}

const MAIN_SRC = [240, 194, 1711, 1150];
function s5Proof(ctx, u, IMG) {
  fill(ctx, C.canvas);
  const k = springU(u, 23.4, SPRING.snappy);
  const out = E.inCubic(prog(u, 31.5, 32));
  const w = FORMAT.pick({ '16x9': 990, '1x1': 900 });
  const h = w * (MAIN_SRC[3] / MAIN_SRC[2]);
  const x = SQ ? (W - w) / 2 : LAY.sx + (LAY.sw - w) / 2;
  const y = SQ ? 360 : (H - h) / 2;
  const yy = lerp(y + 120, y, k) - out * 50;
  const a = clamp(k * 1.5) * (1 - out);
  card(ctx, IMG.trader, MAIN_SRC, x, yy, w, h, { r: 26, alpha: a });
  const s = w / MAIN_SRC[2];
  // the chart draws itself: a canvas-coloured cover slides off left → right
  const rev = E.inOutCubic(prog(u, 24.4, 28));
  const cx = x + (298 - 240) * s, cy = yy + (646 - 194) * s, cw = 1595 * s, ch = 440 * s;
  if (rev < 1 && a > 0) {
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = C.white;
    ctx.fillRect(cx + cw * rev, cy - 4, cw * (1 - rev) + 2, ch + 8);
    ctx.restore();
  }
  // the four stats pop in one by one
  const sx0 = x + (298 - 240) * s, sy0 = yy + (1134 - 194) * s, chipW = 380.75 * s, chipH = 152 * s, gap = 24 * s;
  if (a > 0) {
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = C.white;
    ctx.fillRect(sx0 - 4, sy0 - 4, 1595 * s + 8, chipH + 8);
    for (let i = 0; i < 4; i++) {
      const pk = springU(u, 28 + i * 0.75, SPRING.bouncy);
      if (pk <= 0) continue;
      const px = sx0 + i * (chipW + gap);
      ctx.save();
      ctx.translate(px + chipW / 2, sy0 + chipH / 2); ctx.scale(pk, pk); ctx.translate(-(px + chipW / 2), -(sy0 + chipH / 2));
      ctx.drawImage(IMG.trader, 298 + i * (380.75 + 24), 1134, 380.75, 152, px, sy0, chipW, chipH);
      ctx.restore();
    }
    ctx.restore();
  }
  caption(ctx, u, "Can't be edited.\nCan't hide losses.", null, 24.8, 31.5);
}

// The real locked trades card; the crop window closes in on the lock (log-space dolly).
const LOCK_FULL = [520, 1384, 1150, 416], LOCK_TIGHT = [880, 1470, 432, 250];
function s6Private(ctx, u, IMG) {
  fill(ctx, C.canvas);
  const k = springU(u, 31.4, SPRING.snappy);
  const out = E.inCubic(prog(u, 39.5, 40));
  const z = E.inOutSine(prog(u, 32.5, 39.5));
  const r = (a, b) => a * (b / a) ** z; // log-space size
  const sw = r(LOCK_FULL[2], LOCK_TIGHT[2]);
  const sh = sw / (LOCK_FULL[2] / LOCK_FULL[3]) * (1 + 0.6 * z);
  const lockCx = 1096, lockCy = 1607;
  const cxs = lerp(LOCK_FULL[0] + LOCK_FULL[2] / 2, lockCx, z), cys = lerp(LOCK_FULL[1] + LOCK_FULL[3] / 2, lockCy - 20, z);
  const src = [cxs - sw / 2, Math.max(1384, cys - sh / 2), sw, Math.min(sh, 1800 - Math.max(1384, cys - sh / 2))];
  const w = FORMAT.pick({ '16x9': 990, '1x1': 920 });
  const h = w * (src[3] / src[2]);
  const x = SQ ? (W - w) / 2 : LAY.sx + (LAY.sw - w) / 2;
  const y = (SQ ? 380 + (680 - h) / 2 : (H - h) / 2) + (1 - k) * 100 - out * 40;
  card(ctx, IMG.locked, src, x, y, w, h, { r: 26, alpha: clamp(k * 1.5) * (1 - out) });
  caption(ctx, u, 'Trades stay\nprivate.', 'Only people holding a key see them.', 32.2, 39.5, { accent: { 'private.': C.violet } });
}

function s7Buy(ctx, u, IMG) {
  fill(ctx, C.canvas);
  const kc = springU(u, 39.3, SPRING.snappy);
  const kd = springU(u, SQ ? 39.4 : 42.8, SPRING.bouncy);
  const out = E.inCubic(prog(u, 47.5, 48));
  if (!SQ) {
    const w = 400, h = w * (740 / 642);
    const x = lerp(W + 60, 1430, kc), y = 300;
    card(ctx, IMG.keycard, null, x, y - out * 40, w, h, { r: 22, alpha: 1 - out });
  }
  const dw = FORMAT.pick({ '16x9': 520, '1x1': 470 }), dh = dw * (1280 / 920);
  const dx = SQ ? (W - dw) / 2 + 150 : 880, dy = SQ ? 330 : (H - dh) / 2;
  if (kd > 0) {
    ctx.save();
    ctx.translate(dx + dw / 2, dy + dh / 2); const sc = lerp(0.85, 1, kd); ctx.scale(sc, sc); ctx.translate(-(dx + dw / 2), -(dy + dh / 2));
    card(ctx, IMG.buy, null, dx, dy + (1 - kd) * 120 - out * 40, dw, dh, { r: 30, alpha: clamp(kd * 1.5) * (1 - out) });
    // tap on Pay
    const tap = bump(u, 46.6, 0.7);
    if (tap > 0) {
      ctx.globalAlpha = tap * 0.5; ctx.fillStyle = C.white;
      ctx.beginPath(); ctx.arc(dx + dw * 0.5, dy + dh * 0.835, 30 + (1 - tap) * 40, 0, M.TAU); ctx.fill();
    }
    ctx.restore();
  }
  caption(ctx, u, 'Buy a key.', 'The trader is paid instantly.', 40.6, 47.5, SQ ? { size: 64 } : {});
}

function s8In(ctx, u, IMG) {
  fill(ctx, C.violet);
  ctx.save();
  shake(ctx, u, 48, 10, 5, 0.25);
  const k = springU(u, 47.9, SPRING.bouncy);
  const whip = E.inCubic(prog(u, 51.5, 52));
  const w = FORMAT.pick({ '16x9': 820, '1x1': 760 }), h = w * (632 / 920);
  const x = (W - w) / 2 - whip * (W + w), y = (H - h) / 2;
  ctx.translate(x + w / 2, y + h / 2); ctx.scale(lerp(0.6, 1, k), lerp(0.6, 1, k)); ctx.translate(-(x + w / 2), -(y + h / 2));
  card(ctx, IMG.yourein, null, x, y, w, h, { r: 34, shadow: 1.6, alpha: clamp(k * 2) });
  ctx.restore();
}

function s9Feed(ctx, u, IMG) {
  fill(ctx, C.canvas);
  const kin = E.outCubic(prog(u, 51.6, 52.4));
  const out = E.inCubic(prog(u, 61.5, 62));
  const w = FORMAT.pick({ '16x9': 900, '1x1': 860 });
  const h = FORMAT.pick({ '16x9': 960, '1x1': 700 });
  const x = SQ ? (W - w) / 2 : LAY.sx + (LAY.sw - w) / 2 + (1 - kin) * W * 0.5;
  const y = SQ ? 330 : (H - h) / 2;
  const img = IMG.feed;
  const srcH = img.width * (h / w);
  const scroll = E.inOutSine(prog(u, 52.5, 61.5)) * 2400;
  card(ctx, img, [0, scroll, img.width, srcH], x, y - out * 40, w, h, { r: 26, alpha: 1 - out });
  caption(ctx, u, 'See every\ntrade.', 'What, how much, and how it did since.', 53, 61.5, SQ ? { size: 64 } : {});
}

function s10Copy(ctx, u, IMG) {
  fill(ctx, C.canvas);
  const k = springU(u, 61.4, SPRING.snappy);
  const done = u >= 68;
  const out = E.inCubic(prog(u, 71.5, 72));
  const dw = FORMAT.pick({ '16x9': 560, '1x1': 480 }), dh = dw * (1240 / 920);
  const dx = SQ ? (W - dw) / 2 + 160 : 1000, dy = SQ ? 320 : (H - dh) / 2;
  if (!done) {
    card(ctx, IMG.copy, null, dx, lerp(H + 40, dy, k), dw, dh, { r: 30 });
    const pk = bump(u, 66, 1.2);
    ringAt(ctx, dx + dw * 0.357, lerp(H + 40, dy, k) + dh * 0.339, dw * 0.285, dh * 0.111, pk, 14);
  } else {
    const kc = springU(u, 67.95, SPRING.bouncy);
    const cw = FORMAT.pick({ '16x9': 600, '1x1': 520 }), ch = cw * (692 / 920);
    const cx = SQ ? (W - cw) / 2 + 160 : 980, cy = SQ ? 420 : (H - ch) / 2;
    ctx.save();
    ctx.translate(cx + cw / 2, cy + ch / 2); ctx.scale(lerp(0.7, 1, kc), lerp(0.7, 1, kc)); ctx.translate(-(cx + cw / 2), -(cy + ch / 2));
    card(ctx, IMG.copied, null, cx, cy - out * 40, cw, ch, { r: 30, alpha: 1 - out });
    ctx.restore();
  }
  caption(ctx, u, 'Copy in\none tap.', 'Live price from NEAR Intents.', 62.6, 71.5, SQ ? { size: 64 } : {});
}

const SELL_SRC = [240, 537, 1711, 836];
function s11Earn(ctx, u, IMG) {
  fill(ctx, C.canvas);
  const k = springU(u, 71.4, SPRING.snappy);
  const out = E.inCubic(prog(u, 79.5, 80));
  const w = FORMAT.pick({ '16x9': 1000, '1x1': 920 }), h = w * (SELL_SRC[3] / SELL_SRC[2]);
  const x = SQ ? (W - w) / 2 : LAY.sx + (LAY.sw - w) / 2, y = SQ ? 430 : (H - h) / 2;
  const yy = lerp(y + 140, y, k) - out * 40;
  const a = clamp(k * 1.4) * (1 - out);
  card(ctx, IMG.sell, SELL_SRC, x, yy, w, h, { r: 26, alpha: a });
  // bars grow: a white cover over the chart's bar area slides down
  const s = w / SELL_SRC[2];
  const bx = x + 40 * s, by = yy + (873 - 537 + 110) * s, bw = 1631 * s, bh = 340 * s;
  const g = E.outCubic(prog(u, 72.6, 77));
  if (g < 1 && a > 0) {
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = C.white; ctx.fillRect(bx, by, bw, bh * (1 - g)); ctx.restore();
  }
  caption(ctx, u, 'Get paid for\nbeing right.', 'Traders keep 95% of every key.', 72.8, 79.5, SQ ? { size: 64 } : {});
}

function s12Phones(ctx, u, IMG) {
  fill(ctx, C.ink);
  const k1 = springU(u, 79.4, SPRING.snappy), k2 = springU(u, 79.8, SPRING.snappy);
  const out = E.inCubic(prog(u, 83.4, 84));
  const pw = FORMAT.pick({ '16x9': 330, '1x1': 300 }), ph = pw / 0.462;
  const y = (H - ph) / 2 + (SQ ? 0 : 0);
  const gap = 60;
  const x1 = W / 2 - pw - gap / 2 - out * W * 0.6, x2 = W / 2 + gap / 2 + out * W * 0.6;
  phone(ctx, IMG.m1, lerp(-pw - 100, x1, k1), y + 20, pw, lerp(-0.12, -0.03, k1));
  phone(ctx, IMG.m2, lerp(W + 100, x2, k2), y - 20, pw, lerp(0.12, 0.03, k2));
}

function s13End(ctx, u) {
  fill(ctx, C.canvas);
  const k = springU(u, 83.5, SPRING.bouncy);
  const size = FORMAT.pick({ '16x9': 200, '1x1': 170 });
  const x = SQ ? 110 : 260, cy = SQ ? 330 : H / 2 - 90;
  if (k > 0) {
    ctx.save();
    ctx.translate(x + size / 2, cy); ctx.scale(k, k); ctx.rotate((1 - k) * -0.3); ctx.translate(-(x + size / 2), -cy);
    logo(ctx, x + size / 2, cy, size);
    ctx.restore();
  }
  words(ctx, u, [[['Keyhole']]], { x: x + size + 50, y: cy + size * 0.27, size: FORMAT.pick({ '16x9': 170, '1x1': 140 }), u0: 84.2 });
  const t1 = E.outQuint(prog(u, 85.3, 86.3));
  const ty = SQ ? cy + size / 2 + 140 : cy + size / 2 + 120;
  if (t1 > 0) {
    ctx.save(); ctx.globalAlpha = t1;
    text(ctx, 'Trade in private. Sell the view.', x, ty + (1 - t1) * 20, font(FORMAT.pick({ '16x9': 64, '1x1': 54 }), 600, DISPLAY), C.ink);
    ctx.restore();
  }
  const t2 = E.outQuint(prog(u, 86.2, 87.2));
  if (t2 > 0) {
    ctx.save(); ctx.globalAlpha = t2;
    text(ctx, 'keyhole-near.vercel.app', x, ty + 90 + (1 - t2) * 16, font(FORMAT.pick({ '16x9': 44, '1x1': 38 }), 600, UI), C.violet);
    text(ctx, 'Built on NEAR Intents · NEAR HACKATHON 2026', x, ty + 150 + (1 - t2) * 16, font(FORMAT.pick({ '16x9': 30, '1x1': 26 }), 500, UI), C.muted);
    ctx.restore();
  }
}

M.film({
  fonts: [font(100, 600, DISPLAY), font(40, 500, UI), font(40, 600, UI)],
  images: {
    home: 'assets/shots/d01_home.png',
    card: 'assets/shots/d01_card_mara.png',
    trader: 'assets/shots/d02_trader.png',
    locked: 'assets/shots/d02_trader_locked.png',
    keycard: 'assets/shots/d02_keycard.png',
    buy: 'assets/shots/d03_buy_dialog.png',
    yourein: 'assets/shots/d04_youre_in_dialog.png',
    feed: 'assets/shots/d05_feed.png',
    copy: 'assets/shots/d06_copy_dialog.png',
    copied: 'assets/shots/d07_copied_dialog.png',
    sell: 'assets/shots/d10_sell.png',
    m1: 'assets/shots/m02_trader.png',
    m2: 'assets/shots/m05_trades.png',
  },
  hits: HITS,
  draw(ctx, u, t, IMG) {
    if (u < 4) s1Hook(ctx, u);
    else if (u < 8) s2Question(ctx, u, IMG);
    else if (u < 16) s3Reveal(ctx, u, IMG);
    else if (u < 24) s4Records(ctx, u, IMG);
    else if (u < 32) s5Proof(ctx, u, IMG);
    else if (u < 40) s6Private(ctx, u, IMG);
    else if (u < 48) s7Buy(ctx, u, IMG);
    else if (u < 52) s8In(ctx, u, IMG);
    else if (u < 62) s9Feed(ctx, u, IMG);
    else if (u < 72) s10Copy(ctx, u, IMG);
    else if (u < 80) s11Earn(ctx, u, IMG);
    else if (u < 84) s12Phones(ctx, u, IMG);
    else s13End(ctx, u);
  },
});
