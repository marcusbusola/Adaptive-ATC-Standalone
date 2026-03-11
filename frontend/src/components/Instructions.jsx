import React from 'react';
import './Instructions.css';

/**
 * Dynamic Instructions Component
 *
 * Displays condition-specific instructions for the ATC experiment.
 * - Condition 1: Traditional Modal Alerts
 * - Condition 2: Rule-Based Adaptive Alerts
 * - Condition 3: ML-Based Predictive Alerts
 */
function Instructions({ onContinue, condition = 1 }) {

    // Condition-specific alert descriptions
    const getAlertDescription = () => {
        switch (condition) {
            case 1:
                return {
                    title: "Traditional Alert System",
                    description: "You will receive standard modal alerts that require acknowledgment.",
                    characteristics: [
                        "Alerts will appear as pop-up windows in the center of your screen",
                        "Each alert requires you to acknowledge it before continuing",
                        "Alerts will include an audio notification to get your attention",
                        "You can briefly peek at the radar while an alert is displayed",
                        "Unresolved issues will trigger repeated alerts"
                    ],
                    tips: [
                        "Read each alert carefully before acknowledging",
                        "Take appropriate action based on the alert information",
                        "Keep track of ongoing situations even after acknowledging alerts"
                    ]
                };
            case 2:
                return {
                    title: "Adaptive Alert System",
                    description: "You will receive non-blocking banner alerts that vary by priority.",
                    characteristics: [
                        "Alerts appear as banners at the top of your screen",
                        "You can continue monitoring traffic while alerts are displayed",
                        "Critical alerts stay visible until acknowledged",
                        "Lower priority alerts may auto-dismiss after 10-15 seconds",
                        "Alerts include recommended actions when appropriate"
                    ],
                    tips: [
                        "Keep monitoring the radar while reading alert banners",
                        "Use the recommended actions as guidance",
                        "Don't ignore auto-dismissed alerts - check if action is needed"
                    ]
                };
            case 3:
                return {
                    title: "ML Predictive Alert System",
                    description: "AI-powered alerts that adapt based on your attention patterns.",
                    characteristics: [
                        "Alerts appear as non-blocking banners with confidence scores",
                        "The system monitors your mouse movement and interaction patterns",
                        "Alerts may include explanations of why they were triggered",
                        "Visual highlighting may appear on the radar for flagged aircraft",
                        "Alert intensity increases if you appear to be idle"
                    ],
                    tips: [
                        "Pay attention to the confidence percentage shown on alerts",
                        "If you see radar highlighting, investigate that area",
                        "The system may nudge you if it detects potential inattention",
                        "Respond promptly to prevent alert escalation"
                    ]
                };
            default:
                return {
                    title: "Alert System",
                    description: "You will receive alerts to assist you during the scenario.",
                    characteristics: ["Alerts will appear to help you manage traffic safely"],
                    tips: ["Pay attention to all alerts and take appropriate action"]
                };
        }
    };

    const alertInfo = getAlertDescription();

    return (
        <div className="instructions-container">
            <div className="instructions-card">
                <h1>Experiment Instructions</h1>

                <section className="instructions-section">
                    <h2>Welcome</h2>
                    <p>Welcome to the Air Traffic Control Adaptive Alert Research Experiment.</p>
                    <p>Your task is to manage air traffic safely and efficiently. You will be presented with various scenarios and will receive alerts to assist you.</p>
                </section>

                <section className="instructions-section">
                    <h2>Your Objectives</h2>
                    <ul>
                        <li><strong>Safety First:</strong> Maintain safe separation between all aircraft</li>
                        <li><strong>Respond to Emergencies:</strong> Handle any emergency situations promptly</li>
                        <li><strong>Monitor All Traffic:</strong> Keep awareness of all aircraft in your sector</li>
                        <li><strong>Use the Interface:</strong> Issue commands using the action panel on the right</li>
                    </ul>
                </section>

                <section className="instructions-section alert-info-section">
                    <h2>{alertInfo.title}</h2>
                    <p className="alert-description">{alertInfo.description}</p>

                    <h3>How Alerts Work</h3>
                    <ul>
                        {alertInfo.characteristics.map((item, index) => (
                            <li key={index}>{item}</li>
                        ))}
                    </ul>

                    <h3>Tips for Success</h3>
                    <ul className="tips-list">
                        {alertInfo.tips.map((tip, index) => (
                            <li key={index}>{tip}</li>
                        ))}
                    </ul>
                </section>

                <section className="instructions-section">
                    <h2>Data Collection Notice</h2>
                    <p>Your interactions and performance will be recorded for research purposes. All data will be anonymized and used only for scientific analysis.</p>
                </section>

                <section className="instructions-section">
                    <p className="ready-text">If you have any questions, please ask the researcher now.</p>
                    <p className="ready-text"><strong>When you are ready, click the button below to begin.</strong></p>
                </section>

                <button className="continue-button" onClick={onContinue}>
                    Continue to Experiment
                </button>
            </div>
        </div>
    );
}

export default Instructions;
