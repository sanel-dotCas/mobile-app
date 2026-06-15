# AWS Setup - Mobile App Configuration

## ✅ Configuration Complete

Your mobile app is now configured to connect to your **AWS Staging API**.

### API Endpoints

**Staging (Current)**
- Base URL: `https://api.staging.igmma.net`
- Health check: `GET https://api.staging.igmma.net/api/healthz`
- Mobile session: `POST https://api.staging.igmma.net/api/yard/auth/mobile-session`

**Production (When Ready)**
- Base URL: `https://api.igmma.net`
- To switch: Update `app.json` → change `"apiBaseUrl"` to `https://api.igmma.net`

---

## 🚀 How to Run Your App

### Option 1: iOS Simulator (On Mac)
```bash
cd ~/Documents/mobile-app
EXPO_PUBLIC_API_BASE_URL=https://api.staging.igmma.net \
pnpm --filter @workspace/mobile exec expo start --ios
```

### Option 2: Physical Phone with Expo Go
1. Install **Expo Go** app on your phone (from App Store or Google Play)
2. Run:
```bash
cd ~/Documents/mobile-app
EXPO_PUBLIC_API_BASE_URL=https://api.staging.igmma.net \
pnpm --filter @workspace/mobile exec expo start --host lan
```
3. Scan the QR code with Expo Go

### Option 3: Web Browser
```bash
cd ~/Documents/mobile-app
EXPO_PUBLIC_API_BASE_URL=https://api.staging.igmma.net \
pnpm --filter @workspace/mobile exec expo start --web
```
Then open: `http://localhost:8081`

---

## 📱 Test Login Credentials

From your notes:
- **Technician**: MR+1234 / JW+1234
- **Supervisor**: SV+5678 / AD+0000
- **Estimator**: ET+1234 / ET+5678
- **Parts**: PT+1234 / PD+1234

---

## ✨ What's Ready

✅ App configured for AWS API  
✅ Removed Replit dependency  
✅ Using your staging environment  
✅ All endpoints (~75) connected  

Your app will now:
- Fetch vehicles from AWS
- Load inspections from AWS
- Submit job data to AWS
- Work with your database

---

## Troubleshooting

**App won't connect?**
- Check internet connection
- Verify API is running: `curl https://api.staging.igmma.net/api/healthz`
- Check phone/simulator time is correct

**Login fails?**
- Use exact credentials from above
- Make sure you're on staging API

**Need to switch to production?**
- Edit `app.json`
- Change `"apiBaseUrl": "https://api.igmma.net"`
- Restart app

---

## Next Steps

1. Download Expo Go app (if you haven't)
2. Run the app with your preferred method (iOS/Android/Web)
3. Login with test credentials
4. Start using! 🎉

Questions? Check the routes in your app or API docs.
