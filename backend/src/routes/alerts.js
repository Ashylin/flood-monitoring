const express = require("express");
const { listAlerts, createAlert, updateAlertStatus } = require("../controllers/alertController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", listAlerts);
router.post("/", requireAuth(["admin", "operator"]), createAlert);
router.patch("/:id", requireAuth(["admin", "operator"]), updateAlertStatus);

module.exports = router;
