# AppSource Listing — Sparkline Table by TCViz 1.0.0.0

Copy ready to paste into Partner Center, English only. **Editing this file does not change the offer**: every field
is pasted by hand in Partner Center.

Limits measured in Partner Center: *Search results summary* 100 characters, *Description* 5,000 characters counting the
HTML tags (cut silently), *Certification notes* 2,500 counted with CRLF and **cleared on every resubmission**, 3 keywords.

Rules for this listing: start with the problem; no comparison with other marketplace visuals by name, only with what
Power BI does natively; no superlatives or figures that cannot be proven; "Power BI" with that capitalisation;
"conditional formatting (fx)" and "dynamic format strings" written as such (OKviz looks for them). No prices in the
description (they go in the plan). No mention of team or organisation licences.

Positioning (decided): a table for **KPI tracking and actual against plan across many rows** (stores, sales reps,
products, plants) — "which rows are drifting from plan, and is it a trend or one bad month?". It is **not** sold as a
financial statement: it has no calculated rows, no column hierarchy and no export, so the listing never names that use.

---

## Offer name

```
Sparkline Table by TCViz
```

## Search results summary (max 100)
*(99 characters)*

```
Sparkline table for Power BI: track KPIs vs plan across many rows and see a trend or one bad month.
```

## Search keywords (3)

```
sparkline table
kpi scorecard
in-cell charts
```

- `sparkline table` — the name of the thing, typed by someone who already knows what they want: a table with a small
  chart on each row. Whoever searches for it in AppSource has the native matrix and is looking for what it lacks
  (sparklines on subtotal rows, bullet with bands, win/loss, variance). Without it the offer misses the most direct search.
- `kpi scorecard` — the problem in the buyer's words: a monthly review of many rows against target. It is the use the
  positioning is built on (stores, reps, products, plants against plan) and brings people with the right data shape.
- `in-cell charts` — the term used by people coming from Excel (sparklines, data bars inside the cell). It reaches
  analysts who build tracking tables and want the chart inside the row, not next to it.

Left out: `budget vs actual` and `plan vs actual` (already used by other TCViz offers; the portfolio does not compete
with itself for the same search), `matrix` (generic, competes with the native visual), `variance` (a function, not a
problem, and Pro only). Inferred, no volume data: review after three months.

## Description

*(3,470 characters as text; 4,255 as the HTML that is pasted, 4,299 counting CRLF; limit 5,000)*

Paste the **HTML**, not this text: `python C:\tcviz\utillaje\ficha_html.py "C:\tcviz\dev\SparklineTable"` writes
`docs/APPSOURCE-DESCRIPTION.html` (brand template). The 5,000-character limit counts the tags.

```
The monthly review has fifty stores, twelve sales reps or two hundred products on the screen, and one question: which of them are drifting from plan, and is it a trend or one bad month? A table of numbers says who is down this month. It does not say whether that row has been sliding since spring.

Sparkline Table by TCViz puts your hierarchy in rows with the subtotals Power BI calculates, the value of the last period, the change against the previous period or last year, and a sparkline on every row. Plan and prior year sit next to the actual, so you read the gap and its history on the same line.

FREE: A COMPLETE TRACKING TABLE
• Every row: rows arrive in segments and the visual keeps asking until all have arrived, with no cut-off
• Up to 3 levels with subtotals calculated by Power BI, level buttons 1 · 2 · 3, expand and collapse
• Value of the last period or total of the range; Δ and Δ% with a sign, against the previous period or the same period last year
• Five sparkline types: line, area, column, win/loss and bullet, with curve, line colour, markers and a scale shared by level or per row
• Bullet with qualitative bands and % of target; a target line on every sparkline
• Plan, Prior year and Forecast as grey reference columns
• A plan defined only by region shows "—" on stores instead of a meaningless variance; rows with only a plan are hidden
• Data bars behind the value, search box, sort by any column with one click
• Formatting per level, row height, spacing and gridlines; Report theme and Classic templates

PRO: THE CONTROL READING
• Variance against Plan, Prior year or Forecast: ΔPL, ΔPL% and a variance bar on every row and subtotal
• Status icons by your thresholds, told apart by shape and colour
• Up to 3 sparkline columns, each with its own measure, type and scale
• Six collection styles (Boardroom, Ledger, Editorial, Signal, Aurora, Terrace) that match other TCViz visuals
• Conditional formatting (fx) on the value, its background and the sparkline
• An image at the start of each row (flags, logos) and the horizon sparkline

FREE AND PRO
The free version loads every row and gives a complete, correct table; field and row limits are the same in both. Pro adds the variance and the status. Turn on a Pro feature while editing without a licence and it is drawn working on your own data under a "Pro preview" watermark; report readers without a licence see the free table.

WORKS LIKE A NATIVE VISUAL
• Click a row or a subtotal to filter the page, Ctrl+click for several, highlight, bookmarks, context menu, report page tooltips
• Keyboard navigation, screen-reader announcements, high contrast and a layout that keeps the sparkline when the visual narrows
• The number format of each measure, dynamic format strings included; format on the canvas; twelve languages

PRIVACY
The visual declares no privileges, so Power BI does not let it make any network request. Row images must be embedded in your model as Base64; web addresses are never loaded, which is what makes that literally true. The licence is checked through Microsoft's own licensing API.

GETTING STARTED
1. Rows: Region, Sales rep, Store. Period: Month.
2. Values: Sales. Target or Plan: your plan measure.
3. Sort by Δ% and open the rows that are sliding.

Documentation, FAQ and DAX recipes: https://tinocallarisa-web.github.io/sparkline-table/support.html
Questions: https://github.com/tinocallarisa-web/sparkline-table/discussions
Support: support@tcviz.com
```

No "What's new" block: this is the first version.

## Plan

| Field | Value |
|---|---|
| Plan ID | **`sparkline-table-pro`** (exactly this: it is the ID the code checks, `PLAN_IDS` in `src/visual.ts`) |
| Plan name | Sparkline Table Pro |
| Price | 0.99 USD per user per month, 9.99 USD per user per year (round local prices with `utillaje/redondear_precios.py`) |
| Trial | None |
| Plan description | The contents of `docs/PLAN-DESCRIPTION.html` (lines that start with an emoji; the plan editor removes bold). Text below. |

```
⭐ Sparkline Table Pro adds the control reading: which rows are off plan, and by how much.
📊 Variance against Plan, Prior year or Forecast: ΔPL, ΔPL% and a variance bar on every row and subtotal.
🚦 Status icons by your own thresholds, told apart by shape and colour.
📈 Up to 3 sparkline columns, each with its own measure, type and scale, plus the horizon sparkline.
🎨 Six collection styles: Boardroom, Ledger, Editorial, Signal, Aurora and Terrace.
🖌️ Conditional formatting (fx) on the value, its background and the sparkline.
🏳️ An image at the start of each row (flags, logos), embedded as Base64.
✅ Includes everything in the free version: every row, 3 levels with subtotals, five sparkline types, bullet with bands.
```

## Offer setup

| Field | Value |
|---|---|
| Offer name | Sparkline Table by TCViz |
| Categories | The closest available to tables / KPIs and comparison (check the list in Partner Center) |
| Industries | Retail; Professional services |
| Video | [VIDEO URL — pendiente] (when it exists: `https://www.youtube.com/watch?v=<id>`) |
| Support / documentation | https://tinocallarisa-web.github.io/sparkline-table/support.html |
| Privacy | https://tinocallarisa-web.github.io/sparkline-table/privacy.html |
| Terms (EULA) | https://tinocallarisa-web.github.io/sparkline-table/terms.html |
| Changelog | https://tinocallarisa-web.github.io/sparkline-table/changelog.html |
| Source | https://github.com/tinocallarisa-web/sparkline-table |
| Product page | https://tcviz.com/product/sparkline-table/ (gives 404 today: create it in tcviz-web before publishing) |
| Logo and screenshots | see **Images** below |
| Package | `dist/matrixSparklinesFAB7608B939348B490060433D1A28FA6.1.0.0.0.pbiviz` (production build only after explicit confirmation) |
| Sample report | `SparklineTable_sample.pbix` (pending; no `_test` in the name) |

## Images

Screenshots are 1366x768, in this order. The infographics are regenerated with `python tools/gen_infographic.py`
(`--preparar` rebuilds the crops in `tools/img/` first); their HTML is in `docs/infographic.html` and
`docs/infographic-pro.html`.

| # | File | What it shows |
|---|---|---|
| Logo | `assets/icon_300x300.png` | Product icon, 300x300 |
| 1 | `assets/infographic.png` | Free: "Which rows are drifting from plan — and is it a trend or one bad month?" Region › Store with Power BI subtotals, Δ/Δ%, sparkline per row; bullet with bands; the five sparkline types; search box; formatting per level; list of everything that is free |
| 2 | `assets/infographic-pro.png` | Pro: variance vs Plan / Prior year / Forecast (ΔPL, bar, ΔPL%) and status; 3 sparkline columns; horizon; row images; fx; the six styles; Pro preview while editing, free table for readers without a licence |
| 3 | `assets/Image_1.png` | Scorecard by region in Power BI Desktop: variance to plan, status, sparklines; card and table filtered by the selection |
| 4 | `assets/Image_2.png` | Sparkline types: line, column, win/loss in three columns; area and horizon in a second copy |
| 5 | `assets/Image_3.png` | Bullet with qualitative bands and % of target, each store against its own target |

The video goes **only** in its canonical form, `https://www.youtube.com/watch?v=<id>`: never a short link, never
`/shorts/` or `/embed/` (policy 100.3.3.3).

---

## What to paste by hand in Partner Center (1.0.0.0)

Editing this file changes nothing in the offer. In Partner Center:

1. **Offer listing → Name:** `Sparkline Table by TCViz`.
2. **Offer listing → Search results summary:** the block above.
3. **Offer listing → Description:** the contents of `docs/APPSOURCE-DESCRIPTION.html` (run `ficha_html.py` again after
   any edit), not the text above.
4. **Offer listing → Search keywords:** `sparkline table`, `kpi scorecard`, `in-cell charts`.
5. **Offer listing → Videos:** [VIDEO URL — pendiente] — the canonical `https://www.youtube.com/watch?v=…` once it exists.
6. **Offer listing → Support / Privacy / Terms URLs:** the table above. Check each one with a real request after the
   repo is pushed: until then GitHub Pages answers 404.
7. **Plans → new plan:** Plan ID `sparkline-table-pro`, name, prices in the pricing fields, no trial; Plan description
   from `docs/PLAN-DESCRIPTION.html`.
8. **Technical configuration:** the 1.0.0.0 `.pbiviz` and `SparklineTable_sample.pbix`.
9. **Review and publish → Notes for certification:** `docs/CERTIFICATION-NOTES-SHORT.txt` (review it against the real
   `.pbix` first, and fill in the video line or delete it).
10. **Screenshots and logo.**
