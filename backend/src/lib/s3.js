// S3 helpers for banner uploads (S3_BUCKET_IMAGES) and ticket PDFs
// (S3_BUCKET_TICKETS, Week 3 Lambda).
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

module.exports = {
  uploadImage,
  getSignedImageUrl,
};
