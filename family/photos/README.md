# Photos for the family map

William’s own photographs can be added later. Until then, pins have no image — the map does not invent or use placeholder pictures.

## How to add a photo

1. Drop a JPEG, PNG, WebP or TIFF into `photos/originals/`, named as a slug for the place (for example `silvermere-softplay.jpg`).
2. Run:

```
python3 tools/process_photos.py
```

or pass a single file. This reuses the Hello Dorking photo workflow:

- `photos/web/<slug>.jpg` and `.webp` — 1200px wide, quality 80, for the pop-up
- `photos/web/<slug>-thumb.jpg` and `.webp` — 400px wide, quality 80

3. In the relevant CSV, set `Photo` to the slug filename (for example `silvermere-softplay.jpg`) and `Photo_Credit` to a short credit such as `William, WB Photography`.

The pop-up only shows an image when `Photo` is filled and the file exists.
