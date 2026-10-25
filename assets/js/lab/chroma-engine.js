// Модель хроматографічної колонки: міграція зон за умов елюювання, що змінюються в часі та вздовж колонки,
// розмивання за рівнянням Ван-Деемтера, хроматограма детектора.
import { diffusion, SEC_VP_V0 } from './chroma-data.js';

/** Зведена висота тарілки h = a + b/ν + c·ν (ν = u·d_p/D_m — зведена швидкість). */
export const H_DEFAULT = { a: 1, b: 2, c: 0.1 };
export function plateHeight(u, dpMm, Dm, h = H_DEFAULT, cf = 1) {
  const nu = u * dpMm / Dm;
  return { H: dpMm * (h.a + h.b / nu + h.c * cf * nu), A: dpMm * h.a, B: dpMm * h.b / nu, C: dpMm * h.c * cf * nu, nu };
}
// Гель-фільтрація: масообмін у порах є лише для молекул, що в них входять
const secCf = (k) => 0.15 + 3.2 * k / (1 + k) ** 2;

/** Програма елюенту: значення умови в момент τ від введення проби. */
export function program(preset, st, t0) {
  const c = preset.cond;
  if (preset.column.step) {
    const ts = 5 * t0;
    return { at: (tau) => (tau < ts ? st.v : st.v2), tStep: ts, kind: 'step' };
  }
  if (st.grad && st.grad.on && c.grad) {
    const tg = st.grad.tg * 60, v0 = st.v, v1 = st.grad.end;
    return { at: (tau) => (tau <= 0 ? v0 : tau >= tg ? v1 : v0 + (v1 - v0) * tau / tg), tg, kind: 'grad' };
  }
  return { at: () => st.v, kind: 'iso' };
}

function erfc(x) {
  // Абрамовіц–Стіган 7.1.26, похибка < 1,5·10⁻⁷
  const z = Math.abs(x), t = 1 / (1 + 0.3275911 * z);
  const y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-z * z);
  return x >= 0 ? y : 2 - y;
}

/** Пік: гаусіан або експоненційно модифікований гаусіан (хвіст при перевантаженні колонки). */
export function peak(t, tR, s, tau) {
  if (tau < s * 0.05) return Math.exp(-0.5 * ((t - tR) / s) ** 2) / (s * 2.5066283);
  const z = (s / tau - (t - tR) / s) / Math.SQRT2;
  if (z > 5) {
    // асимптотика erfc(z) ≈ e^(−z²)/(z√π)·(1 − 1/2z²), щоб уникнути переповнення exp·erfc
    return Math.exp(-0.5 * ((t - tR) / s) ** 2) * (1 - 0.5 / (z * z)) / (z * 1.7724539 * 2 * tau);
  }
  return Math.exp((s * s) / (2 * tau * tau) - (t - tR) / tau) * erfc(z) / (2 * tau);
}

/**
 * st: { v, v2, grad: {on, end, tg}, u, L, dp, load }
 * Повертає зони (час виходу, ширина), кадри для анімації, хроматограму.
 */
export function simulate(preset, st) {
  const col = preset.column, L = st.L, u = st.u, dp = st.dp / 1000;
  const t0 = L / u;
  const prog = program(preset, st, t0);
  const uniform = !!preset.cond.uniform;
  const comps = preset.comps;
  const n = comps.length;
  const kf = preset.k;
  const Hs = comps.map((c) => plateHeight(u, dp, c.M ? diffusion(c.M) : (col.Dm || 1e-3), col.h).H);
  if (col.sec) comps.forEach((c, i) => { Hs[i] = plateHeight(u, dp, diffusion(c.M), col.h, secCf(Math.max(0, kf(c, st.v)))).H; });
  const x = new Float64Array(n), s2 = new Float64Array(n).fill((0.004 * L) ** 2);
  const out = comps.map(() => null);
  const dt = t0 / 200;
  const tMaxProg = prog.kind === 'grad' ? prog.tg : prog.kind === 'step' ? prog.tStep : 0;
  const tMax = Math.max(60 * t0, tMaxProg + 25 * t0);
  const frameDt = t0 / 30;
  const frames = []; // [t, x0, σ0, x1, σ1, …]
  let t = 0, left = n, nextFrame = 0;
  const pushFrame = () => {
    const f = new Float32Array(1 + 2 * n);
    f[0] = t;
    for (let i = 0; i < n; i++) { f[1 + 2 * i] = out[i] ? L * 1.2 : x[i]; f[2 + 2 * i] = Math.sqrt(s2[i]); }
    frames.push(f);
  };
  pushFrame(); nextFrame = frameDt;
  while (left > 0 && t < tMax) {
    t += dt;
    for (let i = 0; i < n; i++) {
      if (out[i]) continue;
      const v = uniform ? prog.at(t) : prog.at(t - x[i] / u);
      const v2 = prog.kind === 'step' ? undefined : st.v2;
      const k = Math.max(0, kf(comps[i], v, v2));
      const vel = u / (1 + k);
      const dx = vel * dt;
      if (x[i] + dx >= L) {
        const frac = (L - x[i]) / dx;
        s2[i] += Hs[i] * (L - x[i]);
        const tR = t - dt + frac * dt;
        const sig = Math.sqrt(s2[i]) / vel;
        out[i] = { tR, sig, kExit: k, vExit: vel };
        left--;
      } else { x[i] += dx; s2[i] += Hs[i] * dx; }
    }
    if (t >= nextFrame) { pushFrame(); nextFrame += frameDt; }
  }
  pushFrame();
  const load = st.load || 1;
  const zones = comps.map((c, i) => {
    const o = out[i];
    if (!o) return { c, i, eluted: false, xEnd: x[i] };
    const kApp = (o.tR - t0) / t0;
    const tau = o.sig * 0.45 * (load - 1) * (o.kExit / (1 + o.kExit));
    return { c, i, eluted: true, tR: o.tR, sig: o.sig, tau, kApp, kExit: o.kExit, N: (o.tR / o.sig) ** 2, amt: (c.amt ?? 1) * load, H: Hs[i] };
  });
  // роздільна здатність сусідніх піків
  const el = zones.filter((z) => z.eluted).sort((a, b) => a.tR - b.tR);
  el.forEach((z, j) => {
    const p = el[j - 1];
    z.Rs = p ? (z.tR + z.tau - p.tR - p.tau) / (2 * (Math.hypot(z.sig, z.tau) + Math.hypot(p.sig, p.tau))) : null;
    z.order = j;
  });
  const last = el.length ? el[el.length - 1] : null;
  let tEnd = last ? last.tR + 4 * last.sig + 3 * last.tau : 2 * t0;
  if (zones.some((z) => !z.eluted)) tEnd = Math.max(tEnd, Math.min(t, tMax));
  tEnd = Math.max(tEnd, 1.6 * t0, prog.kind === 'step' ? prog.tStep + 3 * t0 : 0);
  // хроматограма
  const NP = 900, ts = new Float64Array(NP), ys = new Float64Array(NP), parts = el.map(() => new Float64Array(NP));
  for (let p = 0; p < NP; p++) {
    const tt = tEnd * p / (NP - 1);
    ts[p] = tt;
    let y = 0;
    el.forEach((z, j) => { const v = z.amt * peak(tt, z.tR, z.sig, z.tau); parts[j][p] = v; y += v; });
    ys[p] = y;
  }
  const yMax = Math.max(...ys, 1e-12);
  const Rmin = el.reduce((m, z) => (z.Rs != null && z.Rs < m ? z.Rs : m), Infinity);
  return { t0, L, u, prog, zones, el, frames, frameDt, ts, ys, parts, yMax, tEnd, Rmin, Hcol: Hs.reduce((a, b) => a + b, 0) / n, secVp: SEC_VP_V0 };
}
