// Keyhole demo walkthrough: pure function of time (see lib/motion.js). 90 bpm grid, 180 beats.
// A screen-recording feel built only from real screenshots of the app: a camera moves over each
// screen, a violet ring points at what matters, a step label and one caption sit underneath.
import * as M from './lib/motion.js';

const { W, H, E, prog, lerp, clamp, springU, SPRING, font, layout, text, fill, rrect, bump } = M;

const C = { ink: '#0D1117', canvas: '#F5F6F8', violet: '#5B3DF5', white: '#FFFFFF', muted: '#5B6474', night: '#AEB6C4', tint: '#EFEBFF' };
const DISPLAY = 'Display', UI = 'UI';

// Stage: the screen sits in a white card; the caption band is underneath.
const ST = { x: 210, y: 28, w: 1500, h: 938 }; // 16:10, like the screenshots
const AR = 1.6;

// ------------------------------------------------------------------ shots
// cam: [[beat, [cx, cy, w]]] in screenshot pixels (2880x1800 screens, 2x). rings: [beat0, beat1, [x,y,w,h]].
// swaps: element screenshots drawn over the same spot (a dialog changing state).
const SHOTS = [
  { a: 8, b: 20, img: 'homeFull', step: '1 · Find a trader', cap: 'Ranked by return. One trader is losing money: nothing is cherry-picked.',
    cam: [[8, [1440, 900, 2880]], [10, [1900, 700, 1700]], [13.5, [1900, 700, 1700]], [15.5, [2050, 1450, 1500]]],
    rings: [[10.5, 13.2, [2130, 468, 510, 92]], [16, 19.6, [1867, 1313, 773, 641]]] },
  { a: 20, b: 32, el: 'card', step: '1 · Find a trader', cap: "Return, win rate, biggest dip: read from the trader's private NEAR account.",
    rings: [[21.5, 25.5, [46, 173, 232, 102]], [26, 31.5, [24, 330, 726, 104]]] },
  { a: 32, b: 46, img: 'trader', step: '2 · Check the record', cap: "The chart and the stats are public. Mara can't edit them.",
    cam: [[32, [1440, 900, 2880]], [34.5, [1095, 760, 1900]], [40, [1095, 760, 1900]], [43, [1095, 1180, 1750]]],
    rings: [[41.5, 45.6, [298, 1134, 1595, 152]]] },
  { a: 46, b: 56, img: 'locked', step: '2 · Check the record', cap: 'Her trades are private.',
    cam: [[46, [1440, 900, 2880]], [48, [1096, 1560, 1300]]], rings: [[49, 55.5, [1044, 1555, 104, 104]]] },
  { a: 56, b: 64, img: 'api', step: '2 · Check the record', cap: 'Even the data API refuses without a key (403).',
    cam: [[56, [1440, 900, 2880]], [57.5, [575, 200, 1150]]] },
  { a: 64, b: 80, img: 'buy', step: '3 · Buy a key', cap: '7, 30 or 90 days. 95% goes to the trader, instantly.',
    cam: [[64, [1440, 900, 2880]], [66, [1440, 900, 1800]]],
    swaps: [[70, 74, 'buy90', [980, 260, 920, 1280]], [75.5, 80, 'paying', [980, 260, 920, 1280]]],
    rings: [[66.5, 69.6, [1028, 576, 824, 109]], [70.5, 73.6, [1028, 701, 824, 105]], [74.2, 75.6, [1028, 1301, 824, 108]]] },
  { a: 80, b: 88, img: 'youreIn', step: '3 · Buy a key', cap: "You're in. Mara's trades are open to you.",
    cam: [[80, [1440, 900, 1800]], [82, [1440, 900, 1500]]] },
  { a: 88, b: 96, img: 'trades', step: '4 · See the trades', cap: "Each change in Mara's holdings is a trade: its size, price, and how it has done since.",
    cam: [[88, [1440, 900, 2880]], [90, [1100, 860, 1900]]], rings: [[91, 95.6, [242, 798, 1707, 156]]] },
  { a: 96, b: 104, el: 'feed', scroll: [96, 104, 0, 1900], step: '4 · See the trades', cap: 'New trades show up within minutes.' },
  { a: 104, b: 120, img: 'copy', step: '5 · Copy a trade', cap: 'The amount comes from a live NEAR Intents price check.',
    cam: [[104, [1440, 900, 2880]], [106, [1440, 900, 1800]]],
    swaps: [[111, 120, 'copy25', [980, 282, 920, 1240]]],
    rings: [[106.5, 110.6, [1308, 700, 264, 140]], [111.5, 115.6, [1588, 700, 264, 140]], [117, 119.6, [1028, 1288, 824, 108]]] },
  { a: 120, b: 125, img: 'copied', step: '5 · Copy a trade', cap: 'Copied. It lands in your own NEAR Intents balance in Live mode.',
    cam: [[120, [1440, 900, 1800]], [121.5, [1440, 900, 1500]]] },
  { a: 125, b: 130, img: 'after', step: '5 · Copy a trade', cap: 'Your copies are tracked.',
    cam: [[125, [1440, 900, 2880]], [126.5, [2320, 900, 1500]]] },
  { a: 130, b: 136, el: 'auto', step: '5 · Copy a trade', cap: 'Or copy automatically (Demo today; Live asks you each time).' },
  { a: 136, b: 140, img: 'start', step: '6 · For traders', cap: 'Sign once with your wallet. It moves no money.',
    cam: [[136, [1440, 900, 2880]], [137.5, [1200, 1000, 2100]]] },
  { a: 140, b: 144, img: 'start3', step: '6 · For traders', cap: 'Set your price. You keep 95% of every key.',
    cam: [[140, [1200, 1000, 2100]], [141.5, [1100, 1250, 1900]]] },
  { a: 144, b: 152, img: 'sell', step: '6 · For traders', cap: 'Your earnings, keys sold and buyers, in one place.',
    cam: [[144, [1440, 900, 2880]], [146.5, [1240, 900, 2000]]] },
  { a: 152, b: 164, phones: true, step: 'Phones', cap: 'Made for phones too.' },
  { a: 164, b: 168, img: 'liveHome', step: 'Live mode', cap: 'Live mode: the same app on NEAR mainnet, with real money.',
    cam: [[164, [1440, 900, 2880]], [166, [1440, 700, 2300]]] },
  { a: 168, b: 171, img: 'liveSignin', step: 'Live mode', cap: 'Sign in with your own wallet. NEAR Intents checks the signature.',
    cam: [[168, [1440, 900, 2600]], [169.5, [1440, 900, 1700]]] },
  { a: 171, b: 176, img: 'livePay', step: 'Live mode', cap: 'Pay for a key with any coin, at a real one-time NEAR Intents address.',
    cam: [[171, [1440, 900, 2600]], [172.5, [1440, 880, 1500]]], rings: [[173, 175.6, [1056, 666, 794, 282]]] },
];

const HITS = [
  [0, 'title', 'impact'], [1.5, 'subtitle', 'blip', { pitch: 'C6' }],
  ...SHOTS.map((s) => [s.a, `cut ${s.step}`, s.step !== (SHOTS[SHOTS.indexOf(s) - 1] || {}).step ? 'whoosh' : 'click', { len: 0.35 }]),
  ...SHOTS.flatMap((s) => (s.rings || []).map((r) => [r[0], 'ring', 'tick'])),
  ...SHOTS.flatMap((s) => (s.swaps || []).map((r) => [r[0], 'state change', 'click'])),
  [80, "you're in", 'coins'], [120, 'copied', 'bell', { pitch: 'A6' }],
  [176, 'end card', 'impact'], [176.5, 'logo', 'bell', { pitch: 'F6' }],
].sort((a, b) => a[0] - b[0]);

// ------------------------------------------------------------------ helpers

function camAt(u, keys) {
  if (!keys) return [1440, 900, 2880];
  let v = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [u1, b] = keys[i];
    const [u0, a] = keys[i - 1];
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
  const x = clamp(cx - w / 2, 0, imgW - w), y = clamp(cy - h / 2, 0, imgH - h);
  return [x, y, w, h];
}

function stageCard(ctx, draw) {
  ctx.save();
  ctx.shadowColor = 'rgba(13,17,23,0.14)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 20;
  rrect(ctx, ST.x, ST.y, ST.w, ST.h, 22); ctx.fillStyle = C.white; ctx.fill();
  ctx.restore();
  ctx.save(); rrect(ctx, ST.x, ST.y, ST.w, ST.h, 22); ctx.clip();
  draw();
  ctx.restore();
}

function ring(ctx, x, y, w, h, k) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = k;
  const g = (1 - k) * 22 + 10;
  ctx.strokeStyle = C.violet; ctx.lineWidth = 6;
  rrect(ctx, x - g, y - g, w + 2 * g, h + 2 * g, 16 + g); ctx.stroke();
  ctx.restore();
}

const ringK = (u, a, b) => E.outCubic(prog(u, a, a + 0.6)) * (1 - E.inCubic(prog(u, b - 0.4, b)));

function band(ctx, u, shot) {
  const y = 1022;
  const f = font(30, 600, UI);
  ctx.font = f;
  const pw = ctx.measureText(shot.step).width + 44;
  const k = springU(u, shot.a - 0.3, SPRING.snappy);
  rrect(ctx, ST.x, y - 30, pw, 56, 28); ctx.fillStyle = C.violet; ctx.fill();
  text(ctx, shot.step, ST.x + 22, y + 9, f, C.white);
  const cf = font(32, 500, UI);
  ctx.save();
  ctx.globalAlpha = clamp(k * 1.4);
  ctx.beginPath(); ctx.rect(ST.x + pw + 10, y - 40, W, 80); ctx.clip();
  text(ctx, shot.cap, ST.x + pw + 26, y + 11 + (1 - k) * 30, cf, C.ink);
  ctx.restore();
}

function logo(ctx, cx, cy, size) {
  const s = size / 32;
  rrect(ctx, cx - size / 2, cy - size / 2, size, size, 9 * s); ctx.fillStyle = C.violet; ctx.fill();
  const X = (v) => cx + (v - 16) * s, Y = (v) => cy + (v - 16) * s;
  ctx.beginPath(); ctx.arc(X(16), Y(13.667), 3.333 * s, 0, M.TAU);
  ctx.moveTo(X(14.4), Y(16)); ctx.lineTo(X(13.333), Y(22)); ctx.lineTo(X(18.667), Y(22)); ctx.lineTo(X(17.6), Y(16)); ctx.closePath();
  ctx.fillStyle = C.white; ctx.fill();
}

function phone(ctx, img, x, y, w, rot = 0) {
  const h = w / 0.462;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot); ctx.translate(-w / 2, -h / 2);
  ctx.save(); ctx.shadowColor = 'rgba(13,17,23,0.25)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 24;
  rrect(ctx, -10, -10, w + 20, h + 20, 46); ctx.fillStyle = '#1B2130'; ctx.fill(); ctx.restore();
  rrect(ctx, 0, 0, w, h, 36); ctx.clip();
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();
}

// ------------------------------------------------------------------ scenes

function title(ctx, u, IMG) {
  fill(ctx, C.canvas);
  const k = springU(u, -0.3, SPRING.bouncy);
  const out = E.inCubic(prog(u, 7.4, 8));
  ctx.save(); ctx.globalAlpha = 1 - out;
  ctx.save(); ctx.translate(380, 470); ctx.scale(k, k); ctx.translate(-380, -470); logo(ctx, 380, 470, 200); ctx.restore();
  const t1 = E.outQuint(prog(u, 0.6, 1.8));
  text(ctx, 'Keyhole in 2 minutes', 540, 505 + (1 - t1) * 30, font(110, 600, DISPLAY), C.ink, 'left', -2);
  const t2 = E.outQuint(prog(u, 1.8, 3));
  ctx.globalAlpha = (1 - out) * t2;
  text(ctx, "Demo mode: simulated traders, today's real prices. No wallet, no money.", 546, 600 + (1 - t2) * 20, font(36, 500, UI), C.muted);
  ctx.restore();
  void IMG;
}

function shotScene(ctx, u, IMG, s) {
  fill(ctx, C.canvas);
  // a small settle on every cut, so a new screen arrives rather than appears
  const settle = 1 + 0.012 * (1 - E.outCubic(prog(u, s.a, s.a + 1)));
  ctx.save();
  M.zoomAbout(ctx, settle, W / 2, ST.y + ST.h / 2);
  if (s.el) elementShot(ctx, u, IMG, s);
  else if (s.phones) phonesShot(ctx, u, IMG);
  else {
    const img = IMG[s.img];
    const c = camAt(u, s.cam);
    const [sx, sy, sw, sh] = srcRect(c, img.width, img.height);
    const k = ST.w / sw;
    const map = ([x, y, w, h]) => [ST.x + (x - sx) * k, ST.y + (y - sy) * k, w * k, h * k];
    stageCard(ctx, () => {
      ctx.drawImage(img, sx, sy, sw, sh, ST.x, ST.y, ST.w, ST.w / AR);
      for (const [a, b, key, rect] of s.swaps || []) {
        if (u >= a && u < b && IMG[key]) { const [x, y, w, h] = map(rect); ctx.drawImage(IMG[key], x, y, w, h); }
      }
    });
    for (const [a, b, rect] of s.rings || []) { const [x, y, w, h] = map(rect); ring(ctx, x, y, w, h, ringK(u, a, b)); }
  }
  ctx.restore();
  band(ctx, u, s);
}

function elementShot(ctx, u, IMG, s) {
  const img = IMG[s.el];
  if (s.scroll) {
    const [a, b, y0, y1] = s.scroll;
    const sy = lerp(y0, y1, E.inOutSine(prog(u, a + 0.5, b)));
    const sw = img.width, sh = sw / AR;
    stageCard(ctx, () => {
      ctx.fillStyle = C.canvas; ctx.fillRect(ST.x, ST.y, ST.w, ST.h);
      const w = ST.w * 0.86, x = ST.x + (ST.w - w) / 2;
      ctx.drawImage(img, 0, sy, sw, sh * (ST.w / w), x, ST.y, w, ST.h);
    });
    return;
  }
  // a single card, big, on the canvas
  const maxW = 1100, maxH = 820;
  const sc = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width * sc, h = img.height * sc;
  const x = (W - w) / 2, y = ST.y + (ST.h - h) / 2;
  const k = springU(u, s.a - 0.4, SPRING.snappy);
  ctx.save();
  ctx.translate(W / 2, y + h / 2); ctx.scale(lerp(0.92, 1, k), lerp(0.92, 1, k)); ctx.translate(-W / 2, -(y + h / 2));
  ctx.save(); ctx.shadowColor = 'rgba(13,17,23,0.16)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 22;
  rrect(ctx, x, y, w, h, 28 * sc * 1.5); ctx.fillStyle = C.white; ctx.fill(); ctx.restore();
  ctx.save(); rrect(ctx, x, y, w, h, 28 * sc * 1.5); ctx.clip(); ctx.drawImage(img, x, y, w, h); ctx.restore();
  for (const [a, b, [rx, ry, rw, rh]] of s.rings || []) ring(ctx, x + rx * sc, y + ry * sc, rw * sc, rh * sc, ringK(u, a, b));
  ctx.restore();
}

function phonesShot(ctx, u, IMG) {
  const pw = 380, ph = pw / 0.462;
  const y = ST.y + (ST.h - ph) / 2 + 10;
  const xs = [W / 2 - pw * 1.5 - 70, W / 2 - pw / 2, W / 2 + pw / 2 + 70];
  ['m1', 'm2', 'm3'].forEach((key, i) => {
    const k = springU(u, 151.6 + i * 0.6, SPRING.snappy);
    if (k <= 0) return;
    phone(ctx, IMG[key], xs[i], lerp(H + 50, y, k) + (i === 1 ? -20 : 10), pw, (i - 1) * 0.03);
  });
}

function endCard(ctx, u) {
  fill(ctx, C.canvas);
  const k = springU(u, 175.6, SPRING.bouncy);
  ctx.save(); ctx.translate(380, 430); ctx.scale(k, k); ctx.translate(-380, -430); logo(ctx, 380, 430, 200); ctx.restore();
  const t1 = E.outQuint(prog(u, 176.2, 177));
  ctx.save(); ctx.globalAlpha = t1;
  text(ctx, 'Keyhole', 540, 485 + (1 - t1) * 24, font(150, 600, DISPLAY), C.ink, 'left', -3);
  text(ctx, 'Trade in private. Sell the view.', 546, 590, font(52, 600, DISPLAY), C.ink);
  text(ctx, 'keyhole-near.vercel.app', 546, 680, font(40, 600, UI), C.violet);
  text(ctx, 'github.com/sarenabg/keyhole', 546, 735, font(32, 500, UI), C.muted);
  ctx.restore();
}

M.film({
  fonts: [font(100, 600, DISPLAY), font(40, 500, UI), font(40, 600, UI)],
  images: {
    homeFull: 'assets/shots/d01_home_full.png',
    card: 'assets/shots/d01_card_mara.png',
    trader: 'assets/shots/d02_trader.png',
    locked: 'assets/shots/d02_trader_locked.png',
    api: 'assets/shots/d13_api_403.png',
    buy: 'assets/shots/d03_buy.png',
    buy90: 'assets/shots/d03_buy_dialog_90.png',
    paying: 'assets/shots/d03_buy_paying.png',
    youreIn: 'assets/shots/d04_youre_in.png',
    trades: 'assets/shots/d05_trades.png',
    feed: 'assets/shots/d05_feed.png',
    copy: 'assets/shots/d06_copy.png',
    copy25: 'assets/shots/d06_copy_dialog_25.png',
    copied: 'assets/shots/d07_copied.png',
    after: 'assets/shots/d08_trades_after.png',
    auto: 'assets/shots/d08_autocopy_on.png',
    start: 'assets/shots/d11_start.png',
    start3: 'assets/shots/d11_start_3.png',
    sell: 'assets/shots/d10_sell.png',
    liveHome: 'assets/shots/l01_home_live.png',
    liveSignin: 'assets/shots/l02_signin.png',
    livePay: 'assets/shots/l05_pay_address.png',
    m1: 'assets/shots/m02_trader.png',
    m2: 'assets/shots/m05_trades.png',
    m3: 'assets/shots/m06_copy.png',
  },
  hits: HITS,
  samples: 8,
  draw(ctx, u, t, IMG) {
    if (u < 8) return title(ctx, u, IMG);
    if (u >= 176) return endCard(ctx, u);
    const s = SHOTS.find((x) => u >= x.a && u < x.b) ?? SHOTS[SHOTS.length - 1];
    shotScene(ctx, u, IMG, s);
  },
});
