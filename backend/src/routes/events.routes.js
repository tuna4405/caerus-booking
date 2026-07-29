const express = require('express');
const multer = require('multer');
const eventsController = require('../controllers/events.controller');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { ValidationError } = require('../lib/errors');

const router = express.Router();

// In-memory storage: the file never touches EC2 disk, just streams straight
// to lib/s3.js#uploadImage as a buffer. jpg/png + 5 MB cap per api-spec §3.2.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
      return cb(new ValidationError('image must be a jpg or png file.'));
    }
    cb(null, true);
  },
});

// Wraps multer so its own errors (wrong type, >5MB) become the app's
// { error: { code: 'VALIDATION_ERROR', ... } } shape instead of a raw 500.
function bannerUpload(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return next(err instanceof ValidationError ? err : new ValidationError(err.message));
    }
    next();
  });
}

router.get('/', eventsController.listEvents);
router.get('/:id', eventsController.getEventById);
router.post('/', auth, requireAdmin, eventsController.createEvent);
router.post('/:id/banner', auth, requireAdmin, bannerUpload, eventsController.uploadBanner);

module.exports = router;
