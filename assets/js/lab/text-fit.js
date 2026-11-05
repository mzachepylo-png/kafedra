// Підписи на полотнах не виходять за межі полотна (вузькі екрани телефонів): текст зсувається вбік рівно настільки, щоб поміститись.
const ft = CanvasRenderingContext2D.prototype.fillText;
CanvasRenderingContext2D.prototype.fillText = function (s, x, y, mw) {
  const tr = this.getTransform();
  if (!tr.b && !tr.c && tr.a > 0 && this.canvas && this.canvas.width > 40) {
    const wd = this.measureText(s).width * tr.a, pad = 2 * tr.a, a = this.textAlign;
    const l = tr.e + (a === 'center' ? x - wd / tr.a / 2 : (a === 'right' || a === 'end') ? x - wd / tr.a : x) * tr.a;
    let dx = 0;
    if (l + wd > this.canvas.width - pad) dx = this.canvas.width - pad - (l + wd);
    if (l + dx < pad) dx = pad - l;
    x += dx / tr.a;
  }
  return mw === undefined ? ft.call(this, s, x, y) : ft.call(this, s, x, y, mw);
};
