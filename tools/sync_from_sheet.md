# Daily sync: Google Sheet → Surrey Hills map

The outdoor map at https://map.wbphotography.uk reads static CSV files in
`data/`. William (or anyone he has shared the sheet with) can edit the
private Google Sheet **Surrey Hills Map — Data**. Once a day, those edits
are copied into the CSVs and, if anything changed, committed and pushed
to `williambarton1000-dotcom/dorking-map`. The live GitHub Pages site
then updates within a minute or two.

The sheet stays **private**. Do not change sharing, do not publish the
sheet, and do not put the spreadsheet ID in this public repository. The
ID lives in `tools/sheet_config.local.json` (gitignored). A blank example
is in `tools/sheet_config.example.json`.

The Photography layer is *coming soon* and has no tab yet.

## What the assistant does each day

Google Sheets cannot be read from this repo’s Python alone — the
connected **Google Sheets** connector is what reads and writes the
workbook. The assistant (Grok Bot) runs the following. A person can
follow the same steps.

### 1. Read every layer tab

Open `tools/sheet_config.local.json` for the `spreadsheetId`. Using the
Google Sheets connector (`user-Google-sheets`):

- `get_spreadsheet` to confirm the tabs still exist.
- `read_range` for each layer tab, cells `1:200`, with
  `valueRenderOption` set to `FORMATTED_VALUE` and a high `maxChars`
  (200000 is plenty). If a result is truncated, follow `nextCells`.

Tabs and the CSV they feed (column order must match `tools/layers.json`):

| Tab                 | CSV                      | Live rows today (at first build) |
| ------------------- | ------------------------ | -------------------------------- |
| Food & drink        | `data/food_drink.csv`    | 15                               |
| Landmarks & lore    | `data/landmarks.csv`     | 33                               |
| Churches            | `data/churches.csv`      | 19                               |
| Pubs                | `data/pubs.csv`          | 41                               |
| Walk start points   | `data/walks.csv`         | 20                               |

Skip **How to edit**. Do not invent a Photography tab.

Save each tab’s returned CSV to:

```
tools/.cache/sheet_export/Food & drink.csv
tools/.cache/sheet_export/Landmarks & lore.csv
tools/.cache/sheet_export/Churches.csv
tools/.cache/sheet_export/Pubs.csv
tools/.cache/sheet_export/Walk start points.csv
```

(`tools/.cache/` is gitignored.) Write the files as UTF-8. The exact
quoting of the export does not matter; `tools/sheet_to_csv.py` parses
them with Python’s csv reader and rewrites the map CSVs in the repo’s
dialect: every field quoted, CRLF line endings, trailing newline.

### 2. Rebuild the layer CSVs

From the repo root:

```bash
python3 tools/sheet_to_csv.py --from-export tools/.cache/sheet_export --geocode
```

This is a dry run. It:

- Drops completely empty rows (spare rows left for adding places).
- Treats a blank **Status** as live. `CLOSED` and `HIDDEN` rows are left
  off the map (and, once you apply, appended to
  `data/archive/<layer>_removed.csv`). Never delete those rows from the
  sheet — Status is how a place comes off the map without being lost.
- Fills blank Latitude/Longitude:
  - If a `lat,long` pair or a Google Maps URL was pasted in Address,
    Name, or Notes, those numbers are used.
  - Otherwise the Address (or Name) is looked up with OpenStreetMap
    Nominatim, one request per second, with a contactable User-Agent.
  - Proposed sheet writes are saved to
    `tools/.cache/coord_updates.json`.
- Checks every live pin: a Name, numeric coordinates, and a location
  inside a sensible Surrey bounding box (about 51.05–51.40 N,
  0.65–0.10 W). Failures are printed and that row is not written to the
  map CSV.
- Writes proposed CSVs to `tools/.cache/out/` and diffs them against
  the current `data/*.csv` files (field-level, keyed by Name, or by
  Name + Village for pubs — two pubs share a name).

If the dry run reports validation errors, fix them in the sheet (or by
handing the row back to William) before applying.

### 3. Write any new coordinates back to the sheet

If `tools/.cache/coord_updates.json` is not an empty list, use
`write_range` with `parseInput: false` to put each `lat` / `lon` into
the `lat_cell` and `lon_cell` named in that file. This keeps the sheet
and the map in step, so the next daily run is a no-change round trip.
Do not change sharing when you do this.

### 4. Apply, and push only if something changed

```bash
python3 tools/sheet_to_csv.py --from-export tools/.cache/sheet_export --apply
```

That overwrites `data/*.csv` (still excluding CLOSED/HIDDEN rows),
archives those off-map rows, and appends one line per changed field to
`data/CHANGELOG.csv` with the columns:

```
date, layer, place, field, old, new
```

Dates are in the Europe/London calendar day. New places appear as
`field=(row), new=added`. Places that left the map appear as
`field=(row), new=removed`.

Look at `git diff -- data`. If, and only if, something real changed:

```bash
python3 tools/sheet_to_csv.py --from-export tools/.cache/sheet_export --apply --push
```

(`--push` implies `--apply`. It commits only `data/` and pushes to
`origin` on the current branch, which should be `main`.)

If the diff is empty, do not commit and do not push. The goal of a
no-change day is a zero-diff run — quoting, line endings and empty
fields must not jitter.

After a push, quickly load https://map.wbphotography.uk (or the local
`index.html`) and confirm the layers still open.

## How William can also ask for a change here

Edits do not have to go through the sheet. William can message the
Grok Bot assistant and ask for a change. The assistant then updates
both the sheet (so it stays the master list) and the CSV, and pushes
if needed. The monthly summary of changes is read from
`data/CHANGELOG.csv`.

## Adding a place in the sheet

A new row at the bottom of the right tab is enough. It needs a **Name**
and either an **Address** / postcode or a Google Maps latitude and
longitude (for example `51.2321, -0.3304`). If Latitude and Longitude
are left blank, the daily sync fills them in and writes them back.

To take a place off the map, set **Status** to `CLOSED` or `HIDDEN`.
Do not delete the row. Do not edit the header row (the sheet warns
before it).

## One-off checks

Byte-identical rewrite of the current map CSVs, with no sheet involved:

```bash
python3 tools/sheet_to_csv.py --self-test
```

This must print `Self-test passed` and exit 0. It is the check that the
writer’s quoting and line endings still match the files already in git.

## Bounding box

Defined in `tools/layers.json`. At first build the live pins spanned
about 51.131–51.272 N and 0.484–0.240 W. The box is padded so a new
pin in, say, Reigate or Guildford is accepted, but a pin in another
county is flagged.
