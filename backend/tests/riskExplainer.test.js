const { computeDetailedRisk, computeRateOfChange, dataFreshness, scoreToLevel } = require("../src/services/riskExplainer");

describe("dataFreshness", () => {
  test("no_data when there's no timestamp", () => {
    expect(dataFreshness(null).status).toBe("no_data");
  });
  test("fresh when recent", () => {
    const now = Date.now();
    const tenMinAgo = new Date(now - 10 * 60000).toISOString();
    expect(dataFreshness(tenMinAgo, now).status).toBe("fresh");
  });
  test("stale beyond 60 minutes", () => {
    const now = Date.now();
    const ninetyMinAgo = new Date(now - 90 * 60000).toISOString();
    expect(dataFreshness(ninetyMinAgo, now).status).toBe("stale");
  });
  test("no_data beyond 24 hours", () => {
    const now = Date.now();
    const twoDaysAgo = new Date(now - 48 * 60 * 60000).toISOString();
    expect(dataFreshness(twoDaysAgo, now).status).toBe("no_data");
  });
});

describe("computeRateOfChange", () => {
  test("null when missing inputs", () => {
    expect(computeRateOfChange(null, 3, 1).ratePerHour).toBeNull();
  });
  test("flags rapid rise above threshold", () => {
    const result = computeRateOfChange(4.0, 3.5, 1); // +0.5m in 1h
    expect(result.ratePerHour).toBe(0.5);
    expect(result.rapidRise).toBe(true);
  });
  test("does not flag a slow rise", () => {
    const result = computeRateOfChange(3.6, 3.5, 2); // +0.1m over 2h = 0.05/hr
    expect(result.rapidRise).toBe(false);
  });
});

describe("scoreToLevel", () => {
  test.each([
    [0, "insufficient_data"],
    [10, "low"],
    [25, "medium"],
    [50, "high"],
    [80, "critical"],
  ])("score %i maps to %s", (score, expected) => {
    expect(scoreToLevel(score)).toBe(expected);
  });
});

describe("computeDetailedRisk", () => {
  const noRise = { ratePerHour: null, rapidRise: false };

  test("no river feed + negligible rain -> insufficient_data, score 0", () => {
    const result = computeDetailedRisk({
      riverStatus: "no_feed",
      riverFreshness: null,
      rain6hMm: 0,
      rain24hMm: 1, // below IMD 'light' threshold (2.5mm) -> negligible, 0 points
      rainfallFreshness: { status: "fresh", ageMinutes: 5 },
      rateOfChange: noRise,
    });
    expect(result.level).toBe("insufficient_data");
    expect(result.score).toBe(0);
  });

  test("no river feed + light rain -> low (not insufficient_data) — light rain is a real, if small, signal", () => {
    const result = computeDetailedRisk({
      riverStatus: "no_feed",
      riverFreshness: null,
      rain6hMm: 0,
      rain24hMm: 5, // IMD 'light' (2.5-15.5mm) -> 5 points
      rainfallFreshness: { status: "fresh", ageMinutes: 5 },
      rateOfChange: noRise,
    });
    expect(result.level).toBe("low");
    expect(result.score).toBeGreaterThan(0);
  });

  test("no river feed + extremely heavy rain never exceeds 'medium' (safety cap)", () => {
    const result = computeDetailedRisk({
      riverStatus: "no_feed",
      riverFreshness: null,
      rain6hMm: 100,
      rain24hMm: 300, // extremely_heavy, max 30 points
      rainfallFreshness: { status: "fresh", ageMinutes: 5 },
      rateOfChange: noRise,
    });
    expect(result.score).toBeLessThanOrEqual(30);
    expect(["low", "medium"]).toContain(result.level);
    expect(result.level).not.toBe("high");
    expect(result.level).not.toBe("critical");
  });

  test("river at danger + heavy rain -> critical, with clear reasons", () => {
    const result = computeDetailedRisk({
      riverStatus: "danger",
      riverFreshness: { status: "fresh", ageMinutes: 5 },
      rain6hMm: 50,
      rain24hMm: 150, // very_heavy
      rainfallFreshness: { status: "fresh", ageMinutes: 5 },
      rateOfChange: noRise,
      stationName: "Test Gauge",
      zoneName: "Test Zone",
    });
    expect(result.level).toBe("critical");
    expect(result.reasons.some((r) => r.includes("danger"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("very heavy"))).toBe(true);
  });

  test("stale river reading is weighted at half strength and noted in reasons", () => {
    const fresh = computeDetailedRisk({
      riverStatus: "danger",
      riverFreshness: { status: "fresh", ageMinutes: 5 },
      rain6hMm: 0,
      rain24hMm: 0,
      rainfallFreshness: { status: "fresh", ageMinutes: 5 },
      rateOfChange: noRise,
    });
    const stale = computeDetailedRisk({
      riverStatus: "danger",
      riverFreshness: { status: "stale", ageMinutes: 90 },
      rain6hMm: 0,
      rain24hMm: 0,
      rainfallFreshness: { status: "fresh", ageMinutes: 5 },
      rateOfChange: noRise,
    });
    expect(stale.score).toBeLessThan(fresh.score);
    expect(stale.reasons.some((r) => r.includes("min old"))).toBe(true);
  });

  test("rapid rise adds points and a distinct reason, even below absolute danger", () => {
    const withoutRise = computeDetailedRisk({
      riverStatus: "watch",
      riverFreshness: { status: "fresh", ageMinutes: 5 },
      rain6hMm: 0,
      rain24hMm: 0,
      rainfallFreshness: { status: "fresh", ageMinutes: 5 },
      rateOfChange: noRise,
    });
    const withRise = computeDetailedRisk({
      riverStatus: "watch",
      riverFreshness: { status: "fresh", ageMinutes: 5 },
      rain6hMm: 0,
      rain24hMm: 0,
      rainfallFreshness: { status: "fresh", ageMinutes: 5 },
      rateOfChange: { ratePerHour: 0.35, rapidRise: true },
    });
    expect(withRise.score).toBeGreaterThan(withoutRise.score);
    expect(withRise.reasons.some((r) => r.includes("rising rapidly"))).toBe(true);
  });
});
