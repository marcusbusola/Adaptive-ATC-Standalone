import React, { useState } from 'react';
import '../../styles/surveys.css';

/**
 * Demographics Survey (Pre-Session)
 *
 * Collects participant demographics and background information.
 * Optional - participants can skip questions they're uncomfortable answering.
 */
const DemographicsSurvey = ({ onComplete, onSkip }) => {
  const [demographics, setDemographics] = useState({
    age_range: '',
    gender: '',
    education: '',
    atc_experience: '',
    atc_experience_years: '',
    gaming_experience: '',
    computer_proficiency: '',
    vision_correction: ''
  });

  const [optionalInfo, setOptionalInfo] = useState({
    occupation: '',
    aviation_background: '',
    previous_studies: ''
  });

  const handleChange = (field, value) => {
    setDemographics(prev => ({ ...prev, [field]: value }));
  };

  const handleOptionalChange = (field, value) => {
    setOptionalInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    const surveyData = {
      survey_type: 'Demographics',
      phase: 'pre-session',
      demographics,
      optional_info: optionalInfo,
      completed_at: new Date().toISOString()
    };

    onComplete(surveyData);
  };

  // Check if required fields are filled
  const requiredFieldsFilled =
    demographics.age_range &&
    demographics.gender &&
    demographics.education &&
    demographics.atc_experience &&
    demographics.computer_proficiency;

  return (
    <div className="survey-container demographics-survey">
      <div className="survey-header">
        <h1>Participant Information</h1>
        <p className="survey-subtitle">
          Optional demographic information (you may skip questions)
        </p>
      </div>

      <div className="survey-content">
        <div className="survey-instructions">
          <h3>Instructions</h3>
          <p>
            This information helps us understand the diversity of our participant pool.
            All responses are confidential and will be anonymized in publications.
            You may skip any question you're uncomfortable answering.
          </p>
        </div>

        {/* Required Demographics */}
        <div className="form-section">
          <h3>Basic Information</h3>

          <div className="form-field">
            <label htmlFor="age-range">
              Age Range <span className="required">*</span>
            </label>
            <select
              id="age-range"
              value={demographics.age_range}
              onChange={(e) => handleChange('age_range', e.target.value)}
            >
              <option value="">-- Select --</option>
              <option value="18-24">18-24</option>
              <option value="25-34">25-34</option>
              <option value="35-44">35-44</option>
              <option value="45-54">45-54</option>
              <option value="55-64">55-64</option>
              <option value="65+">65+</option>
              <option value="prefer-not-to-say">Prefer not to say</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="gender">
              Gender <span className="required">*</span>
            </label>
            <select
              id="gender"
              value={demographics.gender}
              onChange={(e) => handleChange('gender', e.target.value)}
            >
              <option value="">-- Select --</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non-binary">Non-binary</option>
              <option value="other">Other</option>
              <option value="prefer-not-to-say">Prefer not to say</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="education">
              Highest Education Level <span className="required">*</span>
            </label>
            <select
              id="education"
              value={demographics.education}
              onChange={(e) => handleChange('education', e.target.value)}
            >
              <option value="">-- Select --</option>
              <option value="high-school">High School</option>
              <option value="some-college">Some College</option>
              <option value="bachelors">Bachelor's Degree</option>
              <option value="masters">Master's Degree</option>
              <option value="doctorate">Doctorate</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="computer-proficiency">
              Computer Proficiency <span className="required">*</span>
            </label>
            <select
              id="computer-proficiency"
              value={demographics.computer_proficiency}
              onChange={(e) => handleChange('computer_proficiency', e.target.value)}
            >
              <option value="">-- Select --</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>
        </div>

        {/* ATC Experience */}
        <div className="form-section">
          <h3>Air Traffic Control Experience</h3>

          <div className="form-field">
            <label htmlFor="atc-experience">
              Do you have ATC experience? <span className="required">*</span>
            </label>
            <select
              id="atc-experience"
              value={demographics.atc_experience}
              onChange={(e) => handleChange('atc_experience', e.target.value)}
            >
              <option value="">-- Select --</option>
              <option value="none">No experience</option>
              <option value="training">In training</option>
              <option value="certified">Certified controller</option>
              <option value="retired">Retired controller</option>
              <option value="simulation">Simulation only</option>
            </select>
          </div>

          {demographics.atc_experience && demographics.atc_experience !== 'none' && (
            <div className="form-field">
              <label htmlFor="atc-years">
                Years of ATC experience
              </label>
              <input
                id="atc-years"
                type="number"
                min="0"
                max="50"
                value={demographics.atc_experience_years}
                onChange={(e) => handleChange('atc_experience_years', e.target.value)}
                placeholder="Years"
              />
            </div>
          )}
        </div>

        {/* Optional Background */}
        <div className="form-section">
          <h3>Additional Background (Optional)</h3>

          <div className="form-field">
            <label htmlFor="gaming-experience">
              Gaming Experience
            </label>
            <select
              id="gaming-experience"
              value={demographics.gaming_experience}
              onChange={(e) => handleChange('gaming_experience', e.target.value)}
            >
              <option value="">-- Select --</option>
              <option value="none">No gaming experience</option>
              <option value="casual">Casual gamer</option>
              <option value="regular">Regular gamer</option>
              <option value="competitive">Competitive gamer</option>
            </select>
            <span className="help-text">
              Experience with video games or simulations
            </span>
          </div>

          <div className="form-field">
            <label htmlFor="vision-correction">
              Vision Correction
            </label>
            <select
              id="vision-correction"
              value={demographics.vision_correction}
              onChange={(e) => handleChange('vision_correction', e.target.value)}
            >
              <option value="">-- Select --</option>
              <option value="none">No correction needed</option>
              <option value="glasses">Glasses</option>
              <option value="contacts">Contact lenses</option>
              <option value="surgery">Previous corrective surgery</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="occupation">
              Current Occupation
            </label>
            <input
              id="occupation"
              type="text"
              value={optionalInfo.occupation}
              onChange={(e) => handleOptionalChange('occupation', e.target.value)}
              placeholder="e.g., Software Engineer, Student, etc."
            />
          </div>

          <div className="form-field">
            <label htmlFor="aviation-background">
              Aviation Background
            </label>
            <textarea
              id="aviation-background"
              value={optionalInfo.aviation_background}
              onChange={(e) => handleOptionalChange('aviation_background', e.target.value)}
              placeholder="Any aviation-related experience or training..."
              rows="3"
            />
          </div>

          <div className="form-field">
            <label htmlFor="previous-studies">
              Previous Participation
            </label>
            <select
              id="previous-studies"
              value={optionalInfo.previous_studies}
              onChange={(e) => handleOptionalChange('previous_studies', e.target.value)}
            >
              <option value="">-- Select --</option>
              <option value="none">First time</option>
              <option value="atc-studies">Previous ATC studies</option>
              <option value="other-hci">Other HCI studies</option>
              <option value="multiple">Multiple studies</option>
            </select>
            <span className="help-text">
              Have you participated in similar research studies before?
            </span>
          </div>
        </div>
      </div>

      <div className="survey-actions">
        {onSkip && (
          <button className="btn btn-secondary" onClick={onSkip}>
            Skip Demographics
          </button>
        )}
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={!requiredFieldsFilled}
        >
          {requiredFieldsFilled ? 'Continue' : 'Please complete required fields'}
        </button>
      </div>
    </div>
  );
};

export default DemographicsSurvey;
