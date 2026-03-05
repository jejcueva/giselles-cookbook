"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const SESSION_KEY = "cute-cookbook-authenticated";
const VALID_USERNAME = "gisseleMyLove";
const VALID_PASSWORD = "01092026";
const WRONG_MESSAGE = "no nigga";

export function LoveQuizLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorShaking, setErrorShaking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (timerRef.current) clearTimeout(timerRef.current);

    if (username === VALID_USERNAME && password === VALID_PASSWORD) {
      localStorage.setItem(SESSION_KEY, "true");
      const seenBirthday = localStorage.getItem("has_seen_birthday");
      router.push(seenBirthday ? "/" : "/birthday");
      return;
    }

    setError(WRONG_MESSAGE);
    setErrorShaking(true);
    timerRef.current = setTimeout(() => setErrorShaking(false), 550);
  };

  return (
    <main className="auth-screen">
      <section className="auth-card quiz-card">
        <img src="/cat.png" alt="two cats holding hands" className="quiz-cat-photo" />

        <div className="quiz-heart">♥</div>

        <p className="quiz-prompt">sign in to your cookbook</p>

        <form className="quiz-form" onSubmit={handleSubmit}>
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
            type="password"
            className="quiz-single-input"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
