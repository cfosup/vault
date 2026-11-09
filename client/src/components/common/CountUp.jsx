import React, { useEffect, useState } from 'react';

export function CountUp({
  value = 0,
  prefix = '₹',
  duration = 800,
  className,
  style,
}) {
  const target = Math.max(0, Math.round(Number(value) || 0));
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setShown(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return (
    <span className={className} style={style}>
      {prefix}{shown.toLocaleString('en-IN')}
    </span>
  );
}

export function RollingAmount({ prefix = '₹' }) {
  return (
    <span className="rolling-amount" aria-label="Loading amount">
      <span>{prefix}</span>
      {Array.from({ length: 5 }, (_, index) => (
        <span className="digit-reel" key={index} style={{ animationDelay: `${index * 0.07}s` }}>
          <span>{'0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n0'}</span>
        </span>
      ))}
    </span>
  );
}

export default CountUp;
