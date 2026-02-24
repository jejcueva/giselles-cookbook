"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BirthdaySceneTwo } from "@/components/birthday-scene-two";
import { BirthdayLoveLetter } from "@/components/birthday-love-letter";

const BIRTHDAY_SEEN_KEY = "has_seen_birthday";

export function BirthdayFlow() {
  const router = useRouter();
  const [scene, setScene] = useState(1);

  // Scene 1 auto-advances to Scene 2
  useEffect(() => {
    if (scene === 1) {
      const timer = setTimeout(() => setScene(2), 3500);
      return () => clearTimeout(timer);
    }
  }, [scene]);

  const handleSceneTwoComplete = () => setScene(3);

  const handleLoveLetterComplete = () => {
    localStorage.setItem(BIRTHDAY_SEEN_KEY, "true");
    router.push("/");
  };

  if (scene === 2) {
    return <BirthdaySceneTwo onComplete={handleSceneTwoComplete} />;
  }

  if (scene === 3) {
    return <BirthdayLoveLetter onComplete={handleLoveLetterComplete} />;
  }

  // Scene 1: bear animation
  return (
    <main className="birthday-scene">
      <div className="birthday-scene-inner">
        <video
          className="birthday-video"
          src="/animation.mp4"
          autoPlay
          muted
          playsInline
        />
      </div>
    </main>
  );
}

