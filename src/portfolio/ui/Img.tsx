import manifest from "../content/image-manifest.json";
import { asset } from "../seo/asset";

/**
 * One `<img>` for the whole site, so responsive images are not something each
 * section has to remember.
 *
 * The derivatives themselves are produced by `scripts/build-images.mjs`
 * (`npm run images`), which also writes `content/image-manifest.json` — the map
 * imported here. Two deliberate choices:
 *
 * - **`src` always stays a real file.** `srcSet` is additive: a browser that
 *   ignores it, or a manifest that has not caught up with a freshly added
 *   image, still renders the original. Nothing can 404 because of this
 *   component.
 * - **No `<picture>` wrapper.** Several sections style their image with a
 *   direct-child or `img`-only selector (`.story-photo-mask img`,
 *   `.tv-frame`, …) and flex/grid geometry depends on the `<img>` being the
 *   boxed element. An extra element in between is a layout bug waiting to
 *   happen, so the WebP candidates ride on the `<img>` itself.
 *
 * Paths are run through `asset()` because the content JSON stores them
 * root-absolute (`/images/figure.jpg`) while the site may be served from a
 * sub-path on GitHub Pages. The manifest is keyed by the *content* path, so
 * lookups happen before the prefix is applied.
 */
type MediaManifest = {
  images: Record<string, { width: number; height: number; variants: { type: string; srcSet: string }[] }>;
};

const IMAGES = (manifest as MediaManifest).images;

type ImgProps = {
  src: string;
  alt: string;
  /** Layout hint for candidate selection, e.g. `(max-width: 767px) 56vw, 45vw`. */
  sizes?: string;
  className?: string;
  loading?: "lazy" | "eager";
  decoding?: "sync" | "async" | "auto";
  /** Hero images: fetch in the first round trip. */
  priority?: boolean;
  draggable?: boolean;
  width?: number;
  height?: number;
  /** Decorative images should not be announced. */
  hidden?: boolean;
  /**
   * Opt this picture into the pointer-driven ripple (see `ui/WaterHover.tsx`).
   * Marking is all this component does — the controller lives once per page, so
   * there is no wrapper, no canvas per image, and no extra request: the ripple
   * texture is read from the `<img>`'s own `currentSrc`.
   *
   * Content images are in by default. `hidden` (decorative / composited)
   * images are out by default, but may opt in explicitly — that is how the two
   * cropped Hero strips get the effect without dragging the television frame,
   * its alpha cutout or the CRT layers along with them:
   *
   * - omitted      → on, unless the image is `hidden`
   * - `"subtle"`   → on, damped (the Hero's primary photograph)
   * - `"strong"`   → on, amplified (the narrow Hero strips)
   * - `false`      → always off
   */
  water?: boolean | "subtle" | "strong";
};

/** The WebP candidate list for a source, if one was generated. */
export function srcSetFor(src: string): string | undefined {
  const srcSet = IMAGES[src]?.variants.find((variant) => variant.type === "image/webp")?.srcSet;
  if (!srcSet) return undefined;
  return srcSet
    .split(",")
    .map((candidate) => {
      const [url, descriptor] = candidate.trim().split(/\s+/);
      return descriptor ? `${asset(url)} ${descriptor}` : asset(url);
    })
    .join(", ");
}

export function intrinsicSize(src: string): { width: number; height: number } | undefined {
  const entry = IMAGES[src];
  return entry ? { width: entry.width, height: entry.height } : undefined;
}

export function Img({
  src,
  alt,
  sizes,
  className,
  loading,
  decoding = "async",
  priority,
  draggable,
  width,
  height,
  hidden,
  water,
}: ImgProps) {
  const srcSet = srcSetFor(src);
  const waterMode =
    water === undefined
      ? hidden
        ? undefined
        : "true"
      : water === true
        ? "true"
        : water === false
          ? undefined
          : water;
  return (
    // `next/image` needs an optimisation server or a loader service; this is a
    // pure static export, so the script above is how the responsive set is made.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={asset(src)}
      srcSet={srcSet}
      // `sizes` is meaningless without a candidate list, and a stray one would
      // only make the browser do more work in the preload scanner.
      sizes={srcSet ? sizes : undefined}
      alt={hidden ? "" : alt}
      aria-hidden={hidden || undefined}
      loading={priority ? "eager" : loading}
      fetchPriority={priority ? "high" : undefined}
      decoding={decoding}
      draggable={draggable}
      // The only contract with `WaterHover`: a marker on the real `<img>`.
      // Nothing is wrapped, so direct-child selectors keep working.
      data-water={waterMode}
      width={width ?? intrinsicSize(src)?.width}
      height={height ?? intrinsicSize(src)?.height}
    />
  );
}
