# -*- coding: utf-8 -*-
"""Infografías de la ficha (1366x768): docs/infographic.html y docs/infographic-pro.html, y sus PNG en assets/.

Imágenes de entrada (tools/img/), ya recortadas y limpias: ningún recorte incluye el sello "[test …]" del simulador
(abajo a la derecha) ni la marca de agua "Pro preview"; donde queda texto de la interfaz que no hace falta se tapa
con el fondo. Se regeneran con `python tools/gen_infographic.py --preparar` a partir de:
- assets/Image_1.png, Image_2.png, Image_3.png: capturas reales de Power BI Desktop.
- tools/simulador/capturas/: tipos de minigráfico (02_*), buscador (35), formato por niveles (20),
  seis estilos (b2_13_*), imágenes por fila (b2_19), fx en el fondo del valor (b2_15). Todas sin marca de agua.
python tools/gen_infographic.py
"""
import asyncio, base64, io, os, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "tools", "img")
CAP = os.path.join(ROOT, "tools", "simulador", "capturas")
DOC = "https://tinocallarisa-web.github.io/sparkline-table/support.html"
ESTILOS = ("boardroom", "ledger", "editorial", "signal", "aurora", "terrace")

# nombre en tools/img -> (origen, caja de recorte, rectángulos a tapar [coordenadas del origen]); se rellenan con el
# color del fondo justo a su derecha. Ningún recorte llega a la esquina inferior derecha, donde va el sello [test …].
RECORTES = {
    "desktop_table.png":   ("assets/Image_2.png", (52, 170, 956, 417), []),     # una columna de minigráfico (gratis)
    "desktop_bullet.png":  ("assets/Image_3.png", (585, 172, 955, 436), []),
    "desktop_scorecard.png": ("assets/Image_1.png", (52, 170, 958, 742), []),   # varianza y estado (Pro)
    "desktop_three.png":   ("assets/Image_2.png", (712, 170, 1312, 345), []),   # tres columnas de minigráfico (Pro)
    "desktop_horizon.png": ("assets/Image_2.png", (1135, 497, 1312, 742), []),  # horizon (Pro)
    "type_line.png":       ("CAP/02_1_tipo_line.png", (690, 34, 960, 196), []),
    "type_area.png":       ("CAP/02_2_tipo_area.png", (690, 34, 960, 196), []),
    "type_column.png":     ("CAP/02_3_tipo_column.png", (690, 34, 960, 196), []),
    "type_winloss.png":    ("CAP/02_4_tipo_winloss.png", (718, 34, 960, 196), []),
    "search.png":          ("CAP/35_buscador.png", (0, 0, 690, 130), [(288, 4, 380, 24)]),
    "levels.png":          ("CAP/20_formato_por_niveles.png", (0, 30, 690, 152), []),
    "row_images.png":      ("CAP/b2_19_imagenes_pro.png", (0, 30, 396, 230), []),
    "fx_background.png":   ("CAP/b2_15_fx_fondo_del_valor.png", (0, 30, 560, 230), []),
}
for _e, _n in zip(ESTILOS, range(1, 7)):
    RECORTES[f"style_{_e}.png"] = (f"CAP/b2_13_{_n}_estilo_{_e}.png", (560, 75, 1100, 330), [])


def preparar():
    os.makedirs(IMG, exist_ok=True)
    for nombre, (origen, caja, tapas) in RECORTES.items():
        ruta = os.path.join(CAP, origen[4:]) if origen.startswith("CAP/") else os.path.join(ROOT, origen)
        im = Image.open(ruta).convert("RGB")
        d = ImageDraw.Draw(im)
        for r in tapas:
            d.rectangle(r, fill=im.getpixel((r[2] + 4, r[3] - 2)))
        im.crop(caja).save(os.path.join(IMG, nombre))
        print(nombre, "<-", origen, caja)


def data_uri(name, width):
    im = Image.open(os.path.join(IMG, name)).convert("RGB")
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, "JPEG", quality=92)
    return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()


CSS = """
:root{--bg:#FAF9F5;--bg2:#EDE9DE;--line:#DAD9D4;--t1:#3D3929;--t2:#535146;--t3:#83827D;--acc:#2B6CB0;--accd:#1F4E80;--acc2:#3E9C5B;--acc2l:#E3F2E8;--red:#C0392B}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#888;font-family:'Segoe UI',system-ui,sans-serif}
#infographic{background:var(--bg);color:var(--t1);width:1366px;height:768px;overflow:hidden;padding:22px 34px 14px;display:flex;flex-direction:column;gap:12px}
.head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}
.head h1{font-family:Poppins,'Segoe UI',sans-serif;font-size:32px;font-weight:700;line-height:1.05}
.head h1 span{color:var(--acc)}
.head p{font-size:15px;color:var(--t2);margin-top:6px;max-width:960px}
.brand{font-size:12px;color:var(--t3);text-align:right;line-height:1.5;white-space:nowrap}
.brand b{color:var(--acc)}
.grid{display:grid;gap:14px;flex:1;min-height:0}
.col{display:flex;flex-direction:column;gap:12px;min-height:0}
.card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 16px;min-height:0}
.card h3{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--t3);margin-bottom:8px}
.shot{background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px;display:flex;flex-direction:column;min-height:0}
.shot img{width:100%;height:auto;display:block}
.shot .cap{font-size:12px;color:var(--t3);padding:6px 4px 0;line-height:1.35}
.shot .cap b{color:var(--t1)}
.row{display:grid;gap:12px}
.fix img{height:var(--h);object-fit:contain;object-position:left top;background:#fff}
ul.l{list-style:none;display:grid;gap:6px}
ul.l li{font-size:13px;color:var(--t2);padding-left:18px;position:relative;line-height:1.35}
ul.l li::before{content:"";position:absolute;left:2px;top:6px;width:8px;height:8px;border-radius:2px;background:var(--acc)}
ul.l.pro li::before{background:var(--acc2)}
ul.l strong,.card p strong{color:var(--t1)}
.chip{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.8px;padding:2px 8px;border-radius:999px;margin-left:6px;vertical-align:middle}
.chip.free{background:#E6EEF8;color:var(--accd)} .chip.pro{background:var(--acc2l);color:#2F7A47}
.types{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}
.types figure,.styles figure{position:relative;border-radius:6px;overflow:hidden;border:1px solid var(--line)}
.types img,.styles img{width:100%;height:auto!important;display:block}
.types figcaption,.styles figcaption{position:absolute;left:0;bottom:0;font-size:10.5px;font-weight:700;color:#fff;background:rgba(30,30,30,.72);padding:1px 7px;border-top-right-radius:6px}
.styles{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.foot{display:flex;justify-content:space-between;gap:20px;font-size:12px;color:var(--t3)}
.foot b{color:var(--t2)}
"""


def page(title, body):
    return (f'<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>{title}</title>'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&display=swap">'
            f'<style>{CSS}</style></head><body><div id="infographic">{body}</div></body></html>\n')


FOOT = f'<div class="foot"><span>{{izq}}</span><span>tcviz.com · Documentation: {DOC}</span></div>'


def general():
    tipos = "".join(
        f'<figure><img src="{data_uri(f"type_{t}.png", 400)}" alt=""><figcaption>{c}</figcaption></figure>'
        for t, c in (("line", "Line"), ("area", "Area"), ("column", "Column"), ("winloss", "Win/loss")))
    body = f"""
<div class="head"><div><h1>Sparkline Table <span>by TCViz</span></h1>
<p>Which rows are drifting from plan — and is it a trend or one bad month? Your hierarchy with Power BI's own subtotals, the change against last period or last year, and a sparkline on every row.</p></div>
<div class="brand"><b>tcviz.com</b><br>Power BI custom visual · no network requests</div></div>
<div class="grid" style="grid-template-columns:790px 1fr">
  <div class="col">
    <div class="shot"><img src="{data_uri('desktop_table.png', 1600)}" alt="">
      <div class="cap"><b>Region › Store</b> with the subtotals Power BI calculates · value of the last month, <b>Δ and Δ%</b> vs the month before, more measures as columns · a sparkline on every row, scaled per row in detail rows.</div></div>
    <div class="row" style="grid-template-columns:330px 1fr;flex:1">
      <div class="shot"><img src="{data_uri('desktop_bullet.png', 700)}" alt="">
        <div class="cap"><b>Bullet with bands</b> · each store against its own target, with the % of target.</div></div>
      <div class="shot"><div class="types">{tipos}</div>
        <div class="cap"><b>Line, area, column, win/loss and bullet</b> · scale per row or shared by level.</div></div>
    </div>
  </div>
  <div class="col">
    <div class="card" style="flex:1"><h3>Free <span class="chip free">FREE</span></h3><ul class="l">
      <li><strong>Every row</strong>: it keeps asking until Power BI has sent them all</li>
      <li><strong>Up to 3 levels</strong> with subtotals calculated by Power BI, level buttons <strong>1 · 2 · 3</strong></li>
      <li>Value of the <strong>last period</strong> or the total of the range</li>
      <li><strong>Δ and Δ%</strong> with a sign, vs the previous period or the same period last year</li>
      <li><strong>Five sparkline types</strong>, scale per row or shared by level</li>
      <li><strong>Bullet with qualitative bands</strong> and % of target; a target line on every sparkline</li>
      <li>Plan, Prior year and Forecast as <strong>grey reference columns</strong></li>
      <li>Data bars, search box, sort by any column; rows without actual are hidden</li>
      <li>Formatting per level, row height, spacing and gridlines</li>
      <li>Report theme, bookmarks, keyboard, high contrast, <strong>12 languages</strong></li></ul></div>
    <div class="shot"><img src="{data_uri('search.png', 1000)}" alt=""><div class="cap"><b>Search box</b> · finds a row among the loaded ones and shows its path.</div></div>
    <div class="shot"><img src="{data_uri('levels.png', 1000)}" alt=""><div class="cap"><b>Formatting per level</b> · background, font and size for each level and the total.</div></div>
  </div>
</div>
{FOOT.format(izq="<b>Pro</b> adds variance vs plan, status icons, up to 3 sparkline columns, horizon, six styles, fx and row images.")}
"""
    return page("Sparkline Table by TCViz — Visual Guide", body)


def pro():
    estilos = "".join(
        f'<figure><img src="{data_uri(f"style_{e}.png", 330)}" alt=""><figcaption>{e.title()}</figcaption></figure>'
        for e in ESTILOS)
    body = f"""
<div class="head"><div><h1>Sparkline Table <span>Pro</span></h1>
<p>The control reading: which rows are off plan, by how much, and whether it is getting worse — on every row and every subtotal.</p></div>
<div class="brand"><b>tcviz.com</b><br>Pro preview while you edit · licence on Microsoft AppSource</div></div>
<div class="grid" style="grid-template-columns:690px 1fr">
  <div class="col">
    <div class="shot"><img src="{data_uri('desktop_scorecard.png', 1400)}" alt="">
      <div class="cap"><b>Variance against Plan, Prior year or Forecast</b> · ΔPL, variance bar and ΔPL% on every row and subtotal · <b>status</b> by your thresholds: ● good ▲ fair ◆ poor.</div></div>
    <div class="card" style="flex:1"><h3>Pro <span class="chip pro">PRO</span></h3><ul class="l pro" style="grid-template-columns:1fr 1fr;column-gap:18px;gap:5px;margin-bottom:8px">
      <li><strong>Variance</strong> vs Plan, Prior year or Forecast</li>
      <li><strong>Status icons</strong> by shape and colour</li>
      <li><strong>Up to 3 sparkline columns</strong> and horizon</li>
      <li><strong>Six collection styles</strong></li>
      <li><strong>Conditional formatting (fx)</strong></li>
      <li><strong>An image per row</strong> (Base64)</li></ul>
      <p style="font-size:12.5px;color:var(--t2);line-height:1.4">No licence? Pro features you turn on while editing are drawn on your own data under a <strong>“Pro preview”</strong> watermark; report readers see the free table, with the references in grey.</p></div>
  </div>
  <div class="col">
    <div class="shot"><img src="{data_uri('desktop_three.png', 1200)}" alt="">
      <div class="cap"><b>Up to 3 sparkline columns</b>, each with its own measure, type and scale.</div></div>
    <div class="row fix" style="grid-template-columns:0.62fr 1fr 1.25fr;--h:96px">
      <div class="shot"><img src="{data_uri('desktop_horizon.png', 400)}" alt=""><div class="cap"><b>Horizon</b> sparkline.</div></div>
      <div class="shot"><img src="{data_uri('row_images.png', 600)}" alt=""><div class="cap"><b>Row images</b> (flags, logos) as Base64.</div></div>
      <div class="shot"><img src="{data_uri('fx_background.png', 700)}" alt=""><div class="cap"><b>Conditional formatting (fx)</b> on value, background, sparkline.</div></div>
    </div>
    <div class="shot" style="flex:1"><div class="styles">{estilos}</div>
      <div class="cap"><b>Six collection styles</b> that match other TCViz visuals.</div></div>
  </div>
</div>
{FOOT.format(izq="Everything is computed inside your report. No network requests.")}
"""
    return page("Sparkline Table by TCViz — Pro", body)


async def render(html_path, png_path):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1366, "height": 768})
        await pg.goto("file:///" + html_path.replace("\\", "/"))
        await pg.wait_for_timeout(800)
        el = await pg.query_selector("#infographic")
        await el.screenshot(path=png_path)
        await b.close()


def main():
    if "--preparar" in sys.argv:
        preparar()
    os.makedirs(os.path.join(ROOT, "assets"), exist_ok=True)
    for nombre, f, png in (("infographic.html", general, "infographic.png"), ("infographic-pro.html", pro, "infographic-pro.png")):
        h = os.path.join(ROOT, "docs", nombre)
        io.open(h, "w", encoding="utf-8", newline="\n").write(f())
        asyncio.run(render(h, os.path.join(ROOT, "assets", png)))
        print(nombre, "->", png, Image.open(os.path.join(ROOT, "assets", png)).size)


if __name__ == "__main__":
    main()
