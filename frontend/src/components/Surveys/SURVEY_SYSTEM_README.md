# Survey System Documentation

## Overview

The survey system provides comprehensive data collection for the ATC Adaptive Alert Research Study. It includes validated psychometric instruments and custom research questions administered at strategic points during the experiment.

## Survey Components

### 1. NASA Task Load Index (NASA-TLX)

**Purpose**: Measure subjective workload across 6 dimensions

**Dimensions**:
- Mental Demand (cognitive workload)
- Physical Demand (physical activity)
- Temporal Demand (time pressure)
- Performance (perceived success)
- Effort (work required)
- Frustration (stress and annoyance)

**Scoring**:
- Raw TLX: Simple average of 6 ratings (0-100)
- Weighted TLX (optional): Personalized weighting based on pairwise comparisons

**Usage**:
```javascript
import { NASATLX } from './components/Surveys';

<NASATLX
  sessionId={sessionId}
  phase="post-session"
  onComplete={(data) => {
    console.log('TLX Score:', data.raw_tlx);
    console.log('Weighted Score:', data.weighted_tlx);
  }}
/>
```

**Output Structure**:
```javascript
{
  survey_type: 'NASA-TLX',
  phase: 'post-session',
  ratings: {
    mental_demand: 75,
    physical_demand: 20,
    temporal_demand: 60,
    performance: 30,
    effort: 65,
    frustration: 40
  },
  raw_tlx: 48.33,
  weighted_tlx: 52.1, // if weighted
  weights: { ... }, // if weighted
  pairwise_comparisons: { ... }, // if weighted
  completed_at: '2025-01-21T...'
}
```

### 2. Trust in Automation Survey

**Purpose**: Measure participant trust in the alert system

**Dimensions** (1-7 Likert scale):
- Overall Trust
- Reliability
- Predictability
- Dependability
- Usefulness
- Understanding
- Transparency

**Usage**:
```javascript
import { TrustSurvey } from './components/Surveys';

<TrustSurvey
  sessionId={sessionId}
  condition={condition}
  onComplete={(data) => {
    console.log('Trust Score:', data.trust_score);
  }}
/>
```

**Output Structure**:
```javascript
{
  survey_type: 'Trust in Automation',
  condition: 3,
  responses: {
    overall_trust: 6,
    reliability: 5,
    predictability: 6,
    dependability: 6,
    usefulness: 7,
    understanding: 5,
    transparency: 6
  },
  trust_score: 5.86,
  comments: 'Optional text...',
  completed_at: '2025-01-21T...'
}
```

### 3. Alert Effectiveness Survey

**Purpose**: Measure perceived effectiveness of alerts

**Questions** (1-7 Likert scale):
- Helped respond to conflicts
- Timely appearance
- Appropriate frequency
- Reduced workload
- Improved awareness
- Would use again

**Usage**:
```javascript
import { EffectivenessSurvey } from './components/Surveys';

<EffectivenessSurvey
  sessionId={sessionId}
  condition={condition}
  onComplete={(data) => {
    console.log('Effectiveness:', data.effectiveness_score);
  }}
/>
```

### 4. Manipulation Check

**Purpose**: Validate experimental manipulation and participant attention

**Categories**:
- **Visibility Checks**: Could see radar, could see alerts
- **Condition-Specific**: Questions tailored to each condition
  - Condition 1: Alerts blocked view? Required acknowledgment?
  - Condition 2: Alerts were adaptive? Changed style?
  - Condition 3: Showed confidence? Visual highlighting?
- **Attention Checks**: Tried best effort? Took task seriously?
- **Awareness Checks**: Aware of aircraft? Noticed emergencies?

**Usage**:
```javascript
import { ManipulationCheck } from './components/Surveys';

<ManipulationCheck
  sessionId={sessionId}
  condition={condition}
  onComplete={(data) => {
    console.log('Manipulation successful:', data.manipulation_successful);
    console.log('Attention passed:', data.attention_check_passed);
  }}
/>
```

**Critical for**:
- Identifying participants who didn't engage
- Validating that conditions worked as intended
- Data quality control

### 5. Demographics Survey

**Purpose**: Collect participant background (pre-session, optional)

**Information Collected**:
- Age range
- Gender
- Education level
- ATC experience
- Computer proficiency
- Gaming experience
- Vision correction
- Aviation background (optional)

**Usage**:
```javascript
import { DemographicsSurvey } from './components/Surveys';

<DemographicsSurvey
  onComplete={(data) => {
    console.log('Demographics:', data);
  }}
  onSkip={() => {
    console.log('Participant skipped demographics');
  }}
/>
```

## Survey Manager (Orchestration)

The `SurveyManager` component handles the survey flow and timing.

**Survey Sequences**:

### Pre-Session
```
1. Demographics (optional - can skip)
```

### Post-Phase-1 (Baseline)
```
1. NASA-TLX (quick baseline workload)
```

### Post-Session (Full Battery)
```
1. NASA-TLX (full workload assessment)
2. Trust in System
3. Alert Effectiveness
4. Manipulation Check
```

**Usage**:
```javascript
import { SurveyManager } from './components/Surveys';

<SurveyManager
  sessionId={sessionId}
  condition={condition}
  phase="post-session"
  onComplete={(results) => {
    console.log('All surveys complete:', results);
    // Proceed to next phase
  }}
  onSkip={() => {
    console.log('Surveys skipped');
  }}
/>
```

## Data Storage

### Backend Endpoint Required

```python
@app.post("/api/sessions/{session_id}/surveys")
async def submit_survey_response(
    session_id: str,
    survey_data: dict
):
    """
    Store survey response in database
    
    Expected structure:
    {
        "survey_type": "NASA-TLX" | "Trust in Automation" | etc.,
        "phase": "pre-session" | "post-phase-1" | "post-session",
        "responses": { ... },
        "completed_at": "2025-01-21T..."
    }
    """
    db = DatabaseManager()
    
    # Store in surveys table
    survey_id = db.insert_survey_response(
        session_id=session_id,
        survey_type=survey_data['survey_type'],
        phase=survey_data['phase'],
        responses=json.dumps(survey_data['responses']),
        metadata=json.dumps({
            'completed_at': survey_data['completed_at'],
            # Include computed scores
            'raw_tlx': survey_data.get('raw_tlx'),
            'trust_score': survey_data.get('trust_score'),
            'manipulation_successful': survey_data.get('manipulation_successful')
        })
    )
    
    return {
        "survey_id": survey_id,
        "status": "saved"
    }
```

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS surveys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id VARCHAR(50) NOT NULL,
    survey_type VARCHAR(50) NOT NULL,
    phase VARCHAR(20) NOT NULL,
    responses TEXT NOT NULL, -- JSON
    metadata TEXT, -- JSON with scores and flags
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX idx_surveys_session ON surveys(session_id);
CREATE INDEX idx_surveys_type ON surveys(survey_type);
CREATE INDEX idx_surveys_phase ON surveys(phase);
```

## Data Export Integration

The survey data is automatically included when exporting session data:

```javascript
import { exportSessionData } from './services/api';

const sessionData = await exportSessionData(sessionId);
```

**Export Structure**:
```javascript
{
  session: { ... },
  alerts: [ ... ],
  events: [ ... ],
  surveys: [
    {
      survey_type: 'Demographics',
      phase: 'pre-session',
      responses: { ... }
    },
    {
      survey_type: 'NASA-TLX',
      phase: 'post-phase-1',
      responses: { ... },
      raw_tlx: 45.2
    },
    {
      survey_type: 'NASA-TLX',
      phase: 'post-session',
      responses: { ... },
      raw_tlx: 62.8,
      weighted_tlx: 65.3
    },
    {
      survey_type: 'Trust in Automation',
      phase: 'post-session',
      responses: { ... },
      trust_score: 5.2
    },
    {
      survey_type: 'Alert Effectiveness',
      phase: 'post-session',
      responses: { ... },
      effectiveness_score: 5.7
    },
    {
      survey_type: 'Manipulation Check',
      phase: 'post-session',
      responses: { ... },
      manipulation_successful: true,
      attention_check_passed: true
    }
  ],
  metrics: { ... }
}
```

## Research Best Practices

### Survey Timing

1. **Pre-Session**: Demographics before any task exposure
2. **Post-Phase-1**: Quick workload baseline after practice
3. **Post-Session**: Full battery immediately after task completion

### Data Quality

The surveys include multiple quality control mechanisms:

1. **Attention Checks**: In Manipulation Check
2. **Consistency Checks**: Compare ratings across similar questions
3. **Completion Tracking**: Required fields must be answered
4. **Timing Data**: Track how long participants spent on surveys

### Statistical Analysis

**NASA-TLX**:
- Compare Raw TLX scores across conditions (ANOVA)
- Analyze individual dimensions for specific insights
- Consider weighted TLX for more sensitive measures

**Trust & Effectiveness**:
- Likert scale analysis (treat as interval or ordinal)
- Internal consistency (Cronbach's alpha)
- Correlation with objective performance

**Manipulation Checks**:
- Binary pass/fail for data exclusion
- Report manipulation check results in paper
- Exclude participants who fail attention checks

### Sample Size Considerations

With proper counterbalancing:
- Minimum 12 participants per condition (36 total)
- Recommended 20 per condition (60 total) for robust effects
- Power analysis for workload differences (~15% effect size)

## Integration Example

```javascript
import React, { useState } from 'react';
import { SurveyManager } from './components/Surveys';

function App() {
  const [phase, setPhase] = useState('setup');
  const [sessionId, setSessionId] = useState(null);
  const [condition, setCondition] = useState(null);

  const handleSessionStart = (config) => {
    setSessionId(config.sessionId);
    setCondition(config.condition);
    setPhase('pre-session-survey');
  };

  const handleSurveysComplete = (results) => {
    console.log('Surveys complete:', results);
    
    if (phase === 'pre-session-survey') {
      setPhase('instructions');
    } else if (phase === 'post-phase-1-survey') {
      setPhase('scenario');
    } else if (phase === 'post-session-survey') {
      setPhase('complete');
    }
  };

  return (
    <div className="app">
      {phase.includes('survey') && (
        <SurveyManager
          sessionId={sessionId}
          condition={condition}
          phase={phase.replace('-survey', '')}
          onComplete={handleSurveysComplete}
        />
      )}
      
      {/* Other phase components */}
    </div>
  );
}
```

## Validation & Reliability

**NASA-TLX**:
- Well-validated instrument with extensive literature
- High test-retest reliability (r > 0.80)
- Sensitive to workload manipulations

**Trust Scale**:
- Based on Jian et al. (2000) trust in automation scale
- Validated in aviation contexts
- 7-point Likert provides good discrimination

**Custom Questions**:
- Face validity through expert review
- Pilot testing recommended
- Consider validation study if publishing

## Citation

If using this survey system in publications, cite:

**NASA-TLX**:
Hart, S. G., & Staveland, L. E. (1988). Development of NASA-TLX (Task Load Index): Results of empirical and theoretical research. In P. A. Hancock & N. Meshkati (Eds.), Human Mental Workload (pp. 139-183). North-Holland.

**Trust in Automation**:
Jian, J. Y., Bisantz, A. M., & Drury, C. G. (2000). Foundations for an empirically determined scale of trust in automated systems. International Journal of Cognitive Ergonomics, 4(1), 53-71.
