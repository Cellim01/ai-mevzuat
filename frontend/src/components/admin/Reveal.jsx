import { useEffect, useState } from "react";

export default function Reveal({ children, delay = 0, className = "" }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 40 + delay * 90);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: `opacity 0.5s ease ${delay * 0.06}s, transform 0.5s ease ${delay * 0.06}s`,
      }}
    >
      {children}
    </div>
  );
}
