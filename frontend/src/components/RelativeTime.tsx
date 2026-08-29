import { useEffect, useState } from "react";

interface Props {
  timestamp?: string | null;
  prefix?: string;
}

function formatRelative(ts: string): string {
  const diffMs = Date.now() - new Date(ts).getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

// Re-renders on an interval purely to keep the "N ago" text advancing —
// the timestamp value itself only ever changes when new data actually
// arrives (via REST load or a socket event upstream).
export default function RelativeTime({ timestamp, prefix = "Updated" }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  if (!timestamp) return <>—</>;
  return (
    <time dateTime={timestamp} title={new Date(timestamp).toLocaleString()}>
      {prefix ? `${prefix} ${formatRelative(timestamp)}` : formatRelative(timestamp)}
    </time>
  );
}
