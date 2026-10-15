import { type CSSProperties, useEffect, useState } from "react";

const BUBBLES = [
  { left: "6%", size: 6, delay: 0, drift: 5 },
  { left: "14%", size: 9, delay: 420, drift: -6 },
  { left: "23%", size: 5, delay: 150, drift: 4 },
  { left: "31%", size: 7, delay: 700, drift: -5 },
  { left: "40%", size: 10, delay: 260, drift: 6 },
  { left: "49%", size: 5, delay: 860, drift: -4 },
  { left: "57%", size: 8, delay: 90, drift: 5 },
  { left: "65%", size: 6, delay: 540, drift: -6 },
  { left: "73%", size: 9, delay: 330, drift: 4 },
  { left: "81%", size: 5, delay: 760, drift: -5 },
  { left: "88%", size: 7, delay: 200, drift: 6 },
  { left: "94%", size: 6, delay: 620, drift: -4 },
];
const RISE_MS = 2400;
const BURST_MS = RISE_MS + Math.max(...BUBBLES.map((bubble) => bubble.delay));

export function SidebarBubbles({ since }: { since: number }) {
  const [elapsed] = useState(() => Date.now() - since);
  const [done, setDone] = useState(elapsed >= BURST_MS);
  useEffect(() => {
    if (done) return;
    const timeout = setTimeout(() => setDone(true), BURST_MS - elapsed);
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
              animationDuration: `${RISE_MS}ms`,
              animationDelay: `${bubble.delay - elapsed}ms`,
              "--sidebar-bubble-drift": `${bubble.drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
