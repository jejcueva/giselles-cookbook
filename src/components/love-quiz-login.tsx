"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type QuizQuestion = {
  id: string;
  prompt: string;
  answer: string;
  hint: string;
  placeholder: string;
};

const QUESTIONS: QuizQuestion[] = [
  {
    id: "anniversary",
    prompt: "When is our anniversary?",
    answer: "01/09/2026",
    hint: "",
    placeholder: "MM/DD/YYYY",
  },
  {
    id: "first-meet-place",
    prompt: "Where did we meet for the first time?",
    answer: "Galaxy Theatre",
    hint: "it is a case-sensitive.",
    placeholder: "name of the place",
  },
  {
    id: "first-meet-day",
    prompt: "What day did we first meet?",
    answer: "09/15/2025",
    hint: "",
    placeholder: "MM/DD/YYYY",
  },
  {
    id: "confession-date",
    prompt: "When did we confess we liked each other?",
    answer: "01/02/2026",
    hint: "",
    placeholder: "MM/DD/YYYY",
  },
  {
    id: "like-you",
    prompt: "How much do I like you?",
    answer: "I LOVE YOU",
    hint: "are you serious i like you more than that. I L--E YOU",
    placeholder: "how much?",
  },
];

const WRONG_MESSAGE = "no nigga";

const SESSION_KEY = "cute-cookbook-authenticated";

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const PARTICLE_ANGLES = [0, 40, 80, 120, 160, 200, 240, 280, 320];
const PARTICLE_DISTANCE = 120;

function HeartSplash() {
  return (
    <div className="heart-splash-overlay">
      <span className="heart-splash-center">❤️</span>
      {PARTICLE_ANGLES.map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const tx = Math.round(Math.cos(rad) * PARTICLE_DISTANCE);
        const ty = Math.round(Math.sin(rad) * PARTICLE_DISTANCE);
        return (
          <span
            key={i}
            className="heart-splash-particle"
            style={
              {
                "--tx": `${tx}px`,
                "--ty": `${ty}px`,
                animationDelay: `${i * 25}ms`,
              } as React.CSSProperties
            }
          >
            🩷
          </span>
        );
      })}
    </div>
  );
}

export function LoveQuizLogin() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [value, setValue] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState("");
  const [errorShaking, setErrorShaking] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const question = QUESTIONS[currentIndex];
  const submitAnswer = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (timerRef.current) clearTimeout(timerRef.current);

    if (normalize(value) === normalize(question.answer)) {
      setError("");
      setErrorShaking(false);
      setShowSplash(true);

      timerRef.current = setTimeout(() => {
        setShowSplash(false);
        if (currentIndex + 1 >= QUESTIONS.length) {
          localStorage.setItem(SESSION_KEY, "true");
          router.push("/");
        } else {
          setCurrentIndex((prev) => prev + 1);
          setValue("");
          setAttempts(0);
          setError("");
        }
      }, 900);

      return;
    }

    // Wrong answer — shake then show message
    setAttempts((prev) => prev + 1);
    setError(WRONG_MESSAGE);
    setErrorShaking(true);

    timerRef.current = setTimeout(() => {
      setErrorShaking(false);
    }, 550);
  };

  return (
    <main className="auth-screen">
      {showSplash && <HeartSplash />}

      <section className="auth-card quiz-card">
        <img src="/cat.png" alt="two cats holding hands" className="quiz-cat-photo" />

        <div className="quiz-heart">♥</div>

        <div className="quiz-progress">
          {QUESTIONS.map((_, i) => (
            <span
              key={i}
              className={`quiz-dot${i === currentIndex ? " quiz-dot-active" : i < currentIndex ? " quiz-dot-done" : ""}`}
            >
              {i < currentIndex || i === currentIndex ? "♥" : "♡"}
            </span>
          ))}
        </div>

        <p className="eyebrow">Question {currentIndex + 1} of {QUESTIONS.length}</p>
        <p className="quiz-prompt">{question.prompt}</p>

        <form className="quiz-form" onSubmit={submitAnswer}>
          <input
            key={question.id}
            type="text"
            className="quiz-single-input"
            placeholder={question.placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            required
          />

          {error ? (
            <p className={`error-text${errorShaking ? " error-shake" : ""}`}>{error}</p>
          ) : null}

          <button type="submit">Check</button>
        </form>
      </section>
    </main>
  );
}
