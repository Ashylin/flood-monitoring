/**
 * Documented historical flood events for Chennai, used as ground truth for
 * the backtest. Every figure here is a real, publicly reported number with
 * its source cited — nothing in this file is invented. Where sources
 * disagree slightly (as they often do for extreme-weather stats), both
 * figures are recorded rather than silently picking one.
 */
module.exports = [
  {
    slug: "chennai-dec-2015",
    label: "Chennai floods, December 2015",
    peakDate: "2015-12-01",
    // Chennai coordinates (Nungambakkam-area reference point)
    latitude: 13.0827,
    longitude: 80.2707,
    documented: {
      peak24hRainfallMm: {
        cityAverage: 286,
        stationRange: [77, 494],
        source: "World Weather Attribution (2015), citing IMD 08:30 Dec 1 – 08:30 Dec 2 station observations",
        url: "https://www.worldweatherattribution.org/chennai-floods-december-2015/",
      },
      monthlyTotalRainfallMm: {
        value: 1049.3,
        station: "Nungambakkam",
        source: "IMD, via The News Minute / Deccan Herald reporting",
        url: "https://www.thenewsminute.com/tamil-nadu/chennai-rainfall-november-was-third-highest-history-slightly-less-2015-158199",
      },
      deaths: 250,
      economicLossUsd: "3 billion (estimated)",
      note: "NASA Earth Observatory / Weather Underground cite a slightly higher November total (1218.6mm) using a different methodology — both figures are real, sources differ on measurement window.",
    },
  },
  {
    slug: "chennai-nov-2021",
    label: "Chennai floods, November 2021",
    peakDate: "2021-11-07",
    latitude: 13.0827,
    longitude: 80.2707,
    documented: {
      peak24hRainfallMm: {
        cityAverage: 200,
        stationRange: [100, 230],
        source: "IMD data via Gulf News, reporting overnight Nov 6–7 2021 rainfall across Chennai and suburbs",
        url: "https://gulfnews.com/amp/story/world%2Fasia%2Findia%2Findia-heavy-rains-lash-chennai-reservoirs-opened-flood-alert-sounded-1.1636294629492",
      },
      monthlyTotalRainfallMm: {
        value: 1044.3,
        station: "Nungambakkam",
        source: "IMD, via Deccan Herald / The News Minute reporting (third-wettest November on record for Chennai)",
        url: "https://www.deccanherald.com/national/south/chennai-rains-2021-saw-wettest-november-since-2015-1056886.html",
      },
      deaths: 4,
      note: "Comparable monthly total to Dec 2015 (1044.3mm vs 1049.3mm) but lower single-day peak intensity and far lower casualties — useful contrast case for the backtest.",
    },
  },
];
