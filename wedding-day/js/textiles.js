// Процедурные «ткани» и символы: ханатлас, флаги-занавеси, казахский орнамент,
// узоры ганча и майолики. Всё рисуется кодом — без картинок.
window.Textiles = (() => {
  "use strict";

  const UZ = { blue: "#0099B5", red: "#CE1126", white: "#FFFFFF", green: "#1EB53A" };
  const KZ = { sky: "#00AFCA", gold: "#FEC50C" };

  // «Қошқар мүйіз» — бараньи рога, главный мотив казахского орнамента. Рамка 40×40, рога вверх.
  const HORNS =
    "M20 40 V25 C20 13 10 7 6.5 13.5 C4 18.5 9.5 22.5 12.5 18.5 " +
    "M20 25 C20 13 30 7 33.5 13.5 C36 18.5 30.5 22.5 27.5 18.5 " +
    "M13 40 Q20 33 27 40";

  function canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function starPath(ctx, cx, cy, R, r, n = 5, rot = -Math.PI / 2) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const rad = i % 2 ? r : R;
      const a = rot + (i * Math.PI) / n;
      ctx[i ? "lineTo" : "moveTo"](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    ctx.closePath();
  }

  // Восьмиконечная звезда из двух квадратов (хатам) — SVG-путь.
  function khatamD(cx, cy, R) {
    const r = R * 0.7654;
    let d = "";
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 8;
      const rad = i % 2 ? r : R;
      d += `${i ? "L" : "M"}${(cx + Math.cos(a) * rad).toFixed(2)} ${(cy + Math.sin(a) * rad).toFixed(2)}`;
    }
    return d + "Z";
  }

  /* ---------- Ханатлас ---------- */

  const ATLAS = {
    crimson: "#B0103C",
    yellow: "#F4C430",
    white: "#F7F1E3",
    green: "#16884A",
    blue: "#1B3E9E",
    black: "#141414",
    magenta: "#C8166E",
    turq: "#18A5AC",
  };

  function lens(c, cx, cy, hw, hh, color) {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(cx, cy - hh);
    c.quadraticCurveTo(cx + hw * 2, cy, cx, cy + hh);
    c.quadraticCurveTo(cx - hw * 2, cy, cx, cy - hh);
    c.fill();
  }

  function diamond(c, cx, cy, hw, hh, color) {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(cx, cy - hh);
    c.lineTo(cx + hw, cy);
    c.lineTo(cx, cy + hh);
    c.lineTo(cx - hw, cy);
    c.closePath();
    c.fill();
  }

  function triangle(c, cx, y, hw, h, color) {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(cx - hw, y);
    c.lineTo(cx + hw, y);
    c.lineTo(cx, y + h);
    c.closePath();
    c.fill();
  }

  function stripes(c, x, h, list) {
    let px = x;
    list.forEach(([w, color]) => {
      c.fillStyle = color;
      c.fillRect(px, 0, w, h);
      px += w;
    });
  }

  // Плитка 256×512 (степени двойки — чтобы WebGL мог её повторять).
  // Сначала чёткий узор, затем «икат»: каждая нить основы сдвинута по вертикали,
  // отсюда характерные рваные, будто размытые края мотивов.
  function atlasTile() {
    const W = 256;
    const H = 512;
    const P = ATLAS;
    const src = canvas(W, H);
    const c = src.getContext("2d");

    // миндалины на малиновом
    c.fillStyle = P.crimson;
    c.fillRect(0, 0, 96, H);
    for (let k = 0; k <= 4; k++) {
      diamond(c, 0, k * 128, 12, 22, P.turq);
      diamond(c, 96, k * 128, 12, 22, P.turq);
      if (k === 4) break;
      const cy = k * 128 + 64;
      lens(c, 48, cy, 40, 62, P.yellow);
      lens(c, 48, cy, 30, 50, P.white);
      lens(c, 48, cy, 21, 38, P.blue);
      lens(c, 48, cy, 12, 24, P.magenta);
      diamond(c, 48, cy, 5, 10, P.yellow);
    }
    stripes(c, 96, H, [[4, P.white], [3, P.black], [6, P.yellow], [3, P.black]]);

    // зигзаг на синем
    c.fillStyle = P.blue;
    c.fillRect(112, 0, 64, H);
    const zig = () => {
      c.beginPath();
      for (let y = 0, i = 0; y <= H; y += 32, i++) c.lineTo(i % 2 ? 166 : 122, y);
    };
    c.lineJoin = "miter";
    c.strokeStyle = P.yellow;
    c.lineWidth = 12;
    zig();
    c.stroke();
    c.strokeStyle = P.black;
    c.lineWidth = 3;
    zig();
    c.stroke();
    for (let y = 0, i = 0; y <= H; y += 32, i++) diamond(c, i % 2 ? 130 : 158, y, 6, 9, P.magenta);
    stripes(c, 176, H, [[3, P.black], [6, P.yellow], [3, P.black], [4, P.white]]);

    // тумары-обереги на зелёном
    c.fillStyle = P.green;
    c.fillRect(192, 0, 64, H);
    for (let k = 0; k < 4; k++) {
      const y = k * 128;
      triangle(c, 224, y + 6, 24, 54, P.white);
      triangle(c, 224, y + 12, 16, 38, P.magenta);
      diamond(c, 224, y + 22, 4, 6, P.yellow);
      c.save();
      c.translate(224, y + 122);
      c.scale(1, -1);
      triangle(c, 0, 0, 24, 54, P.yellow);
      triangle(c, 0, 6, 16, 38, P.blue);
      c.restore();
      diamond(c, 200, y + 64, 5, 9, P.white);
      diamond(c, 248, y + 64, 5, 9, P.white);
    }

    // икат
    const out = canvas(W, H);
    const o = out.getContext("2d");
    let n = 0;
    for (let x = 0; x < W; x += 2) {
      n = (n + (Math.random() - 0.5) * 3.2) * 0.9;
      const off = Math.round(n * 2.2);
      o.drawImage(src, x, 0, 2, H, x, off, 2, H);
      o.drawImage(src, x, 0, 2, H, x, off - H, 2, H);
      o.drawImage(src, x, 0, 2, H, x, off + H, 2, H);
    }

    // нити: основа и уток
    o.globalAlpha = 0.07;
    o.fillStyle = "#000";
    for (let x = 0; x < W; x += 3) o.fillRect(x, 0, 1, H);
    o.globalAlpha = 0.05;
    o.fillStyle = "#fff";
    for (let y = 0; y < H; y += 2) o.fillRect(0, y, W, 1);
    o.globalAlpha = 1;
    return out;
  }

  // Та же плитка, повёрнутая поперёк, — для лент-разделителей. В конце запас 64 px для бесшовного цикла.
  function ribbonTexture(tile) {
    const r = canvas(512 + 64, 256);
    const c = r.getContext("2d");
    c.save();
    c.translate(0, 256);
    c.rotate(-Math.PI / 2);
    c.drawImage(tile, 0, 0);
    c.restore();
    c.drawImage(r, 0, 0, 64, 256, 512, 0, 64, 256);
    return r;
  }

  /* ---------- Флаги-занавеси ---------- */

  function weave(c, W, H) {
    c.globalAlpha = 0.045;
    c.fillStyle = "#000";
    for (let x = 0; x < W; x += 3) c.fillRect(x, 0, 1, H);
    c.fillStyle = "#fff";
    for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1);
    c.globalAlpha = 1;
  }

  // Флаг Узбекистана на вертикальном полотне: синяя, белая и зелёная полосы с красными каймами,
  // в синей — полумесяц и 12 звёзд (3 + 4 + 5, выровнены вправо).
  function uzCurtain(W, H) {
    const cv = canvas(W, H);
    const c = cv.getContext("2d");
    const band = H * 0.315;
    const line = Math.max(2, H * 0.014);
    c.fillStyle = UZ.white;
    c.fillRect(0, 0, W, H);
    c.fillStyle = UZ.blue;
    c.fillRect(0, 0, W, band);
    c.fillStyle = UZ.green;
    c.fillRect(0, H - band, W, band);
    c.fillStyle = UZ.red;
    c.fillRect(0, band, W, line);
    c.fillRect(0, H - band - line, W, line);

    const s = Math.min((W * 0.8) / 8, (band * 0.62) / 3);
    const r = 1.35 * s;
    const x0 = (W - 8 * s) / 2;
    const cy = band * 0.52;
    c.fillStyle = UZ.white;
    c.beginPath();
    c.arc(x0 + r, cy, r, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = UZ.blue;
    c.beginPath();
    c.arc(x0 + r + 0.34 * r, cy, 0.86 * r, 0, Math.PI * 2);
    c.fill();

    const gx = x0 + 2 * r + 0.9 * s;
    const rows = [[2, 3, 4], [1, 2, 3, 4], [0, 1, 2, 3, 4]];
    c.fillStyle = UZ.white;
    rows.forEach((cols, ri) =>
      cols.forEach((ci) => {
        starPath(c, gx + ci * s, cy + (ri - 1) * s, 0.4 * s, 0.153 * s);
        c.fill();
      })
    );
    weave(c, W, H);
    return cv;
  }

  // Беркут из казахского флага, упрощённый силуэт. Размах крыльев — 200 единиц.
  const WING = "M6 -2 C28 -16 58 -24 98 -22 L86 -13 L95 -9 L79 -4 L86 1 L68 2 L72 7 L54 7 L56 12 L38 10 L36 14 L20 9 L10 10 Z";
  const BODY = "M-7 -8 C-11 4 -9 16 0 22 C9 16 11 4 7 -8 C5 -14 -5 -14 -7 -8 Z";
  const TAIL = "M-7 18 L-10 32 L-4 29 L0 34 L4 29 L10 32 L7 18 Z";
  const BEAK = "M-10 -18 L-17 -13.5 L-10 -12 Z";

  function eagle(c, cx, cy, span, color, eye) {
    const s = span / 200;
    c.save();
    c.translate(cx, cy);
    c.scale(s, s);
    c.fillStyle = color;
    const wing = new Path2D(WING);
    c.fill(wing);
    c.save();
    c.scale(-1, 1);
    c.fill(wing);
    c.restore();
    c.fill(new Path2D(BODY));
    c.fill(new Path2D(TAIL));
    c.fill(new Path2D(BEAK));
    c.beginPath();
    c.arc(-5, -16, 6.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = eye;
    c.beginPath();
    c.arc(-6.5, -17, 1.3, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // Флаг Казахстана: голубое полотно, золотое солнце с 32 лучами, беркут
  // и полоса орнамента у древка — здесь она идёт вдоль шва, где сходятся половины.
  function kzCurtain(W, H) {
    const cv = canvas(W, H);
    const c = cv.getContext("2d");
    c.fillStyle = KZ.sky;
    c.fillRect(0, 0, W, H);

    const bw = Math.max(18, W * 0.13);
    const sc = (bw / 40) * 0.9;
    const horns = new Path2D(HORNS);
    c.strokeStyle = KZ.gold;
    c.lineWidth = 3.4;
    c.lineCap = "round";
    for (let y = -20 * sc; y < H; y += 44 * sc) {
      c.save();
      c.translate(bw * 0.05, y);
      c.scale(sc, sc);
      c.stroke(horns);
      c.restore();
    }

    const fw = W - bw;
    const cx = bw + fw / 2;
    const R = fw * 0.16;
    const cy = H * 0.3;
    c.fillStyle = KZ.gold;
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.fill();
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const da = (Math.PI / 32) * 0.55;
      c.beginPath();
      c.moveTo(cx + Math.cos(a - da) * R * 1.18, cy + Math.sin(a - da) * R * 1.18);
      c.lineTo(cx + Math.cos(a) * R * 1.62, cy + Math.sin(a) * R * 1.62);
      c.lineTo(cx + Math.cos(a + da) * R * 1.18, cy + Math.sin(a + da) * R * 1.18);
      c.fill();
    }
    eagle(c, cx, cy + R * 2.6, fw * 0.82, KZ.gold, KZ.sky);
    weave(c, W, H);
    return cv;
  }

  /* ---------- Узоры фонов (SVG data URL) ---------- */

  const svgUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

  // Ганч — резной алебастр: звёзды-хатам, выпуклые за счёт светлой и тёмной кромки.
  function ganchPattern() {
    const S = 72;
    const stars = [[36, 36], [0, 0], [72, 0], [0, 72], [72, 72]].map(([x, y]) => khatamD(x, y, 25)).join("");
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">` +
      `<path d="${stars}" fill="none" stroke="#B9AE98" stroke-opacity=".55" stroke-width="1.2" transform="translate(.8 .8)"/>` +
      `<path d="${stars}" fill="none" stroke="#FFFFFF" stroke-width="1.2" transform="translate(-.5 -.5)"/>` +
      `</svg>`;
    return svgUrl(svg);
  }

  // Майолика — изразцы: бирюзовые звёзды-хатам с белым контуром, кобальтовые кресты, затирка.
  function tilePattern() {
    const S = 64;
    const corners = [[0, 0], [64, 0], [0, 64], [64, 64]].map(([x, y]) => khatamD(x, y, 18)).join("");
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">` +
      `<rect x=".5" y=".5" width="63" height="63" fill="none" stroke="#FFFFFF" stroke-opacity=".1"/>` +
      `<path d="${corners}" fill="#0C2558" stroke="#1FA4A8" stroke-width="1.2"/>` +
      `<path d="${khatamD(32, 32, 20)}" fill="#1FA4A8" stroke="#E9F4F2" stroke-width="1.4"/>` +
      `<path d="${khatamD(32, 32, 9)}" fill="#0C2558"/>` +
      `<circle cx="32" cy="32" r="2.4" fill="#F2C14E"/>` +
      `</svg>`;
    return svgUrl(svg);
  }

  return { HORNS, khatamD, atlasTile, ribbonTexture, uzCurtain, kzCurtain, ganchPattern, tilePattern };
})();
