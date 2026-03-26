# Deploy Student Housing API on Render

## 1) Push backend to GitHub
- Push `web code/backend` to a GitHub repository.

## 2) Create Render service
- On Render, create a **Web Service** from your backend repository.
- Runtime: **Node**
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/api/health`

## 3) Environment variables
Set the following variables in Render:
- `MONGODB_URI`
- `JWT_SECRET`
- `NODE_ENV=production`
- `CORS_ORIGIN` (comma-separated allowed web origins)
- `GMAIL_USER` (optional if email verification is used)
- `GMAIL_APP_PASSWORD` (optional if email verification is used)

## 4) Verify deployment
- Check health endpoint:
  - `https://<your-render-service>.onrender.com/api/health`
- Check properties endpoint:
  - `https://<your-render-service>.onrender.com/api/properties`

## 5) Android BASE_URL
Use this base URL in Android:
- `https://<your-render-service>.onrender.com/api/`
