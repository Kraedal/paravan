# PARAVAN - Public Transport Van Monitoring and Analytics Platform

## Abstract

PARAVAN is a web-based van monitoring and descriptive analytics system designed for public transport cooperatives. The platform consolidates operational trip data into actionable views of route performance, vehicle utilization, and demand behavior to support evidence-based dispatch and planning decisions. By combining monitoring workflows with analytics-driven insights, PARA aims to improve transport efficiency, increase service reliability, and enhance passenger experience.

## Tech Stack

- SvelteKit + Svelte 5
- Drizzle ORM + PostgreSQL
- Better Auth
- Docker + Docker Compose
- Optional Groq API integration for AI-assisted suggestions

## Local Development

1. Install dependencies:

```sh
bun install
```

2. Create your environment file:

```sh
cp .env.example .env
```

3. Set required variables in `.env`:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL` (server-side auth URL, example: `http://localhost:3000`)
- `PUBLIC_BETTER_AUTH_URL` (client-side auth URL, example: `http://localhost:3000`)

Optional/recommended app URL:

- `ORIGIN` (example: `http://localhost:3000`)

Optional for AI-assisted dashboard suggestions:

- `GROQ_API_KEY`

4. Run the app:

```sh
bun run dev
```

## Run with Docker Compose

1. Ensure `.env` exists and contains at least:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`

2. Build and start:

```sh
docker compose up --build -d
```

3. Open:

- http://localhost:3000

4. Stop services:

```sh
docker compose down
```

## Build Docker Image Manually

Build locally:

```sh
docker build -t para:latest .
```

Run directly:

```sh
docker run --rm -p 3000:3000 \
	-e DATABASE_URL="postgres://user:password@host:5432/db" \
	-e BETTER_AUTH_SECRET="replace-me" \
	-e BETTER_AUTH_URL="http://localhost:3000" \
	-e ORIGIN="http://localhost:3000" \
	-e GROQ_API_KEY="optional" \
	para:latest
```

## Pulling from a Registry

If you publish the image (for example to GHCR), users can pull and run it directly:

```sh
docker pull ghcr.io/<org-or-user>/parafinal:latest
docker run --rm -p 3000:3000 \
	-e DATABASE_URL="postgres://user:password@host:5432/db" \
	-e BETTER_AUTH_SECRET="replace-me" \
	ghcr.io/<org-or-user>/parafinal:latest
```

Replace `<org-or-user>` with your registry namespace.

## Useful Scripts

- `bun run dev` - start local dev server
- `bun run build` - build production app
- `bun run preview` - preview production build
