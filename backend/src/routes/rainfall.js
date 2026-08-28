const express = require("express");
const { listRainfall, getDistrictHistory } = require("../controllers/rainfallController");

const router = express.Router();

router.get("/", listRainfall);
router.get("/:district/history", getDistrictHistory);

module.exports = router;
