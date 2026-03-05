"use client";

import { useRouter } from "next/navigation";
import { BirthdayLoveLetter } from "@/components/birthday-love-letter";

export default function LetterPage() {
  const router = useRouter();

  return <BirthdayLoveLetter onComplete={() => router.push("/")} />;
}

