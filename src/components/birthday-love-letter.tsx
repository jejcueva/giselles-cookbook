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
          Oh my god happy birthday baby.
          I literally lob you so much.
          Hopefully you use this lmao.
          Have a good birthday baby I am so happy you were born lolol.
          I can&apos;t wait to spend more and more time with you it actually
          sucks we&apos;re so far... ugh im getting sad right now just thinking about it.
          anyways i lob you so much baby.
        </p>

        <button className="love-letter-button" onClick={onComplete}>
          Open Your Cookbook &rarr;
        </button>
      </div>
    </main>
  );
}
