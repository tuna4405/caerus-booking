const express = require('express');
const bookingsController = require('../controllers/bookings.controller');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, bookingsController.createBooking);
router.get('/', auth, bookingsController.getMyBookings);
router.get('/:id', auth, bookingsController.getById);
router.delete('/:id', auth, bookingsController.cancelBooking);

module.exports = router;
