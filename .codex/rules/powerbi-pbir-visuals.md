# Power BI PBIR Visual Rules

Before creating or editing visuals in this repo:

1. Edit active visuals only under `Vending Machine Analysis.Report/definition/pages/<pageFolder>/visuals/<visualName>/visual.json`.
2. Never create active visuals under `visualContainers`; that is legacy format and can make Power BI show blank pages.
3. Use Microsoft `visualContainer` schema version `2.x` or newer. Never use legacy `visualContainer/1.x.x`.
4. Use modern visual types: `cardVisual`, `tableEx`, `lineChart`, `clusteredBarChart`, `clusteredColumnChart`, `donutChart`, `slicer`.
5. Use `queryState.<Role>.projections`; do not use legacy role arrays.
6. Ensure `visual.json.name` equals the containing folder name.
7. Ensure every field/measure referenced by a visual exists in the TMDL semantic model.
8. Do not set projection `active` to `false`; inactive fields can make visuals render only headers or appear empty.
9. Do not combine a category from one fact table with a measure from another unrelated fact table.
10. Check category cardinality before building breakdown charts; one-value categories should become trend/detail/KPI visuals.
11. Write DAX measures with multiple `VAR` statements as multi-line TMDL expressions.
12. Ensure every chart/table visual has a visible `visualContainerObjects.title` with non-empty text.
13. Use chart/table subtitles as decision cues or data notes; avoid repeating the brand name when the page title already shows it.
14. Show benchmark/threshold context in the visual when it drives interpretation, and document assumed thresholds in `DASHBOARD_DATA_LIMITATIONS.md`.
15. Put prescriptive/action KPI cards before detail tables, then sort detail tables by priority first and impact/revenue second.
16. Keep common slicers on their own matching sync groups; do not reuse another slicer's sync group.
17. Do not use `Product Category` slicers on replenishment or machine-action pages until those metrics support ProductId line-level filtering.
18. Run `node scripts/validate-pbir-visuals.js` after every visual edit.

See `POWERBI_VISUAL_RULES.md` for the full project rules.
