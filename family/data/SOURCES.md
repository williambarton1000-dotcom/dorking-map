# Sources and licences

Downloaded and checked 22 November 2026 (Europe/London). Official datasets are used under the Open Government Licence v3.0. This map is a hidden preview (noindex; robots.txt disallows crawling). It is not the public launch of dorkingmaps.uk.

## Get Information About Schools (GIAS)

- **Publisher:** Department for Education
- **Dataset:** GIAS “all establishment” public extract
- **File used:** `edubasealldata20261122.csv` (daily extract dated 22 November 2026)
- **URL:** [Get Information About Schools downloads](https://www.get-information-schools.service.gov.uk/Downloads) and the public daily file at `https://ea-edubase-api-prod.azurewebsites.net/edubase/downloads/public/edubasealldata20261122.csv`
- **Downloaded:** 22 November 2026
- **Licence:** [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/)
- **Used for:** open schools in the Dorking catchment (state and independent), including phase, type, religious character, gender, statutory ages, address, easting/northing, website, URN, and the “Has Nursery Classes” flag. Dorking Nursery School is listed on the Nurseries & pre-schools layer.
- **Coordinates:** easting/northing were converted from OSGB36 (EPSG:27700) to WGS84 (EPSG:4326) with pyproj. Where those fields were missing, the pin would have used postcodes.io; in this extract the in-catchment schools all had easting/northing.
- **Ofsted ratings:** this public GIAS extract has no `OfstedRating` or `OfstedLastInsp` columns. School ratings are left blank rather than invented or looked up one school at a time. Ofsted has not issued a single-word overall grade for state-school inspections from September 2024; even for older inspections this map does not fill a grade that is not in the file.

## Ofsted childcare providers and inspections (management information)

- **Publisher:** Ofsted
- **Dataset:** Childcare providers and latest inspections as at 30 June 2026 (management information, published 6 August 2026)
- **File used:** `Management information - childcare providers and inspections - childcare providers data as at 30 June 2026.csv` (saved locally as `ofsted_providers_2026-06-30.csv`)
- **URL:** [Ofsted official statistics and MI landing pages on GOV.UK](https://www.gov.uk/government/collections/early-years-and-childcare-statistics); the file retrieved was `https://assets.publishing.service.gov.uk/media/6a6ca4eb0c36759b5ccaa2e0/Management_information_-_childcare_providers_and_inspections_-_childcare_providers_data_as_at_30_June_2026.csv`
- **As at / published / downloaded:** data as at 30 June 2026; published 6 August 2026; downloaded 22 November 2026
- **Licence:** [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/)
- **Used for:** group-based childcare on non-domestic premises that is on the Early Years Register, of subtype Full day care or Sessional day care (nurseries, pre-schools and playgroups). Out-of-school day care was not copied wholesale onto the Holiday clubs layer. Only holiday provision confirmed on an official site (or the Better holiday page together with Ofsted's named Dorking Sports Centre Holiday Playscheme) is listed there. After-school wraparound was not treated as a holiday club without that check. Childminder names and addresses are **not** used.
- **Inspection outcomes:** reported as they appear in the file.
  - Under the previous early years framework, `EYR OEIF/CIF: Most recent: Overall effectiveness` is stored as 1, 2, 3 or 4. Ofsted’s published management-information guidance uses these codes as Outstanding (1), Good (2), Requires improvement (3) and Inadequate (4). Where a code is present, the map shows both the official word and the code, and labels it as the previous framework.
  - Under the newer early years inspection framework (REIF columns in this file), there is **no single overall word grade**. Where those columns are the latest inspection, the map says so and lists the graded standards that are filled in (for example Inclusion: Strong standard), with the inspection date.
- **Coordinates:** this childcare file has no easting/northing. Pins use the postcode centroid from postcodes.io, unless a named building could be geocoded inside the catchment box.
- **Websites:** left blank except for a light official-site check of the main Dorking settings (Busy Bees Chichester Road and Westcott Road, Bright Horizons Dorking, St Paul’s Church Nursery, and Dorking Nursery School via GIAS). School nursery-class rows reuse the school website from GIAS when it exists.

## Childminder counts (aggregate only)

- From the same Ofsted file as at 30 June 2026, counting Active records only.
- **866** providers of type Childminder in the Surrey local authority, plus **1** “Childminder without domestic premises” (867 of those types in Surrey in total).
- **81** childminders in the **Dorking and Horley** parliamentary constituency (all in Surrey). That constituency is wider than this map and includes Horley, so 81 is not a Dorking-only figure.
- Names, addresses and almost all postcodes for childminders are redacted in the public file. No childminder is pinned, and no name from that file is published. The map points people to [Surrey’s Childcare Finder](https://www.surreycc.gov.uk/childcarefinder) and [Ofsted Find an inspection report](https://reports.ofsted.gov.uk/).

## Birth & More local directory (playgroups)

- **Page:** [Baby and Toddler Groups in and around Dorking](https://www.birthandmore.co.uk/babyandtoddlergroupsindorking)
- **Checked:** 22 November 2026
- **Licence:** not an official dataset; used as a locally curated list, then lightly verified. Official church or school pages were preferred where they exist (Smallfry at Dorking URC; Refresh, formerly Spot, at St Paul’s; Dorking Nursery School’s own site).
- **Used for:** village and town playgroups that were missing from the stage 1 source files.

## Other sources already used in stage 1

Club and class details continue to come from each group’s own website, or from one reliable listing (Happity or Surrey County Council) where no official site exists, checked 22 November 2026. See `REVIEW.md`.

## Map tiles and geocoding

- Map style: OpenFreeMap Liberty; data © OpenStreetMap contributors ([ODbL](https://opendatacommons.org/licenses/odbl/)).
- Satellite imagery: Esri World Imagery.
- Nominatim / OpenStreetMap for a few playgroup venues, with a postcodes.io fallback for postcode centroids.


## Stage 3 sources (checked 22 November 2026, Europe/London)

### Mole Valley District Council — parks, playgrounds and open spaces

- **Pages:** [Parks, Recreation and Play Facilities](https://www.molevalley.gov.uk/leisure-culture/parks-playgrounds/) and [Gardens and Open Spaces](https://www.molevalley.gov.uk/leisure-culture/parks-gardens-and-open-spaces/)
- **Checked:** 22 November 2026
- **Used for:** official playgrounds and recreation grounds in the trimmed area (Meadowbank, King George V Playing Field, Cradhurst, Merebank, Brockham Recreation Ground, Holmwood Park / Wildcroft Drive) and listed gardens and open spaces (The Cotmandene, Westcott Village Green, Brockham Green, Pippbrook Grounds, The Nower and Milton Heath, The Glory Woods and Devil's Den, Deepdene Garden and Terrace).
- **Not pinned, because no reliable coordinate was found:** Chart Park, Inholms Lane Open Space (local nature reserve), and Betchworth Park (walks around the golf course). These remain on the official list and are noted in `REVIEW.md`.
- **Left off as out of the trimmed area:** Ashtead, Bookham, Fetcham and Leatherhead parks and playgrounds on the same council pages, and Polesden Lacey.

### OpenStreetMap / Nominatim (playgrounds)

- **Used for:** named and unnamed `leisure=playground` features inside the trimmed villages, after dropping playgrounds on or next to school sites, any with `access=private`, and Kestrel Corner Play Area (`access=customers`).
- **Overpass:** public Overpass endpoints failed or returned an untrustworthy empty result, so Nominatim + the OpenStreetMap API (tags) were used instead. An empty Overpass response was not treated as evidence that playgrounds do not exist.
- **Licence:** data © OpenStreetMap contributors, [ODbL](https://opendatacommons.org/licenses/odbl/).
- Village and estate playgrounds that are not on the MVDC list are included with a source note. They were not visited in person.

### Surrey County Council — Dorking Library

- **Page:** [Dorking Library](https://www.surreycc.gov.uk/libraries/your-library/find-your-nearest/dorking)
- **Checked:** 22 November 2026
- **Used for:** the only public library in the trimmed area (address, staffed hours, Super Access, facilities). Baby-changing is not stated on that page and was not invented for the baby-changing layer.

### Better — Dorking Sports Centre holiday activities

- **Page:** [Holiday activities](https://www.better.org.uk/leisure-centre/mole-valley/dorking-sports-centre/holiday-activities)
- **Checked:** 22 November 2026
- **Used for:** the combined Holiday clubs pin at Dorking Sports Centre. The page is seasonal (the October 2026 half-term timetable was showing when checked). Inclusive Swim is described on that page as suitable for those with disabilities who may enjoy a quieter pool; that wording is the only reason Inclusive=Y is set on the holiday pin.

### National Trust

- **Pages:** [Box Hill](https://www.nationaltrust.org.uk/visit/surrey/box-hill) (including things-to-do / Natural Play Trail) and [Leith Hill](https://www.nationaltrust.org.uk/visit/surrey/leith-hill)
- **Checked:** 22 November 2026
- **Used for:** Family days out pins, the Box Hill Natural Play Trail description, parking/membership wording, baby changing next to the Box Hill café, and the Leith Hill tower/house closure until spring 2027. Polesden Lacey was not included (Bookham, outside the trimmed area).

### Venues' own sites

- [Denbies Wine Estate](https://www.denbies.co.uk) — vineyard train, public footpaths, and the official FAQ wording that children's activities are listed on the Events page. No playground or baby-changing facility is claimed.
- [Surrey Outdoor Learning, High Ashurst](https://www.surreyoutdoorlearning.uk/holiday-activities/high-ashurst) — school-holiday adventure days.
- [Equitable Riding Academy](https://www.equitableridingacademy.co.uk/services) — holiday Pony Nutz days.
- [Betchworth Park Golf Club juniors](https://www.betchworthparkgc.co.uk/juniors/) — school-holiday golf camps.

### Hello Dorking — public toilets and baby changing

- **Page:** [Good to Know](https://www.hellodorking.com/explore-dorking/good-to-know/)
- **Checked:** 22 November 2026
- **Used for:** baby-changing at the St Martin's Walk and South Street public toilets, and the Changing Places toilet at St Martin's Walk Car Park (hours and RADAR key, described accurately and not as a standard baby-changing room). This is a local guide, not a council dataset. Waitrose, Dorking Halls, Dorking Sports Centre and the Pippbrook offices are described there as allowing non-customers to use toilets, but baby-changing is not stated, so they were not added to this layer.


### HM Land Registry — Price Paid Data (Where to live layer)

- **Files:** yearly CSVs for 2023, 2024 and 2025 from https://price-paid-data.publicdata.landregistry.gov.uk/
- **Used for:** area-level medians and sale counts on the “Where to live” polygons (Category A / standard sales only, 2023–2025). No street-level prices are published. A median is withheld when an area has fewer than 10 sales.
- **Attribution:** Contains HM Land Registry data © Crown copyright and database right 2026. This data is licensed under the Open Government Licence v3.0.
- **Licensing caveat:** The Open Government Licence covers the price, date and property-type fields used here; it does not by itself licence AddressBase or PAF. Area-level medians without addresses are what this layer publishes.
- Character-area names follow Mole Valley’s 2010 Built-up Areas Character Appraisal (Dorking, North Holmwood and Pixham) and the 2013 Larger Rural Villages Character Appraisal SPD, as cited in later Local Plan and neighbourhood-plan documents. Official maps were not obtained; most polygons are approximate. Conservation-area geometry is from planning.data.gov.uk (organisation entity 216, Mole Valley).
