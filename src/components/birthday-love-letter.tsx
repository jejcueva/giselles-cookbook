"use client";

type BirthdayLoveLetterProps = {
  onComplete: () => void;
};

export function BirthdayLoveLetter({ onComplete }: BirthdayLoveLetterProps) {
  return (
    <main className="love-letter-screen">
      <div className="love-letter">
        <p className="love-letter-body">
          Hey giselle,
          From the bottom of my heart I wanted to say I love youuuu. Like so much.
          Fr
        </p>

        <button className="love-letter-button" onClick={onComplete}>
          Open Your Cookbook &rarr;
        </button>
      </div>
    </main>
  );
}
