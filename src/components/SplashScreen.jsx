import React, { useEffect, useState } from "react";

function SplashScreen({ onDone }) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 2200);
    const doneTimer = setTimeout(() => {
      onDone?.();
    }, 2700);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  const meeps = [
    { id: 1, delay: 0, scale: 1.0, left: 0, bottom: 0 },
    { id: 2, delay: 160, scale: 0.9, left: -6, bottom: 8 },
    { id: 3, delay: 260, scale: 0.95, left: 4, bottom: -4 },
    { id: 4, delay: 360, scale: 1.05, left: -10, bottom: -10 },
    { id: 5, delay: 460, scale: 0.85, left: 8, bottom: 12 },
  ];

  const renderMeep = (meep) => (
    <div
      key={meep.id}
      className="splash-meep"
      style={{
        animationDelay: `${meep.delay}ms`,
        "--meep-scale": meep.scale,
        left: `${meep.left}%`,
        bottom: `${meep.bottom}%`,
      }}
      aria-hidden="true"
    >
      <svg
        className="splash-meep-svg"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M45 76 Q60 86 75 76 Q78 96 69 104 Q60 108 51 104 Q42 96 45 76 Z"
          fill="#facc15"
        />
        <circle cx="60" cy="46" r="30" fill="#facc15" />
        <circle
          cx="48"
          cy="44"
          r="9.5"
          fill="#ffffff"
          stroke="#f59e0b"
          strokeWidth="3"
        />
        <circle
          cx="72"
          cy="44"
          r="9.5"
          fill="#ffffff"
          stroke="#f59e0b"
          strokeWidth="3"
        />
        <path
          d="M43 30 C38 30 36 33 36 36 C36 40 39 42 42 42 C45 42 47 40 47 38 C47 36 46 35 44.5 34.5"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M77 30 C82 30 84 33 84 36 C84 40 81 42 78 42 C75 42 73 40 73 38 C73 36 74 35 75.5 34.5"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M60 18 L60 58"
          stroke="#fbbf24"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
    </div>
  );

  return (
    <div
      className={`splash-screen fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900 transition-opacity duration-500 ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      {meeps.map(renderMeep)}
    </div>
  );
}

export default SplashScreen;
