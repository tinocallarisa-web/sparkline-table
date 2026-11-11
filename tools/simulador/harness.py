# -*- coding: utf-8 -*-
"""Simulador Playwright para Sparkline Table (viabilidad): matrix sintético 3 niveles x ~2.040 hojas x 36 meses x 2 medidas."""
import asyncio, json, os, random
from playwright.async_api import async_playwright

BUNDLE = r"C:\tcviz\dev\SparklineTable\.tmp\drop\visual.js"
CSS = r"C:\tcviz\dev\SparklineTable\.tmp\drop\visual.css"
OUT = os.path.dirname(os.path.abspath(__file__))
GUID = "matrixSparklinesFAB7608B939348B490060433D1A28FA6_test"

STUB = r"""
window.__ev = []; window.__sel = []; window.__fetch = 0; window.__toggles = []; window.__persist = 0; window.__lastSelectArg = 0;
window.powerbi = { visuals: { plugins: {} }, extensibility: {} };
(function(){
 function mkId(k){ return { __k:k, getKey(){return k;}, equals(o){return o && o.__k===k;} }; }
 window.__host = {
  eventService: { renderingStarted(){ __ev.push('S'); }, renderingFinished(){ __ev.push('F'); }, renderingFailed(o,m){ __ev.push('X:'+m); } },
  createSelectionManager(){ return {
     select(ids, multi){ ids = Array.isArray(ids)? ids : [ids]; __lastSelectArg = ids.length; __sel = multi ? __sel.concat(ids) : ids; return Promise.resolve(__sel); },
     clear(){ __sel=[]; return Promise.resolve(); }, getSelectionIds(){ return __sel; }, hasSelection(){ return __sel.length>0; },
     registerOnSelectCallback(cb){ window.__onSel = cb; }, showContextMenu(){ return Promise.resolve(); },
     toggleExpandCollapse(id, lvl){ __toggles.push(id.__k + (lvl?'|level':'')); return Promise.resolve(); } }; },
  createSelectionIdBuilder(){ let k=''; return { withMatrixNode(n){ k = n.identity ? n.identity.k : String(n.value); return this; }, createSelectionId(){ return mkId(k); } }; },
  hostCapabilities: { allowInteractions: true }, locale: 'es-ES',
  fetchMoreData(agg){ __fetch++; return true; }, persistProperties(){ __persist++; },
 };
})();
"""


def build(n_zonas=8, n_com=15, n_pdv=17, n_per=36, collapsed=(), truncate=None):
    random.seed(7)
    measures = [{"displayName": "Ventas netas", "queryName": "m.Ventas", "roles": {"values": True}, "format": "#,0", "index": 3, "isMeasure": True},
                {"displayName": "Margen bruto %", "queryName": "m.Margen", "roles": {"values": True}, "format": "0.0 %", "index": 4, "isMeasure": True}]
    per = [f"{2024 + (8 + i) // 12}-{(8 + i) % 12 + 1:02d}" for i in range(n_per)]

    def leafvals():
        base = random.uniform(500, 5000)
        v = {}
        for p in range(n_per):
            ven = base * (1 + 0.01 * p) * random.uniform(0.85, 1.15)
            v[str(2 * p)] = {"value": round(ven, 2)}
            v[str(2 * p + 1)] = {"value": random.uniform(0.25, 0.45), "valueSourceIndex": 1}
        return v

    def subtotal(kids):
        v = {}
        for p in range(n_per):
            ven = sum(k["values"][str(2 * p)]["value"] for k in kids)
            mar = sum(k["values"][str(2 * p)]["value"] * k["values"][str(2 * p + 1)]["value"] for k in kids) / ven
            v[str(2 * p)] = {"value": ven}
            v[str(2 * p + 1)] = {"value": mar, "valueSourceIndex": 1}
        return v

    leaves = 0
    zonas = []
    for z in range(n_zonas):
        coms = []
        for c in range(n_com):
            pdvs = []
            for d in range(n_pdv):
                if truncate is not None and leaves >= truncate:
                    break
                pdvs.append({"level": 2, "levelValues": [{"value": f"PDV-{z}{c:02d}{d:02d}", "levelSourceIndex": 0}],
                             "identity": {"k": f"Z{z}|C{c}|P{d}"}, "values": leafvals()})
                leaves += 1
            if not pdvs:
                break
            st = subtotal(pdvs)
            ck = f"Z{z}|C{c}"
            node = {"level": 1, "levelValues": [{"value": f"COM-{z}{c:02d}", "levelSourceIndex": 0}], "identity": {"k": ck}, "_leafs": pdvs}
            if ck in collapsed:
                node.update({"isCollapsed": True, "values": st})
            else:
                node.update({"isCollapsed": False, "children": [{"isSubtotal": True, "values": st}] + pdvs})
            coms.append(node)
        if not coms:
            break
        allp = [p for c in coms for p in c["_leafs"]]
        zonas.append({"level": 0, "levelValues": [{"value": f"Zona {z}", "levelSourceIndex": 0}], "identity": {"k": f"Z{z}"}, "isCollapsed": False,
                      "children": [{"isSubtotal": True, "values": subtotal(allp)}] + coms, "_leafs": allp})
    allp = [p for z in zonas for p in z["_leafs"]]
    for z in zonas:
        z.pop("_leafs")
        for c in z["children"]:
            c.pop("_leafs", None)
    root = {"children": [{"isSubtotal": True, "values": subtotal(allp)}] + zonas}

    def lv(name):
        return {"sources": [{"displayName": name, "queryName": "t." + name, "roles": {"rows": True}}], "canBeExpanded": True}

    cols = {"root": {"children": [{"level": 0, "levelValues": [{"value": p, "levelSourceIndex": 0}],
                                   "children": [{"level": 1, "levelSourceIndex": 0}, {"level": 1, "levelSourceIndex": 1}]} for p in per]},
            "levels": [{"sources": [{"displayName": "Mes", "roles": {"period": True}}]}, {"sources": measures}]}
    md = {"columns": measures}
    if truncate is not None:
        md["segment"] = {}
    return {"metadata": md, "matrix": {"rows": {"root": root, "levels": [lv("Zona"), lv("Comercial"), lv("PDV")]},
                                       "columns": cols, "valueSources": measures}}, leaves


UPD = """([dv, type, ok, w, h]) => { const t = performance.now();
  __v.update({ dataViews: [dv], viewport: {width: w, height: h}, type: type, operationKind: ok }); return performance.now() - t; }"""


async def main():
    full, nleaves = build()
    part, _ = build(truncate=1000)
    coll, _ = build(collapsed={"Z0|C0", "Z0|C1"})
    W, H = 900, 700
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": W, "height": H})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.set_content(f"<html><body style='margin:0'><div id='host' style='position:relative;width:{W}px;height:{H}px'></div></body></html>")
        await pg.add_script_tag(content=STUB)
        await pg.add_script_tag(path=BUNDLE)
        await pg.add_style_tag(content=open(CSS, encoding="utf-8").read())
        await pg.evaluate("(guid) => { window.__v = powerbi.visuals.plugins[guid].create({ element: document.getElementById('host'), host: __host }); }", GUID)
        res = {"hojas_sinteticas": nleaves}
        # 1) Create con segmento parcial (1.000 hojas) → el visual debe pedir fetchMoreData
        res["create_parcial_ms"] = await pg.evaluate(UPD, [part, 2, 0, W, H])
        res["fetch_tras_create"] = await pg.evaluate("__fetch")
        # 2) Append con todo (sin segment) → debe dejar de pedir
        res["append_completo_ms"] = await pg.evaluate(UPD, [full, 2, 1, W, H])
        res["fetch_tras_append"] = await pg.evaluate("__fetch")
        # 2b) Create completo en frío, cinco veces, para la mediana del update completo
        tiempos = []
        for _ in range(5):
            tiempos.append(await pg.evaluate(UPD, [full, 2, 0, W, H]))
        tiempos.sort()
        res["update_completo_ms_mediana_5"] = round(tiempos[2], 1)
        await pg.wait_for_timeout(200)
        res["dom_rows"] = await pg.evaluate("document.querySelectorAll('.st-row').length")
        res["alto_spacer"] = await pg.evaluate("document.querySelector('.st-spacer').style.height")
        await pg.screenshot(path=os.path.join(OUT, "st_inicio.png"))
        # 3) Scroll: recorrer toda la lista en 240 frames y medir duración de frames
        res["scroll"] = await pg.evaluate("""() => new Promise(done => {
            const sc = document.querySelector('.st-scroller'); const max = sc.scrollHeight - sc.clientHeight;
            const frames = []; let i = 0, last = performance.now(); const N = 240;
            function step(){ const now = performance.now(); frames.push(now - last); last = now;
              if (i > N) { frames.shift(); frames.sort((a,b)=>a-b);
                 done({frames: frames.length, mediana_ms: +frames[Math.floor(frames.length/2)].toFixed(2), p95_ms: +frames[Math.floor(frames.length*0.95)].toFixed(2),
                       max_ms: +frames[frames.length-1].toFixed(2), dom_rows: document.querySelectorAll('.st-row').length, scrollMax: max}); return; }
              sc.scrollTop = max * (i / N); i++; requestAnimationFrame(step); }
            requestAnimationFrame(step); })""")
        await pg.wait_for_timeout(100)
        await pg.evaluate("document.querySelector('.st-scroller').scrollTop = 0")
        await pg.wait_for_timeout(100)
        res["eventos_tras_scroll"] = await pg.evaluate("__ev.join('')")
        # 4) Clic en hoja y en subtotales
        for nombre, sel in [("ids_clic_hoja", "!r.classList.contains('st-subtotal')"),
                            ("ids_clic_subtotal_nivel2", "r.getAttribute('aria-level') === '2'"),
                            ("ids_clic_subtotal_nivel1", "r.getAttribute('aria-level') === '1'")]:
            await pg.evaluate("() => { const r0 = [...document.querySelectorAll('.st-row')].find(r => " + sel +
                              "); r0.dispatchEvent(new MouseEvent('click', {bubbles:true})); }")
            await pg.wait_for_timeout(50)
            res[nombre] = await pg.evaluate("__lastSelectArg")
        # 5) Toggle en un comercial → el host manda update con el nodo contraído
        await pg.evaluate("""() => { const t = [...document.querySelectorAll('.st-row')].find(r => r.getAttribute('aria-level') === '2').querySelector('.st-toggle');
            t.dispatchEvent(new MouseEvent('click', {bubbles:true})); }""")
        res["toggles_enviados"] = await pg.evaluate("__toggles")
        res["update_contraido_ms"] = await pg.evaluate(UPD, [coll, 2, 0, W, H])
        # 6) Resize sin datos nuevos
        await pg.evaluate(UPD, [coll, 4, 0, 600, 420])
        await pg.screenshot(path=os.path.join(OUT, "st_contraido.png"))
        res["eventos_total"] = await pg.evaluate("__ev.join('')")
        res["persistProperties"] = await pg.evaluate("__persist")
        res["diag"] = await pg.evaluate("document.querySelector('.st-diag-body').innerText")
        res["errores"] = errs
        print(json.dumps(res, indent=1, ensure_ascii=False))
        await b.close()

if __name__ == "__main__":
    asyncio.run(main())
