import React, { useState } from 'react';
import '../../styles/surveys.css';

/**
 * Alert Effectiveness Survey
 *
 * Measures perceived effectiveness of the alert system in helping
 * participants respond to conflicts and manage workload.
 */
const EffectivenessSurvey = ({ onComplete, onBack, sessionId, condition }) => {
  const [responses, setResponses] = useState({
    helped_respond: null,
    timely: null,
    appropriate_frequency: null,
    reduced_workload: null,
    improved_awareness: null,
    would_use_again: null
  });

  const [comments, setComments] = useState('');

  const questions = {
    helped_respond: {
      question: 'The alerts helped me respond to conflicts more effectively',
      description: 'Did the alerts improve your ability to identify and respond to conflict situations?'
    },
    timely: {
      question: 'The alerts appeared at the right time',
      description: 'Were the alerts timed appropriately - not too early or too late?'
    },
    appropriate_frequency: {
      question: 'The frequency of alerts was appropriate',
      description: 'Did you receive the right number of alerts - not too many or too few?'
    },
    reduced_workload: {
      question: 'The alerts helped reduce my mental workload',
      description: 'Did the alert system make the task easier or more manageable?'
    },
    improved_awareness: {
      question: 'The alerts improved my situational awareness',
      description: 'Did the alerts help you maintain awareness of the overall traffic situation?'
    },
    would_use_again: {
      question: 'I would want to use this alert system again',
      description: 'Based on your experience, would you choose to use this system in the future?'
    }
  };

  const scaleLabels = [
    'Strongly Disagree',
    'Disagree',
    'Somewhat Disagree',
    'Neutral',
    'Somewhat Agree',
    'Agree',
    'Strongly Agree'
  ];

  const handleResponse = (question, value) => {
    setResponses(prev => ({ ...prev, [question]: value }));
  };

  const handleSubmit = () => {
    const surveyData = {
      survey_type: 'Alert Effectiveness',
      condition,
      responses,
      effectiveness_score: calculateEffectivenessScore(),
      comments,
      completed_at: new Date().toISOString()
    };

    onComplete(surveyData);
  };

  const calculateEffectivenessScore = () => {
    const values = Object.values(responses).filter(v => v !== null);
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  };

  const allQuestionsAnswered = Object.values(responses).every(v => v !== null);

  return (
    <div className="survey-container effectiveness-survey">
      <div className="survey-header">
        <h1>Alert System Effectiveness</h1>
        <p className="survey-subtitle">
          How effective were the alerts in helping you perform the task?
        </p>
        <div className="progress-indicator">
          {Object.values(responses).filter(v => v !== null).length} / {Object.keys(questions).length} completed
        </div>
      </div>

      <div className="survey-content">
        <div className="survey-instructions">
          <h3>Instructions</h3>
          <p>
            Please rate your agreement with each statement about the effectiveness
            of the alert system using a 1-7 scale.
          </p>
        </div>

        {Object.entries(questions).map(([key, question], index) => (
          <div key={key} className="likert-question">
            <div className="question-number">{index + 1} of {Object.keys(questions).length}</div>

            <p className="question-text"><strong>{question.question}</strong></p>
            <p className="question-description">{question.description}</p>

            <div className="likert-scale compact">
              {[1, 2, 3, 4, 5, 6, 7].map(value => (
                <div key={value} className="likert-option">
                  <input
                    type="radio"
                    id={`${key}_${value}`}
                    name={key}
                    value={value}
                    checked={responses[key] === value}
                    onChange={() => handleResponse(key, value)}
                  />
                  <label htmlFor={`${key}_${value}`}>
                    <div className="radio-circle"></div>
                    <span className="scale-value">{value}</span>
                    {(value === 1 || value === 4 || value === 7) && (
                      <span className="scale-label">{scaleLabels[value - 1]}</span>
                    )}
                  </label>
                </div>
              ))}
            </div>
            {responses[key] && (
              <div className="selected-response">
                Selected: {responses[key]} - {scaleLabels[responses[key] - 1]}
              </div>
            )}
          </div>
        ))}

        <div className="open-response">
          <h3>What could be improved about the alert system?</h3>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Please describe any improvements you would suggest..."
            rows="4"
          />
        </div>

        {allQuestionsAnswered && (
          <div className="score-preview">
            <h4>Effectiveness Score</h4>
            <div className="score-value">
              {calculateEffectivenessScore().toFixed(2)} / 7.00
            </div>
          </div>
        )}
      </div>

      <div className="survey-actions">
        {onBack && (
          <button className="btn btn-secondary" onClick={onBack}>
            Back
          </button>
        )}
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={!allQuestionsAnswered}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default EffectivenessSurvey;
