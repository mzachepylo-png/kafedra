// Обробка експериментальних даних: лінійна регресія, поліном 2-го степеня,
// нелінійний метод найменших квадратів (Левенберга–Марквардта).

/** y = a + b·x. Повертає { a, b, r2, sa, sb, n }. */
export function linreg(xs, ys) {
  const n = xs.length;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; }
  const mx = sx / n, my = sy / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
  }
  const b = sxy / sxx, a = my - b * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) { const e = ys[i] - a - b * xs[i]; sse += e * e; }
  const s2 = n > 2 ? sse / (n - 2) : NaN;
  return { a, b, r2: syy > 0 ? 1 - sse / syy : 1, sb: Math.sqrt(s2 / sxx), sa: Math.sqrt(s2 * (1 / n + mx * mx / sxx)), n };
}

/** y = c0 + c1·x + c2·x² методом найменших квадратів. */
export function quadfit(xs, ys) {
  const S = new Array(5).fill(0), T = [0, 0, 0];
  for (let i = 0; i < xs.length; i++) {
    let p = 1;
    for (let k = 0; k < 5; k++) { S[k] += p; if (k < 3) T[k] += p * ys[i]; p *= xs[i]; }
  }
  const A = [[S[0], S[1], S[2]], [S[1], S[2], S[3]], [S[2], S[3], S[4]]];
  const c = solve(A, T);
  const my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let sse = 0, sst = 0;
  xs.forEach((x, i) => { const e = ys[i] - (c[0] + c[1] * x + c[2] * x * x); sse += e * e; sst += (ys[i] - my) ** 2; });
  return { c, r2: 1 - sse / sst };
}

/** Розв'язання лінійної системи методом Гаусса з вибором головного елемента. */
export function solve(A, b) {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-300) return new Array(n).fill(NaN);
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

/**
 * Нелінійна апроксимація f(x, p) методом Левенберга–Марквардта.
 * Повертає { p, sse, iter, se } (se — стандартні похибки параметрів).
 */
export function lm(f, xs, ys, p0, { maxIter = 200, tol = 1e-10 } = {}) {
  let p = p0.slice();
  const n = xs.length, k = p.length;
  const resid = (pp) => xs.map((x, i) => ys[i] - f(x, pp));
  let r = resid(p);
  let sse = r.reduce((s, v) => s + v * v, 0);
  let lambda = 1e-3, iter = 0, JtJ = null;
  for (; iter < maxIter; iter++) {
    // якобіан чисельно
    const J = xs.map(() => new Array(k));
    for (let j = 0; j < k; j++) {
      const h = Math.max(Math.abs(p[j]) * 1e-6, 1e-9);
      const pp = p.slice(); pp[j] += h;
      for (let i = 0; i < n; i++) J[i][j] = (f(xs[i], pp) - f(xs[i], p)) / h;
    }
    JtJ = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, b) => J.reduce((s, row) => s + row[a] * row[b], 0)));
    const Jtr = Array.from({ length: k }, (_, a) => J.reduce((s, row, i) => s + row[a] * r[i], 0));
    let improved = false;
    for (let t = 0; t < 12; t++) {
      const A = JtJ.map((row, a) => row.map((v, b) => (a === b ? v * (1 + lambda) : v)));
      const dp = solve(A, Jtr);
      const pn = p.map((v, j) => v + dp[j]);
      const rn = resid(pn);
      const sn = rn.reduce((s, v) => s + v * v, 0);
      if (isFinite(sn) && sn < sse) {
        const rel = (sse - sn) / Math.max(sse, 1e-300);
        p = pn; r = rn; sse = sn; lambda = Math.max(lambda / 10, 1e-12); improved = true;
        if (rel < tol) iter = maxIter;
        break;
      }
      lambda *= 10;
    }
    if (!improved) break;
  }
  let se = new Array(k).fill(NaN);
  if (JtJ && n > k) {
    const s2 = sse / (n - k);
    se = se.map((_, j) => {
      const e = new Array(k).fill(0); e[j] = 1;
      const col = solve(JtJ, e);
      return Math.sqrt(Math.abs(col[j]) * s2);
    });
  }
  return { p, sse, iter, se };
}

/** Метод Рунге–Кутти 4-го порядку для системи y' = f(t, y). */
export function rk4(f, y0, t0, t1, steps) {
  const h = (t1 - t0) / steps;
  const out = [[t0, ...y0]];
  let y = y0.slice(), t = t0;
  const add = (a, b, s) => a.map((v, i) => v + b[i] * s);
  for (let i = 0; i < steps; i++) {
    const k1 = f(t, y);
    const k2 = f(t + h / 2, add(y, k1, h / 2));
    const k3 = f(t + h / 2, add(y, k2, h / 2));
    const k4 = f(t + h, add(y, k3, h));
    y = y.map((v, j) => Math.max(0, v + h / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])));
    t += h;
    out.push([t, ...y]);
  }
  return out;
}
