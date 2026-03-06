"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export const IMPORT_PREFILL_KEY = "cute-cookbook-import-prefill";

type NewRecipeModalProps = {
  open: boolean;
  onClose: () => void;
};

export function NewRecipeModal({ open, onClose }: NewRecipeModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<"choice" | "url">("choice");

  function closeModal() {
    setStep("choice");
    setImportUrl("");
    setImportError("");
    onClose();
  }
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  function handleDoItMyself() {
    closeModal();
    router.push("/recipes/new?manual=1");
  }

  function handleImportFromUrl() {
    setStep("url");
    setImportError("");
  }

  function handleBack() {
    setStep("choice");
    setImportUrl("");
    setImportError("");
  }

  async function handleImportSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportError("");
    try {
      const res = await fetch("/api/scrape-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error || "Failed to import");
        setImporting(false);
        return;
      }
      const prefill = {
        title: data.title ?? "",
        ingredients: data.ingredients ?? [],
        instructions: data.instructions ?? [],
        cookTime: data.cookTime ?? null,
        prepTime: data.prepTime ?? null,
        servings: data.servings ?? null,
        calories: data.calories ?? null,
        protein: data.protein ?? null,
        carbs: data.carbs ?? null,
        fat: data.fat ?? null,
        imageUrl: data.imageUrl ?? null,
        sourceUrl: importUrl.trim(),
      };
      if (typeof window !== "undefined") {
        sessionStorage.setItem(IMPORT_PREFILL_KEY, JSON.stringify(prefill));
      }
      closeModal();
      router.push("/recipes/new");
    } catch {
      setImportError("Something went wrong");
    }
    setImporting(false);
  }

  if (!open) return null;

  return (
    <div
      className="new-recipe-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-recipe-modal-title"
    >
      <div className="new-recipe-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="new-recipe-modal-close"
          onClick={closeModal}
          aria-label="Close"
        >
          &times;
        </button>

        {step === "choice" ? (
          <>
            <h2 id="new-recipe-modal-title" className="new-recipe-modal-title">
              Add new recipe
            </h2>
            <p className="new-recipe-modal-subtitle">
              Import from a blog link or enter everything yourself.
            </p>
            <div className="new-recipe-modal-actions">
              <button
                type="button"
                className="new-recipe-modal-option"
                onClick={handleImportFromUrl}
              >
                Import from URL
              </button>
              <button
                type="button"
                className="new-recipe-modal-option"
                onClick={handleDoItMyself}
              >
                Do it myself
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleImportSubmit}>
            <h2 id="new-recipe-modal-title" className="new-recipe-modal-title">
              Import from URL
            </h2>
            <p className="new-recipe-modal-subtitle">
              Paste a recipe blog URL and we&apos;ll fill in the details.
            </p>
            <div className="new-recipe-modal-url-row">
              <input
                type="url"
                className="form-input"
                placeholder="https://..."
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                disabled={importing}
                autoFocus
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={importing || !importUrl.trim()}
              >
                {importing ? "Importing..." : "Import"}
              </button>
            </div>
            {importing && (
              <div className="new-recipe-modal-hearts" aria-hidden>
                <span className="heart">&hearts;</span>
                <span className="heart">&hearts;</span>
                <span className="heart">&hearts;</span>
              </div>
            )}
            {importError && (
              <p className="form-error" role="alert">
                {importError}
              </p>
            )}
            <button
              type="button"
              className="new-recipe-modal-back"
              onClick={handleBack}
              disabled={importing}
            >
              &larr; Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

