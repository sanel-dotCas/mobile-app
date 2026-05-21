# Mobile App Local Setup

This repository is a pnpm workspace with an Expo React Native mobile app and an Express API server.

## Requirements

- Node.js 24
- pnpm 11
- PostgreSQL 16
- Expo Go for physical Android/iPhone testing
- Xcode with an iOS Simulator runtime for simulator testing

## First-Time Mac Setup

Install and start PostgreSQL:

```bash
brew install postgresql@16
brew services start postgresql@16
createdb igmma_dms
```

Install dependencies:

```bash
cd /Users/admin/Documents/mobile-app
pnpm install --no-frozen-lockfile
```

Apply the database schema:

```bash
DATABASE_URL=postgresql://admin@localhost:5432/igmma_dms \
pnpm --filter @workspace/db run push
```

## Run The API

Open a terminal and run:

```bash
cd /Users/admin/Documents/mobile-app

DATABASE_URL=postgresql://admin@localhost:5432/igmma_dms \
PORT=8080 \
pnpm --filter @workspace/api-server run start
```

Check that the API is running:

```bash
curl http://localhost:8080/api/healthz
```

Expected response:

```json
{"status":"ok"}
```

## Run On iOS Simulator

Install an iOS simulator runtime in Xcode first:

1. Open Xcode.
2. Open Settings.
3. Go to Platforms.
4. Download an iOS Simulator runtime.

Then start the mobile app:

```bash
cd /Users/admin/Documents/mobile-app

EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8080 \
pnpm --filter @workspace/mobile exec expo start --ios --port 8082 --clear
```

## Run On Physical Android Or iPhone

Find the Mac's Wi-Fi IP address:

```bash
ipconfig getifaddr en0
```

Start Expo with that IP address. Example:

```bash
cd /Users/admin/Documents/mobile-app

EXPO_PUBLIC_API_BASE_URL=http://192.168.1.103:8080 \
pnpm --filter @workspace/mobile exec expo start --host lan --port 8081 --clear
```

Install Expo Go on the phone, then scan the QR code from the Expo terminal.

If Expo Go does not show the local development server, open the URL manually:

```text
exp://192.168.1.103:8081
```

For iPhone, both the Mac and iPhone must be on the same Wi-Fi. If connection fails, check iPhone Settings > Privacy & Security > Local Network and allow Expo Go.

## Notes From Local Migration

- Replit configured the workspace to exclude non-Linux native packages. For local macOS development, the macOS native packages for esbuild, lightningcss, Tailwind oxide, Rollup, and Expo ngrok must not be excluded.
- `EXPO_PUBLIC_API_BASE_URL` is used so the Expo app can call the local API. Physical devices must use the Mac's LAN IP, while iOS Simulator can use `127.0.0.1`.
- `.pnpm-store` is ignored because pnpm may create it locally during installation.
- Expo Go can run the app for development, but push notification behavior is limited in Expo Go. A development build is needed for full push notification testing.
