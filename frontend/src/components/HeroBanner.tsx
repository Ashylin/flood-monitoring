import { useUnsplashPhoto } from "../hooks/useUnsplashPhoto";
import UnsplashCredit from "./UnsplashCredit";
import { SkeletonBlock } from "./Skeleton";

export default function HeroBanner() {
  const { photo, loading } = useUnsplashPhoto("Tamil Nadu monsoon river rain");

  if (loading) return <SkeletonBlock height={180} style={{ marginBottom: 20, borderRadius: 8 }} />;

  // No key configured, or the fetch failed — an honest gradient, not a
  // fake photo. It never claims to be real imagery.
  if (!photo) {
    return (
      <div className="hero-banner hero-banner-fallback">
        <div className="hero-banner-copy">
          <div className="hero-banner-title">Tamil Nadu Flood Early Warning</div>
          <div className="hero-banner-sub">
            Live river, rainfall, and flood-zone monitoring across 38 districts
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hero-banner" style={{ backgroundImage: `url(${photo.imageUrl})` }}>
      <div className="hero-banner-scrim" />
      <div className="hero-banner-copy">
        <div className="hero-banner-title">Tamil Nadu Flood Early Warning</div>
        <div className="hero-banner-sub">
          Live river, rainfall, and flood-zone monitoring across 38 districts
        </div>
      </div>
      <UnsplashCredit photo={photo} className="hero-banner-credit" />
    </div>
  );
}
