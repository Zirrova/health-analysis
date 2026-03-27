# Add Treatment

Add a treatment record to the health tracker.

## Input
Treatment information from user — medication, supplement, therapy, etc.

$ARGUMENTS

## Steps

0. **Identify the person**:
   - Read `data/people.json` for the list of people
   - Ask the user which person this treatment is for (show the names from people.json)
   - Use the person's `id` to determine the target file: `data/{id}_treatments.csv`

1. **Parse the input**: Extract treatment name, start date (YYYY-MM-DD), and optional end date.

2. **Check for duplicates**:
   - Read `data/{id}_treatments.csv`
   - Check for existing (start_date, treatment) pairs
   - If duplicate found, ask if user wants to update end_date instead

3. **Check for overlaps**:
   - Look for existing treatments with same name that overlap in date range
   - If found, show them and ask user to confirm

4. **Show confirmation**:
   ```
   Treatment: [name]
   Start date: [YYYY-MM-DD]
   End date: [YYYY-MM-DD or ongoing]
   ```
   Show related existing entries for context.

5. **On confirmation**:
   - Append new row to `data/{id}_treatments.csv`
   - Report what was added

## Rules
- Dates must be YYYY-MM-DD
- End date is empty string for ongoing treatments
- Remind user of similar existing treatment names for consistency
- Keep the person's treatments CSV sorted by start_date
