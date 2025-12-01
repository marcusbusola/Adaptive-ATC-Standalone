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
                    description: "You will receive context-aware banner alerts that adapt to the situation.",
                    characteristics: [
                        "Alerts appear as non-blocking banners at the top of your screen",
                        "You can continue working while alerts are displayed",
                        "Alert presentation adapts based on current workload and context",
                        "Critical alerts include audio; routine alerts are visual only",
                        "Alerts include recommended actions when appropriate"
                    ],
                    tips: [
                        "Monitor the alert banners while managing traffic",
                        "Use the recommended actions as guidance",
                        "Alerts will auto-dismiss for non-critical issues, but stay aware"
                    ]
                };
            case 3:
                return {
                    title: "ML Predictive Alert System",
                    description: "You will receive AI-powered predictive alerts that anticipate issues before they occur.",
                    characteristics: [
                        "Alerts appear as non-blocking banners with confidence scores",
                        "The system predicts potential issues 30-60 seconds in advance",
                        "Each prediction includes an explanation of why it was flagged",
                        "Relevant areas on the radar will be highlighted",
                        "You can accept or reject predictions to help improve the system"
                    ],
                    tips: [
                        "Pay attention to the confidence percentage - higher means more certain",
                        "Click 'Why is this flagged?' to understand the prediction reasoning",
                        "If you act on a prediction early, the follow-up alert may be prevented",
                        "Your feedback (accept/reject) helps the system learn"
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
