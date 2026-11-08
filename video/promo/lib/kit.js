// Keyhole motion kit, shared by the promo and the walkthrough (copied into each film's lib/).
// Everything is a pure function of time: no state between frames.
import * as M from './motion.js';

const { W, H, E, prog, lerp, clamp, font, layout, glyph, text, rrect, hash01 } = M;

export const C = { ink: '#0D1117', canvas: '#F5F6F8', violet: '#5B3DF5', violetSoft: '#EFEBFF', white: '#FFFFFF', muted: '#5B6474', green: '#047857', red: '#C2410C', night: '#AEB6C4' };
export const DISPLAY = 'Display', UI = 'UI';

// ------------------------------------------------------------------ background
// A living backdrop: a slow-drifting dot grid with two soft pools of violet light.
export function backdrop(ctx, t, { dark = false } = {}) {
  ctx.fillStyle = dark ? C.ink : C.canvas;
  ctx.fillRect(0, 0, W, H);
  const glow = (x, y, r, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(91,61,245,${a})`);
    g.addColorStop(1, 'rgba(91,61,245,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  };
  glow(W * (0.78 + 0.06 * Math.sin(t * 0.21)), H * (0.25 + 0.05 * Math.cos(t * 0.17)), W * 0.55, dark ? 0.22 : 0.09);
  glow(W * (0.15 + 0.05 * Math.cos(t * 0.13)), H * (0.85 + 0.04 * Math.sin(t * 0.19)), W * 0.45, dark ? 0.14 : 0.06);
  const step = 44, ox = (t * 9) % step, oy = (t * 5) % step;
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.07)' : 'rgba(13,17,23,0.075)';
  for (let y = -step + oy; y < H + step; y += step) for (let x = -step + ox; x < W + step; x += step) {
    ctx.beginPath(); ctx.arc(x, y, 1.6, 0, M.TAU); ctx.fill();
  }
}

// ------------------------------------------------------------------ real screen pieces
// A crop of a real screenshot drawn as a floating card. tilt (-1..1) leans it in depth.
export function piece(ctx, img, src, x, y, w, h, { r = 24, shadow = 1, alpha = 1, scale = 1, rot = 0, tilt = 0, blur = 0, bg = C.white } = {}) {
  if (!img || alpha <= 0.002 || scale <= 0.002) return;
  ctx.save();
  ctx.globalAlpha *= clamp(alpha);
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  if (tilt) ctx.transform(1 - Math.abs(tilt) * 0.12, tilt * 0.08, 0, 1, 0, 0);
  ctx.translate(-w / 2, -h / 2);
  if (shadow) {
    ctx.save();
    ctx.shadowColor = `rgba(13,17,23,${0.18 * shadow})`; ctx.shadowBlur = 60; ctx.shadowOffsetY = 26;
    rrect(ctx, 0, 0, w, h, r); ctx.fillStyle = bg; ctx.fill();
    ctx.restore();
  }
  rrect(ctx, 0, 0, w, h, r); ctx.clip();
  if (blur) ctx.filter = `blur(${blur}px)`;
  if (src) ctx.drawImage(img, src[0], src[1], src[2], src[3], 0, 0, w, h);
  else ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = 'none';
  ctx.restore();
}

// Spring-in amount for something entering at beat u0 (0..1, overshooting a little).
export const enter = (u, u0, cfg = M.SPRING.snappy) => M.springU(u, u0, cfg);
export const leave = (u, u0, len = 0.5) => E.inCubic(prog(u, u0, u0 + len));

// ------------------------------------------------------------------ numbers that count up
export function counter(ctx, value, p, x, baseline, f, color, { prefix = '', suffix = '', digits = 1, align = 'left', sign = false } = {}) {
  const v = value * E.outCubic(clamp(p));
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const str = `${sign ? (v >= 0 ? '+' : '−') : ''}${prefix}${s}${suffix}`;
  text(ctx, str, x, baseline, f, color, align);
}

// ------------------------------------------------------------------ cursor + tap
export function cursor(ctx, x, y, { press = 0, alpha = 1 } = {}) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  const s = 1.5 * (1 - 0.12 * press);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, 26); ctx.lineTo(7, 20); ctx.lineTo(12, 31); ctx.lineTo(16.5, 29); ctx.lineTo(11.5, 18.5); ctx.lineTo(20, 18.5); ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  ctx.fillStyle = C.ink; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2; ctx.strokeStyle = C.white; ctx.stroke();
  ctx.restore();
}
export function ripple(ctx, x, y, k) {
  if (k <= 0 || k >= 1) return;
  ctx.save();
  ctx.globalAlpha = (1 - k) * 0.55;
  ctx.strokeStyle = C.violet; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(x, y, 12 + k * 70, 0, M.TAU); ctx.stroke();
  ctx.globalAlpha = (1 - k) * 0.25; ctx.fillStyle = C.violet;
  ctx.beginPath(); ctx.arc(x, y, 12 + k * 40, 0, M.TAU); ctx.fill();
  ctx.restore();
}
// A cursor path: keys [[u, x, y]], taps [u...]. Draws cursor + ripples.
export function cursorPath(ctx, u, keys, taps = [], { show = [-1e9, 1e9] } = {}) {
  if (u < show[0] || u > show[1]) return;
  let x = keys[0][1], y = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    const [u1, x1, y1] = keys[i], [u0, x0, y0] = keys[i - 1];
    if (u <= u0) break;
    const p = E.inOutCubic(prog(u, u0, u1));
    x = lerp(x0, x1, p); y = lerp(y0, y1, p);
  }
  let press = 0;
  for (const tu of taps) {
    ripple(ctx, x + 2, y + 2, prog(u, tu, tu + 1.2));
    press = Math.max(press, M.bump(u, tu + 0.1, 0.3));
  }
  const a = E.outCubic(prog(u, show[0], show[0] + 0.5)) * (1 - E.inCubic(prog(u, show[1] - 0.5, show[1])));
  cursor(ctx, x, y, { press, alpha: a });
}

// ------------------------------------------------------------------ icons drawn in code
export function logo(ctx, cx, cy, size, keyFill = C.white) {
  const s = size / 32;
  rrect(ctx, cx - size / 2, cy - size / 2, size, size, 9 * s); ctx.fillStyle = C.violet; ctx.fill();
  keyholePath(ctx, cx, cy, s); ctx.fillStyle = keyFill; ctx.fill();
}
export function keyholePath(ctx, cx, cy, s) {
  const X = (v) => cx + (v - 16) * s, Y = (v) => cy + (v - 16) * s;
  ctx.beginPath(); ctx.arc(X(16), Y(13.667), 3.333 * s, 0, M.TAU);
  ctx.moveTo(X(14.4), Y(16)); ctx.lineTo(X(13.333), Y(22)); ctx.lineTo(X(18.667), Y(22)); ctx.lineTo(X(17.6), Y(16)); ctx.closePath();
}
// Lock that can close (shut 0..1) and turn into a key (key 0..1).
export function lockIcon(ctx, cx, cy, r, { shut = 1, key = 0, bg = C.violet, fg = C.white } = {}) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, M.TAU); ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = fg; ctx.lineWidth = r * 0.13; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (key < 1) {
    ctx.save(); ctx.globalAlpha *= 1 - key;
    const bw = r * 0.8, bh = r * 0.6, by = cy - bh * 0.1;
    rrect(ctx, cx - bw / 2, by, bw, bh, r * 0.1); ctx.stroke();
    const lift = (1 - shut) * r * 0.28;
    ctx.beginPath(); ctx.arc(cx, by - lift, bw * 0.3, Math.PI, 0); ctx.lineTo(cx + bw * 0.3, by - lift + (1 - shut) * 2); ctx.moveTo(cx - bw * 0.3, by - lift); ctx.lineTo(cx - bw * 0.3, by); ctx.stroke();
    ctx.restore();
  }
  if (key > 0) {
    ctx.save(); ctx.globalAlpha *= key;
    ctx.translate(cx, cy); ctx.rotate((1 - key) * -1.2);
    const s = r / 13;
    ctx.beginPath(); ctx.arc(-4.5 * s, 3.5 * s, 4.5 * s, 0, M.TAU);
    ctx.moveTo(-1.3 * s, 0.3 * s); ctx.lineTo(8 * s, -9 * s); ctx.moveTo(4 * s, -5 * s); ctx.lineTo(7 * s, -2 * s); ctx.moveTo(2 * s, -3 * s); ctx.lineTo(4 * s, -1 * s);
    ctx.lineWidth = r * 0.12; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
export function check(ctx, cx, cy, r, k, color = C.green) {
  if (k <= 0) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = r * 0.22; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const pts = [[-0.45, 0.02], [-0.12, 0.34], [0.48, -0.32]];
  const L1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), L2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
  const d = k * (L1 + L2);
  ctx.beginPath(); ctx.moveTo(cx + pts[0][0] * r, cy + pts[0][1] * r);
  const a = Math.min(1, d / L1);
  ctx.lineTo(cx + lerp(pts[0][0], pts[1][0], a) * r, cy + lerp(pts[0][1], pts[1][1], a) * r);
  if (d > L1) { const b = (d - L1) / L2; ctx.lineTo(cx + lerp(pts[1][0], pts[2][0], b) * r, cy + lerp(pts[1][1], pts[2][1], b) * r); }
  ctx.stroke(); ctx.restore();
}

// ------------------------------------------------------------------ transitions
// Keyhole wipe: the next scene shows through a growing keyhole (p 0..1). drawNext paints it.
export function keyholeWipe(ctx, p, drawNext, cx = W / 2, cy = H / 2) {
  if (p <= 0) return;
  const s = 0.6 * (Math.hypot(W, H) / 3.2 / 0.6) ** E.inOutCubic(p) * (p > 0 ? 1 : 0);
  ctx.save();
  keyholePath(ctx, cx, cy + s * 1.2, s);
  ctx.clip();
  drawNext();
  ctx.restore();
}

// ------------------------------------------------------------------ words as they're spoken
// vo.json lines → the words of the line being said, each springing up on its own t0.
export function spokenLine(VO, t, { lead = 0.05, hold = 0.9 } = {}) {
  if (!VO) return null;
  for (let i = 0; i < VO.lines.length; i++) {
    const L = VO.lines[i];
    const next = VO.lines[i + 1];
    const end = Math.min(L.t1 + hold, next ? next.t0 - 0.05 : 1e9);
    if (t >= L.t0 - lead - 0.4 && t < end) return { line: L, end };
  }
  return null;
}

// Lays the words out in a box (wrapping), each word springing in at its spoken time.
export function kinetic(ctx, t, line, end, { x, y, w, size, color = C.ink, accent = {}, family = DISPLAY, weight = 600, lineH = 1.06, align = 'left', exitDur = 0.35, maxLines = 4 } = {}) {
  const f = font(size, weight, family);
  const space = size * 0.28;
  // wrap
  const rows = [[]];
  let rowW = 0;
  for (const wd of line.words) {
    const L = layout(ctx, wd.w, f, -0.02 * size);
    if (rowW + L.width > w && rows[rows.length - 1].length) { rows.push([]); rowW = 0; }
    rows[rows.length - 1].push({ ...wd, L, x: rowW });
    rowW += L.width + space;
  }
  const rowsUse = rows.slice(0, maxLines);
  const exit = E.inCubic(prog(t, end - exitDur, end));
  rowsUse.forEach((row, ri) => {
    const rowWidth = row.length ? row[row.length - 1].x + row[row.length - 1].L.width : 0;
    const ox = align === 'center' ? x + (w - rowWidth) / 2 : x;
    const base = y + ri * size * lineH;
    row.forEach((wd) => {
      const clean = wd.w.replace(/[.,:;!?…]+$/, '');
      const k = M.spring(t - wd.t0 + 0.06, M.SPRING.snappy);
      if (k <= 0) return;
      const col = accent[clean] ?? color;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, base - size * 1.05, W, size * 1.4); ctx.clip();
      wd.L.glyphs.forEach((g, gi) => {
        const kk = M.spring(t - wd.t0 + 0.06 - gi * 0.012, M.SPRING.snappy);
        if (kk <= 0) return;
        glyph(ctx, g.ch, ox + wd.x + g.cx, base + (1 - kk) * size * 0.9 - exit * size * 1.3, f, col);
      });
      ctx.restore();
    });
  });
  return rowsUse.length;
}

// Caption band for the walkthrough: step badge + the spoken words in one line, word by word.
export function captionBand(ctx, t, VO, step, { y = 1030, x = 210, badge = true } = {}) {
  const f = font(30, 600, UI);
  let bx = x;
  if (badge && step) {
    ctx.font = f;
    const pw = ctx.measureText(step).width + 44;
    rrect(ctx, x, y - 30, pw, 56, 28); ctx.fillStyle = C.violet; ctx.fill();
    text(ctx, step, x + 22, y + 9, f, C.white);
    bx = x + pw + 22;
  }
  const s = spokenLine(VO, t, { hold: 1.2 });
  if (!s) return;
  const cf = font(31, 500, UI);
  // show the tail of long lines: keep the last ~13 words visible
  const words = s.line.words;
  const shownFrom = Math.max(0, words.findIndex((w) => w.t0 > t) - 13);
  let cx = bx;
  ctx.font = cf;
  const exit = E.inCubic(prog(t, s.end - 0.3, s.end));
  for (let i = shownFrom; i < words.length; i++) {
    const wd = words[i];
    const k = M.spring(t - wd.t0 + 0.05, M.SPRING.snappy);
    const ww = ctx.measureText(wd.w + ' ').width;
    if (cx + ww > W - 60) break;
    if (k > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(k * 1.3) * (1 - exit);
      text(ctx, wd.w, cx, y + 11 + (1 - k) * 16, cf, C.ink);
      ctx.restore();
    }
    cx += ww;
  }
}
