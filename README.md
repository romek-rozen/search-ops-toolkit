# Search Ops Toolkit

Self-hosted tool for SEO/marketing agencies to fetch, store, and export Google Maps business data and reviews. Each user logs in with their own [DataForSEO](https://skq.pl/data4seo) API credentials.

## Features

- **Google Maps SERP search** — find businesses by keyword + location (live, standard, priority modes)
- **Reviews fetching** — fetch reviews by Google Maps URL with automatic CID extraction
- **Batch operations** — fetch reviews for multiple businesses at once
- **PostgreSQL caching** — all API data cached locally, no duplicate costs
- **Export** — CSV, Excel (.xlsx), webhook integration
- **Multi-user** — each user sees only their own data, admin sees everything
- **Sharing** — share search results and review tasks with other users
- **Cost tracking** — per-task API cost tracking and aggregation
- **Security** — encrypted session cookies (iron-session), CSP headers, zod input validation

## VPS Deployment

### Requirements

- Docker and Docker Compose
- A domain name (for SSL)
- [DataForSEO](https://skq.pl/data4seo) account

### Step by step

```bash
# 1. Clone the repository
git clone https://github.com/romek-rozen/search-ops-toolkit.git
cd search-ops-toolkit

# 2. Run setup (generates .env with secure passwords + starts containers)
chmod +x setup.sh
./setup.sh

# App is now running on http://localhost:3000
# Prisma migrations run automatically on container start
```

> **Manual setup:** If you prefer, copy `.env.example` to `.env`, fill in the values, and run `docker compose up -d --build`.

### Updating

```bash
git pull
docker-compose up -d --build
```

### Reverse proxy (Caddy — recommended)

Caddy handles SSL automatically via Let's Encrypt.

```
# /etc/caddy/Caddyfile
reviews.yourdomain.com {
    reverse_proxy localhost:3000
}
```

```bash
sudo systemctl reload caddy
```

### Reverse proxy (nginx + certbot)

```nginx
server {
    server_name reviews.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo certbot --nginx -d reviews.yourdomain.com
```

## Development

```bash
npm install
docker-compose up -d db          # PostgreSQL only
cp .env.example .env
# Edit .env — for local dev, DATABASE_URL should point to localhost:
#   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/search_ops?schema=public"
npx prisma migrate dev
npm run dev                       # http://localhost:3000
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_PASSWORD` | Production | Database password (used by docker-compose) |
| `SESSION_SECRET` | Yes | Secret for encrypting session cookies (min 32 chars) |
| `DATABASE_URL` | Dev only | PostgreSQL connection string (auto-set in docker-compose) |
| `ADMIN_EMAIL` | No | Admin user email — sees all users' data |
| `NEXT_PUBLIC_ADMIN_EMAIL` | No | Same as above, exposed to client |

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npx prisma migrate dev` | Run migrations (dev) |
| `npm run db:push` | Push schema without migration |
| `npm run db:studio` | Prisma Studio (DB GUI) |

## Tech Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4
- PostgreSQL 16 + Prisma ORM
- DataForSEO API
- iron-session (encrypted cookies)
- zod (validation)
- SheetJS (xlsx export)

## License

[MIT](LICENSE)
