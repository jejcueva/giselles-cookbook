"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ImportModalProps = {
  onClose: () => void;
};

export function ImportModal({ onClose }: ImportModalProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleImportUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/import-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      if (data.type === "paste_fallback") {
        setShowPaste(true);
        return;
      }

      if (data.type === "recipe") {
        sessionStorage.setItem("import-recipe", JSON.stringify(data.recipe));
        router.push("/recipes/new?import=true");
        onClose();
        return;
      }

      if (data.type === "text") {
        await parseWithAI(data.text);
      }
    } catch {
      setError("Something went wrong. Try again!");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pasteText.trim() || loading) return;
    setLoading(true);
    setError("");
    await parseWithAI(pasteText.trim());
    setLoading(false);
  }

  async function parseWithAI(text: string) {
    try {
      const res = await fetch("/api/parse-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      sessionStorage.setItem("import-recipe", JSON.stringify(data.recipe));
      router.push("/recipes/new?import=true");
      onClose();
    } catch {
      setError("AI parsing failed. Try pasting the recipe manually!");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Import Recipe</h2>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleImportUrl}>
          <label className="form-label">
            Paste a URL (Instagram post or recipe blog)
            <input
              type="url"
              className="form-input"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={loading || !url.trim()} style={{ marginTop: "0.75rem", width: "100%" }}>
            {loading ? "Importing..." : "Import"}
          </button>
        </form>

        {showPaste && (
          <form onSubmit={handlePasteSubmit} style={{ marginTop: "1rem" }}>
            <p className="settings-description">
              We couldn&apos;t grab that automatically. Paste the recipe caption here:
            </p>
            <textarea
              className="form-textarea"
              rows={6}
              placeholder="Paste the recipe text here..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              style={{ width: "100%" }}
            />
            <button type="submit" className="btn-primary" disabled={loading || !pasteText.trim()} style={{ marginTop: "0.5rem", width: "100%" }}>
              {loading ? "Parsing..." : "Parse with AI"}
            </button>
          </form>
        )}

        {error && <p className="import-error">{error}</p>}
      </div>
    </div>
  );
}
