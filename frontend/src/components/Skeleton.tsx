interface BlockProps {
  width?: string | number;
  height?: string | number;
  style?: React.CSSProperties;
}

export function SkeletonBlock({ width = "100%", height = 14, style }: BlockProps) {
  return <div className="skeleton-block" style={{ width, height, ...style }} />;
}

export function SkeletonStatGrid() {
  return (
    <div className="stat-grid">
      {Array.from({ length: 4 }).map((_, i) => (
        <div className="stat-card" key={i}>
          <SkeletonBlock width={90} height={10} />
          <SkeletonBlock width={60} height={26} style={{ marginTop: 9 }} />
          <SkeletonBlock width={110} height={11} style={{ marginTop: 7 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCardGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="card-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div className="river-card" key={i}>
          <SkeletonBlock width={120} height={13} />
          <SkeletonBlock width={90} height={11} style={{ marginTop: 8, marginLeft: 10 }} />
          <SkeletonBlock width={80} height={22} style={{ marginTop: 10, marginLeft: 10 }} />
          <SkeletonBlock width={160} height={11} style={{ marginTop: 10, marginLeft: 10 }} />
        </div>
      ))}
    </div>
  );
}
