import React from 'react';
import './Instructions.css';

function Instructions({ onContinue }) {
    return (
        <div className="instructions-container">
            <div className="instructions-card">
                <h1>Experiment Instructions</h1>
                <p>Welcome to the Air Traffic Control Adaptive Alert Research Experiment.</p>
                <p>Your task is to manage air traffic safely and efficiently. You will be presented with various scenarios and may receive alerts to assist you.</p>
                <p>Please read the following carefully:</p>
                <ul>
                    <li><strong>Objective:</strong> Guide all aircraft to their destinations without conflicts or delays.</li>
                    <li><strong>Alerts:</strong> Pay attention to any alerts that appear. They are designed to help you.</li>
                    <li><strong>Interaction:</strong> Use the provided interface to issue commands to aircraft.</li>
                    <li><strong>Data Collection:</strong> Your interactions and performance will be recorded for research purposes. All data will be anonymized.</li>
                </ul>
                <p>If you have any questions, please ask the researcher now.</p>
                <p>When you are ready, click the button below to begin the experiment.</p>
                <button className="continue-button" onClick={onContinue}>
                    Continue to Experiment
                </button>
            </div>
        </div>
    );
}

export default Instructions;
