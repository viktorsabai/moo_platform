# Moo Platform: local Docker runbook

This setup runs the current repository checkout independently from Vercel. It uses one Next.js container and a local PostgreSQL container. It is intended for staging smoke tests and does not touch the production database unless the operator explicitly places production credentials in `.env.local`.

## 1. Prepare the checkout

```bash
git clone https://github.com/viktorsabai/moo_platform.git
cd moo_platform
git checkout test
cp .env.local.example .env.local
```

Fill `.env.local` with a **test Telegram bot token**, `NEXTAUTH_SECRET`, and any optional test payment values. The real `.env.local` is ignored by git.

## 2. Start on the computer

```bash
docker compose -f docker-compose.local.yml up --build
```

Open `http://localhost:3000`. PostgreSQL is exposed on host port `5433`; the app connects to the database service internally through `DATABASE_URL`.

To stop the app without deleting the local database:

```bash
docker compose -f docker-compose.local.yml down
```

To reset the local database completely:

```bash
docker compose -f docker-compose.local.yml down -v
```

## 3. Open from a phone on the same Wi-Fi

Find the computer's LAN address, for example with `ipconfig getifaddr en0` on macOS or `ip addr` on Linux. Set `NEXTAUTH_URL` and `APP_URL` in `.env.local` to `http://<LAN_IP>:3000`, then rebuild:

```bash
docker compose -f docker-compose.local.yml up --build
```

Open `http://<LAN_IP>:3000` on the phone. The computer firewall must allow TCP port 3000.

A Telegram Mini App normally requires HTTPS and Telegram `initData`. A plain LAN URL is suitable for visual/UI testing, but Telegram login and some secure browser behavior may not work there.

## 4. Use a temporary HTTPS tunnel

For a phone/Telegram WebView smoke test, expose port 3000 through a temporary HTTPS tunnel. For example, with Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

Set the resulting hostname in `.env.local`:

```env
CF_TUNNEL_HOST=<hostname>.trycloudflare.com
NEXTAUTH_URL=https://<hostname>.trycloudflare.com
APP_URL=https://<hostname>.trycloudflare.com
```

Then restart the stack. If Telegram bot configuration requires a Web App URL, point the **test bot only** to the tunnel URL. Do not replace the production bot URL.

## 5. Useful checks

```bash
# Container status
docker compose -f docker-compose.local.yml ps

# App logs
docker compose -f docker-compose.local.yml logs -f app

# Database logs
docker compose -f docker-compose.local.yml logs -f db

# Check local HTTP response
curl -I http://localhost:3000
```

The local deployment is ready when the app container is healthy enough to serve `/`, the Prisma migration command completes, and the browser can load the app. Use test credentials and test payment configuration only.
