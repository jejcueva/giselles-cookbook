"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  clearOnboardingFlags,
  hasCompletedQuiz,
  hasSeenBirthday,
  markQuizCompleted,
  normalizeAccountUsername,
} from "@/lib/onboarding-state";

const USERNAME_KEY = "cute-cookbook-username";
const BIRTHDAY_ENTRY_KEY = "cute-cookbook-birthday-entry";
const REMEMBER_USERNAME_KEY = "cute-cookbook-remember-username";

type QuizQuestion = {
  id: string;
  prompt: string;
  answer: string;
  hint: string;
  placeholder: string;
};

type Account = "gisellemyluv" | "test" | "recruiter";

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
    hint: "it is case-sensitive",
    placeholder: "name of the theatre",
  },
  {
    id: "first-meet-day",
    prompt: "What day did we first meet?",
    answer: "09/15/2025",
    hint: "c",
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
    answer: "I WOOF YOU",
    hint: "WOOF WOOF",
    placeholder: "how much? I ---- YOU",
  },
];

const WRONG_CREDENTIALS_MESSAGE = "Wrong username or password.";
const WRONG_QUIZ_MESSAGE = "nah dumbahh try again lol";

const PARTICLE_ANGLES = [0, 40, 80, 120, 160, 200, 240, 280, 320];
const PARTICLE_DISTANCE = 120;

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<"credentials" | "quiz">("credentials");
  const [username, setUsername] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(REMEMBER_USERNAME_KEY) || "";
  });
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem(REMEMBER_USERNAME_KEY);
  });
  const [pendingUser, setPendingUser] = useState<Account | null>(null);
  const [pendingPassword, setPendingPassword] = useState("");
  const [pendingHasSeenBirthday, setPendingHasSeenBirthday] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [value, setValue] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState("");
  const [errorShaking, setErrorShaking] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  const question = QUESTIONS[currentIndex];

  useEffect(() => {
    // One-time cleanup from older builds that persisted password.
    localStorage.removeItem("cute-cookbook-remember-password");
  }, []);

  function triggerError(message: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setError(message);
    setErrorShaking(true);
    timerRef.current = setTimeout(() => setErrorShaking(false), 550);
  }

  async function establishSession(user: Account, rawPassword: string) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: rawPassword }),
    });

    if (!response.ok) {
      throw new Error("Unable to create session");
    }
  }

  async function verifyCredentials(user: Account, rawPassword: string) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: rawPassword, mode: "verify" }),
    });

    if (!response.ok) {
      throw new Error("Invalid credentials");
    }
  }

  function handleCredentialsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalized = normalizeAccountUsername(username) as Account;
    verifyCredentials(normalized, password)
      .then(() => {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_USERNAME_KEY, normalized);
        } else {
          localStorage.removeItem(REMEMBER_USERNAME_KEY);
        }

        if (normalized === "recruiter") {
          establishSession(normalized, password)
            .then(() => {
              localStorage.setItem(USERNAME_KEY, normalized);
              localStorage.removeItem(BIRTHDAY_ENTRY_KEY);
              router.push("/");
            })
            .catch(() => {
              triggerError(WRONG_CREDENTIALS_MESSAGE);
            });
          return;
        }

        const userHasCompletedQuiz = hasCompletedQuiz(localStorage, normalized);
        const userHasSeenBirthday = hasSeenBirthday(localStorage, normalized);

        if (userHasCompletedQuiz) {
          establishSession(normalized, password)
            .then(() => {
              localStorage.setItem(USERNAME_KEY, normalized);
              const shouldShowBirthday = normalized === "test" || !userHasSeenBirthday;
              if (shouldShowBirthday) {
                localStorage.setItem(BIRTHDAY_ENTRY_KEY, "true");
                router.push("/birthday");
              } else {
                router.push("/");
              }
            })
            .catch(() => {
              triggerError(WRONG_CREDENTIALS_MESSAGE);
            });
          return;
        }

        setPendingPassword(password);
        setPendingHasSeenBirthday(userHasSeenBirthday);
        setPendingUser(normalized);
        setCurrentIndex(0);
        setValue("");
        setAttempts(0);
        setError("");
        setErrorShaking(false);
        setStep("quiz");
      })
      .catch(() => {
        triggerError(WRONG_CREDENTIALS_MESSAGE);
      });
  }

  function expectedAnswerForCurrentQuestion() {
    if (pendingUser === "test") return "test";
    return question.answer;
  }

  async function finishQuiz() {
    if (!pendingUser) {
      router.replace("/login");
      return;
    }

    if (!pendingPassword) {
      triggerError(WRONG_CREDENTIALS_MESSAGE);
      setStep("credentials");
      return;
    }

    try {
      await establishSession(pendingUser, pendingPassword);
    } catch {
      triggerError(WRONG_CREDENTIALS_MESSAGE);
      setStep("credentials");
      return;
    }

    localStorage.setItem(USERNAME_KEY, pendingUser);
    markQuizCompleted(localStorage, pendingUser);

    // Keep the test account reusable for birthday-flow QA.
    if (pendingUser === "test") {
      clearOnboardingFlags(localStorage, pendingUser);
    }

    const shouldShowBirthday = pendingUser === "test" || !pendingHasSeenBirthday;
    if (shouldShowBirthday) {
      localStorage.setItem(BIRTHDAY_ENTRY_KEY, "true");
      router.push("/birthday");
      return;
    }

    router.push("/");
  }

  function handleQuizSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (timerRef.current) clearTimeout(timerRef.current);

    if (normalize(value) === normalize(expectedAnswerForCurrentQuestion())) {
      setError("");
      setErrorShaking(false);
      setShowSplash(true);

      timerRef.current = setTimeout(() => {
        setShowSplash(false);
        if (currentIndex + 1 >= QUESTIONS.length) {
          finishQuiz();
        } else {
          setCurrentIndex((prev) => prev + 1);
          setValue("");
          setAttempts(0);
          setError("");
        }
      }, 900);

      return;
    }

    setAttempts((prev) => prev + 1);
    triggerError(WRONG_QUIZ_MESSAGE);
  }

  return (
    <main className="auth-screen">
      {showSplash && <HeartSplash />}

      <section className="auth-card quiz-card">
        <Image
          src="/cat.png"
          alt="two cats holding hands"
          className="quiz-cat-photo"
          width={240}
          height={240}
          priority
        />

        <div className="quiz-heart">&hearts;</div>

        {step === "credentials" ? (
          <>
            <p className="quiz-prompt">sign in to your cookbook</p>
            <form className="quiz-form" onSubmit={handleCredentialsSubmit}>
              <input
                type="text"
                className="quiz-single-input"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
              />

              <input
                ref={passwordRef}
                type="password"
                className="quiz-single-input"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <label className="quiz-remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>

              {error ? (
                <p className={`error-text${errorShaking ? " error-shake" : ""}`}>{error}</p>
              ) : null}

              <button type="submit">Check</button>
            </form>
            <button
              type="button"
              className="recruiter-login-link"
              onClick={() => {
                setUsername("recruiter");
                setError("");
                passwordRef.current?.focus();
              }}
            >
              Recruiter access
            </button>
            {normalizeAccountUsername(username) === "recruiter" ? (
              <p className="quiz-hint">Read-only preview. The personal quiz is skipped.</p>
            ) : null}
          </>
        ) : (
          <>
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

            <p className="eyebrow">
              Question {currentIndex + 1} of {QUESTIONS.length}
            </p>
            <p className="quiz-prompt">{question.prompt}</p>

            <form className="quiz-form" onSubmit={handleQuizSubmit}>
              <input
                key={question.id}
                type="text"
                className="quiz-single-input"
                placeholder={pendingUser === "test" ? "type test" : question.placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                required
              />

              {attempts >= 3 && question.hint ? (
                <p className="quiz-hint">Hint: {question.hint}</p>
              ) : null}

              {pendingUser === "test" ? (
                <p className="quiz-hint">Demo hint: type &quot;test&quot; for each question.</p>
              ) : null}

              {error ? (
                <p className={`error-text${errorShaking ? " error-shake" : ""}`}>{error}</p>
              ) : null}

              <button type="submit">Check</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
