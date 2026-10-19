import { INPUT_MULTIPLE } from "./constants.js";

/**
 * 将各类位图对象转换为灰度 Uint8Array。
 * 强制预填纯白色背景，防止透明 PNG/PDF 在无背景时变黑。
 */
export const toGray = (img) => {
  const iw = img.naturalWidth ?? img.width, ih = img.naturalHeight ?? img.height;
  const c = new OffscreenCanvas(iw, ih);
  const x = c.getContext("2d", { willReadFrequently: true });
  x.fillStyle = "#ffffff";
  x.fillRect(0, 0, iw, ih);
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, iw, ih).data;
  const g = new Uint8Array(iw * ih);
  for (let i = 0, p = 0; i < g.length; i++, p += 4)
    g[i] = (d[p] * 299 + d[p + 1] * 587 + d[p + 2] * 114) / 1000 | 0;
  return { g, w: iw, h: ih };
};

/* 与 cv2.INTER_AREA / INTER_LINEAR 对齐的缩放。
   canvas 的 imageSmoothing 只是近似，边界几个像素的差异就足以让检测框的均值偏移亚像素，
   进而让小字行的裁剪高度差 2px、识别结果翻转，所以这里按 OpenCV 的算法自己算。
   Python 侧：page_to_input 与 crop_line 都是缩小用 AREA、放大用 LINEAR。 */
export function resizeArea(g, w, h, nw, nh) {
  const sx = w / nw;
  const span = [];
  for (let x = 0; x < w; x++) {
    const d0 = x / sx, d1 = (x + 1) / sx;
    const i0 = Math.floor(d0), i1 = Math.min(w, Math.ceil(d1));
    const list = [];
    for (let i = i0; i < i1; i++) {
      const wt = Math.min(i + 1, d1) - Math.max(i, d0);
      if (wt > 0) list.push(i, wt);
    }
    span.push(list);
  }
  const colW = new Float64Array(nw);
  for (const list of span) for (let k = 0; k < list.length; k += 2) colW[list[k]] += list[k + 1];

  const tmp = new Float64Array(h * nw);
  for (let y = 0; y < h; y++) {
    const srow = y * w, orow = y * nw;
    for (let x = 0; x < w; x++) {
      const v = g[srow + x];
      const list = span[x];
      for (let k = 0; k < list.length; k += 2) tmp[orow + list[k]] += v * list[k + 1];
    }
    for (let i = 0; i < nw; i++) { const d = colW[i]; if (d > 0) tmp[orow + i] /= d; }
  }

  const sy = h / nh, out = new Uint8Array(nw * nh);
  const acc = new Float64Array(nw);
  for (let j = 0; j < nh; j++) {
    const d0 = j * sy, d1 = (j + 1) * sy;
    const j0 = Math.floor(d0), j1 = Math.min(h, Math.ceil(d1));
    acc.fill(0);
    let wsum = 0;
    for (let y = j0; y < j1; y++) {
      const wt = Math.min(y + 1, d1) - Math.max(y, d0);
      if (wt <= 0) continue;
      wsum += wt;
      const orow = y * nw;
      for (let i = 0; i < nw; i++) acc[i] += tmp[orow + i] * wt;
    }
    for (let i = 0; i < nw; i++) out[j * nw + i] = wsum > 0 ? Math.round(acc[i] / wsum) : 0;
  }
  return out;
}

export function resizeLinear(g, w, h, nw, nh) {
  const o = new Uint8Array(nw * nh);
  const sx = w / nw, sy = h / nh;
  for (let y = 0; y < nh; y++) {
    const fy = Math.max(0, Math.min(h - 1, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(h - 1, y0 + 1), wy = fy - y0;
    for (let x = 0; x < nw; x++) {
      const fx = Math.max(0, Math.min(w - 1, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(w - 1, x0 + 1), wx = fx - x0;
      const a = g[y0 * w + x0] * (1 - wx) + g[y0 * w + x1] * wx;
      const b = g[y1 * w + x0] * (1 - wx) + g[y1 * w + x1] * wx;
      o[y * nw + x] = Math.round(a * (1 - wy) + b * wy);
    }
  }
  return o;
}

export function resizeGray(g, w, h, nw, nh) {
  return nw * nh < w * h ? resizeArea(g, w, h, nw, nh) : resizeLinear(g, w, h, nw, nh);
}

/**
 * 整页灰度图转换为检测输入张量（长边 longSide，补齐为 32 的倍数）
 */
export function pageToInput(g, w, h, longSide) {
  const scale = longSide / Math.max(h, w);
  const nh = Math.max(1, Math.round(h * scale)), nw = Math.max(1, Math.round(w * scale));
  const ph = Math.ceil(nh / INPUT_MULTIPLE) * INPUT_MULTIPLE;
  const pw = Math.ceil(nw / INPUT_MULTIPLE) * INPUT_MULTIPLE;
  const small = (nh === h && nw === w) ? g : resizeGray(g, w, h, nw, nh);
  const x = new Float32Array(ph * pw);
  for (let r = 0; r < nh; r++) for (let c = 0; c < nw; c++) x[r * pw + c] = 1 - small[r * nw + c] / 255;
  return { x, dims: [1, 1, ph, pw], scale };
}
