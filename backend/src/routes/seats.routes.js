// Mounted at /api/v1/events/:eventId/seats in app.js — mergeParams gives
// this router access to req.params.eventId.
const express = require('express');
const seatsController = require('../controllers/seats.controller');

const router = express.Router({ mergeParams: true });

router.get('/', seatsController.getSeatMap);

module.exports = router;
