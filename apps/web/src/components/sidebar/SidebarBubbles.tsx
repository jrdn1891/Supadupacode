import { type CSSProperties, useEffect, useState } from "react";

import {
  BUBBLE_BURST_MS,
  BUBBLE_RISE_MS,
  BUBBLES,
} from "@supacode/client-runtime/aquarium/bubbles";

export function SidebarBubbles({ since }: { since: number }) {
  const [elapsed] = useState(() => Date.now() - since);
  const [done, setDone] = useState(elapsed >= BUBBLE_BURST_MS);
  useEffect(() => {
    if (done) return;
    const timeout = setTimeout(() => setDone(true), BUBBLE_BURST_MS - elapsed);
    return () => clearTimeout(timeout);
  }, [done, elapsed]);

  if (done) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden [container-type:size]"
    >
      {BUBBLES.map((bubble) => (
        <span
          key={bubble.left}
          className="sidebar-bubble"
          style={
            {
              left: bubble.left,
              width: bubble.size,
              height: bubble.size,
              animationDuration: `${BUBBLE_RISE_MS}ms`,
              animationDelay: `${bubble.delay - elapsed}ms`,
              "--sidebar-bubble-drift": `${bubble.drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
