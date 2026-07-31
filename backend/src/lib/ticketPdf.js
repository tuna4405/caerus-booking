// Renders one booking's ticket as a PDF buffer. Pure rendering, no AWS calls —
// bookings.service.js#generateTicket() uploads the result via lib/s3.js#uploadTicket.
const PDFDocument = require('pdfkit');
const { CINEMA_TIMEZONE } = require('../config/timezone');

function renderTicketPdf({ bookingId, eventTitle, startsAt, auditorium, seatLabels, totalPrice }) {
  return new Promise((resolve, reject) => {
    // Small ticket-stub-sized page (roughly 3in x 6in) rather than a full A4 sheet.
    const doc = new PDFDocument({ size: [216, 432], margin: 24 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const showtime = new Date(startsAt).toLocaleString('en-GB', {
      timeZone: CINEMA_TIMEZONE,
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const total = new Intl.NumberFormat('vi-VN').format(totalPrice);

    doc.fontSize(16).text('CAERUS CINEMA', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(13).text(eventTitle, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`Showtime: ${showtime} (GMT+7)`);
    doc.text(`Room: ${auditorium}`);
    doc.text(`Seats: ${seatLabels.join(', ')}`);
    doc.text(`Total: ${total} VND`);
    doc.moveDown();
    doc.fontSize(9).fillColor('#666').text(`Booking #${bookingId}`, { align: 'center' });

    doc.end();
  });
}

module.exports = { renderTicketPdf };
