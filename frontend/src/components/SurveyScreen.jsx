import React, { useState } from 'react';
import { submitSurvey } from '../services/api';
import '../styles/survey.css';

const SurveyScreen = ({ sessionId, condition, onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // NASA-TLX Workload Assessment
  const [nasaTLX, setNasaTLX] = useState({
    mental_demand: 50,
    physical_demand: 50,
    temporal_demand: 50,
    performance: 50,
    effort: 50,
    frustration: 50
  });

  // Trust in Automation (Condition 3 specific)
  const [trust, setTrust] = useState({
    reliability: 50,
    predictability: 50,
    understanding: 50,
    usefulness: 50
  });

  // Alert System Feedback
  const [alertFeedback, setAlertFeedback] = useState({
    helpfulness: 50,
    intrusiveness: 50,
    timing: 50,
    clarity: 50
  });

  // Qualitative Feedback
  const [qualitative, setQualitative] = useState({
    liked: '',
    disliked: '',
    improvements: '',
    additional: ''
  });

  const handleNasaTLXChange = (dimension, value) => {
    setNasaTLX(prev => ({ ...prev, [dimension]: parseInt(value) }));
  };

  const handleTrustChange = (dimension, value) => {
    setTrust(prev => ({ ...prev, [dimension]: parseInt(value) }));
  };

  const handleAlertFeedbackChange = (dimension, value) => {
    setAlertFeedback(prev => ({ ...prev, [dimension]: parseInt(value) }));
  };

  const handleQualitativeChange = (field, value) => {
    setQualitative(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const responses = {
        nasa_tlx: nasaTLX,
        alert_feedback: alertFeedback,
        qualitative_feedback: qualitative
      };

      if (condition === 3) {
        responses.trust_scores = trust;
      }

      const surveyData = {
        survey_type: 'post_session',
        survey_phase: 'post',
        duration_seconds: null,
        responses: {
          ...responses,
          _metadata: {
            condition: condition ?? null,
            completed_at: new Date().toISOString()
          }
        }
      };

      await submitSurvey(sessionId, surveyData);
      onComplete();
    } catch (err) {
      console.error('Failed to submit survey:', err);
      setError(err.message || 'Failed to submit survey');
      setLoading(false);
    }
  };

  const renderSlider = (value, onChange, leftLabel, rightLabel) => (
    <div className="slider-container">
      <div className="slider-labels">
        <span className="slider-label-left">{leftLabel}</span>
        <span className="slider-value">{value}</span>
        <span className="slider-label-right">{rightLabel}</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="slider"
      />
    </div>
  );

  const renderPage1 = () => (
    <div className="survey-page">
      <h2>NASA Task Load Index (NASA-TLX)</h2>
      <p className="page-description">
        Please rate your experience during the scenario on the following dimensions.
        Use the sliders to indicate your rating from 0 (low) to 100 (high).
      </p>

      <div className="survey-section">
        <h3>Mental Demand</h3>
        <p className="dimension-description">
          How mentally demanding was the task?
        </p>
        {renderSlider(
          nasaTLX.mental_demand,
          (value) => handleNasaTLXChange('mental_demand', value),
          'Very Low',
          'Very High'
        )}
      </div>

      <div className="survey-section">
        <h3>Physical Demand</h3>
        <p className="dimension-description">
          How physically demanding was the task?
        </p>
        {renderSlider(
          nasaTLX.physical_demand,
          (value) => handleNasaTLXChange('physical_demand', value),
          'Very Low',
          'Very High'
        )}
      </div>

      <div className="survey-section">
        <h3>Temporal Demand</h3>
        <p className="dimension-description">
          How hurried or rushed was the pace of the task?
        </p>
        {renderSlider(
          nasaTLX.temporal_demand,
          (value) => handleNasaTLXChange('temporal_demand', value),
          'Very Low',
          'Very High'
        )}
      </div>

      <div className="survey-section">
        <h3>Performance</h3>
        <p className="dimension-description">
          How successful were you in accomplishing what you were asked to do?
        </p>
        {renderSlider(
          nasaTLX.performance,
          (value) => handleNasaTLXChange('performance', value),
          'Perfect',
          'Failure'
        )}
      </div>

      <div className="survey-section">
        <h3>Effort</h3>
        <p className="dimension-description">
          How hard did you have to work to accomplish your level of performance?
        </p>
        {renderSlider(
          nasaTLX.effort,
          (value) => handleNasaTLXChange('effort', value),
          'Very Low',
          'Very High'
        )}
      </div>

      <div className="survey-section">
        <h3>Frustration</h3>
        <p className="dimension-description">
          How insecure, discouraged, irritated, stressed, or annoyed were you?
        </p>
        {renderSlider(
          nasaTLX.frustration,
          (value) => handleNasaTLXChange('frustration', value),
          'Very Low',
          'Very High'
        )}
      </div>
    </div>
  );

  const renderPage2 = () => (
    <div className="survey-page">
      <h2>Alert System Feedback</h2>
      <p className="page-description">
        Please rate your experience with the alert system used in this session.
      </p>

      <div className="survey-section">
        <h3>Helpfulness</h3>
        <p className="dimension-description">
          How helpful were the alerts in managing the scenario?
        </p>
        {renderSlider(
          alertFeedback.helpfulness,
          (value) => handleAlertFeedbackChange('helpfulness', value),
          'Not Helpful',
          'Very Helpful'
        )}
      </div>

      <div className="survey-section">
        <h3>Intrusiveness</h3>
        <p className="dimension-description">
          How intrusive or disruptive were the alerts?
        </p>
        {renderSlider(
          alertFeedback.intrusiveness,
          (value) => handleAlertFeedbackChange('intrusiveness', value),
          'Not Intrusive',
          'Very Intrusive'
        )}
      </div>

      <div className="survey-section">
        <h3>Timing</h3>
        <p className="dimension-description">
          How appropriate was the timing of the alerts?
        </p>
        {renderSlider(
          alertFeedback.timing,
          (value) => handleAlertFeedbackChange('timing', value),
          'Too Early/Late',
          'Just Right'
        )}
      </div>

      <div className="survey-section">
        <h3>Clarity</h3>
        <p className="dimension-description">
          How clear and understandable were the alerts?
        </p>
        {renderSlider(
          alertFeedback.clarity,
          (value) => handleAlertFeedbackChange('clarity', value),
          'Not Clear',
          'Very Clear'
        )}
      </div>

      {/* Trust in Automation (Condition 3 only) */}
      {condition === 3 && (
        <>
          <h2 className="section-divider">Trust in ML System</h2>
          <p className="page-description">
            Please rate your trust in the machine learning alert system.
          </p>

          <div className="survey-section">
            <h3>Reliability</h3>
            <p className="dimension-description">
              How reliable were the ML predictions?
            </p>
            {renderSlider(
              trust.reliability,
              (value) => handleTrustChange('reliability', value),
              'Not Reliable',
              'Very Reliable'
            )}
          </div>

          <div className="survey-section">
            <h3>Predictability</h3>
            <p className="dimension-description">
              How predictable was the ML system's behavior?
            </p>
            {renderSlider(
              trust.predictability,
              (value) => handleTrustChange('predictability', value),
              'Not Predictable',
              'Very Predictable'
            )}
          </div>

          <div className="survey-section">
            <h3>Understanding</h3>
            <p className="dimension-description">
              How well did you understand why the ML made its predictions?
            </p>
            {renderSlider(
              trust.understanding,
              (value) => handleTrustChange('understanding', value),
              'Not Understood',
              'Well Understood'
            )}
          </div>

          <div className="survey-section">
            <h3>Usefulness</h3>
            <p className="dimension-description">
              How useful were the ML explanations and confidence scores?
            </p>
            {renderSlider(
              trust.usefulness,
              (value) => handleTrustChange('usefulness', value),
              'Not Useful',
              'Very Useful'
            )}
          </div>
        </>
      )}
    </div>
  );

  const renderPage3 = () => (
    <div className="survey-page">
      <h2>Additional Feedback</h2>
      <p className="page-description">
        Please provide any additional comments about your experience.
      </p>

      <div className="survey-section">
        <h3>What did you like about the alert system?</h3>
        <textarea
          value={qualitative.liked}
          onChange={(e) => handleQualitativeChange('liked', e.target.value)}
          placeholder="Your answer..."
          rows="4"
          className="survey-textarea"
        />
      </div>

      <div className="survey-section">
        <h3>What did you dislike about the alert system?</h3>
        <textarea
          value={qualitative.disliked}
          onChange={(e) => handleQualitativeChange('disliked', e.target.value)}
          placeholder="Your answer..."
          rows="4"
          className="survey-textarea"
        />
      </div>

      <div className="survey-section">
        <h3>How could the alert system be improved?</h3>
        <textarea
          value={qualitative.improvements}
          onChange={(e) => handleQualitativeChange('improvements', e.target.value)}
          placeholder="Your answer..."
          rows="4"
          className="survey-textarea"
        />
      </div>

      <div className="survey-section">
        <h3>Any other comments or observations?</h3>
        <textarea
          value={qualitative.additional}
          onChange={(e) => handleQualitativeChange('additional', e.target.value)}
          placeholder="Your answer..."
          rows="4"
          className="survey-textarea"
        />
      </div>
    </div>
  );

  return (
    <div className="survey-screen">
      <div className="survey-container">
        <header className="survey-header">
          <h1>Post-Session Survey</h1>
          <p className="subtitle">Page {currentPage} of 3</p>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(currentPage / 3) * 100}%` }}
            />
          </div>
        </header>

        <div className="survey-content">
          {currentPage === 1 && renderPage1()}
          {currentPage === 2 && renderPage2()}
          {currentPage === 3 && renderPage3()}
        </div>

        {error && (
          <div className="survey-error">
            <span>{error}</span>
          </div>
        )}

        <footer className="survey-footer">
          <div className="survey-navigation">
            {currentPage > 1 && (
              <button
                className="btn btn-secondary"
                onClick={() => setCurrentPage(prev => prev - 1)}
                disabled={loading}
              >
                Previous
              </button>
            )}

            {currentPage < 3 ? (
              <button
                className="btn btn-primary"
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                Next
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? 'Submitting...' : 'Submit Survey'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};

export default SurveyScreen;
