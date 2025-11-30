#!/usr/bin/env bash
# Build script for Render deployment
# This script builds both frontend and backend, and initializes the database

set -e  # Exit on error

echo "=========================================="
echo "ATC Adaptive Alert Research System - Build"
echo "=========================================="

# ===== Backend Setup =====
echo ""
echo "📦 Installing Python dependencies..."
cd backend
pip install --upgrade pip
pip install -r requirements.txt

# ===== Frontend Build =====
echo ""
echo "📦 Installing Node.js dependencies and building frontend..."
cd ../frontend
npm ci --legacy-peer-deps
npm run build

echo ""
echo "✅ Frontend build complete. Static files in frontend/build/"

# ===== Database Initialization =====
echo ""
echo "🗄️ Initializing database..."
cd ../backend

# Run database setup (creates tables if they don't exist)
python -c "
import asyncio
import sys
sys.path.insert(0, '.')
from data.setup_database import DatabaseSetup

async def init_db():
    setup = DatabaseSetup()
    try:
        # Try to verify first - if tables exist, skip creation
        if await setup.verify_database():
            print('✓ Database already initialized')
            return
    except:
        pass

    # Create database schema
    await setup.create_database(force=False)
    print('✓ Database initialized successfully')

asyncio.run(init_db())
"

# ===== ML Model Setup (Optional) =====
echo ""
echo "🤖 Checking ML model..."
mkdir -p ml_models/trained_models
if [ ! -f "ml_models/trained_models/complacency_detector.pkl" ]; then
    echo "Training default ML model..."
    python -c "
import sys
sys.path.insert(0, '.')
try:
    from ml_models.train_complacency_model import main
    main()
    print('✓ ML model trained successfully')
except Exception as e:
    print(f'⚠️ ML model training skipped: {e}')
    print('  (ML features will use fallback heuristics)')
" || echo "⚠️ ML model training failed, continuing..."
else
    echo "✓ ML model already exists"
fi

cd ..

echo ""
echo "=========================================="
echo "✅ Build complete!"
echo "=========================================="
