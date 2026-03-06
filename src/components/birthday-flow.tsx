"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { BirthdaySceneTwo } from "@/components/birthday-scene-two";
import { BirthdayLoveLetter } from "@/components/birthday-love-letter";

const SESSION_KEY = "cute-cookbook-authenticated";
const USERNAME_KEY = "cute-cookbook-username";
const BIRTHDAY_ENTRY_KEY = "cute-cookbook-birthday-entry";

function birthdaySeenKey(user: string) {
  return `has_seen_birthday_${user}`;
}

export function BirthdayFlow() {
  const router = useRouter();
  const [scene, setScene] = useState(1);
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const isAuthenticated =
    isClient && localStorage.getItem(SESSION_KEY) === "true";
  const user = isClient ? localStorage.getItem(USERNAME_KEY) : null;
  const cameFromQuiz =
    isClient && localStorage.getItem(BIRTHDAY_ENTRY_KEY) === "true";
  const canShowBirthdayFlow = isAuthenticated && !!user && cameFromQuiz;

  useEffect(() => {
    if (isClient && !canShowBirthdayFlow) {
      router.replace("/login");
    }
  }, [canShowBirthdayFlow, isClient, router]);

  // Scene 1 auto-advances to Scene 2
  useEffect(() => {
    if (!canShowBirthdayFlow) {
      return;
    }

    if (scene === 1) {
      const timer = setTimeout(() => setScene(2), 3500);
      return () => clearTimeout(timer);
    }
  }, [canShowBirthdayFlow, scene]);

  const handleSceneTwoComplete = () => setScene(3);

  const handleLoveLetterComplete = () => {
    const user = typeof window !== "undefined" ? localStorage.getItem(USERNAME_KEY) || "gisellemyluv" : "gisellemyluv";
    localStorage.setItem(birthdaySeenKey(user), "true");
    localStorage.removeItem(BIRTHDAY_ENTRY_KEY);
    router.push("/");
  };

  if (!isClient || !canShowBirthdayFlow) {
    return null;
  }

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
