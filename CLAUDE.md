# Health Analysis Tracker

## Overview
Single-page web app for tracking health analysis results and treatments over time.
Supports multiple people — each person has separate analysis and treatment CSV files.
Data in CSV files in `data/`. Frontend uses DuckDB-WASM (in-browser SQL) + Plotly.js. No build step.

## Quick Start
```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

## Architecture
- **No build step.** Vanilla ES modules, CDN imports only.
- **DuckDB-WASM** loads CSVs into in-memory tables, runs SQL for filtering/aggregation.
- **Plotly.js** renders interactive charts.
- Data entry via Claude Code custom commands (`.claude/commands/`).

## File Layout
```
data/                       CSV data (committed to repo)
  people.json               Person config — [{id, name}]
  {id}_analysis.csv         Per-person lab results — date,indicator,value,units,laboratory_reference,laboratory
  {id}_treatments.csv       Per-person treatments — start_date,end_date,treatment
  indicator_aliases.csv     Maps variant names → canonical English names (shared)
  unit_conversions.csv      Unit conversion factors (shared)
js/                         ES modules
  app.js                    Entry point
  db.js                     DuckDB-WASM init + CSV loading
  queries.js                SQL query builders
  chart.js                  Plotly chart rendering
  table.js                  Wide-format HTML table
  controls.js               UI controls
  url-state.js              URL param sync
  theme.js                  Light/dark theme
css/tokens.css              Design tokens (CSS custom properties)
css/style.css               Layout + components
```

## Data Conventions
- All dates: YYYY-MM-DD
- Indicator canonical names: English, lowercase, underscores (e.g. `ferritin`, `thyroid_stimulating_hormone`)
- `laboratory_reference` stored as raw text from lab
- Uniqueness: (date, indicator) for analysis; (start_date, treatment) for treatments
- Lab results may be in Georgian or English; always mapped to English canonical via aliases

## Custom Commands
- `/add_analysis` — parse lab results (PDF/text), ask which person, resolve indicators, append to person's CSV
- `/add_treatment` — ask which person, add treatment records to person's CSV

## Testing with Rodney
```bash
rodney start --local
python3 -m http.server 8000 &
rodney open http://localhost:8000
rodney waitload && rodney waitstable
rodney screenshot
rodney js "window._dbReady"
rodney stop
```
Always verify the page with rodney before signing off work.

## Deployment
GitHub Pages via `.github/workflows/deploy.yml`. Push to main triggers deploy. No build step.
