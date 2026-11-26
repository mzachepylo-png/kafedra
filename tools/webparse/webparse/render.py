"""Рендеринг сторінок у браузері (Playwright + Chromium) — для сайтів, де текст і графіки
будуються JavaScript: Highcharts, Chart.js, Plotly, ECharts, <canvas>, Datawrapper тощо.

Необов'язкова частина: потрібні `pip install playwright` і `playwright install chromium`.
Об'єкт Renderer треба створювати й використовувати в одному потоці (так вимагає Playwright).
"""
from __future__ import annotations

import glob
import os
from typing import Optional

from .fetch import UA

# елементи, які знімаємо як зображення (контейнер графіка, а не його внутрішні шари)
CHART_SELECTOR = ", ".join([
    "canvas", "svg", "iframe",
    ".highcharts-container", ".js-plotly-plot", "[_echarts_instance_]", ".apexcharts-canvas",
    ".amcharts-main-div", ".vega-embed", ".google-visualization-chart", ".recharts-wrapper",
])
CHART_HOSTS = ["datawrapper", "flourish", "infogram", "plotly", "tableau", "ourworldindata", "observablehq"]

MARK_JS = """
([selector, hosts, maxShots]) => {
  const out = [];
  const marked = new Set();
  let n = 0;
  for (const el of document.querySelectorAll(selector)) {
    if (n >= maxShots) break;
    let p = el.parentElement, inside = false;
    while (p) { if (marked.has(p)) { inside = true; break; } p = p.parentElement; }
    if (inside) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 120 || r.height < 80) continue;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || +st.opacity === 0) continue;
    if (el.tagName === 'IFRAME' && !hosts.some(h => (el.src || '').includes(h))) continue;
    if (el.tagName.toLowerCase() === 'svg' && el.closest('a, button, nav, header, footer')) continue;
    const id = 'wp' + (n++);
    el.setAttribute('data-wp-shot', id);
    marked.add(el);
    out.push(id);
  }
  return out;
}
"""

SCROLL_JS = """
async () => {
  const step = Math.max(400, innerHeight * 0.8);
  for (let y = 0; y < document.body.scrollHeight && y < 60000; y += step) {
    scrollTo(0, y);
    await new Promise(r => setTimeout(r, 120));
  }
  scrollTo(0, 0);
}
"""


def _chromium_path() -> Optional[str]:
    p = os.environ.get("WEBPARSE_CHROMIUM")
    if p and os.path.exists(p):
        return p
    for pat in ("/opt/pw-browsers/chromium-*/chrome-linux*/chrome",):
        hits = sorted(glob.glob(pat))
        if hits:
            return hits[-1]
    return None


def available() -> bool:
    try:
        import playwright.sync_api  # noqa: F401
        return True
    except ImportError:
        return False


class Renderer:
    def __init__(self, max_shots: int = 40, timeout_ms: int = 30000):
        from playwright.sync_api import sync_playwright
        self.max_shots = max_shots
        self.timeout = timeout_ms
        self._pw = sync_playwright().start()
        try:
            try:
                self._browser = self._pw.chromium.launch()
            except Exception:
                path = _chromium_path()
                if not path:
                    raise
                self._browser = self._pw.chromium.launch(executable_path=path)
            self._ctx = self._browser.new_context(user_agent=UA, device_scale_factor=2,
                                                  viewport={"width": 1280, "height": 900},
                                                  locale="uk-UA")
        except Exception:
            self._pw.stop()
            raise

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()

    def close(self) -> None:
        try:
            self._browser.close()
        finally:
            self._pw.stop()

    def render(self, url: str) -> tuple[str, str, dict[str, bytes]]:
        """Повертає (остаточна адреса, HTML після виконання JavaScript, знімки графіків)."""
        page = self._ctx.new_page()
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=self.timeout)
            try:
                page.wait_for_load_state("networkidle", timeout=10000)
            except Exception:
                pass
            page.evaluate(SCROLL_JS)  # «ліниві» зображення й графіки
            try:
                page.wait_for_load_state("networkidle", timeout=5000)
            except Exception:
                pass
            page.wait_for_timeout(800)  # анімації графіків
            ids = page.evaluate(MARK_JS, [CHART_SELECTOR, CHART_HOSTS, self.max_shots])
            shots: dict[str, bytes] = {}
            for i in ids:
                try:
                    shots[i] = page.locator(f'[data-wp-shot="{i}"]').first.screenshot(timeout=8000, animations="disabled")
                except Exception:
                    continue
            return page.url, page.content(), shots
        finally:
            page.close()

    def svg_to_png(self, svg: bytes) -> bytes:
        page = self._ctx.new_page()
        try:
            page.set_content("<html><body style='margin:0;background:#fff'>" + svg.decode("utf-8", "replace")
                             + "</body></html>")
            return page.locator("svg").first.screenshot(timeout=8000)
        finally:
            page.close()
