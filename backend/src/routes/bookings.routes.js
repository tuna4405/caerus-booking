const express = require('express');
const bookingsController = require('../controllers/bookings.controller');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, bookingsController.create);
router.get('/', auth, bookingsController.getMyBookings);
router.get('/:id', auth, bookingsController.getById);
router.delete('/:id', auth, bookingsController.cancel);

module.exports = router;
