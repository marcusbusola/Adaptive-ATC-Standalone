import React, { useState } from 'react';
import NASATLX from './NASA-TLX';
import TrustSurvey from './TrustSurvey';
import EffectivenessSurvey from './EffectivenessSurvey';
import ManipulationCheck from './ManipulationCheck';
import DemographicsSurvey from './DemographicsSurvey';
import { submitSurveyResponse } from '../../services/api';
import '../../styles/surveys.css';

/**
 * Survey Manager
 *
 * Orchestrates the survey flow based on phase and timing:
 * - Pre-session: Demographics (optional)
 * - Post-Phase-1: Quick workload check
 * - Post-session: Full battery (NASA-TLX, Trust, Effectiveness, Manipulation Check)
 */
const SurveyManager = ({
  sessionId,
  condition,
  phase,
  onComplete,
  onSkip
}) => {
  const [currentSurveyIndex, setCurrentSurveyIndex] = useState(0);
  const [surveyResponses, setSurveyResponses] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [lastFailedData, setLastFailedData] = useState(null); // For retry functionality

  // Define survey sequences for each phase
  const surveySequences = {
    'pre-session': [
      { component: DemographicsSurvey, name: 'Demographics', optional: true }
    ],
    'post-phase-1': [
      { component: NASATLX, name: 'NASA-TLX Baseline', phase: 'post-phase-1' }
    ],
    'post-session': [
      { component: NASATLX, name: 'NASA-TLX', phase: 'post-session' },
      { component: TrustSurvey, name: 'Trust in System' },
      { component: EffectivenessSurvey, name: 'Alert Effectiveness' },
      { component: ManipulationCheck, name: 'Manipulation Check' }
    ]
  };

  const currentSequence = surveySequences[phase] || surveySequences['post-session'];
  const currentSurvey = currentSequence[currentSurveyIndex];
  const totalSurveys = currentSequence.length;

  const handleSurveyComplete = async (surveyData) => {
    // Add to responses
    const response = {
      ...surveyData,
      session_id: sessionId,
      survey_index: currentSurveyIndex,
      phase
    };

    setSurveyResponses(prev => [...prev, response]);

    // Save to backend
    setIsSubmitting(true);
    setError(null);
    setLastFailedData(null);

    try {
      await submitSurveyResponse(sessionId, response);
      console.log('Survey response saved:', surveyData.survey_type);

      // Move to next survey or complete
      if (currentSurveyIndex < totalSurveys - 1) {
        setCurrentSurveyIndex(prev => prev + 1);
      } else {
        // All surveys complete
        onComplete({
          phase,
          responses: [...surveyResponses, response],
          completed_at: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Failed to save survey response:', err);
      setError(`Failed to save response: ${err.message || 'Unknown error'}. Please try again.`);
      setLastFailedData(surveyData); // Store for retry
    } finally {
      setIsSubmitting(false);
    }
  };

  // Retry failed submission
  const handleRetry = () => {
    if (lastFailedData) {
      handleSurveyComplete(lastFailedData);
    }
  };

  // Skip failed survey and continue (for non-critical errors)
  const handleSkipAndContinue = () => {
    setError(null);
    setLastFailedData(null);
    if (currentSurveyIndex < totalSurveys - 1) {
      setCurrentSurveyIndex(prev => prev + 1);
    } else {
      onComplete({
        phase,
        responses: surveyResponses,
        completed_at: new Date().toISOString(),
        had_errors: true
      });
    }
  };

  const handleBack = () => {
    if (currentSurveyIndex > 0) {
      setCurrentSurveyIndex(prev => prev - 1);
    }
  };

  const handleSkipSurvey = async () => {
    if (currentSurvey.optional) {
      // Skip optional survey
      if (currentSurveyIndex < totalSurveys - 1) {
        setCurrentSurveyIndex(prev => prev + 1);
      } else {
        onSkip?.();
      }
    }
  };

  if (isSubmitting) {
    return (
      <div className="survey-loading">
        <div className="loading-spinner"></div>
        <p>Saving your response...</p>
      </div>
    );
  }

  const SurveyComponent = currentSurvey.component;

  return (
    <div className="survey-manager">
      {/* Progress Indicator */}
      <div className="survey-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${((currentSurveyIndex + 1) / totalSurveys) * 100}%` }}
          />
        </div>
        <div className="progress-text">
          Survey {currentSurveyIndex + 1} of {totalSurveys}
          {currentSurvey.name && `: ${currentSurvey.name}`}
        </div>
      </div>

      {/* Error Display with Retry Options */}
      {error && (
        <div className="survey-error-banner">
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
          <div className="error-actions">
            {lastFailedData && (
              <button
                className="btn btn-retry"
                onClick={handleRetry}
              >
                Retry
              </button>
            )}
            <button
              className="btn btn-skip"
              onClick={handleSkipAndContinue}
            >
              Skip & Continue
            </button>
            <button
              className="error-close"
              onClick={() => { setError(null); setLastFailedData(null); }}
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Current Survey */}
      <SurveyComponent
        sessionId={sessionId}
        condition={condition}
        phase={currentSurvey.phase || phase}
        onComplete={handleSurveyComplete}
        onBack={currentSurveyIndex > 0 ? handleBack : null}
        onSkip={currentSurvey.optional ? handleSkipSurvey : null}
      />

      {/* Phase-specific instructions */}
      {phase === 'pre-session' && (
        <div className="phase-notice">
          <p>
            <strong>Note:</strong> This information is collected before the main task begins.
            You may skip this section if you prefer.
          </p>
        </div>
      )}

      {phase === 'post-phase-1' && (
        <div className="phase-notice">
          <p>
            <strong>Note:</strong> This is a brief baseline assessment. The full survey
            will be administered after the main scenario.
          </p>
        </div>
      )}
    </div>
  );
};

export default SurveyManager;
