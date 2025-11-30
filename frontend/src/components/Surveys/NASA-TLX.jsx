import React, { useState } from 'react';
import '../../styles/surveys.css';

/**
 * NASA Task Load Index (NASA-TLX) Survey
 *
 * Standard subjective workload assessment tool with 6 dimensions.
 * Scores range from 0-100 with optional weighted scoring.
 *
 * Reference: Hart, S. G., & Staveland, L. E. (1988)
 */
const NASATLX = ({ onComplete, onBack, sessionId, phase = 'post-session' }) => {
  const [ratings, setRatings] = useState({
    mental_demand: 50,
    physical_demand: 50,
    temporal_demand: 50,
    performance: 50,
    effort: 50,
    frustration: 50
  });

  const [useWeighting, setUseWeighting] = useState(false);
  const [pairwiseComparisons, setPairwiseComparisons] = useState({});
  const [showWeighting, setShowWeighting] = useState(false);

  // NASA-TLX dimension definitions
  const dimensions = {
    mental_demand: {
      label: 'Mental Demand',
      description: 'How mentally demanding was the task?',
      lowAnchor: 'Very Low',
      highAnchor: 'Very High',
      explanation: 'How much mental and perceptual activity was required (e.g., thinking, deciding, calculating, remembering, looking, searching)? Was the task easy or demanding, simple or complex, exacting or forgiving?'
    },
    physical_demand: {
      label: 'Physical Demand',
      description: 'How physically demanding was the task?',
      lowAnchor: 'Very Low',
      highAnchor: 'Very High',
      explanation: 'How much physical activity was required (e.g., pushing, pulling, turning, controlling, activating)? Was the task easy or demanding, slow or brisk, slack or strenuous, restful or laborious?'
    },
    temporal_demand: {
      label: 'Temporal Demand',
      description: 'How hurried or rushed was the pace of the task?',
      lowAnchor: 'Very Low',
      highAnchor: 'Very High',
      explanation: 'How much time pressure did you feel due to the rate or pace at which the tasks or task elements occurred? Was the pace slow and leisurely or rapid and frantic?'
    },
    performance: {
      label: 'Performance',
      description: 'How successful were you in accomplishing what you were asked to do?',
      lowAnchor: 'Perfect',
      highAnchor: 'Failure',
      explanation: 'How successful do you think you were in accomplishing the goals of the task set by the researcher? How satisfied were you with your performance in accomplishing these goals?',
      reversed: true
    },
    effort: {
      label: 'Effort',
      description: 'How hard did you have to work to accomplish your level of performance?',
      lowAnchor: 'Very Low',
      highAnchor: 'Very High',
      explanation: 'How hard did you have to work (mentally and physically) to accomplish your level of performance?'
    },
    frustration: {
      label: 'Frustration',
      description: 'How insecure, discouraged, irritated, stressed, or annoyed were you?',
      lowAnchor: 'Very Low',
      highAnchor: 'Very High',
      explanation: 'How insecure, discouraged, irritated, stressed, and annoyed versus secure, gratified, content, relaxed, and complacent did you feel during the task?'
    }
  };

  // Pairwise comparison pairs for weighted NASA-TLX
  const comparisonPairs = [
    ['mental_demand', 'physical_demand'],
    ['mental_demand', 'temporal_demand'],
    ['mental_demand', 'performance'],
    ['mental_demand', 'effort'],
    ['mental_demand', 'frustration'],
    ['physical_demand', 'temporal_demand'],
    ['physical_demand', 'performance'],
    ['physical_demand', 'effort'],
    ['physical_demand', 'frustration'],
    ['temporal_demand', 'performance'],
    ['temporal_demand', 'effort'],
    ['temporal_demand', 'frustration'],
    ['performance', 'effort'],
    ['performance', 'frustration'],
    ['effort', 'frustration']
  ];

  const handleRatingChange = (dimension, value) => {
    setRatings(prev => ({ ...prev, [dimension]: parseInt(value) }));
  };

  const handleComparisonChange = (pair, selected) => {
    setPairwiseComparisons(prev => ({
      ...prev,
      [`${pair[0]}_vs_${pair[1]}`]: selected
    }));
  };

  const calculateWeights = () => {
    const weights = {
      mental_demand: 0,
      physical_demand: 0,
      temporal_demand: 0,
      performance: 0,
      effort: 0,
      frustration: 0
    };

    // Count how many times each dimension was selected
    Object.entries(pairwiseComparisons).forEach(([key, selected]) => {
      weights[selected]++;
    });

    // Normalize to weights that sum to 1
    const total = 15; // Total number of comparisons
    Object.keys(weights).forEach(dim => {
      weights[dim] = weights[dim] / total;
    });

    return weights;
  };

  const calculateScore = () => {
    if (useWeighting && Object.keys(pairwiseComparisons).length === 15) {
      // Weighted NASA-TLX
      const weights = calculateWeights();
      let weightedSum = 0;

      Object.keys(ratings).forEach(dim => {
        weightedSum += ratings[dim] * weights[dim];
      });

      return weightedSum;
    } else {
      // Raw NASA-TLX (unweighted average)
      const sum = Object.values(ratings).reduce((acc, val) => acc + val, 0);
      return sum / 6;
    }
  };

  const handleSubmit = () => {
    const score = calculateScore();
    const weights = useWeighting ? calculateWeights() : null;

    const surveyData = {
      survey_type: 'NASA-TLX',
      phase,
      ratings,
      raw_tlx: Object.values(ratings).reduce((acc, val) => acc + val, 0) / 6,
      weighted_tlx: useWeighting ? score : null,
      weights,
      pairwise_comparisons: useWeighting ? pairwiseComparisons : null,
      completed_at: new Date().toISOString()
    };

    onComplete(surveyData);
  };

  const allRatingsComplete = Object.values(ratings).every(v => v !== null);
  const allComparisonsComplete = !useWeighting ||
    (showWeighting && Object.keys(pairwiseComparisons).length === 15);

  return (
    <div className="survey-container nasa-tlx">
      <div className="survey-header">
        <h1>NASA Task Load Index (NASA-TLX)</h1>
        <p className="survey-subtitle">
          Subjective Workload Assessment
        </p>
        <div className="progress-indicator">
          Step {showWeighting ? '2' : '1'} of {useWeighting ? '2' : '1'}
        </div>
      </div>

      <div className="survey-content">
        {!showWeighting ? (
          <>
            {/* Rating Scales Section */}
            <div className="survey-instructions">
              <h3>Instructions</h3>
              <p>
                Please rate your experience during the task on the following six dimensions.
                Use the sliders to indicate your rating from 0 to 100.
              </p>
            </div>

            {Object.entries(dimensions).map(([key, dimension]) => (
              <div key={key} className="nasa-tlx-dimension">
                <div className="dimension-header">
                  <h3>{dimension.label}</h3>
                  <div className="dimension-value">{ratings[key]}</div>
                </div>

                <p className="dimension-description">
                  <strong>{dimension.description}</strong>
                </p>

                <div className="dimension-explanation">
                  {dimension.explanation}
                </div>

                <div className="slider-container">
                  <div className="slider-labels">
                    <span className="slider-label-left">{dimension.lowAnchor}</span>
                    <span className="slider-label-right">{dimension.highAnchor}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={ratings[key]}
                    onChange={(e) => handleRatingChange(key, e.target.value)}
                    className="nasa-tlx-slider"
                  />
                  <div className="slider-markers">
                    {[0, 25, 50, 75, 100].map(marker => (
                      <span key={marker} className="marker">{marker}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* Weighting Option */}
            <div className="weighting-option">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={useWeighting}
                  onChange={(e) => setUseWeighting(e.target.checked)}
                />
                <span>
                  Use weighted NASA-TLX (requires pairwise comparisons)
                </span>
              </label>
              <p className="help-text">
                Weighted NASA-TLX provides more personalized workload assessment
                by considering which dimensions were most important to you.
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Pairwise Comparisons Section */}
            <div className="survey-instructions">
              <h3>Pairwise Comparisons</h3>
              <p>
                For each pair, select which factor was more important in contributing
                to your workload during the task.
              </p>
            </div>

            <div className="pairwise-comparisons">
              {comparisonPairs.map((pair, index) => (
                <div key={index} className="comparison-pair">
                  <div className="comparison-number">{index + 1} of 15</div>
                  <div className="comparison-options">
                    <button
                      className={`comparison-button ${
                        pairwiseComparisons[`${pair[0]}_vs_${pair[1]}`] === pair[0] ? 'selected' : ''
                      }`}
                      onClick={() => handleComparisonChange(pair, pair[0])}
                    >
                      {dimensions[pair[0]].label}
                    </button>
                    <span className="comparison-vs">vs</span>
                    <button
                      className={`comparison-button ${
                        pairwiseComparisons[`${pair[0]}_vs_${pair[1]}`] === pair[1] ? 'selected' : ''
                      }`}
                      onClick={() => handleComparisonChange(pair, pair[1])}
                    >
                      {dimensions[pair[1]].label}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="comparison-progress">
              {Object.keys(pairwiseComparisons).length} of 15 comparisons completed
            </div>
          </>
        )}
      </div>

      {/* Survey Score Preview */}
      {allRatingsComplete && !showWeighting && (
        <div className="score-preview">
          <h4>Your Workload Score</h4>
          <div className="score-value">
            {calculateScore().toFixed(1)} / 100
          </div>
          <p className="score-interpretation">
            {calculateScore() < 30 && 'Low workload'}
            {calculateScore() >= 30 && calculateScore() < 60 && 'Moderate workload'}
            {calculateScore() >= 60 && calculateScore() < 80 && 'High workload'}
            {calculateScore() >= 80 && 'Very high workload'}
          </p>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="survey-actions">
        {onBack && (
          <button className="btn btn-secondary" onClick={onBack}>
            Back
          </button>
        )}

        {!showWeighting ? (
          <button
            className="btn btn-primary"
            onClick={() => {
              if (useWeighting) {
                setShowWeighting(true);
              } else {
                handleSubmit();
              }
            }}
            disabled={!allRatingsComplete}
          >
            {useWeighting ? 'Continue to Comparisons' : 'Submit'}
          </button>
        ) : (
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setShowWeighting(false)}
            >
              Back to Ratings
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!allComparisonsComplete}
            >
              Submit
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default NASATLX;
