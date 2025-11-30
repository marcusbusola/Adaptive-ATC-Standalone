# Deployment Guide - Render

This guide covers deploying the ATC Adaptive Alert Research System to Render.

## Quick Deploy (Blueprint)

1. **Fork/Push to GitHub**
   ```bash
   git add .
   git commit -m "Add Render deployment configuration"
   git push origin main
   ```

2. **Deploy on Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Render will detect `render.yaml` and create:
     - Web service: `atc-adaptive-alerts`
     - PostgreSQL database: `atc-research-db`

3. **Set Environment Variables** (in Render Dashboard)
   After deployment, set these in the web service's Environment tab:
   ```
   CORS_ORIGINS=https://your-app-name.onrender.com
   FRONTEND_URL=https://your-app-name.onrender.com
   BACKEND_URL=https://your-app-name.onrender.com
   ```

4. **Access Your App**
   - App URL: `https://your-app-name.onrender.com`
   - API Docs: `https://your-app-name.onrender.com/docs`
   - Health Check: `https://your-app-name.onrender.com/health`

## Manual Deploy (Without Blueprint)

### 1. Create PostgreSQL Database
- Render Dashboard → New → PostgreSQL
- Name: `atc-research-db`
- Plan: Starter (or higher)
- Copy the Internal Database URL

### 2. Create Web Service
- Render Dashboard → New → Web Service
- Connect GitHub repo
- Configure:
  ```
  Name: atc-adaptive-alerts
  Region: Oregon (or closest to users)
  Branch: main
  Runtime: Python 3
  Build Command: ./build.sh
  Start Command: cd backend && uvicorn api.server:app --host 0.0.0.0 --port $PORT
  ```

### 3. Environment Variables
Add these in the Environment tab:
```
DATABASE_URL=<paste Internal Database URL from step 1>
SECRET_KEY=<generate: openssl rand -hex 32>
RESEARCHER_TOKEN=<generate: openssl rand -hex 32>
CORS_ORIGINS=https://your-app-name.onrender.com
FRONTEND_URL=https://your-app-name.onrender.com
BACKEND_URL=https://your-app-name.onrender.com
ALLOW_UNPROTECTED_RESEARCHER=false
ML_TRAINING_ENABLED=false
ENABLE_BEHAVIORAL_TRACKING=true
```

## Post-Deployment

### Verify Deployment
```bash
# Health check
curl https://your-app-name.onrender.com/health

# Should return:
# {"status":"healthy","database":"connected","ml_models":"loaded",...}
```

### Access Researcher Panel
1. Go to `https://your-app-name.onrender.com/researcher`
2. Login with your `RESEARCHER_TOKEN`
3. Create session queues and manage participants

### View Logs
- Render Dashboard → Your Service → Logs

### Database Access
- Render Dashboard → Your Database → Connections
- Use external URL with psql or a GUI tool

## Updating the App

Push to your main branch - Render auto-deploys:
```bash
git push origin main
```

## Scaling

### Upgrade Plans
- **Web Service**: Starter → Standard for more RAM/CPU
- **Database**: Starter → Standard for more connections

### Multiple Workers (Standard+ plans)
Update start command:
```bash
cd backend && gunicorn api.server:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT
```

Add gunicorn to requirements.txt:
```
gunicorn==21.2.0
```

## Troubleshooting

### Build Fails
- Check Render logs for specific error
- Ensure Python 3.11 compatibility
- Verify all dependencies in requirements.txt

### Database Connection Errors
- Verify DATABASE_URL is set correctly
- Check database is running (Render Dashboard)
- Ensure using Internal URL (not External)

### CORS Errors
- Verify CORS_ORIGINS includes your frontend URL
- Include both http and https if needed

### WebSocket Issues
- Render supports WebSockets on Starter+ plans
- Ensure using `wss://` for production URLs

### ML Model Not Loading
- Check build logs for training errors
- ML will fallback to heuristics if training fails
- Model is retrained on each deploy

## Security Checklist

- [ ] `RESEARCHER_TOKEN` is set and secure
- [ ] `SECRET_KEY` is randomly generated
- [ ] `ALLOW_UNPROTECTED_RESEARCHER=false`
- [ ] Database uses Internal URL only
- [ ] HTTPS enforced (Render does this automatically)

## Cost Estimate (Render)

| Resource | Plan | Cost/Month |
|----------|------|------------|
| Web Service | Starter | $7 |
| PostgreSQL | Starter | $7 |
| **Total** | | **$14** |

Free tier available with limitations (services spin down after inactivity).
