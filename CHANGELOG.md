# Changelog

All notable changes to Sparkline Table by TCViz. Power BI four-part version numbers.

## 1.0.0.0 — 2026-11-12

- First release: a table for KPI tracking and actual against plan across many rows, with one sparkline per row over the period axis.
- Row hierarchy up to 3 levels with subtotals calculated by Power BI, level buttons 1 · 2 · 3, expand and collapse (Alt + click for a whole level), grand total row.
- Every row: rows arrive in segments of 1,000 and the visual asks for the next segment until Power BI has sent them all, with a "Loading N of …" note; if Power BI stops, a note says how many rows are shown.
- Value of the last period or total of the range; Δ and Δ% with a sign against the previous period or the same period last year; Δ% left empty on a zero or negative base and dimmed on small bases.
- Five sparkline types (line, area, column, win/loss, bullet) with curve (linear, smooth, step), line colour (neutral, per row, by trend), markers and scale (shared by level, per row in detail rows, per row).
- Bullet with qualitative bands and % of target; target line on every sparkline; data bars behind the value.
- Plan, Prior year and Forecast shown as grey reference columns; repeated references below the level where a measure is defined shown as "—"; rows without actual hidden.
- Search box, sort by any column with a click on its header, tooltips on the sparkline or the whole row.
- Formatting per level (background, text, font, bold, italic), row height, density, column spacing and gridlines; Report theme (default) and Classic templates; setup guide and start screen.
- Pro: variance against Plan, Prior year or Forecast (ΔPL, ΔPL% and a variance bar, per row and in subtotals), status icons by threshold with shape and colour, up to 3 sparkline columns, six collection styles (Boardroom, Ledger, Editorial, Signal, Aurora, Terrace), conditional formatting (fx) on the value, its background and the sparkline, row images from Base64 data URIs, and the horizon sparkline. Without a licence, Pro features are drawn under a "Pro preview" watermark while editing; reading view shows the free table.
- Cross-filtering (subtotal rows included), multi-select, highlight, bookmarks, context menu, report page tooltips, keyboard navigation, screen-reader announcements and high contrast.
- The number format of each measure, dynamic format strings included; format on the canvas; Format pane and texts in 12 languages.
- No network requests; Pro licence through Microsoft AppSource.
