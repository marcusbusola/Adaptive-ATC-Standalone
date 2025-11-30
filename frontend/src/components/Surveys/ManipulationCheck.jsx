import React, { useState } from 'react';
import '../../styles/surveys.css';

/**
 * Manipulation Check Survey
 *
 * Validates that participants perceived and experienced the
 * experimental manipulation as intended. Critical for ensuring
 * internal validity of the study.
 */
const ManipulationCheck = ({ onComplete, onBack, sessionId, condition }) => {
  const [responses, setResponses] = useState({
    // Visibility and attention
    could_see_radar: null,
    could_see_alerts: null,
    read_all_alerts: null,

    // Alert characteristics (condition-specific)
    alerts_blocked_view: null,
    alerts_required_acknowledgment: null,
    alerts_were_adaptive: null,
    alerts_showed_confidence: null,

    // Awareness
    aware_of_all_aircraft: null,
    noticed_emergencies: null,

    // Engagement
    tried_best_effort: null,
    took_task_seriously: null
  });

  const [additionalComments, setAdditionalComments] = useState('');

  // Questions that apply to all conditions
  const commonQuestions = {
    could_see_radar: {
      question: 'Could you see the radar display during alerts?',
      type: 'yesno'
    },
    could_see_alerts: {
      question: 'Could you clearly see and read the alerts when they appeared?',
      type: 'yesno'
    },
    read_all_alerts: {
      question: 'Did you read all the alerts that appeared during the scenario?',
      type: 'yesno'
    },
    aware_of_all_aircraft: {
      question: 'Were you aware of all aircraft in your sector during the scenario?',
      type: 'yesno'
    },
    noticed_emergencies: {
      question: 'Did you notice when emergency situations occurred?',
      type: 'yesno'
    },
    tried_best_effort: {
      question: 'Did you try your best to perform the task well?',
      type: 'yesno'
    },
    took_task_seriously: {
      question: 'Did you take the task seriously and follow the instructions?',
      type: 'yesno'
    }
  };

  // Condition-specific questions
  const conditionQuestions = {
    1: { // Traditional Modal
      alerts_blocked_view: {
        question: 'Did the alerts block your view of the radar?',
        type: 'yesno',
        expectedAnswer: true
      },
      alerts_required_acknowledgment: {
        question: 'Did you have to click a button to acknowledge each alert?',
        type: 'yesno',
        expectedAnswer: true
      }
    },
    2: { // Adaptive
      alerts_were_adaptive: {
        question: 'Did the alert style change based on the situation?',
        type: 'yesno',
        expectedAnswer: true
      },
      alerts_blocked_view: {
        question: 'Did the alerts block your view of the radar?',
        type: 'yesno',
        expectedAnswer: false
      }
    },
    3: { // ML-Based
      alerts_showed_confidence: {
        question: 'Did the alerts show a confidence level or explanation?',
        type: 'yesno',
        expectedAnswer: true
      },
      alerts_were_adaptive: {
        question: 'Did you see visual highlighting on the radar?',
        type: 'yesno',
        expectedAnswer: true
      }
    }
  };

  const getQuestionsForCondition = () => {
    return {
      ...commonQuestions,
      ...(conditionQuestions[condition] || {})
    };
  };

  const handleResponse = (question, value) => {
    setResponses(prev => ({ ...prev, [question]: value }));
  };

  const handleSubmit = () => {
    // Check if manipulation was successful
    const conditionSpecificQs = conditionQuestions[condition] || {};
    const manipulationSuccess = Object.entries(conditionSpecificQs)
      .filter(([_, q]) => q.expectedAnswer !== undefined)
      .every(([key, q]) => responses[key] === q.expectedAnswer);

    const surveyData = {
      survey_type: 'Manipulation Check',
      condition,
      responses,
      manipulation_successful: manipulationSuccess,
      attention_check_passed: responses.tried_best_effort === true && responses.took_task_seriously === true,
      comments: additionalComments,
      completed_at: new Date().toISOString()
    };

    onComplete(surveyData);
  };

  const questions = getQuestionsForCondition();
  const allQuestionsAnswered = Object.keys(questions)
    .every(key => responses[key] !== null);

  return (
    <div className="survey-container manipulation-check">
      <div className="survey-header">
        <h1>Experience Check</h1>
        <p className="survey-subtitle">
          Quick questions about your experience during the task
        </p>
        <div className="progress-indicator">
          {Object.keys(questions).filter(key => responses[key] !== null).length} / {Object.keys(questions).length} completed
        </div>
      </div>

      <div className="survey-content">
        <div className="survey-instructions">
          <h3>Instructions</h3>
          <p>
            Please answer the following questions about what you noticed and
            experienced during the scenario. This helps us ensure the system
            worked correctly.
          </p>
        </div>

        {Object.entries(questions).map(([key, question], index) => (
          <div key={key} className="yesno-question">
            <div className="question-number">{index + 1} of {Object.keys(questions).length}</div>

            <p className="question-text">{question.question}</p>

            <div className="yesno-options">
              <button
                className={`yesno-button ${responses[key] === true ? 'selected yes' : ''}`}
                onClick={() => handleResponse(key, true)}
              >
                <span className="button-label">Yes</span>
              </button>

              <button
                className={`yesno-button ${responses[key] === false ? 'selected no' : ''}`}
                onClick={() => handleResponse(key, false)}
              >
                <span className="button-label">No</span>
              </button>
            </div>
          </div>
        ))}

        <div className="open-response">
          <h3>Additional Comments</h3>
          <p>Did you notice anything unusual or have any technical issues?</p>
          <textarea
            value={additionalComments}
            onChange={(e) => setAdditionalComments(e.target.value)}
            placeholder="Your comments here..."
            rows="3"
          />
        </div>
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

export default ManipulationCheck;
