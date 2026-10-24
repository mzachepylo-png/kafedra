// Легка бібліотека графіків на Canvas: лінії, точки, заливка, сітка з «гарними» поділками,
// HiDPI, адаптивний розмір, перехрестя з підказкою. Без залежностей.

const FONT = '12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const COLORS = { axis: '#46584C', grid: '#E3EBE3', text: '#46584C', label: '#13241A' };

export function niceStep(range, target) {
  const raw = range / Math.max(1, target);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

export function niceTicks(min, max, target = 6) {
  if (!(max > min)) { max = min + 1; }
  const step = niceStep(max - min, target);
  const start = Math.ceil(min / step - 1e-9) * step;
  const ticks = [];
  for (let v = start; v <= max + step * 1e-9; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return { ticks, step };
}

export function fmt(v, step) {
  if (!isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(1).replace('.', ',');
  const d = step ? Math.max(0, Math.min(6, -Math.floor(Math.log10(step) + 1e-9))) : (a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3);
  return v.toFixed(d).replace('.', ',').replace('-', '−');
}

function extent(series, key, includeZero) {
  let lo = Infinity, hi = -Infinity;
  for (const s of series) {
    if (s.ignoreExtent) continue;
    for (const p of s.data) {
      const v = p[key];
      if (isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
    }
  }
  if (!isFinite(lo)) { lo = 0; hi = 1; }
  if (includeZero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (hi - lo < 1e-12) { hi = lo + (Math.abs(lo) || 1); }
  return [lo, hi];
}

export class Plot {
  /**
   * @param {HTMLElement} host контейнер (.plot)
   * @param {object} o опції: xLabel, yLabel, x: [min,max] | 'auto', y: [min,max] | 'auto',
   *   yZero (включити 0), title, aspect (ширина/висота), xFmt, yFmt
   */
  constructor(host, o = {}) {
    this.host = host;
    this.o = Object.assign({ xLabel: '', yLabel: '', x: 'auto', y: 'auto', yZero: true, xZero: false, aspect: 1.6 }, o);
    this.series = [];
    this.guides = [];
    host.classList.add('plot');
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', o.ariaLabel || `Графік: ${this.o.yLabel} від ${this.o.xLabel}`);
    this.tip = document.createElement('div');
    this.tip.className = 'plot__tip';
    this.tip.hidden = true;
    this.legend = document.createElement('div');
    this.legend.className = 'plot__legend';
    host.append(this.canvas, this.tip, this.legend);
    this.ctx = this.canvas.getContext('2d');

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.canvas.addEventListener('pointermove', (e) => this.hover(e));
    this.canvas.addEventListener('pointerleave', () => { this.hoverX = null; this.tip.hidden = true; this.draw(); });
  }

  setOptions(o) { Object.assign(this.o, o); this.draw(); }

  /** series: [{data: [[x,y],...], color, width, dash, fill, type: 'line'|'points'|'step', label, r}] */
  set(series, guides = []) {
    this.series = series.filter(Boolean);
    this.guides = guides;
    this.renderLegend();
    this.draw();
  }

  renderLegend() {
    const items = this.series.filter((s) => s.label);
    this.legend.replaceChildren(...items.map((s) => {
      const el = document.createElement('span');
      const sw = document.createElement('i');
      sw.style.background = s.type === 'points' ? 'transparent' : s.color;
      sw.style.borderColor = s.color;
      if (s.type === 'points') sw.className = 'is-dot';
      if (s.dash) sw.className = 'is-dash';
      el.append(sw, document.createTextNode(s.label));
      return el;
    }));
    this.legend.hidden = items.length === 0;
  }

  resize() {
    const w = this.host.clientWidth;
    if (!w) return;
    const h = Math.round(Math.min(Math.max(w / this.o.aspect, 220), 520));
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.w = w; this.h = h;
    this.canvas.style.height = h + 'px';
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  domain() {
    const o = this.o;
    let [x0, x1] = o.x === 'auto' ? extent(this.series, 0, o.xZero) : o.x;
    let [y0, y1] = o.y === 'auto' ? extent(this.series, 1, o.yZero) : o.y;
    if (o.y === 'auto') {
      const pad = (y1 - y0) * 0.08;
      if (y1 > 0 || !o.yZero) y1 += pad;
      if (y0 < 0) y0 -= pad;
      if (o.yMaxCap !== undefined) y1 = Math.min(y1, o.yMaxCap);
    }
    const xt = niceTicks(x0, x1, Math.max(3, Math.round((this.w || 500) / 90)));
    const yt = niceTicks(y0, y1, Math.max(3, Math.round((this.h || 300) / 55)));
    if (o.y === 'auto') { y0 = Math.min(y0, yt.ticks[0]); y1 = Math.max(y1, yt.ticks[yt.ticks.length - 1]); }
    return { x0, x1, y0, y1, xt, yt };
  }

  draw() {
    const ctx = this.ctx, w = this.w, h = this.h;
    if (!w) return;
    const d = this.domain();
    this.d = d;
    ctx.clearRect(0, 0, w, h);
    ctx.font = FONT;

    const yLabW = Math.max(...d.yt.ticks.map((t) => ctx.measureText((this.o.yFmt || fmt)(t, d.yt.step)).width), 20);
    const m = { l: yLabW + (this.o.yLabel ? 30 : 14), r: 14, t: 14, b: this.o.xLabel ? 46 : 28 };
    this.m = m;
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const X = (v) => m.l + (v - d.x0) / (d.x1 - d.x0) * pw;
    const Y = (v) => m.t + ph - (v - d.y0) / (d.y1 - d.y0) * ph;
    this.X = X; this.Y = Y;
    this.invX = (px) => d.x0 + (px - m.l) / pw * (d.x1 - d.x0);

    // сітка
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1; ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const t of d.yt.ticks) {
      if (t < d.y0 - 1e-12 || t > d.y1 + 1e-12) continue;
      const y = Math.round(Y(t)) + 0.5;
      ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(m.l + pw, y); ctx.stroke();
      ctx.fillText((this.o.yFmt || fmt)(t, d.yt.step), m.l - 6, y);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const t of d.xt.ticks) {
      if (t < d.x0 - 1e-12 || t > d.x1 + 1e-12) continue;
      const x = Math.round(X(t)) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, m.t + ph); ctx.stroke();
      ctx.fillText((this.o.xFmt || fmt)(t, d.xt.step), x, m.t + ph + 6);
    }

    // осі (нульові лінії)
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.2;
    ctx.beginPath();
    const y0px = d.y0 <= 0 && d.y1 >= 0 ? Y(0) : m.t + ph;
    ctx.moveTo(m.l, Math.round(y0px) + 0.5); ctx.lineTo(m.l + pw, Math.round(y0px) + 0.5);
    const x0px = d.x0 <= 0 && d.x1 >= 0 ? X(0) : m.l;
    ctx.moveTo(Math.round(x0px) + 0.5, m.t); ctx.lineTo(Math.round(x0px) + 0.5, m.t + ph);
    ctx.stroke();

    // підписи осей
    ctx.fillStyle = COLORS.label; ctx.font = '600 12.5px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    if (this.o.xLabel) { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(this.o.xLabel, m.l + pw / 2, h - 4); }
    if (this.o.yLabel) {
      ctx.save(); ctx.translate(12, m.t + ph / 2); ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(this.o.yLabel, 0, 0); ctx.restore();
    }

    // область побудови
    ctx.save();
    ctx.beginPath(); ctx.rect(m.l, m.t - 2, pw, ph + 4); ctx.clip();

    for (const g of this.guides) {
      ctx.strokeStyle = g.color || '#B08A1E'; ctx.lineWidth = 1.2; ctx.setLineDash(g.dash || [5, 5]);
      ctx.beginPath();
      if (g.x !== undefined) { const x = X(g.x); ctx.moveTo(x, m.t); ctx.lineTo(x, m.t + ph); }
      if (g.y !== undefined) { const y = Y(g.y); ctx.moveTo(m.l, y); ctx.lineTo(m.l + pw, y); }
      ctx.stroke(); ctx.setLineDash([]);
      if (g.label) {
        ctx.font = '600 11.5px system-ui, sans-serif'; ctx.fillStyle = g.color || '#8C6A10';
        if (g.x !== undefined) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(g.label, X(g.x) + 4, m.t + 2); }
        else { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(g.label, m.l + pw - 4, Y(g.y) - 3); }
      }
    }

    for (const s of this.series) {
      const pts = s.data.filter((p) => isFinite(p[0]) && isFinite(p[1]));
      if (!pts.length) continue;
      if (s.type === 'points') {
        ctx.fillStyle = s.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        for (const p of pts) {
          ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), s.r || 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          if (s.errors && p[2]) {
            ctx.strokeStyle = s.color; ctx.lineWidth = 1.2; ctx.beginPath();
            ctx.moveTo(X(p[0]), Y(p[1] - p[2])); ctx.lineTo(X(p[0]), Y(p[1] + p[2])); ctx.stroke();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
          }
        }
        continue;
      }
      ctx.beginPath();
      pts.forEach((p, i) => {
        const x = X(p[0]), y = Y(Math.max(Math.min(p[1], d.y1 + (d.y1 - d.y0) * 4), d.y0 - (d.y1 - d.y0) * 4));
        if (i === 0) ctx.moveTo(x, y);
        else if (s.type === 'step') { ctx.lineTo(x, Y(pts[i - 1][1])); ctx.lineTo(x, y); }
        else ctx.lineTo(x, y);
      });
      if (s.fill) {
        ctx.save();
        const base = s.fillTo !== undefined ? Y(s.fillTo) : Y(Math.max(d.y0, 0));
        ctx.lineTo(X(pts[pts.length - 1][0]), base); ctx.lineTo(X(pts[0][0]), base); ctx.closePath();
        ctx.fillStyle = s.fill; ctx.fill(); ctx.restore();
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))));
      }
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.setLineDash(s.dash || []); ctx.stroke(); ctx.setLineDash([]);
    }

    // маркери
    for (const s of this.series) {
      if (!s.marker) continue;
      const [mx, my] = s.marker;
      ctx.fillStyle = s.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(X(mx), Y(my), 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // перехрестя
    if (this.hoverX !== null && this.hoverX !== undefined) {
      const x = X(this.hoverX);
      ctx.strokeStyle = 'rgba(19,36,26,.35)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, m.t + ph); ctx.stroke(); ctx.setLineDash([]);
      for (const hp of this.hoverPts || []) {
        ctx.fillStyle = hp.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(X(hp.x), Y(hp.y), 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  hover(e) {
    if (!this.d) return;
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const m = this.m;
    if (px < m.l || px > this.w - m.r || py < m.t || py > this.h - m.b) {
      this.hoverX = null; this.tip.hidden = true; this.draw(); return;
    }
    const xv = this.invX(px);
    const pts = [];
    for (const s of this.series) {
      if (!s.label || s.noHover) continue;
      const data = s.data.filter((p) => isFinite(p[0]) && isFinite(p[1]));
      if (!data.length) continue;
      if (s.type === 'points') {
        let best = null, bd = 14;
        for (const p of data) {
          const dd = Math.hypot(this.X(p[0]) - px, this.Y(p[1]) - py);
          if (dd < bd) { bd = dd; best = p; }
        }
        if (best) pts.push({ x: best[0], y: best[1], color: s.color, label: s.label, exact: true });
        continue;
      }
      // лінійна інтерполяція за x (дані відсортовані)
      if (xv < data[0][0] || xv > data[data.length - 1][0]) continue;
      let lo = 0, hi = data.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (data[mid][0] <= xv) lo = mid; else hi = mid; }
      const a = data[lo], b = data[hi];
      const t = b[0] === a[0] ? 0 : (xv - a[0]) / (b[0] - a[0]);
      pts.push({ x: xv, y: a[1] + t * (b[1] - a[1]), color: s.color, label: s.label });
    }
    this.hoverX = xv;
    this.hoverPts = pts;
    this.draw();
    if (!pts.length) { this.tip.hidden = true; return; }
    const xf = this.o.xFmt || fmt, yf = this.o.yFmt || fmt;
    const exact = pts.find((p) => p.exact);
    const head = `${this.o.xShort || 'x'} = ${xf(exact ? exact.x : xv, this.d.xt.step / 10)}`;
    this.tip.innerHTML = `<b>${head}</b>` + pts.map((p) =>
      `<span><i style="background:${p.color}"></i>${p.label}: ${yf(p.y, this.d.yt.step / 10)}</span>`).join('');
    this.tip.hidden = false;
    const tw = this.tip.offsetWidth, th = this.tip.offsetHeight;
    let left = px + 14; if (left + tw > this.w - 4) left = px - tw - 14;
    let top = py - th - 10; if (top < 4) top = py + 14;
    this.tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }
}

/** Рівномірна сітка значень. */
export function linspace(a, b, n) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = a + (b - a) * i / (n - 1);
  return out;
}

/** Побудова ряду [x, f(x)]. */
export function sample(f, a, b, n = 240) {
  return linspace(a, b, n).map((x) => [x, f(x)]);
}
