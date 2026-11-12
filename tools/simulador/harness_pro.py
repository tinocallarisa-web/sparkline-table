# -*- coding: utf-8 -*-
"""Simulador Playwright del bloque 2 (Pro) de Sparkline Table.

Reutiliza el dataView MATRIX sintético del bloque 1 (harness.py) y le añade los pozos del bloque 2: Plan (= el
objetivo del motor), Prior year (la misma serie 12 meses antes, del MISMO nodo: así un subtotal trae su propio valor
de motor y no la suma de sus hijos) y Forecast.

Dos pasadas, porque cada build deja su bundle en .tmp/drop:
  node build-test.js         && python tools/simulador/harness_pro.py          → Pro (licencia forzada)
  node build-test.js --free  && python tools/simulador/harness_pro.py --free   → gratis: lectura y edición (marca)
Capturas en tools/simulador/capturas/ (prefijo b2_) y un JSON con las comprobaciones por la salida estándar.
"""
import asyncio, copy, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness as H  # noqa: E402
from playwright.async_api import async_playwright  # noqa: E402

FREE = "--free" in sys.argv
GUID = "matrixSparklinesFAB7608B939348B490060433D1A28FA6_" + ("testfree" if FREE else "test")
OUT = H.OUT
PFX = "b2f_" if FREE else "b2_"

# Licencia: en la pasada gratis, el licenseManager responde "sin planes" (como Desktop sin licencia).
LIC = r"""
window.__notices = []; window.__licReq = 0;
__host.licenseManager = {
  getAvailableServicePlans(){ return Promise.resolve({ plans: [], isLicenseUnsupportedEnv: false, isLicenseInfoAvailable: true }); },
  notifyFeatureBlocked(m){ __notices.push(m); return Promise.resolve(true); },
  notifyLicenseRequired(){ __licReq++; return Promise.resolve(true); },
  clearLicenseNotification(){ return Promise.resolve(true); },
};
"""

REF = [{"displayName": "Plan ventas netas", "queryName": "m.Plan", "roles": {"plan": True}, "format": "#,0 €", "isMeasure": True},
       {"displayName": "Ventas netas AA", "queryName": "m.AA", "roles": {"previousYear": True}, "format": "#,0 €", "isMeasure": True},
       {"displayName": "Previsión", "queryName": "m.FC", "roles": {"forecast": True}, "format": "#,0 €", "isMeasure": True}]


def add_refs(dv, which=(0, 1, 2), plan_factor=1.0):
    """Añade Plan / Prior year / Forecast como medidas 4.ª, 5.ª y 6.ª, calculadas en CADA nodo con sus propias series."""
    mx = dv["matrix"]
    refs = [copy.deepcopy(REF[k]) for k in which]
    nOld = len(mx["valueSources"])
    nNew = nOld + len(refs)
    mx["valueSources"].extend(refs)
    dv["metadata"]["columns"].extend(copy.deepcopy(refs))
    for pnode in mx["columns"]["root"]["children"]:
        for j in range(len(refs)):
            pnode["children"].append({"level": 1, "levelSourceIndex": nOld + j})
    nCols = len(mx["columns"]["root"]["children"])  # periodos + subtotal de columna
    nPer = nCols - 1

    def remap(vals, sub):
        ven = [None] * nCols
        obj = [None] * nCols
        out = {}
        for k, v in vals.items():
            k = int(k)
            p, m = k // nOld, k % nOld
            out[str(p * nNew + m)] = v
            if m == 0: ven[p] = v["value"]
            if m == 2: obj[p] = v["value"]
        for j, kind in enumerate(which):
            for p in range(nCols):
                if kind == 0:
                    # Plan NO aditivo en los subtotales (como un presupuesto fijado por zona): el subtotal del motor
                    # no es la suma de sus hijos, y el visual debe usar el del motor.
                    x = None if obj[p] is None else obj[p] * plan_factor * sub
                elif kind == 1:
                    if p == nPer:
                        x = sum(ven[q - 12] for q in range(12, nPer) if ven[q - 12] is not None) or None
                    else:
                        x = ven[p - 12] if p >= 12 else (None if ven[p] is None else ven[p] * 0.9)
                else:
                    x = None if ven[p] is None else ven[p] * 1.03
                if x is not None:
                    out[str(p * nNew + nOld + j)] = {"value": x, "valueSourceIndex": nOld + j}
        return out

    # Factor por nivel del nodo (hoja 1,00; comercial 1,03; zona 1,07; total 1,10): no aditivo.
    fac = {2: 1.0, 1: 1.03, 0: 1.07, -1: 1.10}

    def walk(n, lv=-1):
        own = n.get("level", lv)
        if "values" in n:
            n["values"] = remap(n["values"], fac.get(own, 1.0))
        for c in n.get("children", []):
            walk(c, own)
    walk(mx["rows"]["root"])
    return dv


async def main():
    os.makedirs(OUT, exist_ok=True)
    res = {"pasada": "gratis" if FREE else "pro"}
    errs = []
    W, Hh = 1100, 560
    vista = {"Z0", "Z0|C0", "Z0|C1", "Z1"}
    async with async_playwright() as p:
        b = await p.chromium.launch()

        async def page(w=W, h=Hh):
            pg = await b.new_page(viewport={"width": w, "height": h})
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            await pg.set_content(f"<html><body style='margin:0;background:#fff'><div id='host' style='position:relative;width:{w}px;height:{h}px'></div></body></html>")
            await pg.add_script_tag(content=H.STUB)
            if FREE:
                await pg.add_script_tag(content=LIC)
            await pg.add_script_tag(path=H.BUNDLE)
            await pg.add_style_tag(content=open(H.CSS, encoding="utf-8").read())
            await pg.evaluate("(guid) => { window.__v = powerbi.visuals.plugins[guid].create({ element: document.getElementById('host'), host: __host }); }", GUID)
            return pg

        async def shot(pg, name):
            await pg.screenshot(path=os.path.join(OUT, PFX + name + ".png"))

        async def events(pg):
            ev = await pg.evaluate("__ev.join('')")
            n = await pg.evaluate("__updates")
            return {"updates": n, "S": ev.count("S"), "F": ev.count("F"), "X": ev.count("X"), "pares_1a1": ev == "SF" * n}

        def dvp(objects=None, which=(0, 1, 2), expanded=vista, **kw):
            return add_refs(H.build(expanded=expanded, objects=objects, **kw)[0], which)

        cols_js = "getComputedStyle(document.querySelector('.st-root')).getPropertyValue('--st-cols')"
        hidden_js = "[...document.querySelector('.st-root').classList].filter(c => c.startsWith('st-hide-')).map(c => c.slice(8))"

        # ── Parte 1: Plan / Prior year / Forecast y varianza ─────────────────────────────────────────
        pg = await page()
        if not FREE:
            await H.upd(pg, dvp(), W, Hh)
            await shot(pg, "01_varianza_plan")
            res["p1_ocultas_por_defecto"] = await pg.evaluate(hidden_js)
            res["p1_cabeceras"] = await pg.evaluate("[...document.querySelectorAll('.st-h1, .st-h2')].map(e => e.textContent).filter(x => x)")
            # Subtotal del motor: Δ = AC(motor) − PL(motor); nunca la suma de los Δ de los hijos.
            res["p1_subtotal_motor"] = await pg.evaluate("""() => { const z = __v.rows.find(r => r.level === 0 && !r.collapsed);
                const kids = z.children.reduce((a, c) => a + (c.vabs || 0), 0);
                return { fila: z.label, real: z.shown[0], plan: z.refs[0], vabs: z.vabs, ok: Math.abs(z.vabs - (z.shown[0] - z.refs[0])) < 1e-6,
                         suma_hijos: kids, distinto_de_suma: Math.abs(kids - z.vabs) > 1 }; }""")
            res["p1_base_cero_o_negativa"] = await pg.evaluate("__v.rows.filter(r => r.vref !== null && r.vref <= 0).map(r => [r.label, r.vref, r.vpct]).slice(0, 3)")
            res["p1_barras"] = await pg.evaluate("""() => { const b = [...document.querySelectorAll('.st-row .st-vb-bar')].filter(x => x.style.display === 'block');
                return { n: b.length, verdes: b.filter(x => x.classList.contains('st-vgood')).length, rojas: b.filter(x => x.classList.contains('st-vbad')).length,
                         negativas_a_la_izquierda: b.filter(x => x.classList.contains('st-vb-neg')).every(x => parseFloat(x.style.left) + parseFloat(x.style.width) <= parseFloat(x.parentNode.querySelector('.st-vb-axis').style.left) + 0.2) }; }""")
            await H.upd(pg, dvp({"variance": {"base": "previousYear"}, "values": {"invert": True}}), W, Hh)
            await shot(pg, "02_varianza_aa_bajada_buena")
            res["p1_aa_invertido_cabecera"] = await pg.evaluate("document.querySelector('.st-h2-vabs') ? document.querySelector('.st-h2-vabs').textContent : ''")
            await H.upd(pg, dvp({"variance": {"showAbs": False, "showPct": False}}), W, Hh)
            await shot(pg, "03_solo_barra")
            await H.upd(pg, dvp({"variance": {"base": "forecast", "showBar": False}}), W, Hh)
            res["p1_base_forecast"] = await pg.evaluate("[document.querySelector('.st-h1') && [...document.querySelectorAll('.st-h-vabs .st-h1, .st-h2-vabs')].map(e => e.textContent)]")
            await H.upd(pg, dvp(which=(1,)), W, Hh)
            res["p1_sin_plan_usa_aa"] = await pg.evaluate("[...document.querySelectorAll('.st-h-vabs .st-h1, .st-h2-vabs')].map(e => e.textContent)")
            await H.upd(pg, dvp(), 700, 300)
            await shot(pg, "04_estrecho_700")
            res["p1_estrecho_columnas"] = await pg.evaluate(hidden_js)
            await H.upd(pg, dvp({"rows": {"sortBy": "varPct"}}), W, Hh)
            res["p1_orden_varPct"] = await pg.evaluate("__v.rows.filter(r => r.level === 0).map(r => r.vpct === null ? null : +r.vpct.toFixed(4))")
            # Tooltip de fila con la varianza
            await pg.evaluate("() => { window.__tipItems = null; __host.tooltipService.show = (o) => { window.__tipItems = o.dataItems; __tips++; }; }")
            await H.upd(pg, dvp({"rows": {"tooltips": "row"}}), W, Hh)
            box = await pg.evaluate("(() => { const r = document.querySelector('.st-row[data-i=\"1\"] .st-c-vabs').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()")
            await pg.mouse.move(box[0], box[1])
            await pg.wait_for_timeout(450)
            res["p1_tooltip"] = await pg.evaluate("(__tipItems || []).map(i => i.displayName + ': ' + i.value)")
            await pg.mouse.move(2, 2)
        else:
            # Lector sin licencia: referencias en GRIS (no un hueco), sin varianza ni marca.
            await H.upd(pg, dvp(), W, Hh, view=0)
            await pg.wait_for_timeout(80)
            await H.upd(pg, dvp(), W, Hh, view=0)
            await shot(pg, "01_lectura_referencias_en_gris")
            res["p1_lectura_ocultas"] = await pg.evaluate(hidden_js)
            res["p1_lectura_ref_color"] = await pg.evaluate("getComputedStyle(document.querySelector('.st-row .st-c-pl')).color")
            res["p1_lectura_marca"] = await pg.evaluate("!!document.querySelector('.st-watermark') && document.querySelector('.st-watermark').style.display !== 'none'")
            res["p1_lectura_avisos"] = await pg.evaluate("__notices.slice()")
            # Editando: vista previa con marca que nombra la función y aviso de Power BI.
            await H.upd(pg, dvp(), W, Hh, view=1)
            await pg.evaluate("() => { const g = document.querySelector('.st-guide'); if (g) g.style.display = 'none'; }")
            await shot(pg, "02_edicion_vista_previa_marca")
            res["p1_edicion_ocultas"] = await pg.evaluate(hidden_js)
            res["p1_edicion_marca"] = await pg.evaluate("document.querySelector('.st-watermark') ? document.querySelector('.st-watermark').textContent : ''")
            res["p1_edicion_avisos"] = await pg.evaluate("__notices.slice()")
            # Apagar la varianza quita la marca (solo quedan referencias, gratis).
            await H.upd(pg, dvp({"variance": {"show": False}}), W, Hh, view=1)
            res["p1_edicion_sin_varianza_marca"] = await pg.evaluate("document.querySelector('.st-watermark').style.display")
        res["p1_eventos"] = await events(pg)
        await pg.close()

        await b.close()
    res["errores"] = errs
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(res, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
