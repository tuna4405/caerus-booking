// S3 helpers for banner uploads (S3_BUCKET_IMAGES) and ticket PDFs
// (S3_BUCKET_TICKETS, Week 3 Lambda). Not wired up yet — add the AWS SDK
// (@aws-sdk/client-s3) as a dependency when implementing this.

async function uploadImage(buffer, key) {
  // TODO: upload `buffer` to process.env.S3_BUCKET_IMAGES under `key`,
  // return the public URL (see POST /events/:id/banner in api-spec.md §3.2)
  throw new Error('lib/s3.js#uploadImage not implemented yet');
}

module.exports = {
  uploadImage,
};
