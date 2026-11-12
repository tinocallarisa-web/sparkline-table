# Sparkline Table by TCViz — Tips & Hints (1.0.0.0)

A table for KPI tracking and actual against plan across many rows — stores, sales reps, products, plants. It answers
"which rows are drifting from plan, and is it a trend or one bad month?". This page is the short version of everything
worth knowing.
Full documentation, with search: <https://tinocallarisa-web.github.io/sparkline-table/support.html>

## Quick start

1. Rows: one to three fields, outermost first (Region › Sales rep › Store).
2. Period: a month or date field — it becomes the sparkline axis.
3. Values: one to three measures, Sales first. Target: a target line on every sparkline.
4. Plan (optional): a grey reference column; with Pro, ΔPL, ΔPL% and a variance bar.

The most common surprise: a plan defined only by region shows "—" on stores. That is on purpose: Power BI repeats the
region's plan on every store, and a variance against it would mean nothing. The FAQ has the DAX (ISINSCOPE) to stop it.

## Field wells

| Well | Limit | What it does |
|---|---|---|
| Rows | 1 to 3 fields | The hierarchy; subtotal rows are calculated by Power BI. |
| Period | 1 field | The sparkline axis; up to 400 periods are drawn. |
| Values | up to 3 measures | The first draws the sparkline, value, Δ and Δ%; the others are extra columns. |
| Target | 1 | Target line, bullet marker, win/loss reference. |
| Plan / Prior year / Forecast (Pro) | 1 each | Grey reference columns (free); variance and bar (Pro). |
| Row image (Pro) | 1 | A Base64 data URI from a measure or a text column set to First. |
| Tooltips | up to 5 | Extra measures; report page tooltips work too. |

Rows arrive in segments of 1,000 and the visual asks for the next until all have arrived ("Loading N of …"). If Power
BI stops sending rows, a note says how many are shown. The limits are the same in the free version and in Pro.

## Reading it

- Value = the last period of the axis, the same for every row. Values → Value shows the total of the range switches it.
- Δ and Δ% always refer to the last period, against the previous one or the same one last year; they carry a sign.
- Δ% is empty on a zero or negative base and dimmed on a very small one (Values → Dim Δ% on small bases).
- A row without data in the last period has an empty value; its sparkline label shows its own last month, dimmed.
- A gap in a sparkline is a period without data: the line breaks, it is never joined or dropped to zero.
- Scale: Per row in detail (default), Shared by level or Per row. The header always says which.
- Columns and area start at zero; for the shape of a series, use Line without Start at zero.

## Recipes

Plan only by region — blank it below its level:
`Plan (region only) = IF ( ISINSCOPE ( Stores[Sales rep] ) || ISINSCOPE ( Stores[Store] ), BLANK (), [Sales plan] )`

Rows with only a plan — return the plan only where there is actual:
`Plan (where there is actual) = IF ( NOT ISBLANK ( [Sales] ), [Sales plan] )`

Flag per country (Pro) — a table Flags[Country, Image] with data URIs, and:
`Flag = IF ( ISINSCOPE ( Geography[Country] ), LOOKUPVALUE ( Flags[Image], Flags[Country], SELECTEDVALUE ( Geography[Country] ) ) )`
Web addresses are never loaded: only `data:image/...;base64,` values are drawn.

Empty period "(Blank)": it is left out of the axis and of Δ; the total of the range from Power BI includes it and the
header says "incl. no date". Fix the relationship to the calendar.

## Levels and selection

- Buttons 1 · 2 · 3 in the header: 3 opens everything, 2 opens the first level, 1 collapses everything.
- Click the arrow or the name of a row to expand or collapse it; Alt + click for the whole level.
- Click a row to filter the page; click the value or sparkline of a subtotal to select all its rows.
- Click a column header: descending, ascending, back to Power BI's order (within each parent).
- Column headers → Search box finds loaded rows with their path; it does not filter the report.

## Format pane

- Style template — Report theme (default), Classic, and the six collection styles (Pro).
- Values — total of the range, change vs, Δ / Δ%, a decrease is good, small bases, value colour and background (fx, Pro), data bars.
- Variance (Pro), Status icons (Pro) — compare with, reference columns, ΔPL / ΔPL% / bar; thresholds and colours.
- Sparkline — type, scale, curve, line colour, width, horizon (Pro), last value, bullet label, target line.
- Sparkline 2 / 3 (Pro), Qualitative bands, Markers.
- Rows — density, row height, indent, spacing, grand total, rows without actual, repeated references, tooltips, sort.
- Row levels — per level: background, text, font, bold, italic, row image (Pro). Column headers. Gridlines.

## Pro

- Variance against Plan, Prior year or Forecast: ΔPL, ΔPL% and a variance bar, per row and in subtotals.
- Status icons by threshold: ● good, ▲ fair, ◆ poor.
- Up to 3 sparkline columns, each with its own measure, type, curve, scale and colour.
- Six collection styles: Boardroom, Ledger, Editorial, Signal, Aurora, Terrace.
- Conditional formatting (fx) on the value colour, the value background and the sparkline colour.
- Row images (Base64 data URI) and the horizon sparkline.

Without a licence, a Pro feature you turn on while editing is drawn working under a "Pro preview" watermark; reading
view shows the free table, with Plan / Prior year / Forecast still visible in grey. Licences are per user: everyone who
should see the Pro features needs one.

## Keyboard

Tab into the visual; up/down move between rows; PageUp/PageDown and Home/End jump; right expands (or goes to the first
child), left collapses (or goes to the parent); Enter or Space selects (Ctrl adds); Esc clears.

## Help

- Documentation: <https://tinocallarisa-web.github.io/sparkline-table/support.html>
- Questions: <https://github.com/tinocallarisa-web/sparkline-table/discussions>
- Bugs: <https://github.com/tinocallarisa-web/sparkline-table/issues>
- Video: https://www.youtube.com/watch?v=qrqWbeswF4Y
- Support: support@tcviz.com
