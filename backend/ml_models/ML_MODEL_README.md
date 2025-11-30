# Complacency Detection ML Model

Machine Learning model for Condition 3 (ML-Based Adaptive Alerts) that predicts controller complacency and attention failures before they occur.

**Version:** 1.0.0
**Model Type:** RandomForest Classifier
**Purpose:** Predictive alert triggering based on behavioral patterns

---

## Overview

The complacency detector uses behavioral data (mouse movements, clicks, interactions) to predict when a controller is becoming complacent or losing situational awareness. This enables **predictive alerts** - alerting the controller *before* critical situations escalate.

### Key Capabilities

✅ **Real-time complacency detection** from behavioral patterns
✅ **Predictive alert recommendations** with confidence scores
✅ **Risk region identification** for highlighting neglected areas
✅ **Priority-based threshold adaptation** for different alert types
✅ **Feature importance analysis** for interpretability
✅ **Model persistence** for production deployment

---

## Quick Start

### 1. Train the Model

```bash
cd backend/ml_models
python train_complacency_model.py
```

This generates synthetic training data and trains the model. Output:
- `trained_models/complacency_detector.pkl` - Trained model
- `trained_models/training_data.csv` - Training dataset
- `trained_models/training_metadata.json` - Training metrics

### 2. Use the Model

```python
from complacency_detector import ComplacencyDetector

# Load trained model
detector = ComplacencyDetector('trained_models/complacency_detector.pkl')

# Predict from behavioral events
events = [
    {'timestamp': 1.0, 'event_type': 'mouse_move', 'data': {'x': 100, 'y': 200}},
    {'timestamp': 1.1, 'event_type': 'click', 'data': {'x': 150, 'y': 250}},
    # ... more events
]

result = detector.predict(events)

print(f"Complacency Score: {result['complacency_score']:.2f}")
print(f"Confidence: {result['confidence']:.2f}")

# Get human-readable message
message = detector.predict_with_message(events)
print(message)
# Output: "Controller shows 78% complacency signature (confidence: 85%)"

# Check if alert should be triggered
recommendation = detector.should_trigger_alert(events, alert_priority='medium')
if recommendation['trigger_alert']:
    print(f"ALERT: {recommendation['reasoning']}")
```

### 3. Run Examples

```bash
python example_usage.py
```

---

## Feature Extraction

The model extracts **10 behavioral features** from event streams:

### 1. **Mouse Velocity Variance**
- **What:** Variance in mouse movement speed
- **Indicator:** Low variance = repetitive/monotonous movement (complacency)
- **Calculation:** Variance of velocity between consecutive mouse positions

### 2. **Interaction Entropy**
- **What:** Diversity of interaction types
- **Indicator:** Low entropy = repetitive interactions (complacency)
- **Calculation:** Shannon entropy of event type distribution

### 3. **Peripheral Neglect Duration**
- **What:** Proportion of time spent in center vs periphery
- **Indicator:** High center focus = tunnel vision (complacency)
- **Calculation:** Time in center region / Total time

### 4. **Click Rate**
- **What:** Frequency of mouse clicks
- **Indicator:** Low rate = reduced engagement
- **Calculation:** Clicks per second

### 5. **Click Pattern Entropy**
- **What:** Diversity of click locations
- **Indicator:** Low entropy = repetitive clicking (complacency)
- **Calculation:** Shannon entropy of discretized click locations

### 6. **Dwell Time Variance**
- **What:** Variance in time spent hovering on targets
- **Indicator:** Low variance = monotonous scanning (complacency)
- **Calculation:** Variance of hover durations

### 7. **Command Sequence Entropy**
- **What:** Diversity of command sequences
- **Indicator:** Low entropy = repetitive commands (complacency)
- **Calculation:** Shannon entropy of command bigrams

### 8. **Hover Stability**
- **What:** Average duration of hover events
- **Indicator:** Long hovers = reduced scanning (complacency)
- **Calculation:** Mean hover duration

### 9. **Response Time Trend**
- **What:** Trend in response times over window
- **Indicator:** Increasing trend = slowing responses (complacency)
- **Calculation:** Linear regression slope of response times

### 10. **Activity Level**
- **What:** Overall event frequency
- **Indicator:** Low activity = reduced engagement
- **Calculation:** Events per second

---

## Model Architecture

### RandomForest Classifier

**Configuration:**
```python
RandomForestClassifier(
    n_estimators=100,      # 100 decision trees
    max_depth=10,          # Maximum tree depth
    min_samples_split=5,   # Minimum samples to split node
    min_samples_leaf=2,    # Minimum samples in leaf
    class_weight='balanced' # Handle class imbalance
)
```

**Input:** 10 behavioral features (standardized)
**Output:** Binary classification (0=normal, 1=complacent)
**Confidence:** Probability scores from ensemble voting

### Feature Scaling

StandardScaler normalization:
- Mean = 0
- Std = 1
- Fitted on training data
- Applied to prediction inputs

---

## Training

### Generate Training Data

```bash
# Default: 500 samples, 50/50 class balance
python train_complacency_model.py

# Custom configuration
python train_complacency_model.py --samples 1000 --balanced --seed 42

# Save to custom location
python train_complacency_model.py --output my_model.pkl
```

**Arguments:**
- `--samples N` - Number of training samples (default: 500)
- `--balanced` - Balance classes 50/50 (default: 70/30 normal/complacent)
- `--output PATH` - Output model path
- `--no-cv` - Skip cross-validation
- `--seed N` - Random seed for reproducibility

### Training Process

1. **Generate Synthetic Data**
   - Normal behavior: High variance, diverse interactions
   - Complacent behavior: Low variance, repetitive patterns

2. **Extract Features**
   - 10 features per sample
   - Feature extraction from event sequences

3. **Train/Validation Split**
   - 80% training, 20% validation
   - Stratified split to maintain class distribution

4. **Model Training**
   - Fit RandomForest on training data
   - Evaluate on validation set

5. **Cross-Validation**
   - 5-fold cross-validation
   - Report mean ± std accuracy

6. **Model Persistence**
   - Save model, scaler, feature names
   - Save metadata and metrics

### Expected Performance

With default settings (500 samples):
- **Accuracy:** ~85-95%
- **Precision:** ~80-90%
- **Recall:** ~80-90%
- **F1 Score:** ~80-90%
- **ROC AUC:** ~90-95%

---

## Prediction Interface

### Basic Prediction

```python
detector = ComplacencyDetector('trained_models/complacency_detector.pkl')

result = detector.predict(events)
# Returns:
# {
#     'complacent': bool,
#     'complacency_score': float (0-1),
#     'confidence': float (0-1),
#     'prediction_class': int (0 or 1),
#     'timestamp': str (ISO format)
# }
```

### Prediction with Features

```python
result = detector.predict(events, return_features=True)
# Additional field:
# 'features': {
#     'mouse_velocity_variance': float,
#     'interaction_entropy': float,
#     ...
# }
```

### Human-Readable Message

```python
message = detector.predict_with_message(events)
# Returns:
# "Controller shows 78% complacency signature (confidence: 85%)"
# or
# "Controller attention nominal (complacency: 23%, confidence: 82%)"
```

---

## Alert Recommendation Logic

### Decision Process

```python
recommendation = detector.should_trigger_alert(
    events,
    alert_priority='medium'
)
```

**Logic:**
1. Extract behavioral features
2. Predict complacency score (0-1)
3. Calculate prediction confidence
4. Compare against thresholds (adjusted by priority)
5. Identify risk regions from feature values
6. Generate reasoning from feature analysis

### Priority-Based Thresholds

| Priority | Complacency Threshold | Confidence Threshold |
|----------|----------------------|---------------------|
| Low      | 0.85                | 0.60                |
| Medium   | 0.75                | 0.60                |
| High     | 0.75                | 0.60                |
| Critical | 0.60                | 0.60                |

**Critical alerts** have lower thresholds - trigger even with moderate complacency.

### Recommendation Output

```python
{
    'trigger_alert': bool,
    'complacency_score': float,
    'confidence': float,
    'threshold_used': float,
    'risk_regions': [
        {
            'region': str,
            'severity': str,
            'reason': str,
            'metric': float
        }
    ],
    'reasoning': str,
    'timestamp': str
}
```

### Risk Region Identification

Identifies areas/aspects at risk:

**Peripheral Neglect** (neglect_duration > 0.8)
- Region: 'peripheral'
- Severity: 'high'
- Reason: "Tunnel vision detected - periphery neglected"

**Repetitive Patterns** (click_entropy < 1.0)
- Region: 'diverse_areas'
- Severity: 'medium'
- Reason: "Repetitive interaction pattern"

**Low Activity** (activity_level < 0.5)
- Region: 'overall'
- Severity: 'high'
- Reason: "Low overall activity level"

---

## Integration Examples

### With FastAPI Server

```python
from complacency_detector import ComplacencyDetector

# Initialize in server startup
detector = ComplacencyDetector('trained_models/complacency_detector.pkl')

@app.websocket("/ws/session/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    # Collect behavioral events
    behavioral_events = []

    # Periodically check complacency
    if len(behavioral_events) > 50:  # Every 50 events
        recommendation = detector.should_trigger_alert(
            behavioral_events,
            alert_priority='medium'
        )

        if recommendation['trigger_alert']:
            # Send predictive alert
            await websocket.send_json({
                'type': 'predictive_alert',
                'data': {
                    'message': 'Attention pattern suggests increased workload risk',
                    'complacency_score': recommendation['complacency_score'],
                    'risk_regions': recommendation['risk_regions']
                }
            })
```

### With Scenario Controller

```python
# In scenario event loop
def on_scenario_event(event):
    # Check complacency before critical events
    if event['type'] == 'emergency' and event['severity'] == 'critical':
        recommendation = detector.should_trigger_alert(
            recent_behavioral_events,
            alert_priority='critical'
        )

        if recommendation['trigger_alert']:
            # Present alert with ML-adapted style
            present_alert_with_ml_adaptation(
                event,
                complacency_score=recommendation['complacency_score'],
                risk_regions=recommendation['risk_regions']
            )
```

### Real-Time Monitoring

```python
import time

# Sliding window of events
event_window = []
window_duration = 30.0  # seconds

while scenario_running:
    # Collect events in window
    event_window = [e for e in all_events if e['timestamp'] > time.time() - window_duration]

    # Predict every 5 seconds
    if time.time() % 5 < 0.1:
        result = detector.predict(event_window)

        print(f"Complacency: {result['complacency_score']:.2f} "
              f"(Confidence: {result['confidence']:.2f})")

        # Dashboard update
        update_dashboard_complacency_meter(result['complacency_score'])
```

---

## Model Persistence

### Save Model

```python
detector.save_model('my_model.pkl')
```

Saves:
- Trained RandomForest model
- StandardScaler (fitted)
- Feature names (ordered)
- Training metadata
- Threshold values

### Load Model

```python
detector = ComplacencyDetector('my_model.pkl')

# Check model info
info = detector.get_model_info()
print(f"Trained: {info['metadata']['trained_at']}")
print(f"Accuracy: {info['metadata']['accuracy']:.4f}")
```

---

## Feature Importance

After training, inspect feature importance:

```python
detector.train(X, y)

# Feature importances are available in model
importances = detector.model.feature_importances_
feature_importance = list(zip(detector.feature_names, importances))
feature_importance.sort(key=lambda x: x[1], reverse=True)

for feature, importance in feature_importance:
    print(f"{feature:40} {importance:.4f}")
```

Typical importance ranking:
1. Peripheral neglect duration
2. Interaction entropy
3. Activity level
4. Mouse velocity variance
5. Click pattern entropy
6. ...

---

## Performance Tuning

### Adjust Thresholds

```python
detector = ComplacencyDetector('model.pkl')

# More sensitive (trigger more alerts)
detector.complacency_threshold = 0.65
detector.confidence_threshold = 0.50

# Less sensitive (trigger fewer alerts)
detector.complacency_threshold = 0.85
detector.confidence_threshold = 0.70
```

### Retrain with More Data

```bash
# More samples = better performance
python train_complacency_model.py --samples 2000
```

### Adjust Window Size

```python
from complacency_detector import BehavioralFeatureExtractor

# Shorter window = more responsive
extractor = BehavioralFeatureExtractor(window_size=15.0)

# Longer window = more stable
extractor = BehavioralFeatureExtractor(window_size=60.0)
```

---

## Validation

### Cross-Validation

Built into training:
```bash
python train_complacency_model.py  # Includes 5-fold CV
```

Metrics reported:
- CV Accuracy Mean
- CV Accuracy Std

### Manual Validation

```python
from sklearn.metrics import classification_report

# Generate test set
X_test, y_test = generator.generate_training_dataset(n_samples=100)

# Predict
predictions = []
for i in range(len(X_test)):
    events = generate_events_from_features(X_test.iloc[i])
    result = detector.predict(events)
    predictions.append(result['prediction_class'])

# Report
print(classification_report(y_test, predictions))
```

---

## Files

| File | Purpose |
|------|---------|
| `complacency_detector.py` | Main model class and feature extraction |
| `train_complacency_model.py` | Training script with data generation |
| `example_usage.py` | Usage examples and demonstrations |
| `ML_MODEL_README.md` | This documentation |
| `trained_models/` | Saved models directory |
| `trained_models/complacency_detector.pkl` | Trained model |
| `trained_models/training_data.csv` | Training dataset |
| `trained_models/training_metadata.json` | Training metrics |

---

## Troubleshooting

### Model Not Found

```python
# Check path
from pathlib import Path
model_path = Path('trained_models/complacency_detector.pkl')
print(f"Exists: {model_path.exists()}")

# Train if missing
if not model_path.exists():
    !python train_complacency_model.py
```

### Low Accuracy

1. **More training data:** `--samples 2000`
2. **Balanced classes:** `--balanced`
3. **Check feature quality:** Review feature importance
4. **Adjust model parameters:** Edit `RandomForestClassifier` config

### Prediction Errors

```python
# Verify events format
events = [
    {
        'timestamp': float,  # Required
        'event_type': str,   # Required
        'data': dict         # Required
    }
]

# Check for NaN features
result = detector.predict(events, return_features=True)
print(result['features'])
```

---

## Research Applications

### Condition 3 Implementation

The complacency detector is used in **Condition 3: ML-Based Adaptive Alerts**

**How it works:**
1. Continuously monitor behavioral events
2. Predict complacency in sliding windows
3. When complacency detected + critical event approaching:
   - Trigger predictive alert
   - Adapt alert presentation (blocking vs non-blocking)
   - Highlight risk regions on display

**Benefits:**
- **Proactive:** Alert before errors occur
- **Adaptive:** Alert style based on engagement level
- **Targeted:** Highlight specific neglected areas

### Experimental Hypotheses

**H1:** ML-based alerts reduce response time to critical events
**Measurement:** Compare response times across conditions

**H2:** Predictive alerts reduce missed alerts
**Measurement:** Track alert acknowledgment rates

**H3:** Complacency detection reduces attention failures
**Measurement:** Compare error rates in high vs low complacency periods

---

## Future Enhancements

### Potential Improvements

1. **Real training data:** Train on actual controller behavior
2. **Deep learning:** LSTM for temporal patterns
3. **Personalization:** Per-participant models
4. **Online learning:** Update model during sessions
5. **Multi-class:** Predict workload levels (low/medium/high)
6. **Additional features:** Eye tracking, physiological data

### Extension Ideas

```python
# Multi-output model
class EnhancedDetector:
    def predict(self, events):
        return {
            'complacency_score': float,
            'workload_level': str,  # low/medium/high
            'attention_focus': str,  # center/distributed
            'fatigue_score': float
        }
```

---

## Citation

If using this model in research:

```
@software{atc_complacency_detector,
  title={Complacency Detection ML Model for ATC Adaptive Alerts},
  author={ATC Adaptive Alert Research System},
  year={2024},
  version={1.0.0},
  url={https://github.com/yourusername/atc-adaptive-alerts}
}
```

---

## Support

**Issues:** Check example_usage.py for working code
**Training:** Run train_complacency_model.py with --help
**Questions:** Review this documentation

**Version:** 1.0.0
**Last Updated:** 2024-11-20
