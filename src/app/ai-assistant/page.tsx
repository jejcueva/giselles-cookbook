"use client";

import { useViewer } from "@/components/viewer-provider";

import { AppShell } from "@/components/app-shell";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type RecipeData = {
  title: string;
  ingredients: { name: string; amount: string; unit: string }[];
  instructions: string[];
  cookTime: number | null;
  prepTime: number | null;
  servings: number | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

const RECIPE_BLOCK_REGEX = /:::recipe\s*([\s\S]*?)\s*:::/;
const CHAT_STORAGE_KEY = "cute-cookbook-ai-chat";

function parseRecipeBlock(content: string): { text: string; recipe: RecipeData | null } {
  const match = content.match(RECIPE_BLOCK_REGEX);
  if (!match) return { text: content, recipe: null };

  const text = content.replace(RECIPE_BLOCK_REGEX, "").trim();
  try {
    const recipe = JSON.parse(match[1]) as RecipeData;
    if (recipe.title && Array.isArray(recipe.ingredients) && Array.isArray(recipe.instructions)) {
      return { text, recipe };
    }
  } catch {
    // malformed JSON — show message normally
  }
  return { text: content, recipe: null };
}

function ChatBubble({ msg }: { msg: Message }) {
  const { canWrite } = useViewer();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  if (msg.role === "user") {
    return <div className="chat-bubble chat-bubble-user">{msg.content}</div>;
  }

  const { text, recipe } = parseRecipeBlock(msg.content);

  async function handleSave() {
    if (!recipe || saveState === "saving" || saveState === "saved") return;
    setSaveState("saving");

    try {
      const { error } = await supabase.from("recipes").insert({
        title: recipe.title.trim(),
        ingredients: recipe.ingredients.filter((ing) => ing.name.trim()),
        instructions: recipe.instructions
          .filter((s) => s.trim())
          .map((stepText, i) => ({ step_number: i + 1, text: stepText })),
        cook_time: recipe.cookTime,
        prep_time: recipe.prepTime,
        servings: recipe.servings,
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: recipe.fat,
      });

      if (error) {
        setSaveState("error");
      } else {
        setSaveState("saved");
      }
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className="chat-bubble chat-bubble-assistant">
      {text}
      {recipe && canWrite ? (
        <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--color-border, #ebd8c8)" }}>
          <button
            className={saveState === "saved" ? "btn-secondary" : "btn-primary"}
            onClick={handleSave}
            disabled={saveState === "saving" || saveState === "saved"}
            style={{ fontSize: "0.85rem", padding: "0.4rem 1rem" }}
          >
            {saveState === "idle" && "Save to My Recipes"}
            {saveState === "saving" && "Saving..."}
            {saveState === "saved" && "Saved!"}
            {saveState === "error" && "Failed — Try Again"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { messages?: Message[] };
      if (Array.isArray(parsed.messages)) {
        setMessages(
          parsed.messages.filter(
            (m): m is Message =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string"
          )
        );
      }
    } catch {
      // ignore bad data
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ messages }));
    } catch {
      // ignore storage failures
    }
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function clearChat() {
    setMessages([]);
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated }),
      });
      const data = await res.json();
      setMessages([...updated, { role: "assistant", content: data.reply || data.error || "Something went wrong" }]);
    } catch {
      setMessages([...updated, { role: "assistant", content: "Couldn't reach the assistant. Try again!" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="chat-container">
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-empty">
              <p className="chat-empty-title">Hey Jizzy!</p>
              <p className="chat-empty-sub">Ask me anything about cooking, recipes, or meal ideas.</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <ChatBubble key={i} msg={msg} />
          ))}
          {loading && (
            <div className="chat-bubble chat-bubble-assistant chat-typing">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="chat-toolbar">
          <button
            type="button"
            className="btn-secondary chat-clear-button"
            onClick={clearChat}
            disabled={messages.length === 0}
          >
            Clear chat
          </button>
        </div>
        <form className="chat-input-bar" onSubmit={sendMessage}>
          <input
            type="text"
            className="chat-input"
            placeholder="Ask me anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn-primary chat-send" disabled={loading || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </AppShell>
  );
}
