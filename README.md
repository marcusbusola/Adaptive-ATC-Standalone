# ATC Adaptive Alert Research System

A comprehensive research platform for evaluating adaptive alert systems in Air Traffic Control (ATC) environments. This system compares three alert design approaches across multiple ATC scenario complexities to optimize controller performance and reduce alert fatigue.

## Project Overview

### Research Objectives

This system investigates how different alert presentation strategies affect ATC controller performance under varying workload conditions. The goal is to identify optimal alerting strategies that:

- Minimize alert fatigue and interruption
- Maintain safety-critical awareness
- Adapt to controller workload and context
- Improve overall operational efficiency

### Alert Conditions (Independent Variable)

The system tests three distinct alert designs:

#### Condition 1: Traditional Modal Alerts
- **Description**: Standard pop-up modal dialogs that interrupt workflow
- **Characteristics**:
  - Always displayed prominently in center of screen
  - Requires explicit acknowledgment to dismiss
  - Consistent presentation regardless of context
  - Baseline condition for comparison

#### Condition 2: Rule-Based Adaptive Alerts
- **Description**: Alerts that adapt based on predefined heuristic rules
- **Adaptation Logic**:
  - Traffic density (aircraft count in sector)
  - Alert priority level (critical, warning, informational)
  - Time since last alert
  - Controller interaction patterns
- **Behavior**:
  - High priority + high traffic = modal alert
  - Low priority + low traffic = peripheral notification
  - Medium conditions = semi-intrusive banner

#### Condition 3: ML-Based Adaptive Alerts
- **Description**: Machine learning model that learns optimal alert presentation
- **Model Features**:
  - Real-time workload estimation
  - Historical performance patterns
  - Controller behavioral signatures
  - Scenario complexity metrics
  - Alert acknowledgment timing
- **Behavior**:
  - Continuously learns from controller interactions
  - Personalizes alert presentation per controller
  - Predicts optimal interruption moments

### ATC Scenarios (Workload Conditions)

Four scenarios representing different complexity and traffic density combinations:

#### L1: Low Complexity, Low Traffic
- **Aircraft Count**: 3-5 aircraft
- **Conflict Probability**: Low (5-10%)
- **Weather**: Clear conditions
- **Special Procedures**: None
- **Alert Frequency**: 2-3 per 10 minutes

#### L2: Low Complexity, High Traffic
- **Aircraft Count**: 12-15 aircraft
- **Conflict Probability**: Medium (15-20%)
- **Weather**: Clear conditions
- **Special Procedures**: Standard arrivals/departures
- **Alert Frequency**: 6-8 per 10 minutes

#### H4: High Complexity, Low Traffic
- **Aircraft Count**: 4-6 aircraft
- **Conflict Probability**: Medium (20-25%)
- **Weather**: Adverse (storms, wind shear)
- **Special Procedures**: Emergency handling, diversions
- **Alert Frequency**: 5-7 per 10 minutes

#### H5: High Complexity, High Traffic
- **Aircraft Count**: 15-20 aircraft
- **Conflict Probability**: High (25-30%)
- **Weather**: Adverse conditions
- **Special Procedures**: Multiple simultaneous emergencies
- **Alert Frequency**: 10-12 per 10 minutes

## System Architecture

```
atc-adaptive-alerts/
│
├── frontend/                 # React-based user interface
│   ├── public/              # Static assets and HTML
│   └── src/
│       ├── components/      # React components
│       │   ├── alerts/      # Alert UI components (Modal, Adaptive, etc.)
│       │   ├── scenarios/   # Scenario visualization components
│       │   └── dashboard/   # Performance dashboard components
│       ├── scenarios/       # Scenario configurations and data
│       ├── services/        # API clients and business logic
│       │   ├── api.js       # Backend API communication
│       │   ├── tracking.js  # Behavioral data collection
│       │   └── analytics.js # Performance calculations
│       └── styles/          # CSS and styling
│
├── backend/                 # Python FastAPI server
│   ├── api/                 # REST API endpoints
│   │   ├── main.py          # FastAPI application entry
│   │   ├── routes/          # API route handlers
│   │   └── models/          # Pydantic data models
│   ├── scenarios/           # Scenario logic controllers
│   │   ├── generator.py     # Scenario event generation
│   │   ├── L1.py            # Low complexity, low traffic
│   │   ├── L2.py            # Low complexity, high traffic
│   │   ├── H4.py            # High complexity, low traffic
│   │   └── H5.py            # High complexity, high traffic
│   ├── ml_models/           # Machine learning components
│   │   ├── trainer.py       # Model training pipeline
│   │   ├── predictor.py     # Real-time prediction service
│   │   ├── features.py      # Feature extraction
│   │   └── saved_models/    # Serialized trained models
│   └── data/                # Data storage
│       ├── sessions/        # Session recordings
│       ├── behavioral/      # Behavioral metrics
│       ├── logs/            # System logs
│       └── exports/         # Research data exports
│
├── .env.example             # Environment configuration template
├── package.json             # Frontend dependencies
├── requirements.txt         # Backend dependencies
└── README.md                # This file
```

## Getting Started

### Prerequisites

- **Node.js**: v18.x or higher
- **Python**: 3.10 or higher
- **npm** or **yarn**: Latest version
- **pip**: Latest version
- **Git**: For version control

### Installation

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd atc-adaptive-alerts
```

#### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env  # or your preferred editor
```

#### 3. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Initialize database
python -m api.main --init-db

# Run backend server
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at: `http://localhost:8000`
API documentation: `http://localhost:8000/docs`

#### 4. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

Frontend will be available at: `http://localhost:3000`

## Usage

### Running Experiments

1. **Start Both Servers**
   - Backend: `uvicorn api.main:app --reload` (from backend/)
   - Frontend: `npm start` (from frontend/)

2. **Access Research Interface**
   - Navigate to `http://localhost:3000`
   - Enter participant ID
   - System will assign condition (or use manual override)

3. **Execute Scenarios**
   - Scenarios presented in randomized or sequential order
   - Each scenario runs for configured duration (default: 10 minutes)
   - System automatically logs all interactions

4. **Data Collection**
   - Behavioral metrics tracked in real-time
   - Session data saved automatically
   - Export available through admin dashboard

### Measured Metrics

#### Performance Metrics
- **Response Time**: Time from alert display to acknowledgment
- **Accuracy**: Correct vs incorrect alert responses
- **Missed Alerts**: Alerts not acknowledged within timeout
- **Task Completion**: Scenario objectives achieved
- **Conflict Resolution**: Time to resolve traffic conflicts

#### Workload Metrics
- **NASA-TLX**: Subjective workload assessment
- **Interaction Frequency**: Mouse/keyboard activity rate
- **Dwell Time**: Time spent on different interface areas
- **Alert Interruption Cost**: Performance degradation after alerts

#### Alert-Specific Metrics
- **Alert Fatigue Score**: Declining response quality over time
- **False Positive Rate**: Unnecessary alert presentations
- **Appropriate Adaptation**: ML model decision quality (Condition 3)

## Development

### Adding New Scenarios

1. Create scenario configuration in `backend/scenarios/`
2. Define aircraft patterns, conflict situations, and alert triggers
3. Register scenario in scenario manager
4. Add corresponding frontend visualization

### Modifying Alert Conditions

1. **Traditional Modal**: Edit `frontend/src/components/alerts/ModalAlert.jsx`
2. **Rule-Based**: Modify rules in `backend/api/routes/adaptive.py`
3. **ML-Based**: Adjust model in `backend/ml_models/trainer.py`

### Training ML Models

```bash
cd backend
python -m ml_models.trainer --scenario all --epochs 100
```

Models saved to `backend/ml_models/saved_models/`

## Testing

### Backend Tests

```bash
cd backend
pytest tests/ -v --cov=api --cov=ml_models
```

### Frontend Tests

```bash
cd frontend
npm test
```

## Data Export

Collected data can be exported for analysis:

```bash
# Export all session data
curl http://localhost:8000/api/export/sessions

# Export specific participant
curl http://localhost:8000/api/export/sessions?participant_id=PART001

# Export aggregated metrics
curl http://localhost:8000/api/export/metrics
```

Data formats: JSON, CSV, or Excel

## Research Protocol

### Participant Flow

1. **Consent & Briefing**: Participants review study information
2. **Training**: 5-minute practice session with assigned condition
3. **Baseline**: L1 scenario to establish baseline performance
4. **Main Scenarios**: L2, H4, H5 in randomized order
5. **Questionnaire**: NASA-TLX and qualitative feedback
6. **Debrief**: Explanation of research goals

### Condition Assignment

- **Between-subjects**: Each participant experiences one condition
- **Randomization**: Automatic assignment to balance groups
- **Counterbalancing**: Scenario order randomized

## Configuration

Key configuration options in `.env`:

- `DEFAULT_ALERT_CONDITION`: Set default condition (1, 2, or 3)
- `AVAILABLE_SCENARIOS`: Enable/disable specific scenarios
- `ENABLE_BEHAVIORAL_TRACKING`: Toggle detailed logging
- `ML_TRAINING_ENABLED`: Allow real-time model updates
- `RANDOMIZE_CONDITIONS`: Auto-assign conditions

## Troubleshooting

### Common Issues

**Backend won't start**
- Check Python version: `python --version`
- Verify dependencies: `pip list`
- Check port availability: `lsof -i :8000`

**Frontend build errors**
- Clear cache: `npm cache clean --force`
- Delete node_modules: `rm -rf node_modules && npm install`
- Check Node version: `node --version`

**ML model errors**
- Ensure TensorFlow installed: `pip show tensorflow`
- Check model files exist: `ls backend/ml_models/saved_models/`
- Review training logs: `cat backend/data/logs/training.log`

**Database issues**
- Reset database: `rm backend/data/atc_research.db`
- Reinitialize: `python -m api.main --init-db`

## Contributing

Research contributions welcome:

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-scenario`
3. Commit changes: `git commit -am 'Add new scenario'`
4. Push to branch: `git push origin feature/new-scenario`
5. Submit pull request

## License

MIT License - see LICENSE file for details

## Citation

If you use this system in your research, please cite:

```
[Your Research Paper Citation]
ATC Adaptive Alert Research System
[Year]
```

## Contact

For questions or collaboration:
- Research Team: [contact email]
- Project Repository: [repository URL]
- Documentation: [docs URL]

## Acknowledgments

- Air Traffic Control Subject Matter Experts
- Human Factors Research Community
- Open Source Contributors

---

**Version**: 1.0.0
**Last Updated**: 2025-11-19
**Status**: Active Development
