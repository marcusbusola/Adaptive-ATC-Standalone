# ATC Adaptive Alert Research System - Frontend

React-based frontend for the ATC Adaptive Alert Research System.

## Prerequisites

**Node.js** is required to run this application.

### Install Node.js

If you don't have Node.js installed, download and install it from:
- **Official website**: https://nodejs.org/ (download LTS version)
- **Using Homebrew** (macOS): `brew install node`
- **Using nvm** (recommended):
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  nvm install --lts
  ```

Verify installation:
```bash
node --version  # Should show v18.x or higher
npm --version   # Should show v9.x or higher
```

## Quick Start

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Start development server:**
   ```bash
   npm start
   ```

3. **Open in browser:**
   - Application will open automatically at `http://localhost:3000`
   - If not, manually navigate to `http://localhost:3000`

## Available Scripts

- `npm start` - Start development server (port 3000)
- `npm build` - Build for production
- `npm test` - Run tests
- `npm run lint` - Run ESLint

## Environment Variables

Configure in `.env` file:

```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_ENV=development
```

## Project Structure

```
src/
├── components/          # React components
│   ├── ModalAlert.jsx         # Traditional modal alerts
│   ├── AdaptiveAlert.jsx      # Adaptive alerts
│   └── OpenScopeViewer.jsx    # OpenScope integration
├── scenarios/           # Scenario configurations
│   └── scenarioConfig.js      # L1, L2, H4, H5 definitions
├── services/            # Business logic
│   ├── api.js                 # Backend API client
│   ├── tracking.js            # Behavioral tracking
│   └── openscope-adapter.js   # OpenScope integration
└── styles/              # CSS styling
    ├── index.css
    ├── App.css
    ├── alerts.css
    └── openscope.css
```

## Connecting to Backend

Ensure the backend is running:

```bash
cd ../backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn api.main:app --reload
```

Backend will be available at `http://localhost:8000`

## Using OpenScope Integration

The system integrates with OpenScope ATC simulator:

```jsx
import OpenScopeViewer from './components/OpenScopeViewer';

<OpenScopeViewer
  airportCode="KSFO"
  scenario={scenarioConfig}
  onAircraftUpdate={handleUpdate}
  onConflict={handleConflict}
/>
```

See `OPENSCOPE_INTEGRATION.md` for detailed documentation.

## Troubleshooting

### Port 3000 already in use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm start
```

### Module not found errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Build errors

```bash
# Clear cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## Development

### Adding new components

```bash
# Create component file
touch src/components/MyComponent.jsx
```

### Adding new dependencies

```bash
npm install <package-name>
```

## Production Build

```bash
npm run build
```

Build files will be in `build/` directory.

## Support

See main `README.md` in project root for full documentation.
