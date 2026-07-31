// S3 helpers for banner uploads (S3_BUCKET_IMAGES) and ticket PDFs
// (S3_BUCKET_TICKETS) — the PDF bytes come from lib/ticketPdf.js.
//
// The SDK is given no explicit credentials — on EC2 it picks up the
// instance's IAM role automatically, which is what lets traffic reach S3
// over the VPC Gateway Endpoint instead of needing public internet access.
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({ region: process.env.AWS_REGION });

async function uploadImage(buffer, key, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_IMAGES,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return key;
}

// caerus-images is a private bucket, so callers must exchange the stored key
// for a time-limited signed URL (default 1h) whenever they need to render it.
async function getSignedImageUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_IMAGES,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

// Ticket PDFs are re-rendered and overwritten on every download click (no
// caching), so this always fires right before getSignedTicketUrl below.
// ContentDisposition forces a real download instead of the browser's inline
// PDF viewer taking over the tab.
async function uploadTicket(buffer, key, bookingId) {
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_TICKETS,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
      ContentDisposition: `attachment; filename="caerus-ticket-${bookingId}.pdf"`,
    })
  );
  return key;
}

// caerus-tickets-* is a private bucket too; same signed-URL pattern as
// getSignedImageUrl, just pointed at the tickets bucket + a shorter default
// expiry since a ticket is downloaded once, right after generating it.
async function getSignedTicketUrl(key, expiresIn = 300) {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_TICKETS,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

module.exports = {
  uploadImage,
  getSignedImageUrl,
  uploadTicket,
  getSignedTicketUrl,
};
