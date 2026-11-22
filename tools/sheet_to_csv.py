#!/usr/bin/env python3
"""Rebuild the Surrey Hills map layer CSVs from a Google Sheet export.

The daily procedure is in tools/sync_from_sheet.md. This script does the
local half: parse exported tabs, drop CLOSED/HIDDEN rows, fill missing
coordinates when asked, validate, write CSVs in the exact dialect the
repo already uses (QUOTE_ALL, CRLF, trailing newline), append a
changelog, and optionally commit and push.

Typical uses:

  python3 tools/sheet_to_csv.py --self-test
      Round-trip the live data/*.csv files (plus a blank Status column)
      and confirm a byte-identical rewrite. No files are changed.

  python3 tools/sheet_to_csv.py --from-export tools/.cache/sheet_export
      Dry run: write proposed CSVs under tools/.cache/out and print a
      summary. Exit 0 if nothing would change.

  python3 tools/sheet_to_csv.py --from-export tools/.cache/sheet_export --apply
      Write data/*.csv, archive removed rows, append data/CHANGELOG.csv.

  python3 tools/sheet_to_csv.py --from-export DIR --apply --push
      As --apply, then commit and push to origin if something changed.

  Add --geocode to fill blank Latitude/Longitude from a pasted
  lat,long / Google Maps URL, or by looking up the Address on
  OpenStreetMap Nominatim. Proposed sheet updates are written to
  tools/.cache/coord_updates.json for the assistant to write back.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import json
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = Path(__file__).resolve().parent
CACHE = TOOLS / ".cache"
CSV_WRITE_KW = dict(quoting=csv.QUOTE_ALL, lineterminator="\r\n")
STATUS_OFF = {"CLOSED", "HIDDEN"}
LAT_LON_RE = re.compile(
    r"(?<!\d)([+-]?\d{1,2}\.\d{3,})(?:\s*,\s*|\s+)([+-]?\d{1,3}\.\d{3,})(?!\d)"
)
MAPS_AT_RE = re.compile(r"@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)")
MAPS_Q_RE = re.compile(
    r"[?&]q=(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)", re.I
)
NOMINATIM = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "SurreyHillsMap/1.0 (https://map.wbphotography.uk; william@wbphotography.uk)"


def load_layers():
    data = json.loads((TOOLS / "layers.json").read_text(encoding="utf-8"))
    return data


def london_today():
    try:
        from zoneinfo import ZoneInfo

        return dt.datetime.now(ZoneInfo("Europe/London")).date().isoformat()
    except Exception:
        return dt.date.today().isoformat()


def write_csv_bytes(header, rows):
    buf = io.StringIO()
    writer = csv.writer(buf, **CSV_WRITE_KW)
    writer.writerow(header)
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")


def write_csv_path(path: Path, header, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(write_csv_bytes(header, rows))


def read_csv_rows(path: Path):
    with path.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.reader(fh))
    if not rows:
        return [], []
    return rows[0], rows[1:]


def cell(row, idx):
    if idx is None or idx >= len(row):
        return ""
    return row[idx]


def norm_status(value):
    return (value or "").strip().upper()


def is_empty_row(row):
    return not any((c or "").strip() for c in row)


def key_of(header, row, key_fields):
    idx = {name: header.index(name) if name in header else None for name in key_fields}
    parts = [cell(row, idx[name]).strip() for name in key_fields]
    return tuple(parts)


def place_label(header, row, key_fields):
    values = [p for p in key_of(header, row, key_fields) if p]
    return " / ".join(values) if values else "(unnamed)"


def parse_export(path: Path, expected_columns):
    """Parse a sheet-exported CSV. Returns (header, live_rows, off_rows, issues).

    live_rows / off_rows are lists of dicts:
      {sheet_row, values_by_col, status, raw}
    values_by_col is an OrderedDict of expected map columns only (no Status).
    """
    issues = []
    with path.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.reader(fh))
    if not rows:
        issues.append(f"{path.name}: file is empty")
        return [], [], [], issues

    header = [(h or "").strip() for h in rows[0]]
    # Ignore a trailing empty header cell that Sheets sometimes adds
    while header and header[-1] == "":
        header.pop()
        rows[0] = header

    missing = [c for c in expected_columns if c not in header]
    if missing:
        issues.append(f"{path.name}: missing columns {missing}")
        return header, [], [], issues

    unexpected = [c for c in header if c not in expected_columns and c != "Status"]
    if unexpected:
        issues.append(f"{path.name}: unexpected extra columns {unexpected} (kept in the sheet, ignored in the map CSV)")

    live, off = [], []
    for offset, raw in enumerate(rows[1:], start=2):
        # Pad / trim to header width
        padded = list(raw) + [""] * (len(header) - len(raw))
        padded = padded[: len(header)]
        if is_empty_row(padded):
            continue
        record = OrderedDict()
        for col in expected_columns:
            record[col] = cell(padded, header.index(col))
        status = ""
        if "Status" in header:
            status = norm_status(cell(padded, header.index("Status")))
        item = {
            "sheet_row": offset,
            "values": record,
            "status": status,
            "raw": padded,
        }
        if status in STATUS_OFF:
            off.append(item)
        elif status in {"", "LIVE", "OPEN"}:
            if status in {"LIVE", "OPEN"}:
                issues.append(
                    f"{path.name} row {offset} ({record.get('Name','')}): "
                    f"Status {status!r} treated as live; prefer a blank cell"
                )
            live.append(item)
        else:
            issues.append(
                f"{path.name} row {offset} ({record.get('Name','')}): "
                f"unknown Status {status!r}; left off the map"
            )
            off.append(item)
    return header, live, off, issues


def extract_coords_from_text(*texts):
    for text in texts:
        if not text:
            continue
        m = MAPS_AT_RE.search(text) or MAPS_Q_RE.search(text)
        if m:
            return m.group(1), m.group(2), "google-maps-url"
        m = LAT_LON_RE.search(text)
        if m:
            lat, lon = float(m.group(1)), float(m.group(2))
            # Heuristic: UK Surrey is lat ~51, lon ~-0.3. If the first
            # number looks like a longitude, swap.
            if abs(lat) > 90 and abs(lon) <= 90:
                lat, lon = lon, lat
            if abs(lat) <= 90 and abs(lon) <= 180:
                return str(m.group(1)), str(m.group(2)), "parsed-latlong"
    return None


def nominatim_geocode(address, pause=1.1):
    if not address or not address.strip():
        return None
    query = urllib.parse.urlencode(
        {"q": address.strip(), "format": "json", "limit": "1", "countrycodes": "gb"}
    )
    req = urllib.request.Request(
        f"{NOMINATIM}?{query}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    time.sleep(pause)
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    if not data:
        return None
    hit = data[0]
    return hit["lat"], hit["lon"], "nominatim"


def fill_coords(layer, live_rows, do_geocode, issues):
    """Fill blank lat/lon in place. Returns a list of sheet update dicts."""
    updates = []
    tab = layer["tab"]
    header_names = layer["columns"]
    # Status is the last column on the sheet, lat/lon positions follow map columns
    lat_col = header_names.index("Latitude")
    lon_col = header_names.index("Longitude")
    # Sheet columns are 0-based among expected_columns + Status; A=1
    def col_letter(idx):
        n = idx + 1
        letters = ""
        while n:
            n, rem = divmod(n - 1, 26)
            letters = chr(65 + rem) + letters
        return letters

    for item in live_rows:
        rec = item["values"]
        lat = (rec.get("Latitude") or "").strip()
        lon = (rec.get("Longitude") or "").strip()
        if lat and lon:
            continue
        name = rec.get("Name") or ""
        address = rec.get("Address") or ""
        # Scan likely pasted fields
        scanned = extract_coords_from_text(
            lat if lat and not lon else "",
            lon if lon and not lat else "",
            address,
            name,
            rec.get("Notes") or "",
            rec.get("Coord_Source") or "",
            rec.get("Source_or_Website") or "",
            rec.get("Website") or "",
        )
        source = None
        if scanned:
            new_lat, new_lon, source = scanned
        elif do_geocode:
            try:
                hit = nominatim_geocode(address or name)
            except Exception as exc:
                issues.append(f"{tab} '{name}': geocode failed ({exc})")
                hit = None
            if hit:
                new_lat, new_lon, source = hit
            else:
                issues.append(f"{tab} '{name}': no coordinates and geocoding found nothing for {address or name!r}")
                continue
        else:
            issues.append(
                f"{tab} '{name}' (sheet row {item['sheet_row']}): "
                "Latitude/Longitude blank — re-run with --geocode, or paste a lat,long / address"
            )
            continue
        rec["Latitude"] = new_lat
        rec["Longitude"] = new_lon
        updates.append(
            {
                "tab": tab,
                "sheet_row": item["sheet_row"],
                "name": name,
                "lat_cell": f"{col_letter(lat_col)}{item['sheet_row']}",
                "lon_cell": f"{col_letter(lon_col)}{item['sheet_row']}",
                "lat": new_lat,
                "lon": new_lon,
                "source": source,
            }
        )
    return updates


def validate_live(layer, live_rows, bbox, issues):
    tab = layer["tab"]
    seen = {}
    for item in live_rows:
        rec = item["values"]
        name = (rec.get("Name") or "").strip()
        if not name:
            issues.append(f"{tab} sheet row {item['sheet_row']}: live row is missing a Name — skipped")
            item["_invalid"] = True
            continue
        key = key_of(list(rec.keys()), list(rec.values()), layer["key"])
        if key in seen:
            issues.append(f"{tab}: duplicate key {key} (sheet rows {seen[key]} and {item['sheet_row']})")
        else:
            seen[key] = item["sheet_row"]
        lat_s = (rec.get("Latitude") or "").strip()
        lon_s = (rec.get("Longitude") or "").strip()
        if not lat_s or not lon_s:
            issues.append(f"{tab} '{name}': missing Latitude/Longitude")
            item["_invalid"] = True
            continue
        try:
            lat = float(lat_s)
            lon = float(lon_s)
        except ValueError:
            issues.append(f"{tab} '{name}': coords are not numbers ({lat_s!r}, {lon_s!r})")
            item["_invalid"] = True
            continue
        if not (bbox["lat_min"] <= lat <= bbox["lat_max"] and bbox["lon_min"] <= lon <= bbox["lon_max"]):
            issues.append(
                f"{tab} '{name}': coords {lat},{lon} are outside the Surrey bounding box "
                f"({bbox['lat_min']}–{bbox['lat_max']}N, {bbox['lon_min']}–{bbox['lon_max']}E)"
            )
            item["_invalid"] = True


def row_from_record(columns, rec):
    return [rec.get(c, "") for c in columns]


def diff_layers(columns, key_fields, old_header, old_rows, new_header, new_rows):
    """Return changelog tuples (place, field, old, new)."""
    def as_map(header, rows):
        out = OrderedDict()
        for r in rows:
            padded = list(r) + [""] * (len(header) - len(r))
            rec = OrderedDict(zip(header, padded))
            k = key_of(header, padded, key_fields)
            out[k] = rec
        return out

    # Use the canonical map columns for comparison
    old_map, new_map = as_map(old_header, old_rows), as_map(new_header, new_rows)
    changes = []
    for k, rec in new_map.items():
        place = " / ".join(p for p in k if p) or (rec.get("Name") or "(unnamed)")
        if k not in old_map:
            changes.append((place, "(row)", "", "added"))
            continue
        prev = old_map[k]
        for col in columns:
            a, b = prev.get(col, ""), rec.get(col, "")
            if a != b:
                changes.append((place, col, a, b))
    for k, rec in old_map.items():
        if k not in new_map:
            place = " / ".join(p for p in k if p) or (rec.get("Name") or "(unnamed)")
            changes.append((place, "(row)", "on map", "removed"))
    return changes


def append_changelog(entries):
    path = ROOT / "data" / "CHANGELOG.csv"
    if not path.exists():
        write_csv_path(path, ["date", "layer", "place", "field", "old", "new"], [])
    header, existing = read_csv_rows(path)
    # Recreate with canonical header if needed, preserving rows
    if header != ["date", "layer", "place", "field", "old", "new"]:
        # Keep whatever is there, but write new rows with the canonical header
        # by appending in the same dialect.
        pass
    with path.open("ab") as fh:
        # If file does not end with newline, still ok because we write full rows
        buf = io.StringIO()
        writer = csv.writer(buf, **CSV_WRITE_KW)
        for row in entries:
            writer.writerow(row)
        fh.write(buf.getvalue().encode("utf-8"))


def archive_off_rows(layer, off_rows, today):
    if not off_rows:
        return None
    path = ROOT / "data" / "archive" / f"{Path(layer['file']).stem}_removed.csv"
    archive_header = ["Removed_Date", "Status"] + layer["columns"]
    existing_header, existing = [], []
    if path.exists():
        existing_header, existing = read_csv_rows(path)
    rows = existing
    for item in off_rows:
        rows.append([today, item["status"]] + row_from_record(layer["columns"], item["values"]))
    write_csv_path(path, archive_header, rows)
    return path


def git(*args, check=True):
    return subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=check,
        text=True,
        capture_output=True,
    )


def proposed_csv_for_layer(layer, live_rows):
    columns = layer["columns"]
    kept = [item for item in live_rows if not item.get("_invalid")]
    rows = [row_from_record(columns, item["values"]) for item in kept]
    return columns, rows, write_csv_bytes(columns, rows)


def layer_export_path(export_dir: Path, layer):
    candidates = [
        export_dir / f"{layer['tab']}.csv",
        export_dir / f"{layer['id']}.csv",
        export_dir / Path(layer["file"]).name,
    ]
    for path in candidates:
        if path.exists():
            return path
    return None


def run_from_export(export_dir: Path, apply: bool, push: bool, geocode: bool):
    cfg = load_layers()
    issues = []
    today = london_today()
    CACHE.mkdir(parents=True, exist_ok=True)
    out_dir = CACHE / "out"
    if out_dir.exists():
        for p in out_dir.glob("*.csv"):
            p.unlink()
    out_dir.mkdir(parents=True, exist_ok=True)

    all_coord_updates = []
    changelog_entries = []
    any_change = False
    byte_identical = True

    for layer in cfg["layers"]:
        path = layer_export_path(export_dir, layer)
        if path is None:
            issues.append(f"No export found for tab {layer['tab']!r} in {export_dir}")
            continue
        header, live, off, parse_issues = parse_export(path, layer["columns"])
        issues.extend(parse_issues)
        all_coord_updates.extend(fill_coords(layer, live, geocode, issues))
        validate_live(layer, live, cfg["bbox"], issues)
        columns, rows, payload = proposed_csv_for_layer(layer, live)
        dest = ROOT / layer["file"]
        preview = out_dir / Path(layer["file"]).name
        preview.write_bytes(payload)

        current = dest.read_bytes() if dest.exists() else b""
        changed = current != payload
        if changed:
            any_change = True
            byte_identical = False
        old_header, old_rows = (read_csv_rows(dest) if dest.exists() else (columns, []))
        changes = diff_layers(columns, layer["key"], old_header, old_rows, columns, rows)
        if changes:
            print(f"{layer['tab']}: {len(changes)} field change(s)")
            for place, field, old, new in changes:
                print(f"  - {place} / {field}")
                changelog_entries.append((today, layer["id"], place, field, old, new))
        else:
            if changed:
                print(f"{layer['tab']}: bytes differ but no field-level change (dialect/quoting?)")
            else:
                print(f"{layer['tab']}: no change ({len(rows)} live row(s), {len(off)} closed/hidden)")

        if apply:
            dest.write_bytes(payload)
            archive_off_rows(layer, off, today)

    updates_path = CACHE / "coord_updates.json"
    updates_path.write_text(json.dumps(all_coord_updates, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if all_coord_updates:
        print(f"\n{len(all_coord_updates)} coordinate fill(s) written to {updates_path}")
        print("Write these back to the Google Sheet (see sync_from_sheet.md), then re-export if you want the sheet and CSV to match.")

    if issues:
        print("\nValidation notes:")
        for msg in issues:
            print(f"  ! {msg}")

    if apply and changelog_entries:
        append_changelog(changelog_entries)
        print(f"Appended {len(changelog_entries)} row(s) to data/CHANGELOG.csv")

    if push:
        if not apply:
            print("--push requires --apply")
            return 2
        if not any_change and not changelog_entries:
            print("Nothing to commit or push.")
            return 0 if not _has_blocking_issues(issues) else 1
        git("add", "--", "data")
        # Only data/, never tools/sheet_config.local.json
        msg = f"Sync map layers from sheet ({today}, {len(changelog_entries)} change(s))"
        result = git("commit", "-m", msg, check=False)
        if result.returncode != 0:
            print(result.stdout)
            print(result.stderr)
            if "nothing to commit" in (result.stdout + result.stderr):
                print("Git: nothing to commit.")
            else:
                return 1
        else:
            git("push", "origin", "HEAD")
            print("Pushed to origin.")

    if _has_blocking_issues(issues):
        return 1
    return 0 if not (any_change and not apply) else 0


def _has_blocking_issues(issues):
    # Warnings about unexpected columns or LIVE status are non-blocking.
    blocking_bits = (
        "missing columns",
        "file is empty",
        "No export found",
        "missing a Name",
        "missing Latitude",
        "not numbers",
        "outside the Surrey bounding box",
        "duplicate key",
        "unknown Status",
        "no coordinates",
        "geocode failed",
        "Latitude/Longitude blank",
    )
    return any(any(bit in msg for bit in blocking_bits) for msg in issues)


def self_test():
    """Rebuild each live CSV from itself and require a byte-identical result."""
    cfg = load_layers()
    export_dir = CACHE / "self-test-export"
    if export_dir.exists():
        for p in export_dir.glob("*"):
            if p.is_file():
                p.unlink()
    export_dir.mkdir(parents=True, exist_ok=True)

    mismatches = []
    for layer in cfg["layers"]:
        src = ROOT / layer["file"]
        if not src.exists():
            mismatches.append(f"{layer['file']} is missing")
            continue
        header, rows = read_csv_rows(src)
        if header != layer["columns"]:
            mismatches.append(
                f"{layer['file']}: header {header} does not match layers.json {layer['columns']}"
            )
            continue
        # Pretend this came from the sheet: same columns plus a blank Status
        sheet_header = header + ["Status"]
        sheet_rows = [list(r) + [""] for r in rows]
        export_path = export_dir / f"{layer['tab']}.csv"
        write_csv_path(export_path, sheet_header, sheet_rows)

        parsed_header, live, off, issues = parse_export(export_path, layer["columns"])
        if issues:
            mismatches.extend(issues)
        if off:
            mismatches.append(f"{layer['tab']}: self-test unexpectedly found {len(off)} off-map row(s)")
        fill_coords(layer, live, do_geocode=False, issues=issues)
        validate_live(layer, live, cfg["bbox"], issues)
        blocking = [m for m in issues if not m.endswith("treated as live; prefer a blank cell")]
        if blocking:
            mismatches.extend(blocking)
        columns, out_rows, payload = proposed_csv_for_layer(layer, live)
        original = src.read_bytes()
        if payload != original:
            mismatches.append(f"{layer['file']}: round-trip bytes differ ({len(original)} -> {len(payload)})")
            # Show a short first-diff hint
            a, b = original, payload
            for i, (x, y) in enumerate(zip(a, b)):
                if x != y:
                    mismatches.append(f"  first byte diff at {i}: {a[max(0,i-20):i+30]!r} vs {b[max(0,i-20):i+30]!r}")
                    break
            else:
                mismatches.append(f"  one file is a prefix of the other")
        else:
            print(f"OK  {layer['tab']}: {len(out_rows)} rows, byte-identical")

    if mismatches:
        print("SELF-TEST FAILED:")
        for m in mismatches:
            print("  !", m)
        return 1
    print("Self-test passed: every layer CSV round-trips with zero diff.")
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--self-test", action="store_true", help="Byte-identical round trip of current data/*.csv")
    parser.add_argument("--from-export", metavar="DIR", help="Directory of exported tab CSVs")
    parser.add_argument("--apply", action="store_true", help="Write data/*.csv, archive, and changelog")
    parser.add_argument("--push", action="store_true", help="Commit and push data/ changes to origin (implies --apply)")
    parser.add_argument("--geocode", action="store_true", help="Fill blank coordinates from pasted lat,long or Nominatim")
    args = parser.parse_args(argv)

    if args.self_test:
        return self_test()
    if args.from_export:
        if args.push:
            args.apply = True
        return run_from_export(Path(args.from_export), args.apply, args.push, args.geocode)
    parser.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
