# Confidence Scoring System

Transparent confidence scoring for ML-based adaptive alerts in Condition 3.

**Version:** 1.0.0
**Purpose:** Build trust in ML predictions through multi-factor confidence scoring and human-readable explanations

---

## Overview

The confidence scoring system provides **transparency** and **trust** for ML predictions by:

1. **Multi-factor confidence calculation** - Not just model output, but consistency, history, and clarity
2. **Human-readable explanations** - Why the alert was triggered
3. **Confidence-based presentation** - Visual style adapts to confidence level
4. **Historical calibration** - Learns from past accuracy

### Why Confidence Matters

In Condition 3 (ML-Based Adaptive Alerts), participants need to **trust** the ML system. Trust comes from:
- **Transparency:** Understanding why alerts are triggered
- **Consistency:** Seeing the system perform accurately over time
- **Appropriate confidence:** Not over-confident or under-confident

---

## Quick Start

### Basic Usage

```python
from confidence_scorer import ConfidenceScorer

# Initialize
scorer = ConfidenceScorer()

# Calculate confidence
confidence_result = scorer.calculate_confidence(
    prediction_score=0.82,  # Model's raw prediction
    features={
        'peripheral_neglect_duration': 0.85,
        'interaction_entropy': 0.9,
        'click_rate': 0.15,
        # ... other features
    },
    scenario_state={
        'aircraft_count': 5,
        'active_alerts': 1,
        'complexity': 'medium',
        'elapsed_time': 120
    }
)

print(f"Confidence: {confidence_result['confidence_percentage']:.0f}%")
print(f"Level: {confidence_result['level']}")
# Output: Confidence: 87%
#         Level: medium

# Generate reasoning
reasoning = scorer.generate_reasoning(
    prediction_score=0.82,
    confidence_result=confidence_result,
    features={...}
)

print(reasoning)
# Output: "High confidence (87%) - peripheral neglect 85% + crisis fixation 95%"
```

### Integrated Usage

```python
from integrated_ml_system import IntegratedMLSystem

# Initialize (includes detector + confidence scorer)
system = IntegratedMLSystem()

# Single call for complete analysis
result = system.predict_with_confidence(
    events=behavioral_events,
    scenario_state=current_state,
    alert_priority='high'
)

print(result['explanation'])
# Output: "Complacency detected (82%). High confidence (87%) -
#          peripheral neglect 85% + monotonous movement + low activity (0.4 events/s)"

print(f"Alert color: {result['alert_color']}")
print(f"Alert style: {result['alert_style']}")
```

---

## Confidence Calculation

### Three-Factor Model

Confidence is calculated from **three components**:

```
Confidence = (0.4 × Consistency) + (0.35 × Accuracy) + (0.25 × Clarity)
```

| Component | Weight | What It Measures |
|-----------|--------|------------------|
| **Feature Consistency** | 40% | Do multiple features agree? |
| **Historical Accuracy** | 35% | Has model been right before? |
| **Situation Clarity** | 25% | Is scenario state clear? |

---

### 1. Feature Consistency (40%)

**Question:** How consistently do features support the prediction?

**High Consistency:**
- Multiple strong features indicate same result
- Features agree with each other
- Important features align with prediction

**Low Consistency:**
- Conflicting feature signals
- Only one or two weak features
- Important features contradict prediction

**Example:**

```python
# High consistency - multiple features indicate complacency
features = {
    'peripheral_neglect_duration': 0.85,  # High (bad)
    'interaction_entropy': 0.9,            # Low (bad)
    'click_rate': 0.15,                    # Low (bad)
    'activity_level': 0.4                  # Low (bad)
}
# → Consistency: 0.92 (all agree on complacency)

# Low consistency - conflicting signals
features = {
    'peripheral_neglect_duration': 0.85,  # High (bad)
    'interaction_entropy': 2.8,            # High (good!)
    'click_rate': 0.45,                    # Normal (good!)
    'activity_level': 1.8                  # High (good!)
}
# → Consistency: 0.35 (features conflict)
```

**Calculation:**
1. For each feature, determine if it indicates complacency or normal
2. Count features supporting vs conflicting with prediction
3. Weight by feature importance from model
4. Calculate: (supporting - conflicting) / total

---

### 2. Historical Accuracy (35%)

**Question:** How accurate have recent predictions been?

**High Accuracy:**
- Recent predictions were correct
- Model is well-calibrated
- Performance is stable

**Low Accuracy:**
- Recent predictions were wrong
- Model is miscalibrated
- Performance is inconsistent

**Tracking:**

```python
# Record outcomes
scorer.record_outcome(prediction_was_correct=True)
scorer.record_outcome(prediction_was_correct=True)
scorer.record_outcome(prediction_was_correct=False)

# Get calibration stats
stats = scorer.get_calibration_stats()
# {
#   'overall_accuracy': 0.85,
#   'recent_accuracy': 0.92,
#   'high_confidence_accuracy': 0.95,
#   'medium_confidence_accuracy': 0.82
# }
```

**Exponential Smoothing:**
- Recent predictions weighted more heavily
- Gradually adapts to changing performance
- Default history window: 100 predictions

---

### 3. Situation Clarity (25%)

**Question:** Is the current situation clear and unambiguous?

**High Clarity:**
- Few aircraft (simple scenario)
- No competing alerts
- Moderate scenario time (familiar but not fatigued)
- Low event rate (not overwhelmed)

**Low Clarity:**
- Many aircraft (complex scenario)
- Multiple active alerts
- Very early or very late in scenario
- Rapid events (high workload)

**Factors:**

```python
scenario_state = {
    'aircraft_count': 5,        # More aircraft = less clarity
    'active_alerts': 1,         # More alerts = less clarity
    'complexity': 'medium',     # High complexity = less clarity
    'elapsed_time': 120,        # Peak clarity at 60-180 seconds
    'recent_event_count': 2     # More events = less clarity
}

# Clarity calculation:
# - Aircraft: 1.0 / (1 + log(5+1)/3) = 0.72
# - Alerts: 1.0 / (1 + 1*0.2) = 0.83
# - Complexity: 0.70 (medium)
# - Time: 0.90 (in sweet spot)
# - Events: 1.0 / (1 + 2*0.1) = 0.83
# → Average: 0.80
```

---

## Confidence Levels

### Categorization

| Confidence | Level | Meaning | Alert Style |
|-----------|-------|---------|-------------|
| **90%+** | High | Strong evidence | 🔴 Red, blocking modal |
| **70-89%** | Medium | Good evidence | 🟠 Orange, prominent banner |
| **50-69%** | Low | Weak evidence | 🟡 Yellow, subtle banner |
| **<50%** | Very Low | Insufficient evidence | 🔵 Blue, info only |

### Alert Presentation

```python
presentation = scorer.get_alert_presentation(
    confidence_result=confidence_result,
    alert_priority='high'
)

# Returns:
# {
#   'presentation_type': 'strong_red_alert',
#   'color': '#DC2626',  # Red
#   'style': 'modal_blocking',
#   'audio_enabled': True,
#   'blocking': True,
#   'dismissable': False,
#   'timeout_seconds': None,
#   'visual_emphasis': 'strong'
# }
```

### Confidence × Priority Matrix

| Confidence ↓ / Priority → | Critical | High | Medium | Low |
|---------------------------|----------|------|--------|-----|
| **High (90%+)** | 🔴 Red Modal | 🔴 Red Modal | 🟠 Orange Banner | 🟠 Orange Banner |
| **Medium (70-89%)** | 🟠 Orange Banner | 🟠 Orange Banner | 🟠 Orange Banner | 🟡 Yellow Suggestion |
| **Low (50-69%)** | 🟡 Yellow Suggestion | 🟡 Yellow Suggestion | 🟡 Yellow Suggestion | 🔵 Info |
| **Very Low (<50%)** | 🟡 Yellow Suggestion | 🔵 Info | 🔵 Info | 🔵 Info |

---

## Reasoning Generation

### Human-Readable Explanations

**Purpose:** Explain **why** the alert was triggered

**Format:**
```
[Confidence Level] ([Percentage]) - [Key Features]
```

**Examples:**

```python
"High confidence (87%) - peripheral neglect 85% + crisis fixation 95%"

"Medium confidence (73%) - monotonous movement + low activity (0.4 events/s)"

"Low confidence (62%) - repetitive commands [Note: conflicting signals]"
```

### Components

1. **Confidence Statement**
   - "High confidence (87%)"
   - Clear, upfront

2. **Key Features** (top 3)
   - Features most strongly indicating complacency
   - Human-readable descriptions
   - Quantified where relevant

3. **Caveats** (if applicable)
   - "[Note: conflicting signals]" - Low feature consistency
   - "[Note: uncertain past performance]" - Low historical accuracy
   - "[Note: ambiguous situation]" - Low situation clarity

### Feature Descriptions

| Feature | Description Format |
|---------|-------------------|
| `peripheral_neglect_duration` | "peripheral neglect 85%" |
| `mouse_velocity_variance` | "monotonous movement" |
| `interaction_entropy` | "repetitive interactions" |
| `click_rate` | "low click rate (0.2/s)" |
| `hover_stability` | "fixation 3.2s" |
| `response_time_trend` | "slowing responses (+150ms)" |
| `activity_level` | "low activity (0.4 events/s)" |

---

## Integration Examples

### Example 1: Basic Alert Decision

```python
from integrated_ml_system import IntegratedMLSystem

system = IntegratedMLSystem()

# Get prediction with confidence
result = system.predict_with_confidence(
    events=behavioral_events,
    scenario_state=current_state,
    alert_priority='medium'
)

if result['confidence'] > 0.7 and result['complacency_score'] > 0.75:
    # Trigger alert
    display_alert(
        message=result['explanation'],
        style=result['alert_style'],
        color=result['alert_color']
    )
```

### Example 2: Adaptive Presentation

```python
# Adjust alert based on confidence
if result['confidence_level'] == 'high':
    # High confidence → Intrusive
    alert_config = {
        'blocking': True,
        'audio': True,
        'color': 'red',
        'timeout': None
    }
elif result['confidence_level'] == 'medium':
    # Medium confidence → Prominent
    alert_config = {
        'blocking': False,
        'audio': True,
        'color': 'orange',
        'timeout': 30
    }
else:
    # Low confidence → Subtle
    alert_config = {
        'blocking': False,
        'audio': False,
        'color': 'yellow',
        'timeout': 15
    }

show_alert(result['explanation'], **alert_config)
```

### Example 3: Explanation Display

```python
# Show detailed explanation to participant
result = system.get_detailed_analysis(events, scenario_state)

print("="*60)
print("ML Alert Explanation")
print("="*60)
print(f"\nPrediction: {result['explanation']}")
print(f"\nConfidence Breakdown:")
print(f"  Feature Consistency: {result['confidence_components']['feature_consistency']*100:.0f}%")
print(f"  Historical Accuracy: {result['confidence_components']['historical_accuracy']*100:.0f}%")
print(f"  Situation Clarity: {result['confidence_components']['situation_clarity']*100:.0f}%")
print(f"\nTop Contributing Factors:")
for feature, info in result['feature_analysis'].items():
    if info['status'] == 'complacent' and info['severity'] > 0.5:
        print(f"  - {feature}: {info['value']:.2f}")
```

### Example 4: Calibration Tracking

```python
# During scenario
result = system.predict_with_confidence(events, scenario_state)

# After participant responds
participant_response_correct = evaluate_participant_action()

# Record outcome
system.record_outcome(participant_response_correct)

# After multiple sessions
report = system.get_calibration_report()
print(report)
# Output:
# Calibration Report
# ============================================================
# Predictions tracked: 45
# Overall accuracy: 87.5%
# Recent accuracy: 92.0%
#
# Confidence Calibration:
#   High Confidence Accuracy: 95.2%
#   Medium Confidence Accuracy: 84.3%
#   Low Confidence Accuracy: 72.1%
```

---

## API Reference

### ConfidenceScorer

```python
class ConfidenceScorer:
    def __init__(
        history_window: int = 100,
        consistency_weight: float = 0.4,
        accuracy_weight: float = 0.35,
        clarity_weight: float = 0.25
    )

    def calculate_confidence(
        prediction_score: float,
        features: Dict[str, float],
        scenario_state: Optional[Dict[str, Any]] = None,
        feature_importances: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]

    def generate_reasoning(
        prediction_score: float,
        confidence_result: Dict[str, Any],
        features: Dict[str, float],
        top_n: int = 3
    ) -> str

    def get_alert_presentation(
        confidence_result: Dict[str, Any],
        alert_priority: str = 'medium'
    ) -> Dict[str, Any]

    def record_outcome(
        prediction_was_correct: bool,
        prediction_index: int = -1
    )

    def get_calibration_stats() -> Dict[str, Any]
```

### IntegratedMLSystem

```python
class IntegratedMLSystem:
    def __init__(
        model_path: str = None,
        track_history: bool = True
    )

    def predict_with_confidence(
        events: List[Dict[str, Any]],
        scenario_state: Optional[Dict[str, Any]] = None,
        alert_priority: str = 'medium'
    ) -> Dict[str, Any]

    def should_trigger_alert(
        events: List[Dict[str, Any]],
        scenario_state: Optional[Dict[str, Any]] = None,
        alert_priority: str = 'medium',
        min_confidence: float = 0.6
    ) -> Dict[str, Any]

    def get_detailed_analysis(
        events: List[Dict[str, Any]],
        scenario_state: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]

    def record_outcome(prediction_was_correct: bool)

    def get_calibration_report() -> str
```

---

## Tuning Parameters

### Adjust Component Weights

```python
# More emphasis on feature consistency
scorer = ConfidenceScorer(
    consistency_weight=0.5,
    accuracy_weight=0.3,
    clarity_weight=0.2
)

# More emphasis on historical accuracy
scorer = ConfidenceScorer(
    consistency_weight=0.3,
    accuracy_weight=0.5,
    clarity_weight=0.2
)
```

### Adjust Confidence Thresholds

```python
# In your alert logic
if result['confidence'] > 0.85:  # Stricter high confidence
    alert_style = 'red_modal'
elif result['confidence'] > 0.65:  # Lower medium threshold
    alert_style = 'orange_banner'
```

### Customize Feature Thresholds

```python
# Modify thresholds for your context
scorer.complacency_feature_thresholds['peripheral_neglect_duration'] = {
    'low': 0.25,   # More lenient
    'high': 0.65   # Stricter
}
```

---

## Research Applications

### Hypothesis Testing

**H1:** Higher confidence alerts are more trusted
- **Measure:** Participant trust ratings by confidence level
- **Analysis:** Compare trust(high) vs trust(medium) vs trust(low)

**H2:** Explanations improve trust and compliance
- **A/B Test:** Alerts with vs without explanations
- **Measure:** Alert acknowledgment rates, trust ratings

**H3:** Well-calibrated confidence improves performance
- **Measure:** Participant performance when confidence matches accuracy
- **Analysis:** Correlation between calibration quality and user performance

### Data Collection

```python
# Track for each alert
data = {
    'alert_id': alert_id,
    'complacency_score': result['complacency_score'],
    'confidence': result['confidence'],
    'confidence_level': result['confidence_level'],
    'reasoning': result['reasoning'],
    'presentation_style': result['alert_style'],

    # Participant response
    'acknowledged': True/False,
    'response_time_ms': 1250,
    'action_taken': 'dismissed' / 'acted',

    # Outcome
    'was_correct': True/False,
    'participant_trust_rating': 1-7
}
```

---

## Files

| File | Purpose |
|------|---------|
| `confidence_scorer.py` | Core confidence scoring |
| `integrated_ml_system.py` | Combined detector + scorer |
| `CONFIDENCE_README.md` | This documentation |

---

## Best Practices

### 1. Always Provide Explanations

```python
# Good
result = system.predict_with_confidence(events, scenario_state)
show_alert(result['explanation'])

# Bad
show_alert("Complacency detected")  # No explanation!
```

### 2. Match Presentation to Confidence

```python
# Use provided presentation recommendations
presentation = result['presentation']
show_alert(
    message=result['explanation'],
    style=presentation['style'],
    color=presentation['color'],
    blocking=presentation['blocking']
)
```

### 3. Track Outcomes

```python
# Record every prediction outcome
prediction_correct = evaluate_outcome()
system.record_outcome(prediction_correct)

# Regularly review calibration
if session_count % 10 == 0:
    print(system.get_calibration_report())
```

### 4. Be Transparent

```python
# Show confidence breakdown for transparency
print(f"Confidence: {result['confidence_percentage']:.0f}%")
print(f"  Feature Consistency: {result['confidence_components']['feature_consistency']*100:.0f}%")
print(f"  Historical Accuracy: {result['confidence_components']['historical_accuracy']*100:.0f}%")
print(f"  Situation Clarity: {result['confidence_components']['situation_clarity']*100:.0f}%")
```

---

## Support

**Examples:** Run `python integrated_ml_system.py`
**Full ML Docs:** See `ML_MODEL_README.md`
**Quick Start:** See `QUICK_START_ML.md`

**Version:** 1.0.0
**Last Updated:** 2024-11-20
