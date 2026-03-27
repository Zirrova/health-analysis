# Add Analysis Results

Parse lab analysis results and add them to the health tracker.

## Input
The user will provide one of:
- A PDF file path containing lab results
- Pasted text of lab results
- A CSV or TXT file path

$ARGUMENTS

## Steps

0. **Identify the person**:
   - Read `data/people.json` for the list of people
   - Ask the user which person these results are for (show the names from people.json)
   - Use the person's `id` to determine the target file: `data/{id}_analysis.csv`

1. **Parse the input**: Read the PDF (using vision) or text to extract lab results. Each result needs:
   - Date of analysis (YYYY-MM-DD)
   - Indicator name (may be in Georgian or English)
   - Value (numeric)
   - Units
   - Laboratory reference range (keep as raw text)
   - Laboratory name (if available)

2. **Resolve indicator names**:
   - Read `data/indicator_aliases.csv` for existing aliases
   - For each indicator:
     - If alias match exists (case-insensitive) → use canonical name
     - If no match → propose a canonical English name (lowercase, underscores) and ask user to confirm
   - Read `data/unit_conversions.csv` for unit conversion rules
   - If same indicator exists in the person's analysis CSV with different units → auto-convert and note it

3. **Check for duplicates**:
   - Read `data/{id}_analysis.csv`
   - Check for existing (date, canonical_indicator) pairs
   - Mark duplicates to skip

4. **Show confirmation table**:
   | Status | Date | Original Name | Canonical Name | Value | Units | Converted | Ref Range | Lab |

   Status values:
   - `ADD` — new row
   - `SKIP (duplicate)` — already exists
   - `ADD (alias matched)` — matched via alias
   - `ADD (converted)` — unit conversion applied
   - `NEW INDICATOR` — new canonical name, needs confirmation

5. **Wait for user approval** before making any changes.

6. **On confirmation**:
   - Append new rows to `data/{id}_analysis.csv`
   - Add new aliases to `data/indicator_aliases.csv`
   - Report what was added

## Rules
- Never overwrite existing data — only append
- Preserve exact `laboratory_reference` text from source
- Dates must be YYYY-MM-DD
- Values must be numeric; if non-numeric (e.g. "positive"), ask user how to handle
- Keep the person's analysis CSV sorted by date
