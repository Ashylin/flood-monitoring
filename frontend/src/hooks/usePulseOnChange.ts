import { useEffect, useRef, useState } from "react";

// Highlights a value briefly when it actually changes — not on first mount,
// and not on every re-render, only on a genuine change to `value`.
export function usePulseOnChange(value: string | number | undefined | null, durationMs = 900): boolean {
  const [pulsing, setPulsing] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current === value) return;
    prevRef.current = value;
    setPulsing(true);
    const t = setTimeout(() => setPulsing(false), durationMs);
    return () => clearTimeout(t);
  }, [value, durationMs]);

  return pulsing;
}
