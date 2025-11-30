"""
ML Complacency Classifier for ATC Adaptive Alert System

Lightweight ML classifier for detecting cognitive tunneling and complacency
in air traffic controllers during high-workload scenarios.

Key Features:
- Random Forest with 100 trees, max depth 5
- 4 core features + up to 3 scenario-specific features
- Inference time: <50ms
- Pre-trained on synthetic behavioral data

Performance Targets:
- F1-score: >0.60
- Precision: >0.70
- False positive rate: <0.15
- Inference time: <50ms

Author: ATC Adaptive Alert Research System
Version: 1.0.0
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report
from typing import Dict, Optional, Tuple, Any
import pickle
import time
from pathlib import Path
from dataclasses import dataclass
import warnings
warnings.filterwarnings('ignore')


@dataclass
class BehavioralState:
    """
    Behavioral state representation for ML prediction

    Attributes:
        peripheral_neglect_max: Maximum neglect duration across all AOIs (seconds)
        interaction_entropy: Shannon entropy of click distribution
        crisis_fixation_ratio: Proportion of time spent on crisis aircraft
        mouse_velocity_variance: Variance of mouse movement speed
        scenario_features: Optional scenario-specific features
    """
    peripheral_neglect_max: float  # seconds
    interaction_entropy: float  # 0.0 to ~3.0 (Shannon entropy)
    crisis_fixation_ratio: float  # 0.0 to 1.0
    mouse_velocity_variance: float  # pixels/sec variance
    scenario_features: Optional[Dict[str, float]] = None

    def to_dict(self) -> Dict[str, float]:
        """Convert to dictionary for feature extraction"""
        features = {
            'peripheral_neglect_max': self.peripheral_neglect_max,
            'interaction_entropy': self.interaction_entropy,
            'crisis_fixation_ratio': self.crisis_fixation_ratio,
            'mouse_velocity_variance': self.mouse_velocity_variance
        }

        if self.scenario_features:
            features.update(self.scenario_features)

        return features


class MLComplacencyClassifier:
    """
    ML-based complacency classifier using Random Forest

    Detects cognitive tunneling patterns from behavioral features.
    Optimized for real-time inference (<50ms).
    """

    def __init__(self, model_path: Optional[str] = None):
        """
        Initialize ML complacency classifier

        Args:
            model_path: Path to pre-trained model file (optional)
        """
        # Random Forest configuration (optimized for speed)
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=5,  # Shallow trees for fast inference
            min_samples_split=10,
            min_samples_leaf=5,
            random_state=42,
            n_jobs=-1,  # Parallel processing
            class_weight='balanced'
        )

        self.is_trained = False
        self.feature_names = None

        # Performance metrics
        self.metrics = {
            'accuracy': None,
            'precision': None,
            'recall': None,
            'f1_score': None,
            'false_positive_rate': None
        }

        # Scenario-specific feature definitions
        self.scenario_feature_map = {
            'L1': ['communication_frequency'],
            'L3': ['manual_check_frequency', 'scan_thoroughness'],
            'H5': ['multi_crisis_attention_distribution']
        }

        # Load pre-trained model if provided
        if model_path and Path(model_path).exists():
            self.load_model(model_path)

    def train(self, X: np.ndarray, y: np.ndarray, test_size: float = 0.2) -> Dict[str, float]:
        """
        Train the classifier on labeled data

        Args:
            X: Feature matrix (n_samples, n_features)
            y: Binary labels (0=normal, 1=tunneling)
            test_size: Proportion of data for testing

        Returns:
            Dictionary of performance metrics
        """
        print("\n" + "="*60)
        print("Training ML Complacency Classifier")
        print("="*60 + "\n")

        # Store feature names
        if hasattr(X, 'columns'):
            self.feature_names = list(X.columns)
            X = X.values
        else:
            # Default feature names
            self.feature_names = [
                'peripheral_neglect_max',
                'interaction_entropy',
                'crisis_fixation_ratio',
                'mouse_velocity_variance'
            ]

        print(f"Features: {len(self.feature_names)}")
        print(f"Samples: {len(X)}")
        print(f"Tunneling samples: {sum(y)} ({sum(y)/len(y)*100:.1f}%)")
        print(f"Normal samples: {len(y) - sum(y)} ({(len(y)-sum(y))/len(y)*100:.1f}%)")

        # Train-test split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=test_size,
            random_state=42,
            stratify=y
        )

        print(f"\nTraining on {len(X_train)} samples...")

        # Measure training time
        start_time = time.time()
        self.model.fit(X_train, y_train)
        training_time = time.time() - start_time

        print(f"Training completed in {training_time:.2f}s")

        # Evaluate on test set
        print("\nEvaluating on test set...")

        # Measure inference time
        start_time = time.time()
        y_pred = self.model.predict(X_test)
        inference_time = (time.time() - start_time) / len(X_test) * 1000  # ms per sample

        y_pred_proba = self.model.predict_proba(X_test)[:, 1]

        # Calculate metrics
        self.metrics['accuracy'] = accuracy_score(y_test, y_pred)
        self.metrics['precision'] = precision_score(y_test, y_pred, zero_division=0)
        self.metrics['recall'] = recall_score(y_test, y_pred, zero_division=0)
        self.metrics['f1_score'] = f1_score(y_test, y_pred, zero_division=0)

        # False positive rate
        tn = sum((y_test == 0) & (y_pred == 0))
        fp = sum((y_test == 0) & (y_pred == 1))
        self.metrics['false_positive_rate'] = fp / (fp + tn) if (fp + tn) > 0 else 0.0

        # Display results
        print("\n" + "="*60)
        print("Performance Metrics")
        print("="*60)
        print(f"Accuracy:            {self.metrics['accuracy']:.4f}")
        print(f"Precision:           {self.metrics['precision']:.4f} (target: >0.70)")
        print(f"Recall:              {self.metrics['recall']:.4f}")
        print(f"F1-Score:            {self.metrics['f1_score']:.4f} (target: >0.60)")
        print(f"False Positive Rate: {self.metrics['false_positive_rate']:.4f} (target: <0.15)")
        print(f"Inference Time:      {inference_time:.2f}ms (target: <50ms)")

        # Check if targets met
        print("\n" + "="*60)
        print("Target Validation")
        print("="*60)

        targets_met = []
        targets_met.append(("F1-Score > 0.60", self.metrics['f1_score'] > 0.60))
        targets_met.append(("Precision > 0.70", self.metrics['precision'] > 0.70))
        targets_met.append(("FPR < 0.15", self.metrics['false_positive_rate'] < 0.15))
        targets_met.append(("Inference < 50ms", inference_time < 50))

        for target, met in targets_met:
            status = "✓" if met else "✗"
            print(f"{status} {target}")

        # Feature importance
        print("\n" + "="*60)
        print("Feature Importance")
        print("="*60)

        importances = self.model.feature_importances_
        for i, (feature, importance) in enumerate(zip(self.feature_names, importances)):
            print(f"{feature:40} {importance:.4f}")

        # Classification report
        print("\n" + "="*60)
        print("Classification Report")
        print("="*60)
        print(classification_report(
            y_test, y_pred,
            target_names=['Normal', 'Tunneling'],
            digits=4
        ))

        self.is_trained = True

        print("✓ Training complete!\n")

        return self.metrics

    def predict_proba(
        self,
        features: BehavioralState,
        scenario_id: str = None
    ) -> Tuple[float, float]:
        """
        Predict tunneling probability with confidence score

        Args:
            features: BehavioralState object with extracted features
            scenario_id: Scenario identifier for scenario-specific features

        Returns:
            Tuple of (probability, confidence)
            - probability: P(tunneling) in [0, 1]
            - confidence: Confidence score in [0, 1]
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")

        # Extract feature vector
        feature_dict = features.to_dict()

        # Add scenario-specific features if available
        if scenario_id and scenario_id in self.scenario_feature_map:
            expected_features = self.scenario_feature_map[scenario_id]
            for feature_name in expected_features:
                if feature_name not in feature_dict:
                    # Use default value if not provided
                    feature_dict[feature_name] = 0.0

        # Convert to array in correct order
        feature_vector = np.array([
            feature_dict.get(name, 0.0) for name in self.feature_names
        ]).reshape(1, -1)

        # Predict
        start_time = time.time()
        probabilities = self.model.predict_proba(feature_vector)[0]
        inference_time = (time.time() - start_time) * 1000  # ms

        # Probability of tunneling (class 1)
        prob_tunneling = float(probabilities[1])

        # Calculate confidence
        confidence = self.calculate_confidence(prob_tunneling)

        # Optional: Log inference time warning
        if inference_time > 50:
            print(f"⚠ Warning: Inference time {inference_time:.2f}ms exceeds 50ms target")

        return prob_tunneling, confidence

    def calculate_confidence(self, prob: float) -> float:
        """
        Calculate confidence score from probability

        Confidence is based on distance from decision boundary (0.5):
        - prob = 0.5 → confidence = 0.0 (maximum uncertainty)
        - prob = 0.0 or 1.0 → confidence = 1.0 (maximum certainty)

        Args:
            prob: Predicted probability

        Returns:
            Confidence score in [0, 1]
        """
        confidence = abs(prob - 0.5) * 2
        return float(confidence)

    def save_model(self, path: str):
        """
        Save trained model to file

        Args:
            path: File path for saving model
        """
        if not self.is_trained:
            raise ValueError("Cannot save untrained model")

        model_data = {
            'model': self.model,
            'feature_names': self.feature_names,
            'metrics': self.metrics,
            'scenario_feature_map': self.scenario_feature_map,
            'version': '1.0.0'
        }

        # Create directory if needed
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, 'wb') as f:
            pickle.dump(model_data, f)

        print(f"✓ Model saved to: {path}")

    def load_model(self, path: str):
        """
        Load pre-trained model from file

        Args:
            path: File path to model
        """
        path = Path(path)

        if not path.exists():
            raise FileNotFoundError(f"Model file not found: {path}")

        with open(path, 'rb') as f:
            model_data = pickle.load(f)

        self.model = model_data['model']
        self.feature_names = model_data['feature_names']
        self.metrics = model_data['metrics']
        self.scenario_feature_map = model_data.get('scenario_feature_map', {})

        self.is_trained = True

        print(f"✓ Model loaded from: {path}")
        print(f"  Features: {len(self.feature_names)}")
        print(f"  F1-Score: {self.metrics['f1_score']:.4f}")
        print(f"  Precision: {self.metrics['precision']:.4f}")

    def get_model_info(self) -> Dict[str, Any]:
        """
        Get model information and metadata

        Returns:
            Dictionary with model details
        """
        return {
            'is_trained': self.is_trained,
            'model_type': 'RandomForestClassifier',
            'n_estimators': 100,
            'max_depth': 5,
            'feature_names': self.feature_names,
            'n_features': len(self.feature_names) if self.feature_names else 0,
            'metrics': self.metrics,
            'scenario_feature_map': self.scenario_feature_map
        }


def generate_synthetic_training_data(n_samples: int = 1000) -> pd.DataFrame:
    """
    Generate synthetic behavioral data for training

    Creates realistic behavioral patterns for:
    - Normal attention (class 0)
    - Tunneling/complacency (class 1)

    Args:
        n_samples: Total number of samples to generate

    Returns:
        DataFrame with features and labels
    """
    np.random.seed(42)

    samples = []

    # Normal attention patterns (class 0)
    print(f"Generating {n_samples // 2} normal attention samples...")
    for _ in range(n_samples // 2):
        samples.append({
            'peripheral_neglect_max': np.random.uniform(5, 25),  # 5-25 seconds
            'interaction_entropy': np.random.uniform(1.2, 2.0),  # High entropy (diverse)
            'crisis_fixation_ratio': np.random.uniform(0.2, 0.5),  # Low fixation (20-50%)
            'mouse_velocity_variance': np.random.uniform(800, 1200),  # Normal variance
            'label': 0
        })

    # Tunneling/complacency patterns (class 1)
    print(f"Generating {n_samples // 2} tunneling samples...")
    for _ in range(n_samples // 2):
        samples.append({
            'peripheral_neglect_max': np.random.uniform(35, 60),  # 35-60 seconds (long neglect)
            'interaction_entropy': np.random.uniform(0.0, 0.7),  # Low entropy (repetitive)
            'crisis_fixation_ratio': np.random.uniform(0.7, 0.95),  # High fixation (70-95%)
            'mouse_velocity_variance': np.random.uniform(200, 600),  # Low variance (monotonous)
            'label': 1
        })

    df = pd.DataFrame(samples)

    # Shuffle
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)

    print(f"✓ Generated {len(df)} synthetic samples")
    print(f"  Class distribution: {df['label'].value_counts().to_dict()}")

    return df


def train_default_model(save_path: str = None) -> MLComplacencyClassifier:
    """
    Train default complacency classifier on synthetic data

    Args:
        save_path: Optional path to save trained model

    Returns:
        Trained MLComplacencyClassifier
    """
    print("\n" + "="*60)
    print("Training Default ML Complacency Classifier")
    print("="*60 + "\n")

    # Generate synthetic training data
    data = generate_synthetic_training_data(n_samples=1000)

    # Separate features and labels
    feature_cols = [
        'peripheral_neglect_max',
        'interaction_entropy',
        'crisis_fixation_ratio',
        'mouse_velocity_variance'
    ]

    X = data[feature_cols]
    y = data['label'].values

    # Train classifier
    clf = MLComplacencyClassifier()
    clf.train(X, y)

    # Save if path provided
    if save_path:
        clf.save_model(save_path)

    return clf


# Example usage
if __name__ == '__main__':
    print("\n" + "="*60)
    print("ML Complacency Classifier Demo")
    print("="*60 + "\n")

    # Train default model
    model_path = Path(__file__).parent.parent / 'data' / 'ml_model' / 'complacency_classifier.pkl'

    clf = train_default_model(save_path=str(model_path))

    # Demo prediction
    print("\n" + "="*60)
    print("Demo Prediction")
    print("="*60 + "\n")

    # Normal behavior
    normal_state = BehavioralState(
        peripheral_neglect_max=15.0,
        interaction_entropy=1.8,
        crisis_fixation_ratio=0.35,
        mouse_velocity_variance=1000.0
    )

    prob, conf = clf.predict_proba(normal_state)
    print(f"Normal behavior:")
    print(f"  Tunneling probability: {prob:.3f}")
    print(f"  Confidence: {conf:.3f}")
    print(f"  Classification: {'NORMAL' if prob < 0.5 else 'TUNNELING'}")

    print()

    # Tunneling behavior
    tunneling_state = BehavioralState(
        peripheral_neglect_max=45.0,
        interaction_entropy=0.5,
        crisis_fixation_ratio=0.85,
        mouse_velocity_variance=400.0
    )

    prob, conf = clf.predict_proba(tunneling_state)
    print(f"Tunneling behavior:")
    print(f"  Tunneling probability: {prob:.3f}")
    print(f"  Confidence: {conf:.3f}")
    print(f"  Classification: {'NORMAL' if prob < 0.5 else 'TUNNELING'}")

    print("\n" + "="*60)
    print("Demo Complete")
    print("="*60 + "\n")
