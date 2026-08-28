const { classify24hRainfall, computeRollingWindows, IMD_24H_THRESHOLDS_MM } = require("../src/services/rainfallWindowService");

describe("classify24hRainfall (IMD standard thresholds)", () => {
  test("negligible below light threshold", () => {
    expect(classify24hRainfall(1)).toBe("negligible");
  });
  test("light", () => {
    expect(classify24hRainfall(IMD_24H_THRESHOLDS_MM.light)).toBe("light");
  });
  test("moderate", () => {
    expect(classify24hRainfall(IMD_24H_THRESHOLDS_MM.moderate)).toBe("moderate");
  });
  test("heavy", () => {
    expect(classify24hRainfall(IMD_24H_THRESHOLDS_MM.heavy)).toBe("heavy");
  });
  test("very heavy", () => {
    expect(classify24hRainfall(IMD_24H_THRESHOLDS_MM.veryHeavy)).toBe("very_heavy");
  });
  test("extremely heavy — real Dec 2015 Chennai city-average figure (286mm)", () => {
    expect(classify24hRainfall(286)).toBe("extremely_heavy");
  });
});

describe("computeRollingWindows", () => {
  function hourly(values) {
    return values.map((v, i) => ({ time: `2015-12-01T${String(i).padStart(2, "0")}:00`, precipitationMm: v }));
  }

  test("6h window only sums the trailing 6 hours", () => {
    const points = hourly([10, 10, 10, 10, 10, 10, 100]); // 7 hours
    const result = computeRollingWindows(points);
    // At hour index 6 (7th point), 6h window = indices 1..6 = 10*5 + 100 = 150
    expect(result[6].rain6h).toBe(150);
  });

  test("24h window sums all available hours when fewer than 24 exist", () => {
    const points = hourly([5, 5, 5]);
    const result = computeRollingWindows(points);
    expect(result[2].rain24h).toBe(15);
  });

  test("24h window caps at the trailing 24 hours once more than 24 exist", () => {
    const values = new Array(30).fill(1); // 30 hours of 1mm each
    const points = hourly(values);
    const result = computeRollingWindows(points);
    expect(result[29].rain24h).toBe(24); // only last 24 hours counted, not all 30
  });

  test("attaches the correct IMD category per point", () => {
    const points = hourly([300]); // single hour, 300mm — extremely heavy
    const result = computeRollingWindows(points);
    expect(result[0].category24h).toBe("extremely_heavy");
  });
});
