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
TEMPLATES = [("report", "Report theme"), ("classic", "Classic")]

# (propiedad, etiqueta, tipo, por defecto, extra)   tipo: bool | num | fill | enum | text
OBJECTS = [
    ("style", "Style template", [
        ("template", "Template", "enum", "report", {"items": TEMPLATES}),
        ("guide", "Setup guide", "bool", True, {}),
    ]),
    # Lo que enseña la columna de valor y contra qué se compara Δ / Δ%.
    ("values", "Values", [
        ("valueMode", "Value shows", "enum", "last", {"items": [("last", "Last period"), ("total", "Total of the range")]}),
        ("compare", "Change vs", "enum", "previous", {"items": [("previous", "Previous period"), ("lastYear", "Same period last year")]}),
        ("showDelta", "Show change (Δ)", "bool", True, {}),
        ("showDeltaPct", "Show change % (Δ%)", "bool", True, {}),
        ("invert", "A decrease is good", "bool", False, {}),
        ("upColor", "Increase color", "fill", "", {}),
        ("downColor", "Decrease color", "fill", "", {}),
        # Regla documentada en PRUEBA-BLOQUE1.md: |base| < umbral % × mediana de |base| de las filas del mismo nivel.
        ("smallBase", "Dim Δ% on small bases (% of level median)", "num", 10, {"min": 0, "max": 100}),
        ("fontSize", "Text size", "num", 11, {"min": 8, "max": 18}),
    ]),
    ("sparkline", "Sparkline", [
        ("type", "Type", "enum", "line", {"items": [("line", "Line"), ("area", "Area"), ("column", "Column"),
                                                   ("winloss", "Win/loss"), ("bullet", "Bullet")]}),
        ("scale", "Scale", "enum", "level", {"items": [("level", "Shared by level"), ("row", "Per row")]}),
        ("zero", "Start at zero", "bool", False, {}),
        ("width", "Line width", "num", 1.5, {"min": 0.5, "max": 4}),
        ("color", "Color", "fill", "", {}),
        ("accent", "Last point color", "fill", "", {}),
        ("showLast", "Show last value", "bool", True, {}),
        ("target", "Show target line", "bool", True, {}),
        ("targetColor", "Target color", "fill", "", {}),
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
        ("indent", "Indent per level", "num", 14, {"min": 0, "max": 40}),
        ("grandTotal", "Grand total", "bool", True, {}),
        # value/value2/value3: el visual pone en el panel el nombre de cada medida y quita las que no están.
        ("sortBy", "Sort by", "enum", "host", {"items": [("host", "Power BI order"), ("name", "Name"), ("value", "Value"),
                                                        ("value2", "Value 2"), ("value3", "Value 3"),
                                                        ("delta", "Change (Δ)"), ("deltaPct", "Change % (Δ%)")]}),
        ("sortDir", "Sort direction", "enum", "desc", {"items": [("desc", "Descending"), ("asc", "Ascending")]}),
    ]),
    ("header", "Column headers", [
        ("show", "Show column headers", "bool", True, {}),
        ("fontSize", "Text size", "num", 11, {"min": 8, "max": 18}),
        ("context", "Show period line", "bool", True, {}),
    ]),
]

# Orden común de la colección: Style template, tarjetas propias (de lo más usado a lo menos).
PANE = [
    ("style", "Style template", [("style", None, None)]),
    ("values", "Values", [("values", None, None)]),
    ("sparkline", "Sparkline", [("sparkline", None, None)]),
    ("markers", "Markers", [("markers", None, None)]),
    ("rows", "Rows", [("rows", None, None)]),
    ("header", "Column headers", [("header", None, "show")]),
]

# subTotals: lo exige "subtotals" de capabilities (propertyIdentifier). No sale en el panel (el visual lo pinta siempre).
SUBTOTALS = {"properties": {
    "rowSubtotals": {"type": {"bool": True}},
    "perRowLevel": {"type": {"bool": True}},
    "columnSubtotals": {"type": {"bool": True}},
    "perColumnLevel": {"type": {"bool": True}},
    "levelSubtotalEnabled": {"type": {"bool": True}},
    "rowSubtotalsType": {"type": {"enumeration": [{"value": "Top", "displayName": "Top"}, {"value": "Bottom", "displayName": "Bottom"}]}},
}}


def cap_type(t):
    return {"bool": {"bool": True}, "num": {"numeric": True}, "fill": {"fill": {"solid": {"color": True}}},
            "text": {"text": True}}.get(t)


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
          "export type PropType = \"bool\" | \"num\" | \"fill\" | \"enum\" | \"text\";",
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
    enp = os.path.join(ROOT, "stringResources", "en-US", "resources.resjson")
    os.makedirs(os.path.dirname(enp), exist_ok=True)
    io.open(enp, "w", encoding="utf-8", newline="\n").write(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    print("formato:", len(objs), "objetos ·", len(out), "claves en-US (sin las de tiempo de ejecución)")


if __name__ == "__main__":
    generar()
