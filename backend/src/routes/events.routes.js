const express = require('express');
const eventsController = require('../controllers/events.controller');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

router.get('/', eventsController.list);
router.get('/:id', eventsController.getById);
router.post('/', auth, requireAdmin, eventsController.create);
router.post('/:id/banner', auth, requireAdmin, eventsController.uploadBanner);

module.exports = router;
