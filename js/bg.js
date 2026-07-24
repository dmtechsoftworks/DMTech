(function () {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = window.matchMedia("(max-width: 768px)").matches;

  // Gray ladder = main accent; mint is rare sparkle only
  const GRAY_LO = [28, 30, 29];
  const GRAY_MID = [58, 62, 60];
  const GRAY_HI = [110, 116, 112];
  const MINT = [40, 208, 124];

  // Wave-driven silhouette motion (traveling UV warp), not color shimmer
  const TARGET_DT = mobile ? 1 / 18 : 1 / 26;
  const WAVE_AMP = 0.09;
  const WAVE_SPEED = 0.95;
  const WAVE_FX = 2.15;
  const WAVE_FY = 1.2;
  const NOISE_AMP = 0.022;
  const DRIFT_SPEED = 0.028;
  const MINT_SPEED = 0.055;
  const DENSITY_THRESH = 0.4;
  const MINT_THRESH = 0.88;
  const EDGE_SOFT = 0.24;

  let w = 0;
  let h = 0;
  let dpr = 1;
  let pitch = mobile ? 10 : 6;
  let size = mobile ? 5 : 3;
  let gap = 1;
  let cols = 0;
  let rows = 0;
  let raf = 0;
  let t0 = performance.now();
  let last = t0;
  let acc = 0;
  let running = true;
  let maskReady = false;
  let mapOx = 0;
  let mapOy = 0;
  let mapW = 1;
  let mapH = 1;

  let hashes = null;
  let imgData = null;
  let pix = null;

  const off = document.createElement("canvas");
  let offCtx = null;

  const maskImg = new Image();
  const maskCanvas = document.createElement("canvas");
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
  let maskData = null;
  let maskW = 0;
  let maskH = 0;
  let densW = 0;
  let densH = 0;
  let dens = null;

  function assetUrl(file) {
    const el = document.querySelector('script[src*="bg.js"]');
    const src = el ? el.getAttribute("src") : "js/bg.js";
    return src.replace(/js\/bg\.js(?:\?.*)?$/, "assets/" + file);
  }

  function hash2(i, j) {
    let n = (i * 374761393 + j * 668265263) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    n = n ^ (n >>> 16);
    return (n >>> 0) / 4294967295;
  }

  function fade(t) {
    return t * t * (3 - 2 * t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function vnoise2(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = fade(x - x0);
    const fy = fade(y - y0);
    return lerp(
      lerp(hash2(x0, y0), hash2(x0 + 1, y0), fx),
      lerp(hash2(x0, y0 + 1), hash2(x0 + 1, y0 + 1), fx),
      fy
    );
  }

  function vnoise3(x, y, z) {
    const z0 = Math.floor(z);
    const fz = fade(z - z0);
    return lerp(
      vnoise2(x + z0 * 17.13, y + z0 * 9.71),
      vnoise2(x + (z0 + 1) * 17.13, y + (z0 + 1) * 9.71),
      fz
    );
  }

  function proceduralLand(u, v) {
    const lobes = [
      { cx: 0.2, cy: 0.36, rx: 0.17, ry: 0.44, w: 1.05 },
      { cx: 0.74, cy: 0.4, rx: 0.3, ry: 0.4, w: 1.2 },
      { cx: 0.58, cy: 0.74, rx: 0.22, ry: 0.18, w: 0.75 },
      { cx: 0.1, cy: 0.16, rx: 0.15, ry: 0.15, w: 0.6 }
    ];
    let d = 0;
    for (let i = 0; i < lobes.length; i++) {
      const L = lobes[i];
      const nx = (u - L.cx) / L.rx;
      const ny = (v - L.cy) / L.ry;
      d += Math.exp(-(nx * nx + ny * ny)) * L.w;
    }
    return Math.min(1, d * 0.82 + vnoise2(u * 8.2, v * 8.2) * 0.28);
  }

  function sampleMaskRaw(u, v) {
    if (u < -0.02 || v < -0.02 || u > 1.02 || v > 1.02) return 0;
    const uu = u < 0 ? 0 : u > 1 ? 1 : u;
    const vv = v < 0 ? 0 : v > 1 ? 1 : v;
    if (!dens) return proceduralLand(uu, vv);

    const x = uu * (densW - 1);
    const y = vv * (densH - 1);
    const x0 = x | 0;
    const y0 = y | 0;
    const x1 = x0 + 1 < densW ? x0 + 1 : x0;
    const y1 = y0 + 1 < densH ? y0 + 1 : y0;
    const fx = x - x0;
    const fy = y - y0;
    return lerp(
      lerp(dens[y0 * densW + x0], dens[y0 * densW + x1], fx),
      lerp(dens[y1 * densW + x0], dens[y1 * densW + x1], fx),
      fy
    );
  }

  function buildDensityField() {
    if (!maskData) {
      densW = 128;
      densH = 72;
      dens = new Float32Array(densW * densH);
      for (let j = 0; j < densH; j++) {
        for (let i = 0; i < densW; i++) {
          dens[j * densW + i] = proceduralLand(i / (densW - 1), j / (densH - 1));
        }
      }
      return;
    }

    densW = Math.min(180, maskW);
    densH = Math.max(1, Math.round((maskH / maskW) * densW));
    dens = new Float32Array(densW * densH);

    for (let j = 0; j < densH; j++) {
      const sy = Math.floor((j / (densH - 1 || 1)) * (maskH - 1));
      for (let i = 0; i < densW; i++) {
        const sx = Math.floor((i / (densW - 1 || 1)) * (maskW - 1));
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = sy + dy;
          if (yy < 0 || yy >= maskH) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = sx + dx;
            if (xx < 0 || xx >= maskW) continue;
            sum += maskData[(yy * maskW + xx) * 4] > 128 ? 1 : 0;
            n++;
          }
        }
        dens[j * densW + i] = n ? sum / n : 0;
      }
    }
  }

  function ensureOff() {
    if (off.width !== w || off.height !== h) {
      off.width = Math.max(1, w);
      off.height = Math.max(1, h);
      offCtx = off.getContext("2d", { alpha: false });
      offCtx.imageSmoothingEnabled = false;
    }
  }

  function buildGrid() {
    const isMobile = w <= 768;
    // Mobile: finer dots (was pitch 10 = chunky bricks)
    if (isMobile) {
      pitch = w < 400 ? 4.25 : 5;
    } else if (w < 900) {
      pitch = 7;
    } else if (w < 1400) {
      pitch = 5.5;
    } else {
      pitch = 5;
    }
    size = Math.max(2, Math.round(pitch * (isMobile ? 0.58 : 0.62)));
    gap = pitch - size;

    cols = Math.ceil(w / pitch);
    rows = Math.ceil(h / pitch);
    const n = cols * rows;
    hashes = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      hashes[k] = hash2(k % cols, (k / cols) | 0);
    }

    const mw = densW || 128;
    const mh = densH || 72;
    // Mobile: fill most of the tall viewport (was half-screen + black void)
    let cover;
    if (isMobile) {
      const fitH = h / mh;
      const fitW = w / mw;
      cover = Math.max(fitW * 1.15, fitH * 1.05);
    } else {
      cover = Math.max(w / mw, h / mh) * 1.08;
    }
    mapW = mw * cover;
    mapH = mh * cover;
    mapOx = (w - mapW) * 0.5;
    mapOy = isMobile ? (h - mapH) * 0.5 : (h - mapH) * 0.36;

    ensureOff();
    imgData = offCtx.createImageData(Math.max(1, w), Math.max(1, h));
    pix = imgData.data;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, w <= 768 ? 1.35 : 1.75);
    w = window.innerWidth | 0;
    h = window.innerHeight | 0;

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    buildGrid();
  }

  function heroClear(nx, ny) {
    // Mobile hero is stacked full-width — lighter fade so bottom stays filled
    if (w <= 768) {
      const dx = (nx - 0.5) / 0.55;
      const dy = (ny - 0.22) / 0.28;
      return Math.min(1, Math.exp(-(dx * dx + dy * dy))) * 0.55;
    }
    const dx = (nx - 0.28) / 0.34;
    const dy = (ny - 0.48) / 0.4;
    return Math.min(1, Math.exp(-(dx * dx + dy * dy)));
  }

  function waveWarp(u, v, t) {
    // Traveling diagonal waves → land outline flows like water
    const ph1 = u * WAVE_FX + v * WAVE_FY - t * WAVE_SPEED;
    const ph2 = u * (-WAVE_FY * 0.7) + v * WAVE_FX * 0.55 - t * WAVE_SPEED * 0.62;
    const w1 = Math.sin(ph1);
    const w2 = Math.sin(ph2 + 1.1);
    const n =
      (vnoise3(u * 2.4, v * 2.4, t * 0.08) * 2 - 1) * NOISE_AMP;
    return {
      u: u + WAVE_AMP * w1 + WAVE_AMP * 0.45 * w2 + n,
      v: v + WAVE_AMP * 0.85 * Math.cos(ph1 * 0.9 + 0.4) + WAVE_AMP * 0.35 * w2 + n * 0.7
    };
  }

  function sampleField(u, v, t) {
    const wuv = waveWarp(u, v, t);
    let land = sampleMaskRaw(wuv.u, wuv.v);
    if (land <= 0.04) return 0;

    // Soft interior carve — also wave-shifted so holes drift with the swell
    const carve = vnoise3(wuv.u * 3.2, wuv.v * 3.2, t * 0.12);
    const carve2 = vnoise3(wuv.u * 7.5 + 20, wuv.v * 7.5, t * 0.18);
    land *= 0.35 + carve * 0.5 + carve2 * 0.25;
    land = Math.max(
      0,
      Math.min(1, land + vnoise3(wuv.u * 14, wuv.v * 14, t * 0.15) * 0.1 - 0.03)
    );
    return land;
  }

  function mintField(u, v, t) {
    // Rare sparse patches only — high threshold later
    const zt = t * MINT_SPEED;
    const wuv = waveWarp(u, v, t);
    return (
      vnoise3(wuv.u * 2.2 + 200, wuv.v * 2.2, zt) * 0.55 +
      vnoise3(wuv.u * 6.4 + 50, wuv.v * 6.4, zt * 1.05) * 0.45
    );
  }

  function grayShade(bright, hv) {
    // Ladder of grays as the visual accent (not mint)
    let a;
    let b;
    let t;
    if (bright < 0.45) {
      a = GRAY_LO;
      b = GRAY_MID;
      t = bright / 0.45;
    } else {
      a = GRAY_MID;
      b = GRAY_HI;
      t = (bright - 0.45) / 0.55;
    }
    t = Math.max(0, Math.min(1, t + (hv - 0.5) * 0.12));
    return [
      (a[0] + (b[0] - a[0]) * t) | 0,
      (a[1] + (b[1] - a[1]) * t) | 0,
      (a[2] + (b[2] - a[2]) * t) | 0
    ];
  }

  function fillSquare(px, py, s, r, g, b) {
    const W = imgData.width;
    const H = imgData.height;
    const x0 = px | 0;
    const y0 = py | 0;
    const x1 = Math.min(W, x0 + s);
    const y1 = Math.min(H, y0 + s);
    if (x0 >= W || y0 >= H || x1 <= 0 || y1 <= 0) return;

    for (let y = Math.max(0, y0); y < y1; y++) {
      let o = (y * W + Math.max(0, x0)) * 4;
      for (let x = Math.max(0, x0); x < x1; x++) {
        pix[o] = r;
        pix[o + 1] = g;
        pix[o + 2] = b;
        pix[o + 3] = 255;
        o += 4;
      }
    }
  }

  function clearBuffer() {
    pix.fill(0);
    for (let i = 3; i < pix.length; i += 4) pix[i] = 255;
  }

  function drawVignette() {
    const isMobile = w <= 768;
    const vg = ctx.createRadialGradient(
      w * 0.55,
      h * (isMobile ? 0.45 : 0.4),
      Math.min(w, h) * 0.1,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * (isMobile ? 0.95 : 0.78)
    );
    vg.addColorStop(0, "rgba(0,0,0,0.04)");
    vg.addColorStop(0.5, "rgba(0,0,0,0.1)");
    vg.addColorStop(0.82, isMobile ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.52)");
    vg.addColorStop(1, isMobile ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.9)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    if (!isMobile) {
      const left = ctx.createLinearGradient(0, 0, w * 0.48, 0);
      left.addColorStop(0, "rgba(0,0,0,0.58)");
      left.addColorStop(0.55, "rgba(0,0,0,0.14)");
      left.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = left;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function drawFrame(t) {
    if (!hashes || !imgData) return;

    clearBuffer();

    const n = cols * rows;
    const s = size;
    const invMapW = 1 / mapW;
    const invMapH = 1 / mapH;
    const driftU = reduce ? 0 : t * DRIFT_SPEED * 0.035;
    const driftV = reduce ? 0 : Math.sin(t * DRIFT_SPEED * 0.9) * 0.025;
    const half = s * 0.5;

    for (let k = 0; k < n; k++) {
      const i = k % cols;
      const j = (k / cols) | 0;
      const sx = i * pitch + gap * 0.5;
      const sy = j * pitch + gap * 0.5;
      const cx = sx + half;
      const cy = sy + half;

      const u = (cx - mapOx) * invMapW + driftU;
      const v = (cy - mapOy) * invMapH + driftV;

      const land = sampleField(u, v, t);
      if (land < DENSITY_THRESH - EDGE_SOFT) continue;

      let densVal = (land - (DENSITY_THRESH - EDGE_SOFT)) / (EDGE_SOFT + (1 - DENSITY_THRESH));
      densVal = densVal < 0 ? 0 : densVal > 1 ? 1 : densVal;
      densVal *= densVal;

      densVal *= 1 - heroClear(cx / w, cy / h) * 0.88;
      if (densVal < 0.07) continue;

      const hv = hashes[k];
      // Sparse fill — Trae density, not solid continents
      if (hv > densVal * 0.72 + 0.12) continue;

      // Gray variance follows the wave swell slightly → readable motion in tone
      const swell = 0.5 + 0.5 * Math.sin(u * WAVE_FX + v * WAVE_FY - t * WAVE_SPEED);
      const bright = 0.22 + densVal * 0.55 + hv * 0.18 + swell * 0.12;
      let rgb = grayShade(bright, hv);

      // Rare mint (~1–3% of lit cells)
      if (densVal > 0.35 && hv > 0.82 && mintField(u, v, t) > MINT_THRESH) {
        const a = 0.55 + densVal * 0.35;
        rgb = [
          (rgb[0] * (1 - a) + MINT[0] * a) | 0,
          (rgb[1] * (1 - a) + MINT[1] * a) | 0,
          (rgb[2] * (1 - a) + MINT[2] * a) | 0
        ];
      }

      fillSquare(sx, sy, s, rgb[0], rgb[1], rgb[2]);
    }

    offCtx.putImageData(imgData, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0);
    drawVignette();
  }

  function frame(now) {
    if (!running) {
      raf = 0;
      return;
    }

    const rawDt = Math.min(0.08, (now - last) / 1000);
    last = now;
    acc += rawDt;

    if (acc >= TARGET_DT || reduce) {
      acc = 0;
      const t = reduce ? 0 : (now - t0) / 1000;
      drawFrame(t);
      if (reduce) {
        raf = 0;
        return;
      }
    }

    raf = requestAnimationFrame(frame);
  }

  function startLoop() {
    cancelAnimationFrame(raf);
    t0 = performance.now();
    last = t0;
    acc = TARGET_DT;
    running = !document.hidden;
    if (running && !reduce) raf = requestAnimationFrame(frame);
    else drawFrame(0);
  }

  function onReady() {
    buildDensityField();
    maskReady = true;
    resize();
    startLoop();
  }

  function onMaskLoad() {
    maskW = maskImg.naturalWidth;
    maskH = maskImg.naturalHeight;
    maskCanvas.width = maskW;
    maskCanvas.height = maskH;
    maskCtx.drawImage(maskImg, 0, 0);
    maskData = maskCtx.getImageData(0, 0, maskW, maskH).data;
    onReady();
  }

  window.addEventListener("resize", () => {
    resize();
    if (reduce || document.hidden) {
      drawFrame(reduce ? 0 : (performance.now() - t0) / 1000);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!reduce && maskReady) {
      running = true;
      last = performance.now();
      acc = TARGET_DT;
      if (!raf) raf = requestAnimationFrame(frame);
    }
  });

  maskImg.decoding = "async";
  maskImg.onload = onMaskLoad;
  maskImg.onerror = () => {
    console.warn("[bg] world-mask missing — procedural lobes");
    maskData = null;
    onReady();
  };
  maskImg.src = assetUrl("world-mask.png");
})();
