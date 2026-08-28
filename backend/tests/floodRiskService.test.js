const { stationStatus, computeZoneRisk } = require("../src/services/floodRiskService");

describe("stationStatus", () => {
  const station = { data_source: "manual", watch_level: 3, warning_level: 4, danger_level: 5 };

  test("returns 'unknown' when station is missing", () => {
    expect(stationStatus({ water_level: "3.5" }, null)).toBe("unknown");
  });

  test("returns 'no_feed' when data_source is unavailable, regardless of reading", () => {
    expect(stationStatus({ water_level: "3.5" }, { ...station, data_source: "unavailable" })).toBe("no_feed");
  });

  test("returns 'no_feed' when there is no reading at all", () => {
    expect(stationStatus(null, station)).toBe("no_feed");
  });

  test("returns 'normal' below watch level", () => {
    expect(stationStatus({ water_level: "2.9" }, station)).toBe("normal");
  });

  test("returns 'watch' at or above watch level but below warning", () => {
    expect(stationStatus({ water_level: "3.0" }, station)).toBe("watch");
    expect(stationStatus({ water_level: "3.9" }, station)).toBe("watch");
  });

  test("returns 'warning' at or above warning level but below danger", () => {
    expect(stationStatus({ water_level: "4.0" }, station)).toBe("warning");
    expect(stationStatus({ water_level: "4.9" }, station)).toBe("warning");
  });

  test("returns 'danger' at or above danger level", () => {
    expect(stationStatus({ water_level: "5.0" }, station)).toBe("danger");
    expect(stationStatus({ water_level: "9.9" }, station)).toBe("danger");
  });
});

describe("computeZoneRisk", () => {
  const station = { data_source: "manual", watch_level: 3, warning_level: 4, danger_level: 5 };

  test("returns 'insufficient_data' when there's no station feed and rainfall is light", () => {
    const risk = computeZoneRisk({
      stationReading: null,
      station: { ...station, data_source: "unavailable" },
      rainfallIntensityMmHr: 5,
    });
    expect(risk).toBe("insufficient_data");
  });

  test("caps at 'medium' from heavy rainfall alone when there's no river feed — never invents a higher score", () => {
    const risk = computeZoneRisk({
      stationReading: null,
      station: { ...station, data_source: "unavailable" },
      rainfallIntensityMmHr: 60,
    });
    expect(risk).toBe("medium");
  });

  test("'low' risk when river is normal and rain is light", () => {
    const risk = computeZoneRisk({
      stationReading: { water_level: "2.0" },
      station,
      rainfallIntensityMmHr: 2,
    });
    expect(risk).toBe("low");
  });

  test("'critical' risk when river is at danger AND rainfall is extreme", () => {
    const risk = computeZoneRisk({
      stationReading: { water_level: "5.5" },
      station,
      rainfallIntensityMmHr: 60,
    });
    expect(risk).toBe("critical");
  });

  test("'high' risk when river is at warning and rainfall is heavy", () => {
    const risk = computeZoneRisk({
      stationReading: { water_level: "4.2" },
      station,
      rainfallIntensityMmHr: 30,
    });
    expect(risk).toBe("high");
  });
});
