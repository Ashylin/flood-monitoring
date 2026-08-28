const express = require("express");
const { listZones } = require("../controllers/zoneController");

const router = express.Router();

router.get("/", listZones);

module.exports = router;
