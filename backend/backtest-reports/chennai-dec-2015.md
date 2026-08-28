# Backtest: Chennai floods, December 2015

**Peak flood date:** 2015-12-01
**Data mode:** BENCHMARK (documented peak-24h figure only — no hour-by-hour resolution available offline)

## Documented ground truth (real, cited figures)

- Peak 24h rainfall: city average 286mm, station range 77–494mm
  - Source: World Weather Attribution (2015), citing IMD 08:30 Dec 1 – 08:30 Dec 2 station observations (https://www.worldweatherattribution.org/chennai-floods-december-2015/)
- Monthly total: 1049.3mm at Nungambakkam
  - Source: IMD, via The News Minute / Deccan Herald reporting (https://www.thenewsminute.com/tamil-nadu/chennai-rainfall-november-was-third-highest-history-slightly-less-2015-158199)
- Note: NASA Earth Observatory / Weather Underground cite a slightly higher November total (1218.6mm) using a different methodology — both figures are real, sources differ on measurement window.

## Backtest result (benchmark-only — no live internet access when this ran)

- Applying the engine's IMD-based 24h classification to the documented city-average figure (286mm) yields category: **extremely_heavy**
- Applying it to the worst individual station reading (494mm) yields category: **extremely_heavy**
- This confirms the engine's thresholds would have correctly classified this as at least IMD "heavy" rainfall using the real documented total, but cannot report an hour-by-hour lead time without the full archive series.
- Re-run `npm run backtest` on a machine with normal internet access to get the full hourly replay and lead-time figure.

## Honest limitations of this backtest

- This evaluates the rainfall-only component of the risk engine. The live system also incorporates river-level data when available; no river telemetry exists for these historical dates, so this backtest cannot and does not claim to reproduce the full multi-signal risk score.
- IMD's 24h rainfall categories are official; the app's specific alert thresholds (mapping categories to Advisory/Warning/Emergency) are this project's own design choice, not an official flood-warning standard.
- "Lead time" measures how early elevated rainfall was detected relative to the peak rainfall hour — not how early it would have predicted the flood itself, which also depends on drainage, tides, and reservoir releases this system does not model.
