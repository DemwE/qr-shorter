# QR Shorter

URL shortener + QR code generator with redirect/QR statistics and light/dark mode.

## Features

- Shorten long links into unique codes.
- Redirect by visiting `/{code}`.
- Generate QR code for each short URL (`/api/qr/{code}`).
- Track redirect counts and QR scan counts.
- Show stats in the UI and API (`/api/stats/{code}`).
- Light and dark mode toggle.

## Storage

- **Local development**: SQLite file (default: `data/qr-shorter.db`).
- **Vercel / persistent deployment**: Upstash Redis via env vars:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

If Redis variables are present, Redis is used automatically.  
If not, SQLite is used.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build and lint

```bash
npm run lint
npm run build
```
