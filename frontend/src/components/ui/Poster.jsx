import { useEffect, useState } from 'react';

import './Poster.css';

// 2:3 movie poster. Shows the image when `src` is set and loads; falls back to
// the title's first letter on a placeholder when `src` is null OR the image
// fails to load (bad S3 URL, missing object, wrong bucket policy) — no
// broken-image icon. Pass a `className` for context-specific sizing/rounding.
export default function Poster({ src, title, className = '', loading = 'lazy' }) {
  const [failed, setFailed] = useState(false);

  // A new src (e.g. navigating between events) gets a fresh chance to load.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  const initial = (title?.trim()?.[0] ?? '?').toUpperCase();
  const showImage = Boolean(src) && !failed;

  return (
    <div className={`caerus-poster ${className}`.trim()}>
      {showImage ? (
        <img
          className="caerus-poster-img"
          src={src}
          alt=""
          loading={loading}
          onError={() => {
            // Dev-only visibility: a 403 (expired/invalid presigned URL) or a
            // missing object both land here, and previously vanished silently
            // behind the letter-placeholder fallback below.
            if (import.meta.env.DEV) {
              console.warn(`Poster failed to load: ${src}`);
            }
            setFailed(true);
          }}
        />
      ) : (
        <span className="caerus-poster-letter" aria-hidden="true">
          {initial}
        </span>
      )}
    </div>
  );
}
