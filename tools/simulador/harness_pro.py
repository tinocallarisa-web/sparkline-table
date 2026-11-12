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

        # ── Parte 2: estado por umbral ───────────────────────────────────────────────────────────────
        pg = await page()
        st_on = {"status": {"show": True}}
        if not FREE:
            await H.upd(pg, dvp(st_on), W, Hh)
            await shot(pg, "05_estado_columna")
            res["p2_estados"] = await pg.evaluate("""() => { const c = [...document.querySelectorAll('.st-row .st-c-stat')];
                return { bueno: c.filter(x => x.textContent === '●').length, neutro: c.filter(x => x.textContent === '▲').length, malo: c.filter(x => x.textContent === '◆').length }; }""")
            # Comprobación de la regla con los datos: ΔPL% ≥ 0 bueno, < −5 % malo.
            res["p2_regla_ok"] = await pg.evaluate("""() => __v.rows.every(r => r.vpct === null ? r.status === 0 : (r.vpct >= 0 ? r.status === 3 : r.vpct < -0.05 ? r.status === 1 : r.status === 2))""")
            await H.upd(pg, dvp({"status": {"show": True, "position": "value", "goodFrom": 5, "badBelow": -20}, "values": {"invert": True}}), W, Hh)
            await shot(pg, "06_estado_junto_al_valor_invertido")
            res["p2_regla_invertida_ok"] = await pg.evaluate("""() => __v.rows.every(r => r.vpct === null ? r.status === 0 : (-r.vpct >= 0.05 ? r.status === 3 : -r.vpct < -0.20 ? r.status === 1 : r.status === 2))""")
            # Sin referencia: sobre el Δ% del periodo.
            await H.upd(pg, H.build(expanded=vista, objects=st_on)[0], W, Hh)
            res["p2_sin_referencia_usa_delta"] = await pg.evaluate("__v.rows.slice(0, 4).map(r => [r.label, r.deltaPct === null ? null : +r.deltaPct.toFixed(3), r.status])")
            await pg.evaluate("() => { window.__tipItems = null; __host.tooltipService.show = (o) => { window.__tipItems = o.dataItems; __tips++; }; }")
            await H.upd(pg, dvp({"status": {"show": True}, "rows": {"tooltips": "row"}}), W, Hh)
            box = await pg.evaluate("(() => { const r = document.querySelector('.st-row[data-i=\"2\"] .st-c-stat').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()")
            await pg.mouse.move(box[0], box[1])
            await pg.wait_for_timeout(450)
            res["p2_tooltip_regla"] = await pg.evaluate("(__tipItems || []).filter(i => /Estado|Status/.test(i.displayName)).map(i => i.value)")
            await pg.mouse.move(2, 2)
            await pg.evaluate("Object.assign(__pal, {isHighContrast: true, foreground: {value: '#FFFFFF'}, background: {value: '#000000'}}); document.body.style.background = '#000';")
            await H.upd(pg, dvp(st_on), W, Hh)
            await shot(pg, "07_estado_y_varianza_alto_contraste")
            await pg.evaluate("Object.assign(__pal, {isHighContrast: false, foreground: {value: '#252423'}, background: {value: '#FFFFFF'}}); document.body.style.background = '#fff';")
        else:
            await H.upd(pg, dvp(st_on), W, Hh, view=0)
            await pg.wait_for_timeout(80)
            await H.upd(pg, dvp(st_on), W, Hh, view=0)
            res["p2_lectura_sin_estado"] = "stat" in await pg.evaluate(hidden_js)
            await H.upd(pg, dvp(st_on), W, Hh, view=1)
            await pg.evaluate("() => { const g = document.querySelector('.st-guide'); if (g) g.style.display = 'none'; }")
            await shot(pg, "03_edicion_estado_marca")
            res["p2_edicion_marca"] = await pg.evaluate("document.querySelector('.st-watermark').textContent")
        res["p2_eventos"] = await events(pg)
        await pg.close()

        # ── Parte 3: hasta 3 columnas de minigráfico ─────────────────────────────────────────────────
        W3 = 1280
        pg = await page(W3, Hh)
        three = {"spark2": {"show": True, "type": "column", "scale": "row", "color": {"solid": {"color": "#7A1F1F"}}},
                 "spark3": {"show": True, "measure": "value1", "type": "winloss"},
                 "variance": {"showReference": False, "showBar": False}}
        if not FREE:
            await H.upd(pg, dvp(three), W3, Hh)
            await shot(pg, "08_tres_minigraficos")
            res["p3_cabeceras"] = await pg.evaluate("[...document.querySelectorAll('.st-h-spark .st-h1, .st-h-spark2 .st-h1, .st-h-spark3 .st-h1, .st-h2-spark2, .st-h2-spark3')].map(e => e.textContent)")
            res["p3_trazados"] = await pg.evaluate("""() => { const r = document.querySelector('.st-row[data-i="2"]');
                const d = s => { const p = r.querySelector(s); return p && p.getAttribute('d') ? p.getAttribute('d').length : 0; };
                return { s1_linea: d('.st-c-spark .st-line'), s2_columnas: d('.st-c-spark2 .st-pos'), s3_winloss: d('.st-c-spark3 .st-pos') + d('.st-c-spark3 .st-neg'),
                         s2_color: getComputedStyle(r.querySelector('.st-c-spark2 .st-pos')).fill }; }""")
            # Escala propia: la 2.ª (Margen %, por fila) no comparte dominio con la 1.ª (Ventas).
            res["p3_escalas"] = await pg.evaluate("[...__v.ext.keys()].sort()")
            # Tooltip en el 2.º minigráfico: el periodo bajo el ratón
            await pg.evaluate("() => { window.__tipItems = null; __host.tooltipService.show = (o) => { window.__tipItems = o.dataItems; __tips++; }; }")
            box = await pg.evaluate("(() => { const r = document.querySelector('.st-row[data-i=\"2\"] .st-c-spark2 svg').getBoundingClientRect(); return [r.x + r.width - 3, r.y + r.height / 2]; })()")
            await pg.mouse.move(box[0], box[1])
            await pg.wait_for_timeout(450)
            res["p3_tooltip_spark2"] = await pg.evaluate("(__tipItems || []).slice(0, 3).map(i => i.displayName + ': ' + i.value)")
            await pg.mouse.move(2, 2)
            await H.upd(pg, dvp(three), 800, Hh)
            res["p3_estrecho_ocultas"] = await pg.evaluate(hidden_js)
            await shot(pg, "09_tres_minigraficos_estrecho")
        else:
            await H.upd(pg, dvp(three), W3, Hh, view=0)
            await pg.wait_for_timeout(80)
            await H.upd(pg, dvp(three), W3, Hh, view=0)
            res["p3_lectura_ocultas"] = await pg.evaluate(hidden_js)
            await shot(pg, "04_lectura_un_minigrafico")
            await H.upd(pg, dvp(three), W3, Hh, view=1)
            await pg.evaluate("() => { const g = document.querySelector('.st-guide'); if (g) g.style.display = 'none'; }")
            await shot(pg, "05_edicion_tres_minigraficos_marca")
            res["p3_edicion_marca"] = await pg.evaluate("document.querySelector('.st-watermark').textContent")
        res["p3_eventos"] = await events(pg)
        await pg.close()

        # ── Parte 4: seis estilos de la colección ──────────────────────────────────────────────────
        pg = await page()
        styles = ["boardroom", "ledger", "editorial", "signal", "aurora", "terrace"]
        bg_js = "[document.querySelector('.st-root').style.background, document.querySelector('.st-root').style.fontFamily]"
        if not FREE:
            res["p4_fondos"] = {}
            for i, sty in enumerate(styles):
                await H.upd(pg, dvp({"style": {"template": sty}, "status": {"show": True}, "markers": {"max": True, "min": True}}), W, Hh)
                await shot(pg, "13_%d_estilo_%s" % (i + 1, sty))
                res["p4_fondos"][sty] = await pg.evaluate(bg_js)
            await H.upd(pg, H.build(expanded=vista, objects={"style": {"template": "boardroom"}, "sparkline": {"type": "bullet", "scale": "row"}})[0], W, Hh)
            await shot(pg, "14_boardroom_bullet_bandas")
        else:
            await H.upd(pg, dvp({"style": {"template": "aurora"}, "variance": {"show": False}}), W, Hh, view=0)
            await pg.wait_for_timeout(80)
            await H.upd(pg, dvp({"style": {"template": "aurora"}, "variance": {"show": False}}), W, Hh, view=0)
            res["p4_lectura_fondo"] = await pg.evaluate(bg_js)
            await shot(pg, "06_lectura_estilo_cae_a_report_theme")
            await H.upd(pg, dvp({"style": {"template": "aurora"}, "variance": {"show": False}}), W, Hh, view=1)
            await pg.evaluate("() => { const g = document.querySelector('.st-guide'); if (g) g.style.display = 'none'; }")
            res["p4_edicion_fondo"] = await pg.evaluate(bg_js)
            res["p4_edicion_marca"] = await pg.evaluate("document.querySelector('.st-watermark').textContent")
            await shot(pg, "07_edicion_aurora_marca")
        res["p4_eventos"] = await events(pg)
        await pg.close()

        # ── Parte 5: formato condicional fx ─────────────────────────────────────────────────────────
        # Imita lo que Power BI deja con una regla fx y selector comodín: objects evaluados en CADA celda (value) del
        # nodo de matriz. No reproduce el motor: es la forma que el visual espera (verificar en Desktop).
        def with_fx(dv, prop="valueColor", obj="values"):
            def walk(n):
                for k, v in (n.get("values") or {}).items():
                    if v.get("valueSourceIndex") == 0 and isinstance(v.get("value"), (int, float)):
                        col = "#107C10" if v["value"] >= 3000 else "#C4314B"
                        v.setdefault("objects", {}).setdefault(obj, {})[prop] = {"solid": {"color": col}}
                for c in n.get("children", []):
                    walk(c)
            walk(dv["matrix"]["rows"]["root"])
            return dv
        pg = await page()
        if not FREE:
            await H.upd(pg, with_fx(with_fx(dvp({"variance": {"showReference": False}})), "valueBackground"), W, Hh)
            # El fondo de regla con el texto en blanco (color fijo, gratis) para que se lea.
            await H.upd(pg, with_fx(dvp({"variance": {"showReference": False}, "values": {"valueColor": {"solid": {"color": "#FFFFFF"}}}}), "valueBackground"), W, Hh)
            await shot(pg, "15_fx_fondo_del_valor")
            res["p5_fondo"] = await pg.evaluate("[...document.querySelectorAll('.st-row .st-c-val')].slice(0, 6).map(c => [c.textContent, c.style.background, c.style.color])")
            await H.upd(pg, with_fx(dvp({"variance": {"showReference": False}})), W, Hh)
            await shot(pg, "16_fx_color_del_valor")
            res["p5_color"] = await pg.evaluate("[...document.querySelectorAll('.st-row .st-c-val')].slice(0, 6).map(c => [c.textContent, c.style.color])")
            await H.upd(pg, with_fx(dvp({"variance": {"showReference": False}, "sparkline": {"scale": "row"}}), "color", "sparkline"), W, Hh)
            await shot(pg, "17_fx_color_del_minigrafico")
            res["p5_minigrafico"] = await pg.evaluate("[...document.querySelectorAll('.st-row .st-c-spark svg')].slice(0, 6).map(s => s.style.getPropertyValue('--st-line'))")
            res["p5_descriptores"] = await pg.evaluate("""() => { const fm = __v.getFormattingModel(); const out = {};
                for (const c of fm.cards) for (const g of c.groups) for (const s of (g.slices || [])) if (['values-valueColor', 'values-valueBackground', 'sparkline-color'].includes(s.uid)) {
                    const d = s.control.properties.descriptor; out[s.uid] = { instanceKind: d.instanceKind, alt: d.altConstantValueSelector, selector: JSON.stringify(d.selector) }; }
                return out; }""")
        else:
            await H.upd(pg, with_fx(dvp({"variance": {"show": False}})), W, Hh, view=0)
            await pg.wait_for_timeout(80)
            await H.upd(pg, with_fx(dvp({"variance": {"show": False}})), W, Hh, view=0)
            res["p5_lectura_sin_regla"] = await pg.evaluate("[...document.querySelectorAll('.st-row .st-c-val')].slice(0, 4).map(c => c.style.color)")
            await H.upd(pg, with_fx(dvp({"variance": {"show": False}})), W, Hh, view=1)
            await pg.evaluate("() => { const g = document.querySelector('.st-guide'); if (g) g.style.display = 'none'; }")
            res["p5_edicion_marca"] = await pg.evaluate("document.querySelector('.st-watermark').textContent")
            await shot(pg, "08_edicion_fx_marca")
        res["p5_eventos"] = await events(pg)
        await pg.close()

        # ── Parte 6: imagen por fila dentro del mismo gating ────────────────────────────────────────
        pg = await page()
        # Primero la imagen (add_images supone las 3 medidas del bloque 1) y luego las referencias.
        dvi = lambda: add_refs(H.add_images(H.build(expanded={"Z1"}, objects={"variance": {"show": False}})[0]))
        img_js = """() => ({ dibujadas: [...document.querySelectorAll('.st-row .st-imgbox image')].filter(i => i.getAttribute('href')).length,
            huecos: [...document.querySelectorAll('.st-row .st-imgbox')].filter(b => b.style.display !== 'none').length,
            marca: document.querySelector('.st-watermark') && document.querySelector('.st-watermark').style.display !== 'none' ? document.querySelector('.st-watermark').textContent : '' })"""
        if not FREE:
            await H.upd(pg, dvi(), W, Hh)
            res["p6_pro"] = await pg.evaluate(img_js)
            await shot(pg, "19_imagenes_pro")
        else:
            await H.upd(pg, dvi(), W, Hh, view=0)
            await pg.wait_for_timeout(80)
            await H.upd(pg, dvi(), W, Hh, view=0)
            res["p6_lectura"] = await pg.evaluate(img_js)
            await shot(pg, "09_lectura_sin_imagenes_ni_hueco")
            await H.upd(pg, dvi(), W, Hh, view=1)
            await pg.evaluate("() => { const g = document.querySelector('.st-guide'); if (g) g.style.display = 'none'; }")
            res["p6_edicion"] = await pg.evaluate(img_js)
            await shot(pg, "10_edicion_imagenes_marca")
            # Varias funciones a la vez: la marca nombra dos y "+n".
            todo = add_refs(H.add_images(H.build(expanded={"Z1"}, objects={"status": {"show": True}, "style": {"template": "signal"}})[0]))
            await H.upd(pg, todo, W, Hh, view=1)
            await pg.evaluate("() => { const g = document.querySelector('.st-guide'); if (g) g.style.display = 'none'; }")
            res["p6_edicion_varias"] = await pg.evaluate(img_js)
            res["p6_avisos"] = await pg.evaluate("__notices.slice(-1)")
        res["p6_eventos"] = await events(pg)
        await pg.close()

        # ── Parte 7: horizon ─────────────────────────────────────────────────────────────────────────
        pg = await page()
        hz = {"sparkline": {"type": "horizon"}, "variance": {"show": False}}
        if not FREE:
            await H.upd(pg, dvp(hz), W, Hh)
            await shot(pg, "20_horizon_3_bandas_cero")
            res["p7_bandas"] = await pg.evaluate("""() => { const r = document.querySelector('.st-row[data-i="2"] .st-c-spark .st-hz');
                return [...r.querySelectorAll('path')].map(p => (p.getAttribute('class') || '') + ':' + (p.getAttribute('d') ? p.getAttribute('fill-opacity') : '-')); }""")
            res["p7_cabecera"] = await pg.evaluate("[document.querySelector('.st-h-spark .st-h1').textContent, document.querySelector('.st-h2-spark').textContent]")
            await H.upd(pg, dvp({"sparkline": {"type": "horizon", "horizonBase": "mean", "horizonBands": 2}, "variance": {"show": False}}), W, Hh)
            await shot(pg, "21_horizon_2_bandas_media")
            res["p7_media_neg"] = await pg.evaluate("[...document.querySelectorAll('.st-row .st-c-spark .st-hz-neg')].filter(p => p.getAttribute('d')).length")
            await H.upd(pg, dvp({"sparkline": {"type": "horizon", "horizonBase": "target"}, "style": {"template": "boardroom"}, "variance": {"show": False}}), W, Hh)
            await shot(pg, "22_horizon_objetivo_boardroom")
            await pg.evaluate("() => { window.__tipItems = null; __host.tooltipService.show = (o) => { window.__tipItems = o.dataItems; __tips++; }; }")
            await H.upd(pg, dvp({"sparkline": {"type": "horizon", "horizonBase": "mean"}, "rows": {"tooltips": "row"}, "variance": {"show": False}}), W, Hh)
            box = await pg.evaluate("(() => { const r = document.querySelector('.st-row[data-i=\"2\"] .st-c-val').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()")
            await pg.mouse.move(box[0], box[1])
            await pg.wait_for_timeout(450)
            res["p7_tooltip"] = await pg.evaluate("(__tipItems || []).filter(i => /Horizon|horizonte/i.test(i.displayName)).map(i => i.displayName + ': ' + i.value)")
            await pg.mouse.move(2, 2)
            await H.upd(pg, dvp({"spark2": {"show": True, "type": "horizon"}, "variance": {"show": False}}), 1280, Hh)
            res["p7_spark2"] = await pg.evaluate("[...document.querySelectorAll('.st-row .st-c-spark2 .st-hz path')].filter(p => p.getAttribute('d')).length")
            await pg.evaluate("Object.assign(__pal, {isHighContrast: true, foreground: {value: '#FFFFFF'}, background: {value: '#000000'}}); document.body.style.background = '#000';")
            await H.upd(pg, dvp({"sparkline": {"type": "horizon", "horizonBase": "mean"}, "variance": {"show": False}}), W, Hh)
            await shot(pg, "23_horizon_alto_contraste")
            await pg.evaluate("Object.assign(__pal, {isHighContrast: false, foreground: {value: '#252423'}, background: {value: '#FFFFFF'}}); document.body.style.background = '#fff';")
        else:
            await H.upd(pg, dvp(hz), W, Hh, view=0)
            await pg.wait_for_timeout(80)
            await H.upd(pg, dvp(hz), W, Hh, view=0)
            res["p7_lectura_cae_a_linea"] = await pg.evaluate("[document.querySelector('.st-row .st-c-spark svg').getAttribute('class'), !!document.querySelector('.st-row .st-c-spark .st-line').getAttribute('d')]")
            await H.upd(pg, dvp(hz), W, Hh, view=1)
            await pg.evaluate("() => { const g = document.querySelector('.st-guide'); if (g) g.style.display = 'none'; }")
            res["p7_edicion_marca"] = await pg.evaluate("document.querySelector('.st-watermark').textContent")
            await shot(pg, "11_edicion_horizon_marca")
        res["p7_eventos"] = await events(pg)
        await pg.close()

        # ── Bullet (gratis, hallazgo de Tino): 4 provincias de tamaños muy distintos, escala por fila ──
        if not FREE:
            pg = await page(1100, 260)
            def provincias(objects):
                dv = dvp(objects, expanded=set(), n_z=4)
                for z, k in zip(dv["matrix"]["rows"]["root"]["children"][1:], (6.0, 1.1, 0.8, 0.2)):
                    def mul(n):
                        for v in (n.get("values") or {}).values():
                            if isinstance(v.get("value"), (int, float)): v["value"] *= k
                        for c in n.get("children", []): mul(c)
                    mul(z)
                return dv
            await H.upd(pg, provincias({"sparkline": {"type": "bullet"}}), 1100, 260)
            await shot(pg, "18_bullet_4_provincias")
            res["bullet_etiquetas"] = await pg.evaluate("[...document.querySelectorAll('.st-row .st-c-spark .st-lastlbl')].map(t => t.textContent)")
            res["bullet_cabecera"] = await pg.evaluate("[document.querySelector('.st-h-spark .st-h1').textContent, document.querySelector('.st-h2-spark').textContent]")
            # La marca del objetivo cae en la misma fracción del eje en cada fila (eje = max(valor, objetivo, banda) × 1,1).
            res["bullet_x_objetivo"] = await pg.evaluate("[...document.querySelectorAll('.st-row .st-c-spark .st-tgt')].map(p => p.getAttribute('d'))")
            await H.upd(pg, provincias({"sparkline": {"type": "bullet", "bulletLabel": "pct"}}), 1100, 260)
            res["bullet_solo_pct"] = await pg.evaluate("[...document.querySelectorAll('.st-row .st-c-spark .st-lastlbl')].map(t => t.textContent)")
            await pg.evaluate("() => { window.__tipItems = null; __host.tooltipService.show = (o) => { window.__tipItems = o.dataItems; __tips++; }; }")
            await H.upd(pg, provincias({"sparkline": {"type": "bullet"}, "bands": {"showBands": False}}), 1100, 260)
            box = await pg.evaluate("(() => { const r = document.querySelector('.st-row[data-i=\"1\"] .st-c-spark').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()")
            await pg.mouse.move(box[0], box[1])
            await pg.wait_for_timeout(450)
            res["bullet_tooltip"] = await pg.evaluate("(__tipItems || []).map(i => i.displayName + ': ' + i.value)")
            res["bullet_eventos"] = await events(pg)
            await pg.close()

        # ── Parte 1 bis (hallazgo de Tino en Desktop): filas sin real y unidades distintas ────────────
        pg = await page()
        def ghosts(dv):
            """Un comercial y un PDV que solo traen Plan (un plan definido por zona repetido en cada miembro)."""
            mx = dv["matrix"]
            nS = len(mx["valueSources"])
            nPer = len(mx["columns"]["root"]["children"]) - 1
            pi = [i for i, s in enumerate(mx["valueSources"]) if s["roles"].get("plan")][0]
            vals = {str(p * nS + pi): {"value": 1149663.0, "valueSourceIndex": pi} for p in range(nPer + 1)}
            z0 = [c for c in mx["rows"]["root"]["children"] if c.get("identity", {}).get("k") == "Z0"][0]
            z0["children"].append({"level": 1, "levelValues": [{"value": "COM-09", "levelSourceIndex": 0}], "identity": {"k": "Z0|G1"},
                                   "isCollapsed": True, "values": dict(vals)})
            c0 = [c for c in z0["children"] if c.get("identity", {}).get("k") == "Z0|C0"][0]
            c0["children"].append({"level": 2, "levelValues": [{"value": "TV-01", "levelSourceIndex": 0}], "identity": {"k": "Z0|C0|G2"}, "values": dict(vals)})
            return dv
        await H.upd(pg, ghosts(dvp()), W, Hh)
        res["p1b_ocultas_por_defecto"] = await pg.evaluate("[__v.hiddenNoActual, __v.rows.some(r => r.label === 'COM-09' || r.label === 'TV-01')]")
        res["p1b_nota_cabecera"] = await pg.evaluate("document.querySelector('.st-h2-name') ? document.querySelector('.st-h2-name').textContent : ''")
        await shot(pg, "10_filas_sin_real_ocultas")
        await H.upd(pg, ghosts(dvp({"rows": {"noActual": "show"}})), W, Hh)
        res["p1b_mostrar"] = await pg.evaluate("[__v.hiddenNoActual, __v.rows.filter(r => r.label === 'COM-09' || r.label === 'TV-01').length]")
        await shot(pg, "11_filas_sin_real_visibles")
        lit = dvp()
        for col in [lit["matrix"]["valueSources"], lit["metadata"]["columns"]]:
            for s_ in col:
                if s_["roles"].get("plan"):
                    s_["displayName"] = "Plan litros"; s_["format"] = "#,0 \"L\""
        await H.upd(pg, lit, W, Hh, view=1)
        await pg.evaluate("() => { const g = document.querySelector('.st-guide'); if (g) g.style.display = 'none'; }")
        res["p1b_aviso_unidades_edicion"] = await pg.evaluate("document.querySelector('.st-notice').textContent")
        await shot(pg, "12_aviso_unidades_distintas")
        await H.upd(pg, lit, W, Hh, view=0)
        res["p1b_aviso_unidades_lectura"] = await pg.evaluate("document.querySelector('.st-notice').style.display")
        await H.upd(pg, dvp(), W, Hh, view=1)
        res["p1b_misma_unidad_sin_aviso"] = await pg.evaluate("document.querySelector('.st-notice').textContent")
        res["p1b_eventos"] = await events(pg)
        await pg.close()

        await b.close()
    res["errores"] = errs
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(res, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
