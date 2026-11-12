# -*- coding: utf-8 -*-
"""Simulador Playwright de Sparkline Table (bloque 1).

dataView MATRIX sintético que imita el de Desktop validado en la prueba de viabilidad: 3 niveles (Zona › Comercial ›
PDV), periodos en columnas con el nivel de medidas (3 medidas: Ventas netas, Margen %, Objetivo), subtotales de fila
como hijo isSubtotal (tipo Top), subtotal de columna (total del rango), huecos, negativos y bases pequeñas.

No reproduce: fetchMoreData real, marcadores ni el motor de Power BI. Requiere `node build-test.js` antes (lee
.tmp/drop/visual.js). Uso:  python tools/simulador/harness.py   → capturas en tools/simulador/capturas/ y JSON.
"""
import asyncio, copy, json, os, random, sys
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BUNDLE = os.path.join(ROOT, ".tmp", "drop", "visual.js")
CSS = os.path.join(ROOT, ".tmp", "drop", "visual.css")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "capturas")
GUID = "matrixSparklinesFAB7608B939348B490060433D1A28FA6_test"

STUB = r"""
window.__ev = []; window.__sel = []; window.__fetch = 0; window.__fetchRet = true; window.__toggles = []; window.__persist = [];
window.__lastSelectArg = 0; window.__tips = 0; window.__updates = 0; window.__ctx = 0;
window.powerbi = { visuals: { plugins: {} }, extensibility: {} };
(function(){
 function mkId(k){ return { __k:k, getKey(){return k;}, equals(o){return !!o && o.__k===k;}, includes(o){ return !!o && (o.__k===k || o.__k.indexOf(k+'|')===0); } }; }
 window.__pal = { isHighContrast:false, foreground:{value:'#252423'}, background:{value:'#FFFFFF'}, foregroundSelected:{value:'#1AEBFF'},
   foregroundNeutralSecondary:{value:'#605E5C'}, foregroundNeutralTertiary:{value:'#8A8886'}, backgroundNeutral:{value:'#E1DFDD'},
   positive:{value:'#1AAB40'}, negative:{value:'#D64554'}, getColor(k){ return {value:'#118DFF'}; } };
 window.__host = {
  eventService: { renderingStarted(){ __ev.push('S'); }, renderingFinished(){ __ev.push('F'); }, renderingFailed(o,m){ __ev.push('X'); console.error('FAILED', m); } },
  createSelectionManager(){ return {
     select(ids, multi){ ids = Array.isArray(ids)? ids : [ids]; __lastSelectArg = ids.length; __sel = multi ? __sel.concat(ids) : ids; return Promise.resolve(__sel); },
     clear(){ __sel=[]; __lastSelectArg = 0; return Promise.resolve(); }, getSelectionIds(){ return __sel; }, hasSelection(){ return __sel.length>0; },
     registerOnSelectCallback(cb){ window.__onSel = cb; }, showContextMenu(){ __ctx++; return Promise.resolve(); },
     toggleExpandCollapse(id, lvl){ __toggles.push(id.__k + (lvl?'|level':'')); return Promise.resolve(); } }; },
  createSelectionIdBuilder(){ let k=[]; return { withMatrixNode(n){ k.push(n.identity ? n.identity.k : String(n.value)); return this; }, createSelectionId(){ return mkId(k[k.length-1]); } }; },
  createLocalizationManager(){ return { getDisplayName(k){ return k; } }; },
  tooltipService: { show(){ __tips++; }, move(){}, hide(){} },
  subSelectionService: { subSelect(){}, updateRegionOutlines(){} },
  hostCapabilities: { allowInteractions: true }, locale: 'es-ES', colorPalette: window.__pal,
  fetchMoreData(agg){ __fetch++; return __fetchRet; }, persistProperties(p){ __persist.push(JSON.stringify(p)); }, launchUrl(){},
 };
})();
"""

MEAS = [{"displayName": "Ventas netas", "queryName": "m.Ventas", "roles": {"values": True}, "format": "#,0 €", "isMeasure": True},
        {"displayName": "Margen bruto %", "queryName": "m.Margen", "roles": {"values": True}, "format": "0.0 %", "isMeasure": True},
        {"displayName": "Objetivo", "queryName": "m.Obj", "roles": {"target": True}, "format": "#,0 €", "isMeasure": True}]


def build(n_z=8, n_c=15, n_p=17, n_per=36, expanded=None, half=False, segment=False, objects=None, sort=None, seed=7, highlight=None):
    """expanded: None = todo expandido; set de claves ("Z0", "Z0|C1") que se expanden (el resto, contraído)."""
    rnd = random.Random(seed)
    meas = copy.deepcopy(MEAS)
    nM = 3
    per = [f"{2023 + (9 + i) // 12}-{(9 + i) % 12 + 1:02d}" for i in range(n_per)]

    def leaf_series(kind):
        base = rnd.uniform(400, 6000) if kind != "small" else rnd.uniform(5, 40)
        trend = rnd.uniform(-0.02, 0.03)
        ven, mar = [], []
        for p in range(n_per):
            v = base * (1 + trend * p) * rnd.uniform(0.8, 1.2) * (1 + 0.15 * ((p % 12) in (5, 6, 11)))
            if kind == "returns" and p % 9 == 4:
                v = -abs(v) * 0.3
            if kind == "gaps" and p in (14, 15, 16):
                v = None
            ven.append(None if v is None else round(v, 2))
            mar.append(None if v is None else rnd.uniform(0.22, 0.46))
        obj = [None if v is None else round(base * (1 + 0.012 * p), 2) for p, v in enumerate(ven)]
        return ven, mar, obj

    def vals_from(ven, mar, obj, hl=False):
        d = {}
        for p in range(n_per):
            for m, arr in enumerate((ven, mar, obj)):
                if arr[p] is not None:
                    d[str(nM * p + m)] = {"value": arr[p], "valueSourceIndex": m}
                    if highlight is not None:
                        d[str(nM * p + m)]["highlight"] = arr[p] * 0.6 if hl else None
        tv = sum(x for x in ven if x is not None)
        tm = sum((v or 0) * (mm or 0) for v, mm in zip(ven, mar)) / tv if tv else None
        to = sum(x for x in obj if x is not None)
        for m, x in enumerate((tv, tm, to)):
            if x is not None:
                d[str(nM * n_per + m)] = {"value": x, "valueSourceIndex": m}
        return d

    def agg(series_list):
        ven = [None] * n_per; mar = [None] * n_per; obj = [None] * n_per
        for p in range(n_per):
            vs = [s[0][p] for s in series_list if s[0][p] is not None]
            if vs:
                ven[p] = sum(vs)
                mar[p] = sum(s[0][p] * s[1][p] for s in series_list if s[0][p] is not None) / ven[p] if ven[p] else None
                obj[p] = sum(s[2][p] for s in series_list if s[2][p] is not None)
        return ven, mar, obj

    def is_exp(k):
        return expanded is None or k in expanded

    leaves = 0
    zonas, zser = [], []
    for z in range(n_z):
        coms, cser_all = [], []
        for c in range(n_c):
            pdvs, pser = [], []
            for d in range(n_p):
                kind = "small" if (z, c, d) in ((0, 0, 3), (1, 2, 5)) else "returns" if d % 11 == 7 else "gaps" if d % 13 == 9 else "n"
                s = leaf_series(kind)
                pser.append(s)
                pdvs.append({"level": 2, "levelValues": [{"value": f"PDV-{z}{c:02d}{d:02d}", "levelSourceIndex": 0}],
                             "identity": {"k": f"Z{z}|C{c}|P{d}"}, "values": vals_from(*s, hl=bool(highlight) and f"Z{z}|C{c}|P{d}" in highlight)})
                leaves += 1
            cs = agg(pser)
            cser_all.extend(pser)
            ck = f"Z{z}|C{c}"
            node = {"level": 1, "levelValues": [{"value": f"KAM-{c + 1:02d}" if c < 3 else f"COM-{z}{c:02d}", "levelSourceIndex": 0}], "identity": {"k": ck}}
            if half:
                node.update({"isCollapsed": True, "values": vals_from(*cs)})
            elif is_exp(ck):
                node.update({"isCollapsed": False, "children": [{"isSubtotal": True, "values": vals_from(*cs)}] + pdvs})
            else:
                node.update({"isCollapsed": True, "values": vals_from(*cs)})
            coms.append(node)
        zs = agg(cser_all)
        zser.extend(cser_all)
        zk = f"Z{z}"
        zn = {"level": 0, "levelValues": [{"value": f"Zona {['Norte', 'Sur', 'Este', 'Oeste', 'Centro', 'Costa', 'Interior', 'Islas', 'Pirineo'][z % 9]}", "levelSourceIndex": 0}],
              "identity": {"k": zk}}
        if is_exp(zk):
            zn.update({"isCollapsed": False, "children": [{"isSubtotal": True, "values": vals_from(*zs)}] + coms})
        else:
            zn.update({"isCollapsed": True, "values": vals_from(*zs)})
        zonas.append(zn)
    root = {"children": [{"isSubtotal": True, "values": vals_from(*agg(zser))}] + zonas}

    def lv(name, can=True):
        return {"sources": [{"displayName": name, "queryName": "t." + name, "roles": {"rows": True}}], "canBeExpanded": can}

    levels = [lv("Zona"), lv("Comercial"), lv("PDV", False)]
    if half:
        levels = [lv("Zona"), lv("Comercial", True)]
    period_children = [{"level": 1, "levelSourceIndex": m} for m in range(nM)]
    cols = {"root": {"children": [{"level": 0, "levelValues": [{"value": p, "levelSourceIndex": 0}], "children": [dict(x) for x in period_children]} for p in per]
                     + [{"level": 0, "isSubtotal": True, "children": [dict(x) for x in period_children]}]},
            "levels": [{"sources": [{"displayName": "anio_mes", "roles": {"period": True}}]}, {"sources": meas}]}
    rowcols = [s["sources"][0] for s in levels]
    md = {"columns": rowcols + [{"displayName": "anio_mes", "roles": {"period": True}}] + meas}
    if half:
        md["columns"].insert(2, {"displayName": "PDV", "queryName": "t.PDV", "roles": {"rows": True}})
    if sort:
        for c in md["columns"]:
            if c["displayName"] == sort:
                c["sort"] = 2
                c["sortOrder"] = 0
    if segment:
        md["segment"] = {}
    if objects:
        md["objects"] = objects
    dv = {"metadata": md, "matrix": {"rows": {"root": root, "levels": levels}, "columns": cols, "valueSources": meas}}
    return dv, leaves


async def setup(pg, W, H):
    await pg.set_content(f"<html><body style='margin:0;background:#fff'><div id='host' style='position:relative;width:{W}px;height:{H}px'></div></body></html>")
    await pg.add_script_tag(content=STUB)
    await pg.add_script_tag(path=BUNDLE)
    await pg.add_style_tag(content=open(CSS, encoding="utf-8").read())
    await pg.evaluate("(guid) => { window.__v = powerbi.visuals.plugins[guid].create({ element: document.getElementById('host'), host: __host }); }", GUID)


async def upd(pg, dv, W, H, typ=2, ok=0, view=0):
    await pg.evaluate("window.__dv = " + json.dumps(dv) + ";")
    ms = await pg.evaluate("""([W, H, typ, ok, view]) => { const t = performance.now(); __updates++;
        document.getElementById('host').style.width = W + 'px'; document.getElementById('host').style.height = H + 'px';
        __v.update({ dataViews: __dv ? [__dv] : [], viewport: {width: W, height: H}, type: typ, operationKind: ok, viewMode: view }); return performance.now() - t; }""",
                           [W, H, typ, ok, view])
    await pg.wait_for_timeout(60)
    return round(ms, 1)


async def main():
    os.makedirs(OUT, exist_ok=True)
    res = {}
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()

        async def page(W, H):
            pg = await b.new_page(viewport={"width": W, "height": H})
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            await setup(pg, W, H)
            return pg

        W, H = 960, 560
        pg = await page(W, H)
        vista = {"Z0", "Z0|C0", "Z0|C1", "Z1"}
        dv, _ = build(expanded=vista)
        res["update_vista_ms"] = await upd(pg, dv, W, H)
        await pg.screenshot(path=os.path.join(OUT, "01_tabla_por_defecto.png"))
        for i, t in enumerate(["line", "area", "column", "winloss", "bullet"]):
            dvt, _ = build(expanded=vista, objects={"sparkline": {"type": t}, "markers": {"max": True, "min": True, "negative": True, "first": True}})
            await upd(pg, dvt, W, H)
            await pg.screenshot(path=os.path.join(OUT, f"02_{i + 1}_tipo_{t}.png"))
        dvr, _ = build(expanded=vista, objects={"sparkline": {"scale": "row"}})
        await upd(pg, dvr, W, H)
        await pg.screenshot(path=os.path.join(OUT, "03_escala_por_fila.png"))
        res["cabecera_escala_por_fila"] = await pg.evaluate("document.querySelector('.st-h2-spark') ? document.querySelector('.st-h2-spark').textContent : ''")
        # Orden del host rotulado (antes de ordenar desde la cabecera)
        dvs, _ = build(expanded=vista, sort="Ventas netas")
        await upd(pg, dvs, W, H)
        res["rotulo_orden_host"] = await pg.evaluate("document.querySelector('.st-h2-name').textContent")
        await pg.screenshot(path=os.path.join(OUT, "04_0_orden_del_host_rotulado.png"))
        # Orden por Δ% con un clic en la cabecera (local; no editando no se guarda)
        await upd(pg, dv, W, H)
        await pg.click(".st-h-pct")
        await pg.wait_for_timeout(80)
        await pg.screenshot(path=os.path.join(OUT, "04_orden_por_delta_pct.png"))
        res["orden_delta_pct_primeras"] = await pg.evaluate("""() => [...document.querySelectorAll('.st-row')].sort((a,b)=>+a.dataset.i - +b.dataset.i).slice(0,6)
            .map(r => r.querySelector('.st-label').textContent + ' ' + r.querySelector('.st-c-pct').textContent)""")
        res["persist_tras_orden_lectura"] = len(await pg.evaluate("__persist"))
        # Dos clics más: ascendente y vuelta al orden de Power BI
        await pg.click(".st-h-pct")
        await pg.wait_for_timeout(50)
        res["orden_tras_2o_clic"] = await pg.evaluate("document.querySelector('.st-h2-name').textContent")
        await pg.click(".st-h-pct")
        await pg.wait_for_timeout(50)
        res["orden_tras_3er_clic"] = await pg.evaluate("document.querySelector('.st-h2-name').textContent")

        # Total del rango y mismo periodo del año anterior
        dvt2, _ = build(expanded=vista, objects={"values": {"compare": "lastYear"}, "subTotals": {"columnSubtotals": True}})
        await upd(pg, dvt2, W, H)
        await pg.screenshot(path=os.path.join(OUT, "05_total_y_ano_anterior.png"))
        res["cabecera_total_ly"] = await pg.evaluate("[...document.querySelectorAll('.st-h1, .st-h2')].map(e => e.textContent)")
        # Alto contraste
        await pg.evaluate("Object.assign(__pal, {isHighContrast: true, foreground: {value: '#FFFFFF'}, background: {value: '#000000'}, foregroundSelected: {value: '#1AEBFF'}})")
        await pg.evaluate("document.body.style.background = '#000'")
        await upd(pg, build(expanded=vista, objects={"markers": {"max": True, "min": True}})[0], W, H)
        await pg.evaluate("() => { const r = [...document.querySelectorAll('.st-row')].find(r => r.dataset.i === '3'); r.dispatchEvent(new MouseEvent('click', {bubbles: true})); }")
        await pg.wait_for_timeout(50)
        await pg.screenshot(path=os.path.join(OUT, "06_alto_contraste.png"))
        await pg.evaluate("Object.assign(__pal, {isHighContrast: false, foreground: {value: '#252423'}, background: {value: '#FFFFFF'}}); __sel = [];")
        await pg.evaluate("document.body.style.background = '#fff'")
        # Jerarquía a medias: 2 niveles recibidos, el 2.º expandible
        dvh, _ = build(half=True, expanded={"Z0", "Z1"})
        await upd(pg, dvh, W, H)
        await pg.screenshot(path=os.path.join(OUT, "07_showing_2_of_3_levels.png"))
        res["aviso_niveles"] = await pg.evaluate("document.querySelector('.st-notice').textContent")
        res["toggle_en_nivel2_a_medias"] = await pg.evaluate("[...document.querySelectorAll('.st-row.st-l1 .st-toggle')].slice(0,2).map(t => t.textContent)")
        # Cargando (llega segment)
        dvl, _ = build(expanded=vista, segment=True)
        await upd(pg, dvl, W, H, ok=0)
        res["aviso_cargando"] = await pg.evaluate("document.querySelector('.st-notice').textContent")
        res["fetch_pedidos"] = await pg.evaluate("__fetch")
        await pg.screenshot(path=os.path.join(OUT, "08_cargando.png"))
        await pg.evaluate("__fetchRet = false")
        dvl2, _ = build(expanded=vista | {"Z2"}, segment=True)
        await upd(pg, dvl2, W, H, ok=1)
        res["aviso_techo"] = await pg.evaluate("document.querySelector('.st-notice').textContent")
        await pg.evaluate("__fetchRet = true")
        # Asistente (editando)
        await upd(pg, dv, W, H, view=1)
        await pg.screenshot(path=os.path.join(OUT, "09_asistente_paso1.png"))
        await pg.click(".st-guide .st-g-btn")
        await pg.wait_for_timeout(50)
        await pg.screenshot(path=os.path.join(OUT, "10_asistente_paso2.png"))
        await pg.click(".st-guide .st-g-chip >> nth=1")
        res["persist_asistente"] = await pg.evaluate("__persist.slice(-1)[0]")
        # Highlight desde otro visual: solo 3 hojas resaltadas, el resto atenuado
        await upd(pg, build(expanded=vista, highlight={"Z0|C0|P1", "Z0|C0|P4", "Z0|C1|P2"})[0], W, H)
        res["filas_atenuadas_highlight"] = await pg.evaluate("document.querySelectorAll('.st-row.st-dim').length")
        await pg.screenshot(path=os.path.join(OUT, "16_highlight.png"))
        # Tema oscuro con Report theme, y Classic
        await pg.evaluate("Object.assign(__pal, {foreground: {value: '#F3F2F1'}, background: {value: '#1F1F1F'}, foregroundNeutralSecondary: {value: '#C8C6C4'}, foregroundNeutralTertiary: {value: '#8A8886'}}); document.body.style.background = '#1F1F1F';")
        await upd(pg, dv, W, H)
        await pg.screenshot(path=os.path.join(OUT, "17_report_theme_oscuro.png"))
        await upd(pg, build(expanded=vista, objects={"style": {"template": "classic"}})[0], W, H)
        await pg.screenshot(path=os.path.join(OUT, "18_classic_sobre_tema_oscuro.png"))
        await pg.evaluate("Object.assign(__pal, {foreground: {value: '#252423'}, background: {value: '#FFFFFF'}, foregroundNeutralSecondary: {value: '#605E5C'}}); document.body.style.background = '#fff';")
        ev1 = await pg.evaluate("__ev.join('')")
        n1 = await pg.evaluate("__updates")
        res["eventos_pagina_1"] = {"updates": n1, "S": ev1.count("S"), "F": ev1.count("F"), "pares_1a1": ev1 == "SF" * n1}
        await pg.close()

        # Tamaño pequeño
        pg = await page(320, 200)
        await upd(pg, dv, 320, 200)
        await pg.screenshot(path=os.path.join(OUT, "11_pequeno_320x200.png"))
        res["columnas_pequeno"] = await pg.evaluate("getComputedStyle(document.querySelector('.st-root')).getPropertyValue('--st-cols')")
        await pg.close()
        pg = await page(480, 260)
        await upd(pg, dv, 480, 260)
        await pg.screenshot(path=os.path.join(OUT, "12_mediano_480x260.png"))
        await pg.close()

        # Pantalla de inicio
        pg = await page(800, 420)
        await upd(pg, None, 800, 420)
        await pg.screenshot(path=os.path.join(OUT, "13_pantalla_inicio.png"))
        await upd(pg, None, 420, 240)
        await pg.screenshot(path=os.path.join(OUT, "14_pantalla_inicio_mediana.png"))
        await pg.close()

        # Rendimiento, selección, teclado y eventos: 2.040 hojas × 36 meses, todo expandido
        W, H = 960, 640
        pg = await page(W, H)
        full, n = build()
        res["hojas"] = n
        await pg.evaluate("window.__dvF = " + json.dumps(full) + ";")
        t = []
        for _ in range(5):
            t.append(await pg.evaluate("() => { const t = performance.now(); __updates++; __v.update({ dataViews: [__dvF], viewport: {width: 960, height: 640}, type: 2, operationKind: 0 }); return performance.now() - t; }"))
        t.sort()
        res["update_2040_hojas_ms_mediana"] = round(t[2], 1)
        res["dom_filas"] = await pg.evaluate("document.querySelectorAll('.st-row').length")
        res["filas_totales"] = await pg.evaluate("parseInt(document.querySelector('.st-spacer').style.height) / parseInt(getComputedStyle(document.querySelector('.st-root')).getPropertyValue('--st-rh'))")
        ev0 = await pg.evaluate("__ev.length")
        res["scroll"] = await pg.evaluate("""() => new Promise(done => {
            const sc = document.querySelector('.st-scroller'); const max = sc.scrollHeight - sc.clientHeight;
            const f = []; let i = 0, last = performance.now(); const N = 240;
            function step(){ const now = performance.now(); f.push(now - last); last = now;
              if (i > N) { f.shift(); f.sort((a,b)=>a-b); done({mediana_ms: +f[f.length>>1].toFixed(2), p95_ms: +f[Math.floor(f.length*0.95)].toFixed(2), max_ms: +f[f.length-1].toFixed(2), dom: document.querySelectorAll('.st-row').length}); return; }
              sc.scrollTop = max * (i / N); i++; requestAnimationFrame(step); }
            requestAnimationFrame(step); })""")
        await pg.evaluate("document.querySelector('.st-scroller').scrollTop = 0")
        await pg.wait_for_timeout(100)
        # Hover con tooltip
        box = await pg.evaluate("(() => { const r = document.querySelector('.st-row[data-i=\"2\"] .st-c-spark').getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()")
        await pg.mouse.move(box[0], box[1])
        await pg.wait_for_timeout(50)
        res["tooltips_mostrados"] = await pg.evaluate("__tips")
        await pg.screenshot(path=os.path.join(OUT, "15_hover_2040_hojas.png"))
        # Selección: hoja, subtotal nivel 2, subtotal nivel 1, Ctrl, alternar
        sel_js = "(lvl) => { const r = [...document.querySelectorAll('.st-row')].sort((a,b)=>+a.dataset.i - +b.dataset.i).find(r => r.getAttribute('aria-level') === lvl); r.dispatchEvent(new MouseEvent('click', {bubbles:true, ctrlKey: false})); return r.querySelector('.st-label').textContent; }"
        await pg.evaluate(sel_js, "3"); res["ids_hoja"] = await pg.evaluate("__lastSelectArg")
        await pg.evaluate(sel_js, "2"); res["ids_subtotal_nivel2"] = await pg.evaluate("__lastSelectArg")
        await pg.evaluate(sel_js, "1"); res["ids_subtotal_nivel1"] = await pg.evaluate("__lastSelectArg")
        res["seleccionadas_dom"] = await pg.evaluate("document.querySelectorAll('.st-row.st-selected').length")
        await pg.evaluate(sel_js, "1"); res["ids_tras_segundo_clic_mismo"] = await pg.evaluate("__lastSelectArg")
        # Marcador: el host devuelve la selección (ids de 2 hojas) por el callback
        await pg.evaluate("__onSel([{__k:'Z0|C0|P1', getKey(){return 'otra-forma-1';}, equals(o){return o && o.__k==='Z0|C0|P1';}}, {__k:'Z0|C0|P2', getKey(){return 'otra-forma-2';}, equals(o){return o && o.__k==='Z0|C0|P2';}}])")
        await pg.wait_for_timeout(50)
        res["restaurado_marcador_dom"] = await pg.evaluate("[...document.querySelectorAll('.st-row.st-selected .st-label')].map(e => e.textContent)")
        # Teclado
        await pg.focus(".st-root")
        for k in ["ArrowDown", "ArrowDown", "ArrowLeft", "Enter", "Escape", "ArrowRight"]:
            await pg.keyboard.press(k)
        res["teclado_live"] = await pg.evaluate("document.querySelector('.st-live').textContent")
        res["teclado_toggles"] = await pg.evaluate("__toggles")
        # Toggle con el ratón (y Alt = nivel entero)
        await pg.evaluate("() => { const t = document.querySelector('.st-row[data-i=\"1\"] .st-toggle'); t.dispatchEvent(new MouseEvent('click', {bubbles:true, altKey:true})); }")
        res["toggles"] = await pg.evaluate("__toggles")
        # Menú contextual
        await pg.evaluate("() => document.querySelector('.st-row[data-i=\"4\"]').dispatchEvent(new MouseEvent('contextmenu', {bubbles:true}))")
        res["menu_contextual"] = await pg.evaluate("__ctx")
        res["eventos_por_interaccion"] = await pg.evaluate("__ev.length") - ev0
        # Resize sin datos
        await pg.evaluate("() => { __updates++; __v.update({ dataViews: [__dvF], viewport: {width: 700, height: 500}, type: 4, operationKind: 0 }); }")
        # Interacciones apagadas
        await pg.evaluate("__host.hostCapabilities.allowInteractions = false; __lastSelectArg = -1;")
        await pg.evaluate("() => { __updates++; __v.update({ dataViews: [__dvF], viewport: {width: 700, height: 500}, type: 2, operationKind: 0 }); }")
        await pg.evaluate(sel_js, "3")
        res["allowInteractions_false_select"] = await pg.evaluate("__lastSelectArg")
        res["persistProperties_total"] = len(await pg.evaluate("__persist"))
        ev = await pg.evaluate("__ev.join('')")
        res["eventos"] = {"updates": await pg.evaluate("__updates"), "S": ev.count("S"), "F": ev.count("F"), "X": ev.count("X"),
                          "pares_1a1": ev == "SF" * (await pg.evaluate("__updates"))}
        await pg.close()

        # Escenario A de Desktop (cuelgue del 12-11): 1.800 hojas × 24 meses, subtotales de filas y columnas, nivel de
        # medidas, cargado por segmentos agregados (Create + 2 Append con segment + Append final sin segment).
        pg = await page(W, H)
        segs = [build(n_z=4, n_c=15, n_p=30, n_per=24, expanded={"Z0"} | {f"Z0|C{c}" for c in range(15)}, segment=True)[0],
                build(n_z=4, n_c=15, n_p=30, n_per=24, expanded={"Z0", "Z1"} | {f"Z{z}|C{c}" for z in (0, 1) for c in range(15)}, segment=True)[0],
                build(n_z=4, n_c=15, n_p=30, n_per=24)[0]]
        tA = []
        for i, d in enumerate(segs):
            tA.append(await upd(pg, d, W, H, ok=0 if i == 0 else 1))
        # Un update de formato a mitad de carga (mismo segmento) y el final otra vez: no debe colgar ni descuadrar.
        tA.append(await upd(pg, segs[1], W, H, ok=1))
        tA.append(await upd(pg, segs[2], W, H, ok=1))
        evA = await pg.evaluate("__ev.join('')")
        nA = await pg.evaluate("__updates")
        res["escenario_A_1800"] = {"hojas": build(n_z=4, n_c=15, n_p=30, n_per=24)[1], "ms_por_update": tA,
                                   "fetchMoreData": await pg.evaluate("__fetch"), "aviso_final": await pg.evaluate("document.querySelector('.st-notice').textContent"),
                                   "pares_1a1": evA == "SF" * nA, "updates": nA}
        await pg.screenshot(path=os.path.join(OUT, "19_escenario_A_1800_hojas.png"))
        # Formato por niveles + cabecera + alto de fila + escala automática
        lvl = {"level1": {"background": {"solid": {"color": "#1F4E79"}}, "color": {"solid": {"color": "#FFFFFF"}}, "fontSize": 13, "fontFamily": "Georgia, serif", "bold": "on"},
               "level2": {"background": {"solid": {"color": "#F2C14E"}}, "bgOpacity": 35, "fontFamily": "Georgia, serif", "italic": True},
               "level3": {"fontSize": 10},
               "header": {"background": {"solid": {"color": "#EAF1F8"}}, "color": {"solid": {"color": "#1F4E79"}}, "fontFamily": "Georgia, serif", "fontSize": 12},
               "rows": {"rowHeight": 30}, "sparkline": {"type": "column"}}
        await upd(pg, build(expanded={"Z0", "Z0|C0", "Z1"}, objects=lvl)[0], W, H)
        await pg.screenshot(path=os.path.join(OUT, "20_formato_por_niveles.png"))
        await upd(pg, build(expanded={"Z0", "Z0|C0", "Z1"}, objects={"rows": {"rowHeight": 16}, "values": {"fontSize": 14}})[0], W, H)
        res["alto_pedido_16_con_texto_14"] = await pg.evaluate("getComputedStyle(document.querySelector('.st-root')).getPropertyValue('--st-rh')")
        await upd(pg, build(expanded={"Z0", "Z0|C0", "Z1"}, objects={"rows": {"rowHeight": 44}})[0], W, H)
        await pg.screenshot(path=os.path.join(OUT, "21_alto_de_fila_44.png"))
        await pg.close()

        # Estrés: 10.800 hojas × 24 meses
        if "--estres" in sys.argv:
            pg = await page(W, H)
            big, nb = build(n_z=9, n_c=200, n_p=6, n_per=24)
            await pg.evaluate("window.__dvB = " + json.dumps(big) + ";")
            t = sorted([await pg.evaluate("() => { const t = performance.now(); __v.update({ dataViews: [__dvB], viewport: {width: 960, height: 640}, type: 2, operationKind: 0 }); return performance.now() - t; }") for _ in range(3)])
            res["estres"] = {"hojas": nb, "update_ms_mediana": round(t[1], 1)}
            await pg.close()
        await b.close()
    res["errores"] = errs
    print(json.dumps(res, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
