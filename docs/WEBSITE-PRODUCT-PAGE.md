# Sparkline Table by TCViz — TCViz Web Product Page Content

Content for the four tabs of the TCViz product page (`https://tcviz.com/product/sparkline-table/`, not created yet).
Current visual version: **1.0.0.0**. The live page is generated from `src/data.jsx` in `tcviz-web`; this file is the
source text, and editing it does not change the site. No prices on this page: they live in AppSource and on the
licensing page. Positioning: KPI tracking and actual against plan across many rows — never a financial statement.

## Page title and meta

- Title: `Sparkline Table for Power BI — KPI tracking vs plan, one sparkline per row | TCViz`
- Meta description: `A Power BI table for KPI tracking across many rows: hierarchy with subtotals, change vs last period or last year, and a sparkline on every row. Variance vs plan in Pro.`

## TAB 1: OVERVIEW

### Which rows are drifting from plan — and is it a trend or one bad month?

The monthly review has fifty stores, twelve sales reps or two hundred products on the screen. A table of numbers says
who is down this month; it does not say whether that row has been sliding since spring. Sparkline Table by TCViz puts
your hierarchy in rows with the subtotals Power BI calculates, the value of the last period, the change against the
previous period or last year, and a sparkline on every row.

### Key highlights
- **Every row, free.** Rows arrive in segments of 1,000 and the visual keeps asking until Power BI has sent them all.
- **Your hierarchy, Power BI's subtotals.** Up to 3 levels, level buttons 1 · 2 · 3, expand and collapse; a region's
  margin is the region's margin, not the sum of its stores.
- **The history on the same line.** Line, area, column, win/loss or bullet with bands, with a scale shared by level or
  per row.
- **Honest with partial plans.** A plan defined only by region shows "—" on stores instead of a meaningless variance.
- **Pro: the control reading.** Variance against plan, prior year or forecast with a bar on every row and subtotal,
  status icons, up to 3 sparkline columns, six collection styles, conditional formatting (fx), row images and horizon.

Video: https://www.youtube.com/watch?v=qrqWbeswF4Y

---

## TAB 2: FEATURES

### Free: a complete tracking table
- Every row, loaded in segments of 1,000 with a "Loading N of …" note, until Power BI has sent them all
- Row hierarchy up to 3 levels with subtotals calculated by Power BI, level buttons 1 · 2 · 3, expand and collapse, grand total
- Value of the last period or total of the range; Δ and Δ% with a sign, against the previous period or the same period last year
- Five sparkline types: line, area, column, win/loss, bullet; curve (linear, smooth, step), line colour (neutral, per row, by trend), markers
- Scale shared by level, per row in detail rows, or per row — the header always says which
- Bullet with qualitative bands and % of target; target line on every sparkline
- Plan, Prior year and Forecast as grey reference columns; repeated references shown as "—"; rows without actual hidden
- Data bars behind the value, search box, sort by any column with a click on its header
- Formatting per level, row height, density, column spacing, gridlines
- Report theme (default) and Classic templates; setup guide and start screen
- Cross-filtering (subtotals included), multi-select, highlight, bookmarks, context menu, report page tooltips
- Keyboard navigation, screen-reader announcements, high contrast
- Number format of each measure, dynamic format strings included; format on the canvas; 12 languages

### Pro: the control reading
- **Variance:** ΔPL, ΔPL% and a variance bar against Plan, Prior year or Forecast, on every row and subtotal
- **Status icons:** ● good, ▲ fair, ◆ poor, by your own thresholds — shape and colour
- **Up to 3 sparkline columns**, each with its own measure, type, curve, scale and colour
- **Collection styles:** Boardroom, Ledger, Editorial, Signal, Aurora, Terrace
- **Conditional formatting (*fx*)** on the value colour, the value background and the sparkline colour
- **Row images:** flags or logos at the start of the row, from Base64 data URIs
- **Horizon sparkline**, with 2 or 3 bands around zero, the row average or the target

### Free vs Pro

| Feature | Free | Pro |
|---|---|---|
| Every row, hierarchy up to 3 levels with Power BI subtotals, level buttons | ✓ | ✓ |
| Value, Δ and Δ% vs previous period or last year | ✓ | ✓ |
| Five sparkline types, curve, line colour, markers, scale | ✓ | ✓ |
| Bullet with bands and % of target, target line | ✓ | ✓ |
| Plan / Prior year / Forecast as grey reference columns | ✓ | ✓ |
| Data bars, search, sort, rows without actual and repeated references hidden | ✓ | ✓ |
| Formatting per level, gridlines, Report theme and Classic | ✓ | ✓ |
| Selection, highlight, bookmarks, keyboard, high contrast, 12 languages | ✓ | ✓ |
| Variance ΔPL, ΔPL% and bar per row and subtotal | — | **✓** |
| Status icons by threshold | — | **✓** |
| Up to 3 sparkline columns | — | **✓** |
| Six collection styles | — | **✓** |
| Conditional formatting (*fx*) | — | **✓** |
| Row images, horizon sparkline | — | **✓** |

Field and row limits are the same in both. Turn on a Pro feature while editing without a licence and it is drawn
working on your own data under a "Pro preview" watermark; report readers without a licence see the free table.

---

## TAB 3: HOW TO USE

1. **Rows** — one to three fields, outermost first: Region › Sales rep › Store.
2. **Period** — a month or date: the sparkline axis.
3. **Values** — Sales first; up to two more measures as extra columns.
4. **Target** — a target line on every sparkline; with the Bullet type, bands and % of target.
5. **Plan** — a grey reference column; with Pro, ΔPL, ΔPL% and the variance bar.

### Plan defined only by region?
The visual shows "—" below that level. To make the measure stop there:
`Plan (region only) = IF ( ISINSCOPE ( Stores[Sales rep] ) || ISINSCOPE ( Stores[Store] ), BLANK (), [Sales plan] )`

### Use cases
- **Stores against plan** — which stores are off plan, and since when.
- **Sales reps month by month** — sort by Δ% to put the biggest drops first.
- **Products against a target** — bullet with bands, each row against its own target.
- **Plants and KPIs with status (Pro)** — ● ▲ ◆ by your thresholds and up to three sparkline columns side by side.
- **Long lists** — thousands of rows, a search box, smooth scrolling.

---

## TAB 4: SUPPORT

- Documentation, FAQ and troubleshooting: https://tinocallarisa-web.github.io/sparkline-table/support.html
- Questions: https://github.com/tinocallarisa-web/sparkline-table/discussions
- Bugs: https://github.com/tinocallarisa-web/sparkline-table/issues
- Privacy: https://tinocallarisa-web.github.io/sparkline-table/privacy.html
- Terms: https://tinocallarisa-web.github.io/sparkline-table/terms.html
- Email: support@tcviz.com

Privacy in one line: the visual declares no privileges, so Power BI does not let it make any network request;
everything is computed inside your report.

AppSource link: add it when the offer is published (not before: a link to an unpublished offer gives 404).
