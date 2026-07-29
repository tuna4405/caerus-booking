const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const eventsRoutes = require('./routes/events.routes');
const seatsRoutes = require('./routes/seats.routes');
const bookingsRoutes = require('./routes/bookings.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

const allowedOrigins = [
  'http://caerus-frontend-web.s3-website-ap-southeast-1.amazonaws.com',
  'http://localhost:5173',
];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get('/api/v1/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/events', eventsRoutes);
app.use('/api/v1/events/:eventId/seats', seatsRoutes);
app.use('/api/v1/bookings', bookingsRoutes);

// Must stay last.
app.use(errorHandler);

module.exports = app;
