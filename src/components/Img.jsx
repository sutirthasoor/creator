import { useState } from "react";

/* <img> that keeps the original markup/classes; if the asset file is missing it
   renders an empty element with the same classes so layout stays intact. */
export default function Img({ src, alt = "", className, ...rest }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={className} role={alt ? "img" : undefined} aria-label={alt || undefined} />;
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} {...rest} />;
}
