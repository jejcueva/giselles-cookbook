This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Recipe import from URLs (optional)

Some sites (e.g. Simply Recipes) block automated requests. To bypass that:

1. Create a `.env.local` file **in the same folder as `package.json`** (the folder where you run `npm run dev`).
2. Add your [ScraperAPI](https://www.scraperapi.com/) key:

```bash
SCRAPER_API_KEY=your_api_key_here
```

3. Restart the dev server.

Free tier: 5,000 requests/month. If you still see "This site blocks import", the app isn’t seeing your key—check that `.env.local` is next to `package.json` and you restarted the server. You can confirm the proxy is used by checking the response header `X-ScraperAPI-Used: true` in the Network tab when an import succeeds.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## CI/CD and Vercel Deployment

This repo includes:

- `CI` workflow: runs `npm ci`, `npm run lint`, and `npm run build` on PRs and pushes to `main`.
- `Vercel Deploy` workflow:
  - Preview deployments on pull requests.
  - Production deployments on pushes to `main`.

### One-time setup

1. Import this repository into Vercel and create the project.
2. In Vercel, generate a personal token.
3. In GitHub, add repository secrets:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`

You can find `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` by running `vercel link` locally and checking the generated `.vercel/project.json`, or from Vercel project settings.
