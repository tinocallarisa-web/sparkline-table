# -*- coding: utf-8 -*-
"""Páginas publicadas (docs/) de Sparkline Table by TCViz.

Copiado de Line Chart (tools/gen_docs.py): estilo, cabecera y buscador de Word Cloud. El contenido describe lo que
hace el código (capabilities.json, src/visual.ts, src/model.ts, src/formatSpec.ts) y lo probado en PRUEBA-BLOQUE1.md /
PRUEBA-BLOQUE2.md; si cambia una función, cambiarla aquí y regenerar:   python tools/gen_docs.py
Para OKviz: "conditional formatting (fx)" y "dynamic format strings" van escritos tal cual.
El changelog.html sale de CHANGELOG.md (raíz).
Posicionamiento: seguimiento de KPI y real contra plan para muchas filas. No venderla como cuenta de resultados.
"""
import io, json, os, re, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WC = r"C:\tcviz\dev\WordCloud\docs"
NAME = "Sparkline Table by TCViz"
BASE = "https://tinocallarisa-web.github.io/sparkline-table/"
REPO = "https://github.com/tinocallarisa-web/sparkline-table"
PRODUCT = "https://tcviz.com/product/sparkline-table/"
VERSION = json.load(io.open(os.path.join(ROOT, "pbiviz.json"), encoding="utf-8"))["visual"]["version"]
FECHA = "12 November 2026"
# [VIDEO URL — pendiente]: cuando exista, la URL canónica https://www.youtube.com/watch?v=<id> (nunca la corta).
VIDEO = ""

plantilla = io.open(os.path.join(WC, "privacy.html"), encoding="utf-8").read()
HEAD = plantilla[:plantilla.index("<body>")]
HEADER = plantilla[plantilla.index("<header>"):plantilla.index("</header>") + len("</header>")]
sup = io.open(os.path.join(WC, "support.html"), encoding="utf-8").read()
SCRIPT = sup[sup.rindex("<script"):sup.rindex("</script>") + len("</script>")]


def page(title, sub, body, nav="", search=False):
    head = HEAD.replace("Privacy Policy – Word Cloud by TCViz", f"{title} – {NAME}")
    hdr = HEADER.replace("Word Cloud by TCViz", NAME).replace(">Privacy Policy<", f">{html.escape(sub)}<")
    sb = ""
    if search:
        sb = '''<div class="searchbar">
  <div class="searchbox">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <input id="docsearch" type="search" placeholder="Search the documentation — try &quot;plan&quot;, &quot;scale&quot;, &quot;image&quot;, &quot;level&quot;…"
           autocomplete="off" aria-label="Search the documentation">
    <button id="searchclear" type="button" aria-label="Clear search" hidden>&times;</button>
  </div>
  <div id="searchstatus" class="search-status" role="status" aria-live="polite"></div>
</div>
'''
    foot = f'''<footer>
  <div style="margin-bottom:10px;">
    <a href="{BASE}support.html">Documentation</a>
    <a href="{BASE}privacy.html">Privacy Policy</a>
    <a href="{BASE}terms.html">Terms of Use</a>
    <a href="{BASE}changelog.html">Changelog</a>
    <a href="{REPO}/discussions" target="_blank">Discussions</a>
    <a href="{REPO}/issues" target="_blank">Issues</a>
    <a href="{PRODUCT}" target="_blank">tcviz.com</a>
  </div>
  <p>© 2026 TCViz · {NAME} · <a href="mailto:support@tcviz.com">support@tcviz.com</a></p>
</footer>
'''
    return (head + "<body>\n" + hdr + "\n" + nav + sb + body + foot + (SCRIPT if search else "") + "\n</body>\n</html>\n")


def dax(code):
    return ('<pre style="background:var(--bg2);border-radius:6px;padding:10px 12px;margin:8px 0 12px;overflow-x:auto;'
            'white-space:pre-wrap;font-size:12.5px;line-height:1.5"><code style="background:none;padding:0">'
            + html.escape(code) + '</code></pre>')


# ── Datos comunes ────────────────────────────────────────────────────────────
# Límites de campos: capabilities.json → dataViewMappings[0].conditions. Filas: matrix, window de 1.000 por segmento
# con fetchMoreData; periodos: top 400.

FIELDS = [
    ("Rows", "Grouping", "Yes, 1 to 3 fields", "Your hierarchy, outermost first (region › sales rep › store). Each level expands and collapses; subtotal rows are calculated by Power BI, never added up by the visual."),
    ("Period", "Grouping", "Yes, one field", "The sparkline axis: month, quarter, week or date. The value column shows the last period (or the total of the range). Up to 400 periods are drawn."),
    ("Values", "Measure", "Yes, up to 3", "The first measure draws the sparkline, the value, Δ and Δ%. The second and third appear as extra columns (with Pro, each can also have its own sparkline column)."),
    ("Target", "Measure", "No, one field", "A target line on each sparkline, the marker of the bullet and the reference for win/loss. Free."),
    ("Plan (Pro)", "Measure", "No, one field", "Shown free as a grey reference column. With Pro: variance ΔPL, ΔPL% and a variance bar per row and in subtotals."),
    ("Prior year (Pro)", "Measure", "No, one field", "Same as Plan. Variance uses it when there is no Plan, or when you choose it."),
    ("Forecast (Pro)", "Measure", "No, one field", "Same as Plan; choose it in <em>Variance → Compare with</em>."),
    ("Row image (Pro)", "Measure", "No, one field", "An image at the start of the row: a measure, or a text column set to <strong>First</strong>, that returns a Base64 data URI (<code>data:image/png;base64,…</code>). Web links are never loaded."),
    ("Tooltips", "Measure", "No, up to 5", "Extra measures in the tooltip. Report page tooltips are supported."),
]

FREE_PRO = [
    ("Every row: Power BI sends rows in segments of 1,000 and the visual asks for the next until all have arrived — no cut-off by the visual", "✓", "✓"),
    ("Row hierarchy up to 3 levels with subtotals calculated by Power BI, level buttons 1 · 2 · 3, expand and collapse", "✓", "✓"),
    ("Value of the last period or total of the range; Δ and Δ% against the previous period or the same period last year", "✓", "✓"),
    ("Five sparkline types — line, area, column, win/loss, bullet — with curve, line colour, markers and scale (shared by level, per row in detail rows, per row)", "✓", "✓"),
    ("Bullet with qualitative bands and % of target; target line on every sparkline", "✓", "✓"),
    ("Data bars behind the value, search box, rows without actual hidden, repeated references hidden", "✓", "✓"),
    ("Grey reference columns for Plan, Prior year and Forecast", "✓", "✓"),
    ("Formatting per level, row height, column spacing, gridlines; Report theme and Classic templates", "✓", "✓"),
    ("Selection, highlight, keyboard, context menu, bookmarks, format on the canvas, high contrast, 12 languages", "✓", "✓"),
    ("Number format of each measure, dynamic format strings included; no network access", "✓", "✓"),
    ("Variance against Plan, Prior year or Forecast: ΔPL, ΔPL% and a variance bar, per row and in subtotals", "—", "✓"),
    ("Status icons by threshold, with shape and colour", "—", "✓"),
    ("Up to 3 sparkline columns, each with its own measure, type, curve, scale and colour", "—", "✓"),
    ("Six collection styles: Boardroom, Ledger, Editorial, Signal, Aurora, Terrace", "—", "✓"),
    ("Conditional formatting (fx) on the value colour, the value background and the sparkline colour", "—", "✓"),
    ("Image at the start of each row (Base64 data URI)", "—", "✓"),
    ("Horizon sparkline", "—", "✓"),
]

FORMAT = [
    ("Style template", "Report theme (default: the colours of your report theme, like a native visual), Classic, and the six collection styles Boardroom, Ledger, Editorial, Signal, Aurora and Terrace (Pro). Setup guide: turn it back on to see the guide again."),
    ("Values", "<strong>Value shows the total of the range</strong> (off: the last period); Change vs — previous period or same period last year; show Δ and Δ%; <strong>A decrease is good</strong> (for costs: swaps the colours); increase and decrease colours; dim Δ% on small bases (% of the level median, 0 turns it off); text size; value colour and value background, both with conditional formatting (fx) rules (Pro); data bars behind the value and their colour."),
    ("Variance (Pro)", "Show; Compare with — Plan, else prior year (default), Plan, Prior year or Forecast; reference columns; variance (Δ), variance % (Δ%) and the variance bar, each on or off; favourable and unfavourable colours."),
    ("Status icons (Pro)", "Show; position — own column or next to the value; good from (Δ% ≥, default 0%) and poor below (Δ% &lt;, default −5%); good, fair and poor colours. The rule uses the variance % against the reference, or the period Δ% when there is no Plan or Prior year."),
    ("Sparkline", "Type — Line, Area, Column, Win/loss, Bullet, Horizon (Pro); scale — Shared by level, Per row in detail (default), Per row; start at zero (line); curve — Linear, Smooth, Step (line and area); line colour — Neutral, Per row, By trend; line width; horizon bands (2 or 3) and baseline — zero, row average or target (Pro); colour, with conditional formatting (fx) rules (Pro); last point colour; show last value; bullet label — value, % of target or both; show target line and its colour."),
    ("Sparkline 2 (Pro), Sparkline 3 (Pro)", "Show; measure (Value 1, 2 or 3); type; curve; scale; colour."),
    ("Qualitative bands", "For the Bullet type with a positive target. Show; poor below (default 80% of target); good from (default 95%); lower is better (mirrors the thresholds around 100%); three band colours."),
    ("Markers", "Last point (on by default), first point, maximum, minimum and negative points, each with its own shape; marker size."),
    ("Rows", "Density — Compact, Standard, Comfortable; text size; row height (0 = automatic; raised to fit the text); indent per level; column spacing; reserve space for row images; grand total; rows without actual — Hide (default) or Show; repeated references — Hide (default) or Show; tooltips — sparkline only, whole row or off; sort by and sort direction."),
    ("Row levels", "Pick Level 1, 2, 3 or the grand total row: background and its opacity, text colour, text size, font, bold, italic; show row image, image size and shape — square or round (Pro)."),
    ("Column headers", "Show; text size, font, bold, colour, background; show period line; search box; expand / collapse buttons (the level buttons 1 · 2 · 3)."),
    ("Gridlines", "Vertical lines — off, between groups (default) or between all columns, with colour, width (1–3 px) and style; horizontal lines with colour and width."),
]

USE_CASES = [
    ("Stores against plan",
     "Rows = Region › Store, Period = Month, Values = Sales, Plan = Sales plan. With Pro, ΔPL% and the variance bar show which stores are off plan; the sparkline shows whether it is a trend or one bad month. Subtotal rows are the ones Power BI calculates for each region."),
    ("Sales reps month by month",
     "Rows = Area › Sales rep, Values = Sales, Margin %, Orders. The value column shows the last month, Δ% compares with the month before (or with the same month last year). Sort by Δ% with a click on its header to put the biggest drops first."),
    ("Products against a target",
     "Rows = Category › Product, Target = the target measure, Sparkline type = Bullet. Each row is compared with its own target; the bands say poor, fair or good, and the label reads “1.54M · 101%”."),
    ("Plants and KPIs with status (Pro)",
     "Rows = Plant › Line, Values = Output, Plan = Output plan, Status icons on: ● good, ▲ fair, ◆ poor, by your own thresholds. Up to three sparkline columns show output, scrap rate and downtime side by side."),
    ("Long lists",
     "Thousands of rows (stores, customers, SKUs): rows arrive in segments and the table scrolls without redrawing everything. The search box finds a row among the loaded ones and shows it with its path."),
]

TROUBLE = [
    ("The plan shows “—” below a certain level",
     "<p>Your plan measure is defined at one level only (for example by region), and Power BI repeats the region's plan on every store under it. "
     "With <em>Rows → Repeated references = Hide</em> (default) the visual detects the level where the plan stops being defined and shows “—” from there on, "
     "with no variance against it; the header says “Plan: available down to Region”. See the recipe in the FAQ to stop the measure going down.</p>"),
    ("Rows with only the plan appear",
     "<p>A measure defined at another level of detail returns a value for every row of the dimension, also where nothing was sold. "
     "<em>Rows → Rows without actual = Hide</em> (default) hides rows where all Values are blank; the header says how many. Subtotals do not change: they are Power BI's. The FAQ has the DAX fix.</p>"),
    ("“Same period last year is not available on this axis”",
     "<p>The visual needs to know which period is the same one a year earlier. It recognises dates, <code>2026-09</code>, <code>202609</code>, <code>09-2026</code>, "
     "<code>2026-Q3</code> / <code>Q3 2026</code>, <code>Sep 2026</code> and years. With another format it compares with the previous period and says so.</p>"),
    ("Δ% is empty for a row",
     "<p>The base is zero or negative, so a percentage would not mean anything. The tooltip says so. Δ% is also shown dimmed when the base is very small compared with the rest of its level "
     "(<em>Values → Dim Δ% on small bases</em>).</p>"),
    ("The value column is empty but the sparkline has data",
     "<p>The value column shows the last period of the axis, the same for every row. A row without data in that period has an empty value; its sparkline ends at its own last point, "
     "and the label next to it shows that month, dimmed (“1.22K · Jun 2026”).</p>"),
    ("“n values without a date on the axis are not drawn”",
     "<p>Some rows of your data have a blank period. They are left out of the sparkline, of the header range, of the last period and of Δ. "
     "With <em>Value shows the total of the range</em>, the total comes from Power BI and does include them: the header says “Total (incl. no date)”. Check the relationship between your fact table and the calendar.</p>"),
    ("“Row limit reached: showing N rows”",
     "<p>The visual keeps asking Power BI for more rows until all have arrived. If Power BI stops sending them, the note says how many are shown. Filter the page or collapse a level.</p>"),
    ("“Total of the range did not arrive from Power BI”",
     "<p><em>Value shows the total of the range</em> asks Power BI for the total of each row. If it does not arrive, the value shows the last period. Turn the option off and on again, or reduce the number of rows.</p>"),
    ("A row looks flat on its sparkline",
     "<p>Columns and area start at zero, so a series that moves between 40K and 50K looks almost full: a bar that does not start at zero exaggerates. "
     "For the shape, use Line without <em>Start at zero</em>. With <em>Shared by level</em>, rows share one scale; <em>Per row</em> gives each row its own.</p>"),
    ("“Plan and Sales use different formats”",
     "<p>While editing, the visual warns when the reference and the actual have different number formats (litres against euros, for example): the variance may not make sense. It blocks nothing and is not shown to readers.</p>"),
    ("Images do not appear",
     "<p>Only Base64 data URIs are drawn (<code>data:image/png;base64,…</code>, also jpeg, gif, webp, bmp and svg+xml). A web address is never loaded; while editing, a note says so. "
     "Check also <em>Row levels → Show row image</em> for that level. Row images are part of Pro.</p>"),
    ("I see a “Pro preview” watermark",
     "<p>A Pro feature is turned on (or Plan / Prior year / Forecast is in its field with the Variance card on) and you are editing without a licence. "
     "Turn it off to remove the watermark, or get a licence. Readers of the report without a licence see the free table, with no watermark.</p>"),
]

FAQ = [
    ("My plan exists only by region: why “—” on stores, and how do I stop it going down?",
     "<p>When a plan measure has no detail below region, Power BI cannot split it and repeats the region's figure on every sales rep and store. "
     "A variance of −90% on each store against the whole region's plan would mean nothing, so with <em>Rows → Repeated references = Hide</em> the visual shows “—” in grey "
     "from the level where the plan stops being defined: no variance, no bar, no status against it. Regions and the total do not change.</p>"
     "<p>To make the measure itself return a value only where it is defined, blank it below its level with ISINSCOPE:</p>"
     + dax("Plan (region only) =\nIF (\n    ISINSCOPE ( Stores[Sales rep] ) || ISINSCOPE ( Stores[Store] ),\n    BLANK (),\n    [Sales plan]\n)")
     + "<p>Use the columns of your own Rows hierarchy. The same works for Prior year, Forecast and Target.</p>"),
    ("How do I show a flag or logo on each row?",
     "<p>Row images (Pro) take a Base64 data URI, not a web address: the visual has no network access, so an image on a web server is never loaded. That is what keeps the privacy promise literal.</p>"
     "<ol style=\"padding-left:20px\"><li>Make a small table <strong>Flags</strong> with two columns: <strong>Country</strong> and <strong>Image</strong>, where Image is text such as "
     "<code>data:image/svg+xml;base64,PHN2Zy…</code> or <code>data:image/png;base64,iVBOR…</code>.</li>"
     "<li>Create a measure that looks the image up for the country in scope:</li></ol>"
     + dax("Flag =\nIF (\n    ISINSCOPE ( Geography[Country] ),\n    LOOKUPVALUE ( Flags[Image], Flags[Country], SELECTEDVALUE ( Geography[Country] ) )\n)")
     + "<ol start=\"3\" style=\"padding-left:20px\"><li>Drag the measure to <strong>Row image</strong>. Turn images on or off per level in <em>Row levels → Show row image</em>, with size and a square or round shape.</li></ol>"
     "<p>Keep images small (an icon of a few KB); very long text values can be cut by Power BI when the model loads. "
     "<em>Rows → Reserve space for row images</em> keeps names aligned when a row has no image.</p>"),
    ("Why do “phantom” rows with only a plan appear?",
     "<p>A measure at another level of detail than the rows (a plan by region, rows down to sales rep) returns a value for every member of the dimension, also those that sold nothing there. "
     "The native matrix does the same with measures that never return BLANK. The visual hides rows where every measure in Values is blank (<em>Rows → Rows without actual = Hide</em>, default), "
     "and the header says how many. The fix in the model is to return the plan only where there is actual:</p>"
     + dax("Plan (where there is actual) =\nIF ( NOT ISBLANK ( [Sales] ), [Sales plan] )")),
    ("Why does a row show its last value from an earlier month?",
     "<p>The value column always shows the same period for every row: the last period of the axis. A store that has no data that month has an empty value — the visual never takes an older month without saying so. "
     "Its sparkline does end at its real last point, and the label next to it carries that month, dimmed: “1.22K · Jun 2026”. The same applies to sparkline columns 2 and 3 and to horizon.</p>"),
    ("What happens with an empty period or rows without a date?",
     "<p>A blank period, shown as “(Blank)” by Power BI, is left out of the sparkline axis, of the header range, of the last period and of Δ. "
     "While editing, a note says how many values have no date. With <em>Value shows the total of the range</em> the total is Power BI's and does include them; the header says “Total (incl. no date)”. "
     "Nothing is subtracted. To get rid of the blank period, fix the relationship between the fact table and the calendar.</p>"),
    ("Who calculates the subtotals?",
     "<p>Power BI. Each subtotal row is the measure evaluated for that region or sales rep, so Margin % of a region is the region's margin, not the sum or average of its stores. "
     "ΔPL of a subtotal is that row's actual minus that row's plan.</p>"),
    ("Value: last period or total of the range?",
     "<p>By default the value column shows the last period with data. <em>Values → Value shows the total of the range</em> asks Power BI for the total of each row over the whole period axis. "
     "Δ and Δ% always refer to the last period (against the previous one or the same one last year); the header says which.</p>"),
    ("How does the scale of the sparklines work?",
     "<p><strong>Per row in detail</strong> (default): each row of the last level has its own scale, and subtotal rows share one scale per level, so a region does not flatten its stores. "
     "<strong>Shared by level</strong>: every row of a level on one scale, to compare sizes. <strong>Per row</strong>: every row of every level on its own scale, to compare shapes. "
     "The header always says which. Horizon and the bullet with a target are always per row.</p>"),
    ("How do the level buttons and expand/collapse work?",
     "<p>The buttons 1 · 2 · 3 in the header work like Excel's outline levels: 3 opens everything, 2 opens the first level and leaves the second closed, 1 collapses everything. "
     "Click the arrow or the name of a row to expand or collapse it; Alt + click opens or closes the whole level. Power BI's own context menu also has Expand / Collapse. Power BI keeps the expanded state, so it is saved with the report and with bookmarks.</p>"),
    ("How many fields and rows can it use?",
     "<p>Rows up to 3 fields; Period one; Values up to 3 measures; Target, Plan, Prior year, Forecast and Row image one each; Tooltips up to 5. "
     "Rows arrive from Power BI in segments of 1,000 and the visual asks for the next segment until all have arrived; while loading, a note says “Loading N of …”. "
     "Up to 400 periods are drawn. The limits are the same in the free version and in Pro.</p>"),
    ("Does sorting change the report?",
     "<p>Click a column header to sort by the figure you see: descending, ascending, then back to Power BI's order, always within each parent. While editing, the sort is saved with the report. "
     "When the order comes from Power BI's own Sort by menu, a line under the header says so, because Power BI sorts by the total of the range.</p>"),
    ("Does it use my number formats?",
     "<p>Yes: the number format of each measure from the model, <strong>dynamic format strings</strong> included, in the report's language. Δ% and % of target use a percentage format.</p>"),
    ("Does it follow my report theme?",
     "<p>Yes. <strong>Report theme</strong> is the default template: colours and text come from your theme, like a native visual. Colours you set yourself always win.</p>"),
    ("What is the “Pro preview” watermark?",
     "<p>While you edit a report without a licence, Pro features you turn on are drawn working on your own data under a watermark that names them, and Power BI shows its licence notice. "
     "Reading view shows the free table: Plan, Prior year and Forecast stay visible as grey reference columns, without variance, status, extra sparklines, styles, fx, images or horizon (a horizon falls back to a line). "
     "Where Power BI provides no licence information (for example when you are not signed in to Power BI Desktop), the free table is shown.</p>"),
    ("How do I get Pro?",
     "<p>On the visual's Microsoft AppSource page, choose <strong>Buy now</strong> (not Install free). Licences are per user and managed by Microsoft; "
     "every person who should see the Pro features needs one. Restart Power BI Desktop after the licence is assigned. See <a href=\"https://tcviz.com/licensing.html\">tcviz.com/licensing</a>.</p>"),
    ("Is my data sent anywhere?",
     "<p>No. The visual declares no privileges, so Power BI does not let it make any network request, and it stores nothing outside your report. The links on the start screen open only when you click them, through Power BI.</p>"),
]


def table(headers, rows):
    th = "".join(f"<th>{html.escape(h)}</th>" for h in headers)
    trs = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f"<table><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table>"


def details(items):
    return "".join(f'<details><summary>{html.escape(q)}</summary><div class="faq-body">{a}</div></details>' for q, a in items)


READ_SVG = '''<svg viewBox="0 0 660 200" role="img" aria-label="Annotated table: hierarchy, value, change, grey plan column, variance bar and one sparkline per row" style="width:100%;max-width:660px;display:block;margin:0 auto">
  <g font-family="Segoe UI, sans-serif" font-size="12" fill="#252423">
    <g font-weight="700" fill="#605E5C" font-size="11">
      <text x="8" y="18">Region › Store</text><text x="200" y="18" text-anchor="end">Sales</text><text x="250" y="18" text-anchor="end">Δ%</text>
      <text x="310" y="18" text-anchor="end">Plan</text><text x="372" y="18" text-anchor="middle">ΔPL</text><text x="420" y="18">Sales · Jan–Sep</text>
    </g>
    <path d="M4 26 H530" stroke="#C8C6C4"/>
    <text x="8" y="48" font-weight="700">▾ North</text><text x="200" y="48" text-anchor="end" font-weight="700">1.54M</text>
    <text x="250" y="48" text-anchor="end" fill="#107C10">+3.1%</text><text x="310" y="48" text-anchor="end" fill="#8A8886">1.53M</text>
    <rect x="372" y="38" width="10" height="12" fill="#107C10"/><path d="M372 34 V54" stroke="#8A8886"/>
    <path d="M420 50 L440 46 L460 47 L480 42 L500 41 L520 38" fill="none" stroke="#8A8886" stroke-width="1.5"/><circle cx="520" cy="38" r="2.5" fill="#118DFF"/>
    <text x="24" y="78">Store 12</text><text x="200" y="78" text-anchor="end">276K</text><text x="250" y="78" text-anchor="end" fill="#107C10">+5.4%</text>
    <text x="310" y="78" text-anchor="end" fill="#8A8886">262K</text><rect x="372" y="68" width="14" height="12" fill="#107C10"/><path d="M372 64 V84" stroke="#8A8886"/>
    <path d="M420 82 L440 80 L460 76 L480 74 L500 70 L520 66" fill="none" stroke="#8A8886" stroke-width="1.5"/><circle cx="520" cy="66" r="2.5" fill="#118DFF"/>
    <text x="24" y="108">Store 31</text><text x="200" y="108" text-anchor="end">198K</text><text x="250" y="108" text-anchor="end" fill="#C4314B">−8.2%</text>
    <text x="310" y="108" text-anchor="end" fill="#8A8886">231K</text><rect x="352" y="98" width="20" height="12" fill="#C4314B"/><path d="M372 94 V114" stroke="#8A8886"/>
    <path d="M420 100 L440 101 L460 99 L480 102 L500 101 L520 112" fill="none" stroke="#8A8886" stroke-width="1.5"/><circle cx="520" cy="112" r="2.5" fill="#118DFF"/>
    <path d="M4 124 H530" stroke="#C8C6C4"/>
    <text x="8" y="146" font-weight="700">▸ South</text><text x="200" y="146" text-anchor="end" font-weight="700">0.98M</text>
    <text x="250" y="146" text-anchor="end" fill="#C4314B">−1.2%</text><text x="310" y="146" text-anchor="end" fill="#8A8886">1.02M</text>
    <rect x="362" y="136" width="10" height="12" fill="#C4314B"/><path d="M372 132 V152" stroke="#8A8886"/>
    <path d="M420 140 L440 144 L460 141 L480 145 L500 146 L520 147" fill="none" stroke="#8A8886" stroke-width="1.5"/><circle cx="520" cy="147" r="2.5" fill="#118DFF"/>
    <text x="545" y="50" font-size="11" fill="#605E5C">Subtotal row:</text><text x="545" y="64" font-size="11" fill="#605E5C">from Power BI</text>
    <text x="545" y="100" font-size="11" fill="#605E5C">One bad month,</text><text x="545" y="114" font-size="11" fill="#605E5C">or a trend?</text>
    <text x="8" y="186" font-size="11" fill="#605E5C">Grey = reference column (free) · ΔPL bar = variance against plan (Pro) · dot = last point</text>
  </g>
</svg>'''


def support():
    nav = '''<nav>
  <a href="#quickstart" class="active">Quick Start</a>
  <a href="#read">How to read it</a>
  <a href="#usecases">Use cases</a>
  <a href="#fields">Field Wells</a>
  <a href="#freepro">Free and Pro</a>
  <a href="#plan">Plan in one minute</a>
  <a href="#format">Format Pane</a>
  <a href="#interaction">Selection and levels</a>
  <a href="#accessibility">Accessibility</a>
  <a href="#troubleshooting">Troubleshooting</a>
  <a href="#faq">FAQ</a>
  <a href="changelog.html">Changelog</a>
  <a href="#contact">Contact</a>
</nav>
'''
    video = (f'<div class="video-wrap"><iframe src="https://www.youtube.com/embed/{VIDEO.split("v=")[-1]}" title="{NAME} video" '
             f'allowfullscreen></iframe></div>\n<p style="font-size:13px;color:var(--t3);margin:8px 0 0">Video on YouTube: '
             f'<a href="{VIDEO}" target="_blank">{VIDEO}</a></p>') if VIDEO else ""
    uses = "".join(f'<div class="card"><h3>{html.escape(t)}</h3><p>{d}</p></div>' for t, d in USE_CASES)
    body = f'''<div class="wrap">

<div class="verpill">Visual v{VERSION} &nbsp;·&nbsp; docs updated {FECHA} &nbsp;·&nbsp; <a href="changelog.html">what's new</a></div>

<p class="lead">A table for KPI tracking and actual against plan across many rows — stores, sales reps, products, plants. It answers the
question of the monthly review: which rows are drifting from plan, and is it a trend or one bad month? Your hierarchy with Power BI's own
subtotals, the value, the change against the previous period or last year, and a sparkline on every row. The free version loads every row.
<strong>Pro</strong> adds the variance against plan, prior year or forecast with a bar per row, status icons, up to three sparkline columns,
six collection styles, conditional formatting (fx), row images and the horizon sparkline.</p>
{video}
<h2 id="quickstart">Quick Start</h2>
<div class="card">
<ol style="padding-left:20px;font-size:14px;color:var(--t2)">
<li>Add <strong>{html.escape(NAME)}</strong> to the page. With no fields it shows a start screen with these steps.</li>
<li>Drag one to three fields to <strong>Rows</strong>, outermost first — Region › Sales rep › Store.</li>
<li>Drag a month or date to <strong>Period</strong>: it becomes the sparkline axis.</li>
<li>Drag one to three measures to <strong>Values</strong> — Sales first. Add <strong>Target</strong> for a target line on every sparkline.</li>
<li>Optional: your plan measure in <strong>Plan</strong>. It shows as a grey column; with Pro, the variance and its bar appear next to it.</li>
</ol>
<p>While editing, a setup guide in the corner walks through your fields, how to read the table and the style.</p>
</div>

<h2 id="read">How to read it</h2>
<div class="card">
<figure style="margin:0 0 14px">
{READ_SVG}
</figure>
<p>The value is the last period (or the total of the range); Δ and Δ% compare it with the previous period or the same period last year, with a sign as well as
a colour. The sparkline shows the whole range, so a row that is down this month can be read at once as a dip or as a slide. Subtotal rows are calculated by Power BI.</p>
</div>

<h2 id="usecases">Use cases</h2>
{uses}

<h2 id="fields">Field Wells</h2>
{table(["Field", "Kind", "Required / limit", "What it does"], [(f"<strong>{a}</strong>", b, c, d) for a, b, c, d in FIELDS])}
<p>Rows arrive in segments of 1,000; the visual asks for the next segment until every row has arrived (“Loading N of …” while it does). If Power BI stops sending rows,
a note says how many are shown. Up to 400 periods are drawn. The limits are the same in the free version and in Pro.</p>

<h2 id="freepro">Free and Pro</h2>
{table(["Capability", "Free", "Pro"], FREE_PRO)}
<p>Turn on a Pro capability without a licence while editing and it is drawn working on your own data under a “Pro preview” watermark that
names it. Reading view shows the free table. Pro is sold per user on Microsoft AppSource.</p>

<h2 id="plan">Plan in one minute</h2>
<div class="card">
<ol style="padding-left:20px;font-size:14px;color:var(--t2)">
<li>Drag your plan measure to <strong>Plan</strong> (and, if you have it, last year to <strong>Prior year</strong>).</li>
<li>Free: the plan appears as a grey reference column with the figure of the same period as the value.</li>
<li>Pro: <strong>ΔPL</strong>, a variance bar (right and green when favourable, left and red when not) and <strong>ΔPL%</strong>, on every row and subtotal. <em>Values → A decrease is good</em> swaps the colours for costs.</li>
<li>Pro: <em>Status icons</em> on — ● good, ▲ fair, ◆ poor, by your thresholds on ΔPL%.</li>
</ol>
<p>Plan defined only by region? The visual shows “—” below that level instead of a meaningless variance. The FAQ has the DAX to make the measure stop there.</p>
</div>

<h2 id="format">Format Pane</h2>
{table(["Card", "Settings"], [(f"<strong>{a}</strong>", b) for a, b in FORMAT])}
<p>Format on the canvas: in format mode, click the column headers, a row name, a value, a variance column, a status icon, a sparkline, the bullet bands or the table background to open its card.</p>

<h2 id="interaction">Selection, levels and interaction</h2>
<div class="card">
<ul>
<li>Click a row to filter the rest of the page. Click the value or the sparkline of a subtotal row to select it: it passes all its rows. Ctrl/Cmd + click adds; click again, click the background or press Esc to clear.</li>
<li>Click the arrow or the name of a row to expand or collapse it; Alt + click for the whole level. Level buttons 1 · 2 · 3 in the header open the table to that level.</li>
<li>Highlight: when another visual filters this one, rows without highlighted data are faded.</li>
<li>Tooltip on the sparkline with the period under the mouse; <em>Rows → Tooltips</em> can show the whole row or nothing. Report page tooltips are supported.</li>
<li>Click a column header to sort by it; the search box (Column headers → Search box) finds rows among those loaded, with their path, without filtering the report.</li>
<li>Bookmarks restore the selection and the expanded rows. Right-click opens the Power BI context menu.</li>
<li>When the report author turns interactions off, clicks do not filter.</li>
</ul>
</div>

<h2 id="accessibility">Accessibility</h2>
<div class="card">
<ul>
<li>Keyboard: Tab into the visual; up and down move between rows; PageUp/PageDown and Home/End jump; right expands (or goes to the first child), left collapses (or goes to the parent); Enter or Space selects (Ctrl adds); Esc clears.</li>
<li>The focused row is announced to screen readers with its name, level, value, Δ%, status and whether it is expanded or selected.</li>
<li>High contrast: the visual uses the colours of the Windows contrast theme; status is told apart by shape, a negative variance bar is hatched and the selection is outlined.</li>
<li>Δ and Δ% carry a sign as well as a colour; status icons differ in shape as well as colour.</li>
<li>The layout adapts to the size of the visual: when it narrows, the extra columns give way first; the sparkline stays.</li>
</ul>
</div>

<h2 id="troubleshooting">Troubleshooting</h2>
{details(TROUBLE)}

<h2 id="faq">FAQ</h2>
{details(FAQ)}

<h2 id="contact">Contact</h2>
<div class="contact-box"><div class="icon">✉</div><div>
<h3>Questions, bugs, ideas</h3>
<p>Ask in <a href="{REPO}/discussions" target="_blank">GitHub Discussions</a>, report a bug in <a href="{REPO}/issues" target="_blank">GitHub Issues</a>,
or write to <a href="mailto:support@tcviz.com">support@tcviz.com</a>. Product page: <a href="{PRODUCT}" target="_blank">tcviz.com/product/sparkline-table</a>.</p>
</div></div>

</div>
'''
    return page("Documentation", "Documentation", body, nav=nav, search=True)


def privacy():
    body = f'''<div class="wrap prose">
<h1>Privacy Policy</h1>
<p><strong>Last updated:</strong> {FECHA} (version {VERSION})</p>
<h2>1. Overview</h2>
<p>{NAME} is a Power BI custom visual developed by TCViz (Tino Callarisa). This policy describes how data is handled when you use it.</p>
<h2>2. Data collection</h2>
<p>The visual <strong>does not collect, transmit or store any data</strong>. Every calculation — changes, variances, status, scales and sparklines —
happens inside Power BI, on the data of your report. Subtotals are calculated by Power BI itself.</p>
<h2>3. No network access</h2>
<p>The visual declares <strong>no network privileges</strong> (<code>"privileges": []</code>), so Power BI does not let it make any web request.
Everything it draws, including the start-screen icon, is bundled inside the visual. Row images are drawn only from Base64 data embedded in your
model; a web address is never loaded.</p>
<p>The <em>Guide</em> and <em>Product page</em> links on the start screen ask Power BI to open those pages in your browser, only when you click
them (Power BI Desktop asks first). The visual sends nothing.</p>
<h2>4. Cookies and storage</h2>
<p>No cookies and no browser storage. Formatting settings and the sort you choose while editing are saved in your report by Power BI, like those of any visual.</p>
<h2>5. Licensing</h2>
<p>To know whether you have a Pro licence, the visual asks Microsoft's licensing API in Power BI (<code>IVisualLicenseManager</code>). TCViz receives
no data from this check. See the <a href="https://privacy.microsoft.com/privacystatement">Microsoft Privacy Statement</a>.</p>
<h2>6. Third parties</h2>
<p>No analytics, tracking or advertising.</p>
<h2>7. Contact</h2>
<p><a href="mailto:support@tcviz.com">support@tcviz.com</a></p>
</div>
'''
    return page("Privacy Policy", "Privacy Policy", body)


def terms():
    def plain(t):
        return html.unescape(re.sub(r"<[^>]+>", "", t))
    corto = {"Every row: Power BI sends rows in segments of 1,000 and the visual asks for the next until all have arrived — no cut-off by the visual":
             "every row, loaded in segments with no cut-off by the visual"}
    free = "; ".join(plain(corto.get(r[0], r[0][0].lower() + r[0][1:])) for r in FREE_PRO if r[1] == "✓")
    pro = "; ".join(plain(r[0][0].lower() + r[0][1:]) for r in FREE_PRO if r[1] == "—")
    body = f'''<div class="wrap prose">
<h1>Terms of Use</h1>
<p><strong>Effective date:</strong> {FECHA} &nbsp;·&nbsp; applies to version {VERSION} and later</p>
<h2>1. Acceptance</h2>
<p>By installing or using {NAME} ("the Visual"), you agree to these Terms of Use. If you do not agree, do not install or use the Visual.</p>
<h2>2. License grant</h2>
<p>TCViz grants you a non-exclusive, non-transferable, revocable license to use the Visual within Microsoft Power BI, subject to these Terms
and any applicable Microsoft AppSource subscription terms.</p>
<p><strong>Free tier:</strong> available to all users at no cost. Includes: {html.escape(free)}.</p>
<p><strong>Pro tier:</strong> available through a Microsoft AppSource subscription, licensed per user. Adds: {html.escape(pro)}.
Without an active licence, Pro features are shown in edit mode only, as a preview marked with a watermark; reading view shows the free result.
Field and row limits are the same in both tiers.</p>
<h2>3. Restrictions</h2>
<ul>
<li>Do not reverse-engineer, decompile or disassemble the Visual, except where applicable law permits it.</li>
<li>Do not redistribute, resell, sublicense or transfer the Visual.</li>
<li>Do not remove or alter proprietary notices, branding or watermarks.</li>
<li>Do not use the Visual in breach of applicable laws.</li>
</ul>
<h2>4. Intellectual property</h2>
<p>The Visual, including its source code, design and documentation, is the intellectual property of TCViz. The source code is published on
GitHub for transparency and review; publication does not grant a licence to copy it or to build competing products.</p>
<h2>5. Disclaimer of warranties</h2>
<p>The Visual is provided "as is", without warranty of any kind, express or implied, including merchantability, fitness for a particular
purpose and non-infringement. TCViz does not warrant that the Visual will be error-free or uninterrupted.</p>
<h2>6. Limitation of liability</h2>
<p>To the maximum extent permitted by law, TCViz shall not be liable for any indirect, incidental, special, consequential or punitive damages
arising from the use of, or inability to use, the Visual.</p>
<h2>7. Updates</h2>
<p>TCViz may update the Visual and these Terms. Updated Terms are posted at this address with a new date; continued use means acceptance.</p>
<h2>8. Governing law</h2>
<p>These Terms are governed by the laws of Spain. Any dispute shall be resolved in the courts of Barcelona, Spain.</p>
<h2>9. Contact</h2>
<p><a href="mailto:support@tcviz.com">support@tcviz.com</a></p>
</div>
'''
    return page("Terms of Use", "Terms of Use", body)


def changelog():
    md = io.open(os.path.join(ROOT, "CHANGELOG.md"), encoding="utf-8").read()
    partes = re.split(r"^## ", md, flags=re.M)[1:]
    bloques = []
    for p in partes:
        cab, _, cuerpo = p.partition("\n")
        items = "".join(f"<li>{html.escape(l[2:].strip())}</li>" for l in cuerpo.splitlines() if l.startswith("- "))
        bloques.append(f'<div class="card"><h3>{html.escape(cab.strip())}</h3><ul>{items}</ul></div>')
    body = f'<div class="wrap prose"><h1>Changelog</h1><p>{NAME} · current version {VERSION}</p>{"".join(bloques)}</div>\n'
    return page("Changelog", "Changelog", body)


def tips_plain():
    """docs/TIPS-AND-HINTS-PLAIN.txt desde docs/TIPS-AND-HINTS.md (la fuente es el .md: editar allí)."""
    md = io.open(os.path.join(ROOT, "docs", "TIPS-AND-HINTS.md"), encoding="utf-8").read()
    out = []
    for l in md.splitlines():
        l = re.sub(r"<(https?://[^>]+)>", r"\1", l).replace("`", "").replace("**", "").replace("—", "--")
        if l.startswith("# "):
            t = l[2:].upper()
            out += [t, "=" * len(t)]
        elif l.startswith("## "):
            t = l[3:].upper()
            out += [t, "-" * len(t)]
        elif l.startswith("|---"):
            continue
        elif l.startswith("|"):
            out.append("- " + " | ".join(c.strip() for c in l.strip("|").split("|")))
        else:
            out.append(l)
    return "\n".join(out).rstrip() + "\n"


def main():
    os.makedirs(os.path.join(ROOT, "docs"), exist_ok=True)
    io.open(os.path.join(ROOT, "docs", "TIPS-AND-HINTS-PLAIN.txt"), "w", encoding="utf-8", newline="\n").write(tips_plain())
    for nombre, f in (("support.html", support), ("privacy.html", privacy), ("terms.html", terms), ("changelog.html", changelog)):
        io.open(os.path.join(ROOT, "docs", nombre), "w", encoding="utf-8", newline="\n").write(f())
    io.open(os.path.join(ROOT, "docs", "index.html"), "w", encoding="utf-8", newline="\n").write(
        f'<!DOCTYPE html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=support.html"><title>{NAME}</title><a href="support.html">Documentation</a>\n')
    print("docs:", sorted(os.listdir(os.path.join(ROOT, "docs"))))


if __name__ == "__main__":
    main()
