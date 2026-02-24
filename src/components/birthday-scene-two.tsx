"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";

type BirthdaySceneTwoProps = {
  onComplete: () => void;
};

const CONFETTI_COLORS = ["#4afd00", "#ffffff", "#4afd00", "#ffffff", "#4afd00"];

function fireConfetti() {
  const defaults = {
    colors: CONFETTI_COLORS,
    spread: 80,
    ticks: 120,
    gravity: 0.9,
    scalar: 1.1,
  };

  confetti({ ...defaults, particleCount: 50, origin: { x: 0.3, y: 0.6 } });
  confetti({ ...defaults, particleCount: 50, origin: { x: 0.7, y: 0.6 } });

  setTimeout(() => {
    confetti({ ...defaults, particleCount: 30, origin: { x: 0.5, y: 0.4 } });
  }, 300);
}

export function BirthdaySceneTwo({ onComplete }: BirthdaySceneTwoProps) {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    fireConfetti();

    const timer = setTimeout(() => {
      setFadingOut(true);
      setTimeout(onComplete, 600);
    }, 4000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  const handleClick = () => {
    if (fadingOut) return;
    setFadingOut(true);
    setTimeout(onComplete, 600);
  };

  return (
    <main
      className={`birthday-screen ${fadingOut ? "birthday-screen-fade-out" : ""}`}
      onClick={handleClick}
    >
      <h1 className="birthday-title">happy birthday baby, i love you so much</h1>
    </main>
  );
}
