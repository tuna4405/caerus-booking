const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const eventsRoutes = require('./routes/events.routes');
const seatsRoutes = require('./routes/seats.routes');
const bookingsRoutes = require('./routes/bookings.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// TODO: restrict origin to the S3 site + http://localhost:5173 (see docs/api-spec.md §6)
app.use(cors());
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
