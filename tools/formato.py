# -*- coding: utf-8 -*-
"""Tabla ÚNICA del panel de formato de Sparkline Table by TCViz (molde: dev/LineChart/tools/formato.py).

De aquí salen, sin copiar a mano:
  - capabilities.json → "objects" (los dataRoles, el mapeo matrix, subtotales y expandCollapse NO se tocan: están
    validados en Desktop en la prueba de viabilidad),
  - src/formatSpec.ts → la tabla que lee el visual (valores por defecto, panel y on-object),
  - stringResources/en-US → las claves Obj_/Prop_/Enum_ en inglés.
Ejecutar desde la raíz:  python tools/formato.py   (tools/i18n.py lo llama antes de traducir)

Regla de la cartera: los nombres internos (objeto y propiedad) no se renombran nunca una vez publicados.
"""
import io, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Bloque 1: Report theme (por defecto) y Classic. Los seis estilos de la colección (Pro) entran en el bloque 2.
# Bloque 2: los seis estilos de la colección (Pro, con vista previa), con los tokens de Line Chart / KPI Card.
TEMPLATES = [("report", "Report theme"), ("classic", "Classic"), ("boardroom", "Boardroom (Pro)"), ("ledger", "Ledger (Pro)"),
             ("editorial", "Editorial (Pro)"), ("signal", "Signal (Pro)"), ("aurora", "Aurora (Pro)"), ("terrace", "Terrace (Pro)")]

# Horizon (Pro, bloque 2): sexto tipo. Bandas por signo alrededor de una base, escala siempre por fila.
SPARK_TYPES = [("line", "Line"), ("area", "Area"), ("column", "Column"), ("winloss", "Win/loss"), ("bullet", "Bullet"), ("horizon", "Horizon (Pro)")]

# (propiedad, etiqueta, tipo, por defecto, extra)   tipo: bool | num | fill | enum | text
OBJECTS = [
    ("style", "Style template", [
        ("template", "Template", "enum", "report", {"items": TEMPLATES}),
        ("guide", "Setup guide", "bool", True, {}),
    ]),
    # Lo que enseña la columna de valor y contra qué se compara Δ / Δ%.
    ("values", "Values", [
        ("compare", "Change vs", "enum", "previous", {"items": [("previous", "Previous period"), ("lastYear", "Same period last year")]}),
        ("showDelta", "Show change (Δ)", "bool", True, {}),
        ("showDeltaPct", "Show change % (Δ%)", "bool", True, {}),
        ("invert", "A decrease is good", "bool", False, {}),
        ("upColor", "Increase color", "fill", "", {}),
        ("downColor", "Decrease color", "fill", "", {}),
        # Regla documentada en PRUEBA-BLOQUE1.md: |base| < umbral % × mediana de |base| de las filas del mismo nivel.
        ("smallBase", "Dim Δ% on small bases (% of level median)", "num", 10, {"min": 0, "max": 100}),
        ("fontSize", "Text size", "num", 11, {"min": 8, "max": 18}),
        # Color del valor y fondo de su celda: el color fijo es gratis; con fx (regla por fila) es Pro.
        ("valueColor", "Value color", "fill", "", {}),
        ("valueBackground", "Value background", "fill", "", {}),
        # Barras de fondo en la celda del valor (gratis): desde cero, escala común por nivel, negativos a la izquierda.
        ("dataBars", "Data bars behind the value", "bool", False, {}),
        ("barColor", "Data bar color", "fill", "", {}),
    ]),
    # Bloque 2 (Pro): columnas de referencia (Plan / Prior year / Forecast) y varianza contra la base, con barra en celda.
    # El lector sin licencia ve las columnas de referencia en gris; la varianza es Pro (vista previa editando).
    ("variance", "Variance (Pro)", [
        ("show", "Show variance", "bool", True, {}),
        ("base", "Compare with", "enum", "auto", {"items": [("auto", "Plan, else prior year"), ("plan", "Plan"),
                                                            ("previousYear", "Prior year"), ("forecast", "Forecast")]}),
        ("showReference", "Reference columns", "bool", True, {}),
        ("showAbs", "Variance (Δ)", "bool", True, {}),
        ("showPct", "Variance % (Δ%)", "bool", True, {}),
        ("showBar", "Variance bar", "bool", True, {}),
        ("goodColor", "Favourable color", "fill", "", {}),
        ("badColor", "Unfavourable color", "fill", "", {}),
    ]),
    # Estado por umbral (Pro): icono con FORMA y color (● bueno, ▲ neutro, ◆ malo, como los conjuntos de iconos de
    # Excel), sobre la varianza % contra la referencia o, sin referencia, sobre el Δ% del periodo.
    ("status", "Status icons (Pro)", [
        ("show", "Show status icons", "bool", False, {}),
        ("position", "Position", "enum", "column", {"items": [("column", "Own column"), ("value", "Next to the value")]}),
        ("goodFrom", "Good from (Δ% ≥)", "num", 0, {"min": -100, "max": 100}),
        ("badBelow", "Poor below (Δ% <)", "num", -5, {"min": -100, "max": 100}),
        ("goodColor", "Good color", "fill", "", {}),
        ("neutralColor", "Fair color", "fill", "", {}),
        ("badColor", "Poor color", "fill", "", {}),
    ]),
    ("sparkline", "Sparkline", [
        ("type", "Type", "enum", "line", {"items": SPARK_TYPES}),
        # auto (propuesta, pendiente de Tino): por fila en el último nivel, común por nivel en los subtotales.
        ("scale", "Scale", "enum", "auto", {"items": [("auto", "Per row in detail rows, shared in subtotals"), ("level", "Shared by level"), ("row", "Per row")]}),
        ("zero", "Start at zero", "bool", False, {}),
        # Curva de línea y área (gratis, 12-11): Smooth = monótona (nunca se pasa de los datos); Step = escalón centrado.
        ("curve", "Curve", "enum", "linear", {"items": [("linear", "Linear"), ("smooth", "Smooth"), ("step", "Step")]}),
        # Color de la línea: neutro (gris con el último punto en color), por fila (paleta del tema) o por tendencia.
        ("lineColor", "Line colour", "enum", "neutral", {"items": [("neutral", "Neutral"), ("row", "Per row"), ("trend", "By trend")]}),
        ("width", "Line width", "num", 1.5, {"min": 0.5, "max": 4}),
        ("horizonBands", "Horizon bands", "num", 3, {"min": 2, "max": 3}),
        ("horizonBase", "Horizon baseline", "enum", "zero", {"items": [("zero", "Zero"), ("mean", "Row average"), ("target", "Target")]}),
        ("color", "Color", "fill", "", {}),
        ("accent", "Last point color", "fill", "", {}),
        ("showLast", "Show last value", "bool", True, {}),
        # Etiqueta del bullet (Tino, 12-11): el valor, el % del objetivo o los dos ("1,54M€ · 101 %").
        ("bulletLabel", "Bullet label", "enum", "both", {"items": [("value", "Value"), ("pct", "% of target"), ("both", "Value and % of target")]}),
        ("target", "Show target line", "bool", True, {}),
        ("targetColor", "Target color", "fill", "", {}),
    ]),
    # Bandas cualitativas del bullet (gratis, 12-11). Nombres de Bullet Chart Pro (showBands, band1Pct, band2Pct,
    # band1Color..band3Color); aquí los umbrales son % del OBJETIVO.
    # Minigráficos 2 y 3 (Pro): cada uno con su medida de Values, tipo, curva, escala y color. El visual pone en el
    # panel el nombre real de cada medida y quita las que no están.
] + [
    (obj, label, [
        ("show", "Show " + label.replace(" (Pro)", "").lower(), "bool", False, {}),
        ("measure", "Measure", "enum", dflt, {"items": [("value1", "Value 1"), ("value2", "Value 2"), ("value3", "Value 3")]}),
        ("type", "Type", "enum", "line", {"items": SPARK_TYPES}),
        ("curve", "Curve", "enum", "linear", {"items": [("linear", "Linear"), ("smooth", "Smooth"), ("step", "Step")]}),
        ("scale", "Scale", "enum", "level", {"items": [("level", "Shared by level"), ("row", "Per row")]}),
        ("color", "Color", "fill", "", {}),
    ]) for obj, label, dflt in [("spark2", "Sparkline 2 (Pro)", "value2"), ("spark3", "Sparkline 3 (Pro)", "value3")]
] + [
    ("bands", "Qualitative bands", [
        ("showBands", "Show bands", "bool", True, {}),
        ("band1Pct", "Poor below (% of target)", "num", 80, {"min": 0, "max": 200}),
        ("band2Pct", "Good from (% of target)", "num", 95, {"min": 0, "max": 200}),
        ("lowerIsBetter", "Lower is better", "bool", False, {}),
        ("band1Color", "Band 1 (worst)", "fill", "#F6CFCB", {}),
        ("band2Color", "Band 2 (mid)", "fill", "#FBE7B5", {}),
        ("band3Color", "Band 3 (best)", "fill", "#CDE8CF", {}),
    ]),
    ("markers", "Markers", [
        ("last", "Last point", "bool", True, {}),
        ("first", "First point", "bool", False, {}),
        ("max", "Maximum", "bool", False, {}),
        ("min", "Minimum", "bool", False, {}),
        ("negative", "Negative points", "bool", False, {}),
        ("size", "Marker size", "num", 2.5, {"min": 1, "max": 5}),
    ]),
    ("rows", "Rows", [
        ("density", "Density", "enum", "standard", {"items": [("compact", "Compact"), ("standard", "Standard"), ("comfortable", "Comfortable")]}),
        ("fontSize", "Text size", "num", 11, {"min": 8, "max": 18}),
        # 0 = automático (el de la densidad). Si es menor que el texto, manda el texto (alto mínimo = texto + 4 px).
        ("rowHeight", "Row height (px, 0 = automatic)", "num", 0, {"min": 0, "max": 48}),
        ("indent", "Indent per level", "num", 14, {"min": 0, "max": 40}),
        # Hueco mínimo entre columnas: antes de bajar de 12 px se ocultan columnas (prioridad de layout).
        ("colSpacing", "Column spacing (px)", "num", 16, {"min": 12, "max": 40}),
        # Imagen por fila (Pro): hueco reservado para que los nombres queden alineados aunque falte la imagen.
        ("imageGap", "Reserve space for row images", "bool", True, {}),
        ("grandTotal", "Grand total", "bool", True, {}),
        # Filas sin real (Tino en Desktop, 12-11): un Plan definido a otro nivel de detalle (p. ej. por provincia) hace
        # que el motor cree una fila por cada miembro de la dimensión con solo el plan. Gratis; Hide por defecto. Las
        # referencias no cuentan; los subtotales siguen siendo los del motor.
        ("noActual", "Rows without actual", "enum", "hide", {"items": [("hide", "Hide"), ("show", "Show")]}),
        # Tooltips (Tino, 12-11): por defecto solo sobre el minigráfico, para no estorbar al pulsar ▸/▾.
        ("tooltips", "Tooltips", "enum", "sparkline", {"items": [("sparkline", "Sparkline only"), ("row", "Whole row"), ("off", "Off")]}),
        # value/value2/value3: el visual pone en el panel el nombre de cada medida y quita las que no están.
        ("sortBy", "Sort by", "enum", "host", {"items": [("host", "Power BI order"), ("name", "Name"), ("value", "Value"),
                                                        ("value2", "Value 2"), ("value3", "Value 3"),
                                                        ("delta", "Change (Δ)"), ("deltaPct", "Change % (Δ%)"),
                                                        ("varAbs", "Variance (Δ)"), ("varPct", "Variance % (Δ%)")]}),
        ("sortDir", "Sort direction", "enum", "desc", {"items": [("desc", "Descending"), ("asc", "Ascending")]}),
    ]),
    # Líneas de cuadrícula (gratis, Tino 12-11). Verticales centradas en el hueco de Column spacing (no cambian anchos);
    # "Between groups" = nombre | cifras | referencias y varianza | otras medidas | minigráficos, como las matrices
    # financieras. Por defecto entre grupos y muy suaves. Horizontales = la línea bajo cada fila.
    ("grid", "Gridlines", [
        ("vertical", "Vertical lines", "enum", "groups", {"items": [("off", "Off"), ("groups", "Between groups"), ("all", "Between all columns")]}),
        ("vColor", "Vertical color", "fill", "", {}),
        ("vWidth", "Vertical width (px)", "num", 1, {"min": 1, "max": 3}),
        ("vStyle", "Vertical style", "enum", "solid", {"items": [("solid", "Solid"), ("dashed", "Dashed"), ("dotted", "Dotted")]}),
        ("horizontal", "Horizontal lines", "bool", True, {}),
        ("hColor", "Horizontal color", "fill", "", {}),
        ("hWidth", "Horizontal width (px)", "num", 1, {"min": 1, "max": 3}),
    ]),
    ("header", "Column headers", [
        ("show", "Show column headers", "bool", True, {}),
        ("fontSize", "Text size", "num", 11, {"min": 8, "max": 18}),
        ("fontFamily", "Font", "font", "", {}),
        ("bold", "Bold", "bool", True, {}),
        ("color", "Text color", "fill", "", {}),
        ("background", "Background", "fill", "", {}),
        ("context", "Show period line", "bool", True, {}),
        # Buscador (gratis): filtra a la vista las filas cargadas; no filtra el informe ni se guarda.
        ("search", "Search box", "bool", False, {}),
        # Botones de expandir/contraer todo en la cabecera (los guarda el host, como el ▸ de cada fila).
        ("expandButtons", "Expand / collapse all buttons", "bool", True, {}),
    ]),
] + [
    # Formato por nivel (Tino, 11-11): un objeto por nivel, sin selector (fiable con marcadores y temas). Vacío / 0 /
    # Automatic = lo de siempre: subtotales con fondo suave y negrita, hojas normales, colores del tema.
    (obj, label, [
        ("background", "Background", "fill", "", {}),
        ("bgOpacity", "Background opacity (%)", "num", 100, {"min": 0, "max": 100}),
        ("color", "Text color", "fill", "", {}),
        ("fontSize", "Text size (0 = as Rows)", "num", 0, {"min": 0, "max": 24}),
        ("fontFamily", "Font", "font", "", {}),
        ("bold", "Bold", "enum", "auto", {"items": [("auto", "Automatic"), ("on", "On"), ("off", "Off")]}),
        ("italic", "Italic", "bool", False, {}),
        # Imagen al inicio de la fila (Pro, rol Row image; solo data:image/...;base64, nunca URLs).
        ("image", "Show row image (Pro)", "bool", True, {}),
        ("imageSize", "Image size (px, 0 = automatic)", "num", 0, {"min": 0, "max": 48}),
        ("imageShape", "Image shape", "enum", "square", {"items": [("square", "Square"), ("round", "Round")]}),
    ]) for obj, label in [("level1", "Level 1"), ("level2", "Level 2"), ("level3", "Level 3"), ("levelTotal", "Grand total row")]
]

# Orden común de la colección: Style template, tarjetas propias (de lo más usado a lo menos).
PANE = [
    ("style", "Style template", [("style", None, None)]),
    ("values", "Values", [("values", None, None)]),
    ("variance", "Variance (Pro)", [("variance", None, "show")]),
    ("status", "Status icons (Pro)", [("status", None, "show")]),
    ("sparkline", "Sparkline", [("sparkline", None, None)]),
    ("spark2", "Sparkline 2 (Pro)", [("spark2", None, "show")]),
    ("spark3", "Sparkline 3 (Pro)", [("spark3", None, "show")]),
    ("bands", "Qualitative bands", [("bands", None, "showBands")]),
    ("markers", "Markers", [("markers", None, None)]),
    ("rows", "Rows", [("rows", None, None)]),
    # Row levels: el visual la construye en código (un elemento por nivel presente), como el trazo por serie de Line Chart.
    ("levels", "Row levels", []),
    ("header", "Column headers", [("header", None, "show")]),
    ("grid", "Gridlines", [("grid", None, None)]),
]

# subTotals: lo exige "subtotals" de capabilities (propertyIdentifier). No sale en el panel (el visual lo pinta siempre).
SUBTOTALS = {"properties": {
    "rowSubtotals": {"type": {"bool": True}},
    "perRowLevel": {"type": {"bool": True}},
    # columnSubtotals = "Value shows the total of the range": el host solo pide el subtotal de columna si se enciende.
    "columnSubtotals": {"displayName": "Value shows the total of the range", "displayNameKey": "Prop_subTotals_columnSubtotals", "type": {"bool": True}},
    "perColumnLevel": {"type": {"bool": True}},
    "levelSubtotalEnabled": {"type": {"bool": True}},
    "rowSubtotalsType": {"type": {"enumeration": [{"value": "Top", "displayName": "Top"}, {"value": "Bottom", "displayName": "Bottom"}]}},
}}


def cap_type(t):
    return {"bool": {"bool": True}, "num": {"numeric": True}, "fill": {"fill": {"solid": {"color": True}}},
            "text": {"text": True}, "font": {"formatting": {"fontFamily": True}}}.get(t)


def generar():
    caps_p = os.path.join(ROOT, "capabilities.json")
    caps = json.load(io.open(caps_p, encoding="utf-8"))
    objs = {"general": {"properties": {"formatString": {"type": {"formatting": {"formatString": True}}}}},
            "subTotals": SUBTOTALS}
    en = {}
    ts_objs = {}
    for name, label, props in OBJECTS:
        okey = "Obj_" + name
        en[okey] = label
        cp = {}
        tp = []
        for p, plabel, t, d, extra in props:
            pkey = "Prop_%s_%s" % (name, p)
            en[pkey] = plabel
            if t == "enum":
                items = []
                for v, vl in extra["items"]:
                    ekey = "Enum_%s_%s" % (p, v)
                    en[ekey] = vl
                    items.append({"value": v, "displayName": vl, "displayNameKey": ekey})
                cp[p] = {"displayName": plabel, "displayNameKey": pkey, "type": {"enumeration": items}}
            else:
                cp[p] = {"displayName": plabel, "displayNameKey": pkey, "type": cap_type(t)}
            spec = {"name": p, "type": t, "def": d, "key": pkey, "label": plabel}
            if t == "enum":
                spec["items"] = [[v, "Enum_%s_%s" % (p, v), vl] for v, vl in extra["items"]]
            for k in ("min", "max"):
                if k in extra:
                    spec[k] = extra[k]
            tp.append(spec)
        objs[name] = {"displayName": label, "displayNameKey": okey, "properties": cp}
        ts_objs[name] = {"name": name, "key": okey, "label": label, "props": tp}
    caps["objects"] = objs
    caps["supportsOnObjectFormatting"] = True
    caps["enablePointerEventsFormatMode"] = True
    io.open(caps_p, "w", encoding="utf-8", newline="\n").write(json.dumps(caps, indent=2, ensure_ascii=False) + "\n")

    pane = []
    for uid, label, groups in PANE:
        ckey = "Obj_" + uid
        en.setdefault(ckey, label)
        gs = []
        for obj, glabel, toggle in groups:
            g = {"obj": obj, "toggle": toggle}
            if glabel:
                g["key"] = "Grp_" + obj
                g["label"] = glabel
                en[g["key"]] = glabel
            gs.append(g)
        pane.append({"uid": uid, "key": ckey, "label": label, "groups": gs})

    ts = ["/**",
          " * Tabla del panel de formato. Generado por tools/formato.py: no editar a mano.",
          " * Los nombres internos (objeto.propiedad) no se renombran nunca: los informes guardados dejarían de leerlos.",
          " */",
          "export type PropType = \"bool\" | \"num\" | \"fill\" | \"enum\" | \"text\" | \"font\";",
          "export interface PropSpec { name: string; type: PropType; def: string | number | boolean; key: string; label: string;",
          "    items?: [string, string, string][]; min?: number; max?: number; }",
          "export interface ObjSpec { name: string; key: string; label: string; props: PropSpec[]; }",
          "export interface GroupSpec { obj: string; toggle: string | null; key?: string; label?: string; }",
          "export interface CardSpec { uid: string; key: string; label: string; groups: GroupSpec[]; }",
          "export const OBJECTS: Record<string, ObjSpec> = " + json.dumps(ts_objs, ensure_ascii=False, indent=4) + ";",
          "export const PANE: CardSpec[] = " + json.dumps(pane, ensure_ascii=False, indent=4) + ";", ""]
    io.open(os.path.join(ROOT, "src", "formatSpec.ts"), "w", encoding="utf-8", newline="\n").write("\n".join(ts))

    # Las claves de los pozos salen de capabilities.json (displayNameKey / descriptionKey).
    out = {}
    for r in caps["dataRoles"]:
        out[r["displayNameKey"]] = r["displayName"]
        if r.get("descriptionKey"):
            out[r["descriptionKey"]] = r["description"]
    out.update(en)
    out["Prop_subTotals_columnSubtotals"] = SUBTOTALS["properties"]["columnSubtotals"]["displayName"]
    enp = os.path.join(ROOT, "stringResources", "en-US", "resources.resjson")
    os.makedirs(os.path.dirname(enp), exist_ok=True)
    io.open(enp, "w", encoding="utf-8", newline="\n").write(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    print("formato:", len(objs), "objetos ·", len(out), "claves en-US (sin las de tiempo de ejecución)")


if __name__ == "__main__":
    generar()
