# -*- coding: utf-8 -*-
"""Escenario de estrés: 9 x 200 x 6 = 10.800 hojas x 24 meses x 2 medidas (como Zona > PDV > Familia de Begudes Nord)."""
import asyncio, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness as h
from playwright.async_api import async_playwright


async def main():
    dv, n = h.build(n_zonas=9, n_com=200, n_pdv=6, n_per=24)
    W, H = 900, 700
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": W, "height": H})
        await pg.set_content(f"<html><body style='margin:0'><div id='host' style='position:relative;width:{W}px;height:{H}px'></div></body></html>")
        await pg.add_script_tag(content=h.STUB)
        await pg.add_script_tag(path=h.BUNDLE)
        await pg.add_style_tag(content=open(h.CSS, encoding="utf-8").read())
        await pg.evaluate("(guid) => { window.__v = powerbi.visuals.plugins[guid].create({ element: document.getElementById('host'), host: __host }); }", h.GUID)
        await pg.add_script_tag(content="window.__dvS = " + json.dumps(dv) + ";")
        upd = "() => { const t = performance.now(); __v.update({ dataViews: [__dvS], viewport: {width: 900, height: 700}, type: 2, operationKind: 0 }); return performance.now() - t; }"
        ts = sorted([await pg.evaluate(upd) for _ in range(5)])
        sc = await pg.evaluate("""() => new Promise(done => {
            const sc = document.querySelector('.st-scroller'); const max = sc.scrollHeight - sc.clientHeight;
            const f = []; let i = 0, last = performance.now(); const N = 240;
            function step(){ const now = performance.now(); f.push(now - last); last = now;
              if (i > N) { f.shift(); f.sort((a,b)=>a-b); done({mediana_ms: +f[f.length>>1].toFixed(2), p95_ms: +f[Math.floor(f.length*0.95)].toFixed(2), max_ms: +f[f.length-1].toFixed(2), dom: document.querySelectorAll('.st-row').length}); return; }
              sc.scrollTop = max * (i / N); i++; requestAnimationFrame(step); }
            requestAnimationFrame(step); })""")
        diag = await pg.evaluate("document.querySelector('.st-diag-body').innerText")
        print(json.dumps({"hojas": n, "update_ms_mediana": round(ts[2], 1), "scroll": sc, "eventos": await pg.evaluate("__ev.join('')"),
                          "tiempos_diag": [l for l in diag.split("\n") if l.startswith(("TIEMPOS", "SCROLL", "FILAS"))]}, ensure_ascii=False, indent=1))
        await b.close()

asyncio.run(main())
