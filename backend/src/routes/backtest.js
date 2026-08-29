const express = require("express");
const { listEvents, getBacktest } = require("../controllers/backtestController");

const router = express.Router();

router.get("/", listEvents);
router.get("/:slug", getBacktest);

module.exports = router;
