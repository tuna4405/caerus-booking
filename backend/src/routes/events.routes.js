const express = require('express');
const eventsController = require('../controllers/events.controller');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

router.get('/', eventsController.listEvents);
router.get('/:id', eventsController.getEventById);
router.post('/', auth, requireAdmin, eventsController.createEvent);
router.post('/:id/banner', auth, requireAdmin, eventsController.uploadBanner);

module.exports = router;
