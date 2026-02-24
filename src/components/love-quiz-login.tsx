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
    answer: "march 17",
    hint: "It is also birthday season.",
    placeholder: "e.g. March 17",
  },
  {
    id: "first-meet-place",
    prompt: "Where did we first meet?",
    answer: "school",
    hint: "Think about where we spent most weekdays.",
    placeholder: "Type your answer",
  },
  {
    id: "first-meet-day",
    prompt: "What day did we first meet?",
    answer: "friday",
    hint: "Right before the weekend.",
    placeholder: "e.g. Friday",
  },
  {
    id: "confession-date",
    prompt: "When did we confess we liked each other?",
    answer: "october 31",
    hint: "Spooky season.",
    placeholder: "e.g. October 31",
  },
];

const WRONG_MESSAGES = [
  "That is not quite right. Try one more time.",
  "Close, but not this one. You got this.",
  "Nope, that answer does not unlock this cookbook.",
];

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
  const showHint = attempts >= 3;

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

    // Wrong answer — shake, clear, then show a different message
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    const hintText = nextAttempts >= 3 ? ` Hint: ${question.hint}` : "";
    const firstIndex = Math.floor(Math.random() * WRONG_MESSAGES.length);
    const firstMessage = WRONG_MESSAGES[firstIndex];
    const otherMessages = WRONG_MESSAGES.filter((_, i) => i !== firstIndex);
    const secondMessage = otherMessages[Math.floor(Math.random() * otherMessages.length)];

    setError(`${firstMessage}${hintText}`);
    setErrorShaking(true);

    timerRef.current = setTimeout(() => {
      setError("");
      setErrorShaking(false);

      timerRef.current = setTimeout(() => {
        setError(`${secondMessage}${hintText}`);
      }, 350);
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
        <h1 className="quiz-prompt">{question.prompt}</h1>

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

          {showHint && !error ? (
            <small className="quiz-hint">Hint: {question.hint}</small>
          ) : null}

          <button type="submit">Check</button>
        </form>
      </section>
    </main>
  );
}
