import type { UnsplashPhoto } from "../hooks/useUnsplashPhoto";

const UNSPLASH_HOME = "https://unsplash.com/?utm_source=tn_flood_monitoring&utm_medium=referral";

// Unsplash's license requires attributing both the photographer and
// Unsplash itself, with referral params on both links — this isn't
// optional decoration, it's the actual condition of using the photo.
export default function UnsplashCredit({ photo, className }: { photo: UnsplashPhoto; className?: string }) {
  return (
    <div className={className}>
      Photo by{" "}
      <a href={photo.photographerProfileUrl} target="_blank" rel="noopener noreferrer">
        {photo.photographerName}
      </a>{" "}
      on{" "}
      <a href={UNSPLASH_HOME} target="_blank" rel="noopener noreferrer">
        Unsplash
      </a>
    </div>
  );
}
