import { useState } from "react";
import { BookOpen } from "lucide-react";
import { sizedImage } from "../lib/money.js";

/* Product image with a branded fallback for products without a photo (or a broken URL). */
export default function ProductMedia({ image, title, width = 600, eager = false }) {
  const [failed, setFailed] = useState(false);
  if (!image || !image.url || failed) {
    return (
      <div className="cm-media-fallback" role="img" aria-label={title}>
        <BookOpen size={34} aria-hidden="true" />
        <span>{title}</span>
      </div>
    );
  }
  return (
    <img
      src={sizedImage(image.url, width)}
      alt={image.altText || title}
      width={image.width || undefined}
      height={image.height || undefined}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
