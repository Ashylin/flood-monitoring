const express = require("express");
const {
  listStations,
  getStation,
  getStationHistory,
  submitReading,
  submitDeviceReading,
  provisionDevice,
} = require("../controllers/riverController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", listStations);
router.get("/:id", getStation);
router.get("/:id/history", getStationHistory);
router.post("/:id/readings", requireAuth(["admin", "operator"]), submitReading);
router.post("/:id/device-readings", submitDeviceReading); // auth via x-device-token, checked per-station
router.post("/:id/provision-device", requireAuth(["admin"]), provisionDevice);

module.exports = router;
