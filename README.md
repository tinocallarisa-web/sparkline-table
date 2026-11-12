# Sparkline Table by TCViz

A Power BI custom visual for KPI tracking and actual against plan across many rows — stores, sales reps, products, plants. It
answers "which rows are drifting from plan, and is it a trend or one bad month?": your hierarchy with Power BI's own subtotals,
the value of the last period (or the total of the range), Δ and Δ% against the previous period or last year, and a sparkline on
every row. Free: every row Power BI sends (loaded in segments of 1,000), up to 3 levels with level buttons 1 · 2 · 3, five sparkline types
(line, area, column, win/loss, bullet with bands), target line, data bars, search, grey reference columns for Plan / Prior year /
Forecast, formatting per level, Report theme and Classic. Pro adds the variance against plan, prior year or forecast with a bar
per row and in subtotals, status icons, up to 3 sparkline columns, six collection styles, conditional formatting (fx), row images
and the horizon sparkline.

- Documentation: https://tinocallarisa-web.github.io/sparkline-table/support.html
- Privacy: https://tinocallarisa-web.github.io/sparkline-table/privacy.html · Terms: https://tinocallarisa-web.github.io/sparkline-table/terms.html
- Changelog: https://tinocallarisa-web.github.io/sparkline-table/changelog.html
- Questions: https://github.com/tinocallarisa-web/sparkline-table/discussions · Bugs: https://github.com/tinocallarisa-web/sparkline-table/issues
- Video: https://www.youtube.com/watch?v=qrqWbeswF4Y · Product page: https://tcviz.com/product/sparkline-table/
- Support: support@tcviz.com

Version 1.0.0.0 · Power BI visuals API 5.11.1 · no network access (`"privileges": []`).

## Build

```
npm ci
node build-test.js          # test package, Pro forced (_test)
node build-test.js --free   # test package, real licence (_testfree)
```

Format pane and texts are generated: `python tools/formato.py` (Format pane), `python tools/i18n.py` (12 languages).
Documentation pages (`docs/support.html`, `privacy.html`, `terms.html`, `changelog.html`, `index.html`,
`TIPS-AND-HINTS-PLAIN.txt`): `python tools/gen_docs.py`. AppSource description HTML:
`python C:\tcviz\utillaje\ficha_html.py "C:\tcviz\dev\SparklineTable"`.

© 2026 TCViz. Source published for transparency and review; see the Terms of Use.
