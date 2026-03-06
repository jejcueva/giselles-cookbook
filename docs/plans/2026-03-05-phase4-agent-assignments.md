# Phase 4 Agent Assignments (Worktrees)

> Maps which agent worktree in `.claude/worktrees` was working on which Phase 4 feature (from `2026-03-05-phase4-implementation-plan.md` and `2026-03-05-phase4-worker-plan.md`), and what remains to finish.

---

## Summary: Worker → Agent worktree

| Worker | Feature | Agent worktree | Status |
|--------|---------|----------------|--------|
| **A** | Holiday Themes + Custom Colors | `agent-abfe5fa9` | ✅ Complete |
| **B** | AI Assistant | `agent-aab76cd8` | ✅ Complete |
| **C** | Recipe Import | `agent-aaf1ac10` | ✅ Complete |
| **D** | Recipe Sharing | `agent-a0143ed4` | ⚠️ D1 done; D2 pending |

---

## Worker A: Holiday Themes + Custom Colors  
**Assign: `.claude/worktrees/agent-abfe5fa9`**

- **Done:**  
  - `src/lib/themes.ts`  
  - `src/components/theme-provider.tsx`  
  - `src/app/layout.tsx` (ThemeProvider wrap)  
  - `src/app/settings/page.tsx` (theme picker + custom colors)  
  - `src/app/globals.css` (Theme decorations + Settings page sections)
- **Remaining:** None. Use this worktree as the source for Theme + Settings when merging Phase 4.

---

## Worker B: AI Assistant  
**Assign: `.claude/worktrees/agent-aab76cd8`**

- **Done:**  
  - `src/app/api/chat/route.ts`  
  - `src/app/ai-assistant/page.tsx`  
  - `src/app/globals.css` (AI Chat section)
- **Remaining:** None. Use this worktree for Chat API + AI Assistant UI.

---

## Worker C: Recipe Import  
**Assign: `.claude/worktrees/agent-aaf1ac10`**

- **Done:**  
  - `src/app/api/parse-recipe/route.ts`  
  - `src/app/api/import-recipe/route.ts`  
  - `src/components/import-modal.tsx`  
  - `src/components/app-shell.tsx` (Import button + `ImportModal`)  
  - `src/app/globals.css` (Modal section)
- **Remaining:**  
  - Ensure `/recipes/new` (in the worktree you merge into) reads `sessionStorage.getItem("import-recipe")` when `?import=true` and pre-fills the form. If that lives in `phase3-recipe-crud`, merge C into a branch that already has the Phase 3 recipe form.

---

## Worker D: Recipe Sharing  
**Assign: `.claude/worktrees/agent-a0143ed4`**

- **Done:**  
  - `src/app/share/[id]/page.tsx` (public share page)  
  - `src/app/globals.css` (Share page section)
- **Remaining (Task D2):**  
  - **Add Share button to recipe detail.**  
  - In `src/app/recipes/[id]/page.tsx`, in the actions block (with Edit / Delete), add a Share button that copies `${window.location.origin}/share/${recipe.id}` to the clipboard and shows a short “Copied!” confirmation (see implementation plan Task 10).

---

## Cross-worktree notes

1. **`globals.css`**  
   Each worktree appended its own labeled block. When merging into one branch, concatenate those blocks (Theme decorations, Settings page, AI Chat, Modal, Share page) and resolve any duplicate base styles only if needed.

2. **`layout.tsx`**  
   Only Worker A (agent-abfe5fa9) wraps with `ThemeProvider`; use that version when merging.

3. **`app-shell.tsx`**  
   Only Worker C (agent-aaf1ac10) adds the Import button and `ImportModal`; use that version when merging.

4. **Phase 3 dependency**  
   Recipe Import (C) and Share button (D) assume a Phase 3 recipe detail and new-recipe form exist (e.g. in `phase3-recipe-crud`). Merge order: Phase 3 base → then A, B, C, D (or merge C/D into the same branch that has Phase 3).

---

## Post-merge (from worker plan)

1. Run `npm run build` and fix any type/lint errors.  
2. Manually test: themes, AI assistant, import (URL + paste), share page and Share button.  
3. Commit fixes as `phase 4 build fixes`, then push.
