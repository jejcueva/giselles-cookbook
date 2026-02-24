# 🧸 Jizzy's Cookbook — MVP & Release Plan

## Project Overview

**What:** A personalized, cottagecore-themed online cookbook built as a birthday gift for Giselle ("Jizzy"). A single-user app where she can collect, organize, and manage her favorite recipes.

**Vibe:** Cottagecore aesthetic with a pastel palette — soft pink, warm brown, sage green. Cute, cozy, and deeply personal.

**Tech Stack:**
- **Frontend:** Next.js + Tailwind CSS
- **Backend/DB:** Supabase (auth, database, storage)
- **Hosting:** Vercel
- **AI (stretch):** Claude or OpenAI API for recipe parsing

**Target Launch Date:** 🎂 March 17, 2025

---

## 🎨 Design Direction

### Color Palette
| Role | Color | Hex (suggested) |
|------|-------|-----------------|
| Primary | Soft Pink | `#F2B8C6` |
| Secondary | Warm Brown | `#A67B5B` |
| Accent | Sage Green | `#A8BFA0` |
| Background | Cream | `#FFF8F0` |
| Text | Dark Brown | `#4A3728` |
| Card BG | Soft White | `#FFFDFB` |

### Typography
- **Headings:** A handwritten or serif font (e.g., *Playfair Display*, *Cormorant Garamond*, or *Dancing Script* for accents)
- **Body:** A clean readable font (e.g., *Lato*, *Nunito*, or *DM Sans*)

### Visual Elements
- Soft rounded corners on cards and buttons
- Subtle floral or botanical illustrations as accents
- Warm, inviting icons (hand-drawn style if possible)
- Light textures (linen, paper) for backgrounds

---

## 🔐 Authentication: The Love Quiz

Instead of a traditional login, Giselle enters the app by answering personal questions only she would know. This replaces standard email/password auth.

### Quiz Questions (4–5 questions)
1. **"When's our anniversary?"** — Date picker or text input
2. **"Where did we first meet?"** — Multiple choice (with silly wrong answers)
3. **"What day did we meet?"** — Date picker or text input
4. **"When did we confess we liked each other?"** — Date picker or text input

### Quiz UX
- **Wrong answers:** Playful responses — not a hard lockout. Examples:
  - *"Hmm, are you sure you're Jizzy? 🤔 Try again!"*
  - *"That's not quite right, cutie. One more try!"*
  - After 3 wrong attempts on a question: show a hint
- **Correct answers:** Cute micro-animations (hearts, sparkles)
- **Session:** Once authenticated, store a session token in Supabase so she doesn't have to re-quiz every visit
- **No traditional signup/login** — this is a single-user app; the quiz IS the auth

---

## 🎂 First-Time Birthday Experience

On her very first successful login, she sees a special sequence (never shown again):

### Flow
1. **Scene 1 — Two Bears Hugging** 🧸🧸
   - Full-screen animated illustration of two bears hugging
   - Soft fade-in, gentle animation (CSS keyframes or Lottie)
   - Holds for ~3 seconds, then transitions

2. **Scene 2 — Happy Birthday Message** 🎉
   - Beautiful typographic "Happy Birthday, Jizzy!" with floating confetti/petals
   - Animated entrance (scale up, fade in)
   - Holds for ~3 seconds or until she clicks

3. **Scene 3 — Personal Love Letter** 💌
   - A styled letter/card from you to her
   - Handwritten-style font on a paper/envelope background
   - Scrollable if long
   - "Open Your Cookbook →" button at the bottom

### Technical Notes
- Track `has_seen_birthday` flag in Supabase user profile
- Set to `true` after she completes the sequence
- She should be able to revisit the letter later (maybe in a "💌 From [Your Name]" link in the sidebar or settings)

---

## 🏠 Homepage Dashboard

After login, Giselle lands on her personalized dashboard.

### Layout
```
┌─────────────────────────────────────────────┐
│  🧸 Jizzy's Cookbook            [+ New Recipe]│
├─────────────────────────────────────────────┤
│                                             │
│  Welcome back, Jizzy! 🌸                    │
│                                             │
│  ┌─── Recent Recipes ──────────────────┐    │
│  │ [Card] [Card] [Card] [Card]         │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─── Favorites ❤️ ────────────────────┐    │
│  │ [Card] [Card] [Card] [Card]         │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─── Categories ──────────────────────┐    │
│  │ 🍰 Desserts  🍝 Dinner  🥗 Quick   │    │
│  │ [+ New Category]                    │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

### Dashboard Features
- **Greeting:** Personalized welcome message ("Welcome back, Jizzy! 🌸")
- **Recent Recipes:** Last 4–6 recipes added (horizontal scroll or grid)
- **Favorites:** Recipes she's hearted
- **Categories:** Visual category cards, including default "Desserts" + any she creates
- **Quick Add Button:** Always accessible "+" button for new recipes
- **Search Bar:** Top-level search across all recipes

---

## 📖 Recipe Features

### Recipe Card (List/Grid View)
- Recipe photo (or cute placeholder illustration)
- Title
- Category tag(s)
- Favorite heart icon
- Cook time (optional)

### Full Recipe View
- **Hero photo** (uploaded by her)
- **Title**
- **Tags/Categories** (clickable)
- **Ingredients list** (with checkboxes for cooking mode)
- **Instructions** (numbered steps)
- **Personal notes** section (her own tips, substitutions, memories)
- **Nutrition card** (calories, protein, carbs, fat — displayed as a clean visual card/badge)
- **Additional photos** (gallery)
- **Source link** (if saved from somewhere)
- **Favorite toggle**
- **Edit / Delete options**

### Add/Edit Recipe Form
- **Title** (required)
- **Photo upload** (drag & drop or click, stored in Supabase Storage)
- **Ingredients** (dynamic list — add/remove/reorder)
- **Instructions** (dynamic numbered steps — add/remove/reorder)
- **Notes** (free text)
- **Category** (select existing or create new)
- **Tags** (free-form tags)
- **Source URL** (optional — where she found it)
- **Cook time / Prep time** (optional)
- **Servings** (optional)
- **Nutrition / Macros** (optional — calories, protein, carbs, fat per serving)

### Categories & Tags
- **Default category:** "🍰 Desserts" (pre-created)
- She can create, rename, and delete categories
- Tags are free-form (e.g., "quick", "comfort food", "date night")
- Filter/browse by category or tag

### Search
- Search by recipe title, ingredients, tags, or notes
- Real-time filtering as she types

---

## 🤖 Recipe Import Features

### Recipe Blog URL Scraping (MVP)
- She pastes a URL from a recipe blog
- App scrapes structured recipe data (most recipe blogs use JSON-LD `schema.org/Recipe`)
- Auto-fills the recipe form with:
  - Title
  - Ingredients (with quantities)
  - Instructions (as steps)
  - Cook/prep time
  - Servings
  - Nutrition/macros (if available in schema)
  - Cover image
- She reviews, edits, and saves
- **Implementation:** Server-side API route in Next.js → fetch page HTML → parse JSON-LD → return structured data
- **Fallback:** If no JSON-LD found, show a message and let her fill in manually

### AI Caption Parsing (Stretch Goal / V2)
- She pastes text from an Instagram caption (or any source)
- AI (Claude API or OpenAI) parses it into structured recipe fields
- She reviews and edits before saving
- Lower priority than blog scraping since blog scraping is more reliable

---

## 📊 Supabase Schema (MVP)

### Tables

**profiles**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Links to auth or static |
| name | text | "Jizzy" |
| has_seen_birthday | boolean | Default false |
| created_at | timestamp | |

**recipes**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| title | text | Required |
| ingredients | jsonb | Array of {name, amount, unit} |
| instructions | jsonb | Array of {step_number, text} |
| notes | text | Nullable |
| source_url | text | Nullable |
| cook_time | integer | Minutes, nullable |
| prep_time | integer | Minutes, nullable |
| servings | integer | Nullable |
| calories | integer | Nullable, per serving |
| protein | decimal | Grams, nullable |
| carbs | decimal | Grams, nullable |
| fat | decimal | Grams, nullable |
| is_favorite | boolean | Default false |
| cover_image_url | text | Supabase storage URL |
| created_at | timestamp | |
| updated_at | timestamp | |

**categories**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| name | text | e.g., "Desserts" |
| emoji | text | e.g., "🍰" |
| created_at | timestamp | |

**recipe_categories** (junction table)
| Column | Type | Notes |
|--------|------|-------|
| recipe_id | uuid (FK) | |
| category_id | uuid (FK) | |

**recipe_tags**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| recipe_id | uuid (FK) | |
| tag | text | Free-form tag string |

**recipe_photos** (additional photos beyond cover)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| recipe_id | uuid (FK) | |
| image_url | text | Supabase storage URL |
| sort_order | integer | |

---

## 🗓️ Release Plan — Ship by March 17

### 🟢 Phase 1: Foundation (Feb 23 – Feb 28) — Week 1

**Goal:** Project setup, core layout, and quiz auth working.

- [ ] Initialize Next.js project with Tailwind CSS
- [ ] Set up Supabase project (database, storage, auth config)
- [x] Deploy to Vercel (CI/CD from GitHub)
- [ ] Implement color palette + typography (Tailwind config)
- [ ] Build app layout shell (sidebar/nav, main content area)
- [ ] Build quiz login page with all questions
- [ ] Implement playful wrong-answer responses + hints
- [ ] Session management (store quiz completion in cookie/Supabase)
- [ ] Create Supabase tables (profiles, recipes, categories, tags, photos)
- [ ] Seed default "Desserts" category

### 🟡 Phase 2: Birthday Experience + Dashboard (Mar 1 – Mar 5) — Week 2

**Goal:** First-time birthday flow complete, dashboard functional.

- [ ] Build birthday Scene 1: Two bears hugging (find/commission illustration, animate)
- [ ] Build birthday Scene 2: "Happy Birthday, Jizzy!" with confetti
- [ ] Build birthday Scene 3: Personal love letter page
- [ ] Wire up `has_seen_birthday` flag
- [ ] Add "revisit letter" link somewhere accessible
- [ ] Build homepage dashboard layout
- [ ] Recent recipes section (pulling from Supabase)
- [ ] Favorites section
- [ ] Category cards with navigation
- [ ] Search bar (UI + basic filtering)

### 🔵 Phase 3: Recipe CRUD + URL Import (Mar 6 – Mar 11) — Week 3

**Goal:** She can add, view, edit, and delete recipes — including importing from blog URLs. This is the core.

- [ ] Build "Add Recipe" form (all fields including macros: calories, protein, carbs, fat)
- [ ] Photo upload to Supabase Storage
- [ ] Dynamic ingredient list (add/remove/reorder)
- [ ] Dynamic instruction steps (add/remove/reorder)
- [ ] Nutrition/macros input section (clean card-style UI)
- [ ] Category selection + create new category inline
- [ ] Free-form tag input
- [ ] **Blog URL import:** API route to fetch + parse JSON-LD recipe data
- [ ] **Blog URL import:** "Import from URL" field on add recipe form
- [ ] **Blog URL import:** Auto-fill form fields from parsed data, let her review/edit
- [ ] Build full recipe detail view page
- [ ] Nutrition card display (calories + macros)
- [ ] Ingredient checkboxes (cooking mode)
- [ ] Photo gallery
- [ ] Favorite toggle
- [ ] Build recipe edit functionality
- [ ] Build recipe delete (with confirmation)
- [ ] Recipe card grid/list view for browse pages
- [ ] Category browse pages
- [ ] Tag filtering

### 🟣 Phase 4: Polish & Launch (Mar 12 – Mar 16) — Week 4

**Goal:** Everything looks beautiful, feels smooth, and is ready to gift.

- [ ] Responsive design pass (desktop-impressive + mobile-functional — this is a portfolio piece AND a kitchen tool)
- [ ] Cottagecore visual polish (illustrations, textures, hover states, transitions)
- [ ] Loading states + empty states (cute illustrations for "no recipes yet")
- [ ] Micro-interactions (heart animation on favorite, subtle transitions)
- [ ] Error handling + form validation
- [ ] Test full flow end-to-end
- [ ] Write her love letter 💌
- [ ] Find/create the two bears hugging illustration
- [ ] Final QA on mobile + desktop
- [ ] Set up custom domain (optional — e.g., jizzyscookbook.com or similar)

### 🌟 Phase 5: Stretch Goals (Post-Launch / V2)

- [ ] AI recipe parsing from pasted text (Instagram captions, etc.)
- [ ] Meal planning / weekly menu
- [ ] Grocery list generator from selected recipes
- [ ] Auto-calculate macros from ingredients (nutrition API integration)
- [ ] Print-friendly recipe view
- [ ] Dark mode (cozy evening cooking vibes)
- [ ] Recipe sharing (if she ever wants to share individual recipes)
- [ ] Import from other recipe apps
- [ ] Cooking timers within recipe steps

---

## 🧸 Key Decisions & Notes

1. **No traditional auth** — The quiz IS the login. Keep it simple. One user, one session.
2. **Mobile-first** — She'll most likely use this in the kitchen on her phone. Prioritize mobile UX.
3. **Portfolio-ready desktop design** — This is also a resume/portfolio piece, so the desktop experience needs to look polished and professional. Design responsive-first: impressive on desktop, fully functional on mobile.
3. **Supabase Storage for images** — Simple, integrated, generous free tier.
4. **The birthday experience is a one-time gift moment** — Make it special. Don't rush it.
5. **Blog URL scraping in MVP** — Most recipe blogs use JSON-LD structured data, making this reliable and achievable. AI caption parsing can wait for V2.
6. **The love letter matters** — Take your time writing it. This is the emotional core of the gift.

---

*Built with love, for Jizzy 🧸🌸*
