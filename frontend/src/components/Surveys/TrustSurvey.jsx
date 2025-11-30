import React, { useState } from 'react';
import '../../styles/surveys.css';

/**
 * Trust in Automation Survey
 *
 * Measures participant trust in the alert system across multiple dimensions.
 * Based on validated trust in automation scales.
 */
const TrustSurvey = ({ onComplete, onBack, sessionId, condition }) => {
  const [responses, setResponses] = useState({
    overall_trust: null,
    reliability: null,
    predictability: null,
    dependability: null,
    usefulness: null,
    understanding: null,
    transparency: null
  });

  const [comments, setComments] = useState('');

  const questions = {
    overall_trust: {
      label: 'Overall Trust',
      question: 'How much do you trust the alert system?',
      description: 'Overall, how much trust do you have in the system to help you perform the task?'
    },
    reliability: {
      label: 'Reliability',
      question: 'How reliable was the alert system?',
      description: 'The system always provided accurate and timely alerts when needed.'
    },
    predictability: {
      label: 'Predictability',
      question: 'How predictable was the alert system?',
      description: 'The system\'s behavior was consistent and predictable throughout the task.'
    },
    dependability: {
      label: 'Dependability',
      question: 'How dependable was the alert system?',
      description: 'I could depend on the system to alert me to important situations.'
    },
    usefulness: {
      label: 'Usefulness',
      question: 'How useful were the alerts?',
      description: 'The alerts helped me make better decisions and manage the traffic.'
    },
    understanding: {
      label: 'Understanding',
      question: 'How well did you understand the alerts?',
      description: 'I understood why the system generated each alert and what I should do.'
    },
    transparency: {
      label: 'Transparency',
      question: 'How transparent was the alert system?',
      description: 'The system clearly communicated its reasoning and confidence level.'
    }
  };

  // Scale labels (1-7 Likert scale)
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
      survey_type: 'Trust in Automation',
      condition,
      responses,
      trust_score: calculateTrustScore(),
      comments,
      completed_at: new Date().toISOString()
    };

    onComplete(surveyData);
  };

  const calculateTrustScore = () => {
    const values = Object.values(responses).filter(v => v !== null);
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  };

  const allQuestionsAnswered = Object.values(responses).every(v => v !== null);

  return (
    <div className="survey-container trust-survey">
      <div className="survey-header">
        <h1>Trust in Alert System</h1>
        <p className="survey-subtitle">
          Please rate your agreement with the following statements
        </p>
        <div className="progress-indicator">
          {Object.values(responses).filter(v => v !== null).length} / {Object.keys(questions).length} completed
        </div>
      </div>

      <div className="survey-content">
        <div className="survey-instructions">
          <h3>Instructions</h3>
          <p>
            Please indicate how much you agree or disagree with each statement about
            the alert system you just used. Use the 1-7 scale where:
          </p>
          <ul>
            <li><strong>1 = Strongly Disagree</strong></li>
            <li><strong>4 = Neutral</strong></li>
            <li><strong>7 = Strongly Agree</strong></li>
          </ul>
        </div>

        {Object.entries(questions).map(([key, question]) => (
          <div key={key} className="likert-question">
            <div className="question-header">
              <h3>{question.label}</h3>
              {responses[key] && (
                <span className="selected-value">
                  {responses[key]} - {scaleLabels[responses[key] - 1]}
                </span>
              )}
            </div>

            <p className="question-text">{question.description}</p>

            <div className="likert-scale">
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
                    <span className="scale-label">{scaleLabels[value - 1]}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Optional Comments */}
        <div className="open-response">
          <h3>Additional Comments (Optional)</h3>
          <p>Please share any additional thoughts about your trust in the alert system:</p>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Your comments here..."
            rows="4"
          />
        </div>

        {/* Trust Score Preview */}
        {allQuestionsAnswered && (
          <div className="score-preview">
            <h4>Your Trust Score</h4>
            <div className="score-value">
              {calculateTrustScore().toFixed(2)} / 7.00
            </div>
            <p className="score-interpretation">
              {calculateTrustScore() < 3 && 'Low trust'}
              {calculateTrustScore() >= 3 && calculateTrustScore() < 5 && 'Moderate trust'}
              {calculateTrustScore() >= 5 && calculateTrustScore() < 6 && 'High trust'}
              {calculateTrustScore() >= 6 && 'Very high trust'}
            </p>
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

export default TrustSurvey;
