# Backtest: Chennai floods, November 2021

**Peak flood date:** 2021-11-07
**Data mode:** BENCHMARK (documented peak-24h figure only — no hour-by-hour resolution available offline)

## Documented ground truth (real, cited figures)

- Peak 24h rainfall: city average 200mm, station range 100–230mm
  - Source: IMD data via Gulf News, reporting overnight Nov 6–7 2021 rainfall across Chennai and suburbs (https://gulfnews.com/amp/story/world%2Fasia%2Findia%2Findia-heavy-rains-lash-chennai-reservoirs-opened-flood-alert-sounded-1.1636294629492)
- Monthly total: 1044.3mm at Nungambakkam
  - Source: IMD, via Deccan Herald / The News Minute reporting (third-wettest November on record for Chennai) (https://www.deccanherald.com/national/south/chennai-rains-2021-saw-wettest-november-since-2015-1056886.html)
- Note: Comparable monthly total to Dec 2015 (1044.3mm vs 1049.3mm) but lower single-day peak intensity and far lower casualties — useful contrast case for the backtest.

## Backtest result (benchmark-only — no live internet access when this ran)

- Applying the engine's IMD-based 24h classification to the documented city-average figure (200mm) yields category: **very_heavy**
- Applying it to the worst individual station reading (230mm) yields category: **extremely_heavy**
- This confirms the engine's thresholds would have correctly classified this as at least IMD "heavy" rainfall using the real documented total, but cannot report an hour-by-hour lead time without the full archive series.
- Re-run `npm run backtest` on a machine with normal internet access to get the full hourly replay and lead-time figure.

## Honest limitations of this backtest

- This evaluates the rainfall-only component of the risk engine. The live system also incorporates river-level data when available; no river telemetry exists for these historical dates, so this backtest cannot and does not claim to reproduce the full multi-signal risk score.
- IMD's 24h rainfall categories are official; the app's specific alert thresholds (mapping categories to Advisory/Warning/Emergency) are this project's own design choice, not an official flood-warning standard.
- "Lead time" measures how early elevated rainfall was detected relative to the peak rainfall hour — not how early it would have predicted the flood itself, which also depends on drainage, tides, and reservoir releases this system does not model.
