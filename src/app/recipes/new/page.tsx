"use client";

import { AppShell } from "@/components/app-shell";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Ingredient = { name: string; amount: string; unit: string };

export default function NewRecipePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [servings, setServings] = useState("");

  // Ingredients
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { name: "", amount: "", unit: "" },
  ]);

  function addIngredient() {
    setIngredients([...ingredients, { name: "", amount: "", unit: "" }]);
  }

  function removeIngredient(index: number) {
    setIngredients(ingredients.filter((_, i) => i !== index));
  }

  function updateIngredient(index: number, field: keyof Ingredient, value: string) {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  }

  // Instructions
  const [instructions, setInstructions] = useState<string[]>([""]);

  function addInstruction() {
    setInstructions([...instructions, ""]);
  }

  function removeInstruction(index: number) {
    setInstructions(instructions.filter((_, i) => i !== index));
  }

  function updateInstruction(index: number, value: string) {
    const updated = [...instructions];
    updated[index] = value;
    setInstructions(updated);
  }

  return (
    <AppShell>
      <div className="recipe-form-page">
        <h1 className="section-title">Add New Recipe</h1>

        <form className="recipe-form" onSubmit={(e) => e.preventDefault()}>
          <label className="form-label">
            Title *
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Recipe name"
              required
            />
          </label>

          <div className="form-row-3">
            <label className="form-label">
              Prep Time (min)
              <input
                type="number"
                className="form-input"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                min="0"
              />
            </label>
            <label className="form-label">
              Cook Time (min)
              <input
                type="number"
                className="form-input"
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value)}
                min="0"
              />
            </label>
            <label className="form-label">
              Servings
              <input
                type="number"
                className="form-input"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                min="1"
              />
            </label>
          </div>

          <fieldset className="form-fieldset">
            <legend className="form-legend">Ingredients</legend>
            {ingredients.map((ing, i) => (
              <div key={i} className="ingredient-row">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Amount"
                  value={ing.amount}
                  onChange={(e) => updateIngredient(i, "amount", e.target.value)}
                  style={{ flex: "0 0 80px" }}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Unit"
                  value={ing.unit}
                  onChange={(e) => updateIngredient(i, "unit", e.target.value)}
                  style={{ flex: "0 0 80px" }}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ingredient name"
                  value={ing.name}
                  onChange={(e) => updateIngredient(i, "name", e.target.value)}
                  style={{ flex: 1 }}
                />
                {ingredients.length > 1 && (
                  <button type="button" className="btn-icon-remove" onClick={() => removeIngredient(i)}>
                    ×
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn-add-row" onClick={addIngredient}>
              + Add Ingredient
            </button>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend className="form-legend">Instructions</legend>
            {instructions.map((step, i) => (
              <div key={i} className="instruction-row">
                <span className="step-number">{i + 1}.</span>
                <textarea
                  className="form-textarea"
                  placeholder={`Step ${i + 1}`}
                  value={step}
                  onChange={(e) => updateInstruction(i, e.target.value)}
                  rows={2}
                  style={{ flex: 1 }}
                />
                {instructions.length > 1 && (
                  <button type="button" className="btn-icon-remove" onClick={() => removeInstruction(i)}>
                    ×
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn-add-row" onClick={addInstruction}>
              + Add Step
            </button>
          </fieldset>

          <label className="form-label">
            Notes
            <textarea
              className="form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Personal tips, substitutions, memories..."
              rows={3}
            />
          </label>

          <label className="form-label">
            Source URL
            <input
              type="url"
              className="form-input"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
            />
          </label>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => router.back()}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled>
              Save Recipe
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
