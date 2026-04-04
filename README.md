# Giselle's Cookbook

A cozy, full-stack recipe management web app built as a personal project for my girlfriend. Features AI-powered recipe generation, URL scraping, dark mode, and interactive experiences.

**Live:** [cutecookbook.com](https://cutecookbook.com)

<!-- ![demo](demo.gif) -->

## Features

- **Recipe Management** - create, view, edit, and delete recipes with cover images, categories, and step-by-step instructions
- **AI Assistant** - chat-based recipe generation with streaming responses and structured recipe output
- **Recipe Import** - paste a URL from any recipe site and the app scrapes + parses it into a clean recipe card
- **Categories & Filters** - organize recipes by category with emoji labels and a mobile-friendly filter sheet
- **Favorites** - heart recipes to save them for quick access on the home dashboard
- **Dark Mode** - full theme support with system preference detection and manual toggle
- **Recipe Sharing** - shareable recipe links
- **Mobile-First UI** - responsive design with iOS safe-area handling, touch interactions, and bottom sheet navigation
- **Custom Animations** - SVG sunflower garden, confetti system, and interactive multi-scene experiences

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Backend | Next.js API Routes (serverless) |
| Database | Supabase (PostgreSQL + Row-Level Security) |
| Auth | Cookie-based sessions with rate limiting |
| Storage | Supabase Storage (recipe images) |
| AI | Streaming chat API with structured JSON extraction |
| Deployment | Vercel |

## Architecture

```
src/
  app/
    api/
      chat/           # ai assistant streaming endpoint
      scrape-recipe/  # url scraping
      parse-recipe/   # structured recipe extraction
      import-recipe/  # recipe import pipeline
      auth/           # authentication
    recipes/          # recipe pages (list, detail, create)
    ai-assistant/     # chat interface
    categories/       # category browsing
    favorites/        # saved recipes
    settings/         # user preferences
  components/         # shared ui (app shell, modals, theme provider)
  features/           # feature modules (recipe card, recipe logic)
  lib/                # utilities (auth, supabase client, image storage, themes)
supabase/
  migrations/         # database schema
```
