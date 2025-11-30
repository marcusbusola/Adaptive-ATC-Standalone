"""
Complacency Detection ML Model for Condition 3 (ML-Based Adaptive Alerts)

This model uses behavioral data to predict controller complacency and attention failures
before they occur, enabling predictive alert presentation.

Features:
- Real-time complacency detection from behavioral patterns
- Predictive alert recommendations
- Confidence scoring
- Risk region identification

Author: ATC Adaptive Alert Research System
Version: 1.0.0
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from typing import Dict, List, Tuple, Optional, Any
import pickle
import json
from pathlib import Path
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')


class BehavioralFeatureExtractor:
    """
    Extracts behavioral features from raw event data for complacency detection
    """

    def __init__(self, window_size: float = 30.0):
        """
        Initialize feature extractor

        Args:
            window_size: Time window in seconds for feature calculation
        """
        self.window_size = window_size

    def extract_features(self, events: List[Dict[str, Any]]) -> Dict[str, float]:
        """
        Extract behavioral features from event stream

        Args:
            events: List of behavioral events with timestamps

        Returns:
            Dictionary of extracted features
        """
        if not events:
            return self._get_default_features()

        # Convert to DataFrame for easier processing
        df = pd.DataFrame(events)

        # Ensure timestamp column exists
        if 'timestamp' not in df.columns:
            return self._get_default_features()

        # Sort by timestamp
        df = df.sort_values('timestamp')

        # Extract features
        features = {
            'mouse_velocity_variance': self._calculate_mouse_velocity_variance(df),
            'interaction_entropy': self._calculate_interaction_entropy(df),
            'peripheral_neglect_duration': self._calculate_peripheral_neglect(df),
            'click_rate': self._calculate_click_rate(df),
            'click_pattern_entropy': self._calculate_click_pattern_entropy(df),
            'dwell_time_variance': self._calculate_dwell_time_variance(df),
            'command_sequence_entropy': self._calculate_command_sequence_entropy(df),
            'hover_stability': self._calculate_hover_stability(df),
            'response_time_trend': self._calculate_response_time_trend(df),
            'activity_level': self._calculate_activity_level(df)
        }

        return features

    def _calculate_mouse_velocity_variance(self, df: pd.DataFrame) -> float:
        """
        Calculate variance in mouse movement velocity

        Low variance = repetitive/monotonous behavior (complacency indicator)
        High variance = active engagement
        """
        mouse_events = df[df['event_type'] == 'mouse_move']

        if len(mouse_events) < 2:
            return 0.0

        # Calculate velocity between consecutive points
        velocities = []
        for i in range(1, len(mouse_events)):
            prev = mouse_events.iloc[i-1]
            curr = mouse_events.iloc[i]

            # Extract coordinates
            prev_data = prev.get('data', {}) if isinstance(prev.get('data'), dict) else {}
            curr_data = curr.get('data', {}) if isinstance(curr.get('data'), dict) else {}

            x1, y1 = prev_data.get('x', 0), prev_data.get('y', 0)
            x2, y2 = curr_data.get('x', 0), curr_data.get('y', 0)

            # Calculate distance and time
            distance = np.sqrt((x2 - x1)**2 + (y2 - y1)**2)
            time_delta = curr['timestamp'] - prev['timestamp']

            if time_delta > 0:
                velocity = distance / time_delta
                velocities.append(velocity)

        if not velocities:
            return 0.0

        return float(np.var(velocities))

    def _calculate_interaction_entropy(self, df: pd.DataFrame) -> float:
        """
        Calculate entropy of interaction types

        Low entropy = repetitive interactions (complacency)
        High entropy = varied interactions (engagement)
        """
        event_types = df['event_type'].value_counts()

        if len(event_types) == 0:
            return 0.0

        # Calculate Shannon entropy
        probabilities = event_types / len(df)
        entropy = -np.sum(probabilities * np.log2(probabilities + 1e-10))

        return float(entropy)

    def _calculate_peripheral_neglect(self, df: pd.DataFrame) -> float:
        """
        Calculate duration of peripheral vision neglect

        High neglect = tunnel vision (complacency indicator)
        """
        mouse_events = df[df['event_type'] == 'mouse_move']

        if len(mouse_events) == 0:
            return 1.0  # Maximum neglect if no mouse movement

        # Assume screen is 1920x1080, periphery is outer 20%
        peripheral_threshold = 0.2
        screen_width = 1920
        screen_height = 1080

        # Calculate time spent in center vs periphery
        center_time = 0.0
        total_time = 0.0

        for i in range(1, len(mouse_events)):
            prev = mouse_events.iloc[i-1]
            curr = mouse_events.iloc[i]

            curr_data = curr.get('data', {}) if isinstance(curr.get('data'), dict) else {}
            x = curr_data.get('x', screen_width / 2)
            y = curr_data.get('y', screen_height / 2)

            time_delta = curr['timestamp'] - prev['timestamp']

            # Check if in center region
            x_normalized = x / screen_width
            y_normalized = y / screen_height

            in_center = (
                peripheral_threshold < x_normalized < (1 - peripheral_threshold) and
                peripheral_threshold < y_normalized < (1 - peripheral_threshold)
            )

            if in_center:
                center_time += time_delta

            total_time += time_delta

        if total_time == 0:
            return 1.0

        # Return proportion of time in center (neglecting periphery)
        return float(center_time / total_time)

    def _calculate_click_rate(self, df: pd.DataFrame) -> float:
        """
        Calculate click rate (clicks per second)

        Low rate = reduced engagement
        """
        click_events = df[df['event_type'] == 'click']

        if len(click_events) == 0:
            return 0.0

        time_span = df['timestamp'].max() - df['timestamp'].min()

        if time_span == 0:
            return 0.0

        return float(len(click_events) / time_span)

    def _calculate_click_pattern_entropy(self, df: pd.DataFrame) -> float:
        """
        Calculate entropy of click locations/targets

        Low entropy = clicking same areas (complacency)
        """
        click_events = df[df['event_type'] == 'click']

        if len(click_events) == 0:
            return 0.0

        # Discretize click locations into grid cells
        grid_size = 100  # pixels
        click_locations = []

        for _, event in click_events.iterrows():
            event_data = event.get('data', {}) if isinstance(event.get('data'), dict) else {}
            x = event_data.get('x', 0)
            y = event_data.get('y', 0)

            # Grid cell
            cell = (x // grid_size, y // grid_size)
            click_locations.append(cell)

        if not click_locations:
            return 0.0

        # Calculate entropy
        location_counts = pd.Series(click_locations).value_counts()
        probabilities = location_counts / len(click_locations)
        entropy = -np.sum(probabilities * np.log2(probabilities + 1e-10))

        return float(entropy)

    def _calculate_dwell_time_variance(self, df: pd.DataFrame) -> float:
        """
        Calculate variance in dwell time (time spent on targets)

        Low variance = monotonous scanning (complacency)
        """
        hover_events = df[df['event_type'] == 'hover']

        if len(hover_events) == 0:
            return 0.0

        # Calculate dwell times
        dwell_times = []
        current_target = None
        start_time = None

        for _, event in hover_events.iterrows():
            event_data = event.get('data', {}) if isinstance(event.get('data'), dict) else {}
            target = event_data.get('target', None)
            timestamp = event['timestamp']

            if target != current_target:
                # Target changed
                if current_target is not None and start_time is not None:
                    dwell_time = timestamp - start_time
                    dwell_times.append(dwell_time)

                current_target = target
                start_time = timestamp

        if not dwell_times:
            return 0.0

        return float(np.var(dwell_times))

    def _calculate_command_sequence_entropy(self, df: pd.DataFrame) -> float:
        """
        Calculate entropy of command sequences

        Low entropy = repetitive commands (complacency)
        """
        # Look for action/command events
        command_events = df[df['event_type'].isin(['action', 'command', 'key_press'])]

        if len(command_events) < 2:
            return 0.0

        # Extract command sequences (bigrams)
        sequences = []
        for i in range(1, len(command_events)):
            prev = command_events.iloc[i-1]
            curr = command_events.iloc[i]

            prev_data = prev.get('data', {}) if isinstance(prev.get('data'), dict) else {}
            curr_data = curr.get('data', {}) if isinstance(curr.get('data'), dict) else {}

            prev_cmd = prev_data.get('action', prev_data.get('command', prev_data.get('key', 'unknown')))
            curr_cmd = curr_data.get('action', curr_data.get('command', curr_data.get('key', 'unknown')))

            sequences.append((prev_cmd, curr_cmd))

        if not sequences:
            return 0.0

        # Calculate entropy
        sequence_counts = pd.Series(sequences).value_counts()
        probabilities = sequence_counts / len(sequences)
        entropy = -np.sum(probabilities * np.log2(probabilities + 1e-10))

        return float(entropy)

    def _calculate_hover_stability(self, df: pd.DataFrame) -> float:
        """
        Calculate stability of hover events

        High stability (long hovers) = reduced scanning (complacency)
        """
        hover_events = df[df['event_type'] == 'hover']

        if len(hover_events) == 0:
            return 0.0

        # Average hover duration
        total_duration = 0.0
        count = 0

        for i in range(1, len(hover_events)):
            duration = hover_events.iloc[i]['timestamp'] - hover_events.iloc[i-1]['timestamp']
            if duration < 10.0:  # Filter out unrealistic long gaps
                total_duration += duration
                count += 1

        if count == 0:
            return 0.0

        return float(total_duration / count)

    def _calculate_response_time_trend(self, df: pd.DataFrame) -> float:
        """
        Calculate trend in response times

        Increasing trend = slowing responses (complacency)
        """
        # Look for events with response time data
        response_events = df[df['event_type'].isin(['acknowledgment', 'action', 'command'])]

        if len(response_events) < 2:
            return 0.0

        # Extract response times
        response_times = []
        for _, event in response_events.iterrows():
            event_data = event.get('data', {}) if isinstance(event.get('data'), dict) else {}
            rt = event_data.get('response_time', event_data.get('response_time_ms', None))

            if rt is not None:
                response_times.append(float(rt))

        if len(response_times) < 2:
            return 0.0

        # Calculate linear trend (slope)
        x = np.arange(len(response_times))
        slope = np.polyfit(x, response_times, 1)[0]

        return float(slope)

    def _calculate_activity_level(self, df: pd.DataFrame) -> float:
        """
        Calculate overall activity level

        Low activity = reduced engagement
        """
        if len(df) == 0:
            return 0.0

        time_span = df['timestamp'].max() - df['timestamp'].min()

        if time_span == 0:
            return 0.0

        # Events per second
        return float(len(df) / time_span)

    def _get_default_features(self) -> Dict[str, float]:
        """Return default features when no events available"""
        return {
            'mouse_velocity_variance': 0.0,
            'interaction_entropy': 0.0,
            'peripheral_neglect_duration': 1.0,
            'click_rate': 0.0,
            'click_pattern_entropy': 0.0,
            'dwell_time_variance': 0.0,
            'command_sequence_entropy': 0.0,
            'hover_stability': 0.0,
            'response_time_trend': 0.0,
            'activity_level': 0.0
        }


class ComplacencyDetector:
    """
    ML-based complacency detection for Condition 3 (ML-Based Adaptive Alerts)

    Uses RandomForest classifier to predict controller complacency from behavioral features
    """

    def __init__(self, model_path: str = None):
        """
        Initialize complacency detector

        Args:
            model_path: Path to saved model file (optional)
        """
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            class_weight='balanced'
        )

        self.scaler = StandardScaler()
        self.feature_extractor = BehavioralFeatureExtractor()
        self.is_trained = False
        self.feature_names = None
        self.model_metadata = {
            'version': '1.0.0',
            'trained_at': None,
            'accuracy': None,
            'precision': None,
            'recall': None,
            'f1_score': None,
            'roc_auc': None
        }

        # Thresholds for alert triggering
        self.complacency_threshold = 0.75
        self.confidence_threshold = 0.6

        if model_path and Path(model_path).exists():
            self.load_model(model_path)

    def train(
        self,
        X: pd.DataFrame,
        y: np.ndarray,
        validation_split: float = 0.2,
        cross_validate: bool = True
    ) -> Dict[str, float]:
        """
        Train the complacency detection model

        Args:
            X: Feature matrix (DataFrame)
            y: Labels (0 = normal, 1 = complacent)
            validation_split: Proportion of data for validation
            cross_validate: Whether to perform cross-validation

        Returns:
            Dictionary of performance metrics
        """
        print(f"\n{'='*60}")
        print("Training Complacency Detection Model")
        print(f"{'='*60}\n")

        # Store feature names
        self.feature_names = list(X.columns)

        # Split data
        X_train, X_val, y_train, y_val = train_test_split(
            X, y,
            test_size=validation_split,
            random_state=42,
            stratify=y
        )

        print(f"Training samples: {len(X_train)}")
        print(f"Validation samples: {len(X_val)}")
        print(f"Complacent samples: {sum(y_train)} ({sum(y_train)/len(y_train)*100:.1f}%)")
        print(f"Normal samples: {len(y_train) - sum(y_train)} ({(len(y_train)-sum(y_train))/len(y_train)*100:.1f}%)")

        # Scale features
        print("\nScaling features...")
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_val_scaled = self.scaler.transform(X_val)

        # Train model
        print("Training RandomForest classifier...")
        self.model.fit(X_train_scaled, y_train)

        # Predictions
        y_pred = self.model.predict(X_val_scaled)
        y_pred_proba = self.model.predict_proba(X_val_scaled)[:, 1]

        # Calculate metrics
        metrics = {
            'accuracy': accuracy_score(y_val, y_pred),
            'precision': precision_score(y_val, y_pred, zero_division=0),
            'recall': recall_score(y_val, y_pred, zero_division=0),
            'f1_score': f1_score(y_val, y_pred, zero_division=0),
            'roc_auc': roc_auc_score(y_val, y_pred_proba) if len(np.unique(y_val)) > 1 else 0.0
        }

        # Cross-validation
        if cross_validate:
            print("\nPerforming 5-fold cross-validation...")
            cv_scores = cross_val_score(
                self.model,
                self.scaler.transform(X),
                y,
                cv=5,
                scoring='accuracy'
            )
            metrics['cv_accuracy_mean'] = cv_scores.mean()
            metrics['cv_accuracy_std'] = cv_scores.std()

        # Print results
        print(f"\n{'='*60}")
        print("Training Results")
        print(f"{'='*60}")
        print(f"Accuracy:  {metrics['accuracy']:.4f}")
        print(f"Precision: {metrics['precision']:.4f}")
        print(f"Recall:    {metrics['recall']:.4f}")
        print(f"F1 Score:  {metrics['f1_score']:.4f}")
        print(f"ROC AUC:   {metrics['roc_auc']:.4f}")

        if cross_validate:
            print(f"\nCross-Validation Accuracy: {metrics['cv_accuracy_mean']:.4f} (+/- {metrics['cv_accuracy_std']:.4f})")

        # Feature importance
        print(f"\n{'='*60}")
        print("Feature Importance (Top 10)")
        print(f"{'='*60}")

        importances = self.model.feature_importances_
        feature_importance = sorted(
            zip(self.feature_names, importances),
            key=lambda x: x[1],
            reverse=True
        )

        for feature, importance in feature_importance[:10]:
            print(f"{feature:40} {importance:.4f}")

        # Update metadata
        self.model_metadata.update({
            'trained_at': datetime.now().isoformat(),
            **metrics
        })

        self.is_trained = True

        print(f"\n✓ Model training complete!\n")

        return metrics

    def predict(
        self,
        events: List[Dict[str, Any]],
        return_features: bool = False
    ) -> Dict[str, Any]:
        """
        Predict complacency from behavioral events

        Args:
            events: List of behavioral events
            return_features: Whether to return extracted features

        Returns:
            Dictionary with prediction results
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")

        # Extract features
        features = self.feature_extractor.extract_features(events)

        # Convert to DataFrame
        feature_df = pd.DataFrame([features])

        # Ensure correct feature order
        feature_df = feature_df[self.feature_names]

        # Scale features
        features_scaled = self.scaler.transform(feature_df)

        # Predict
        prediction = self.model.predict(features_scaled)[0]
        probabilities = self.model.predict_proba(features_scaled)[0]

        complacency_score = float(probabilities[1])  # Probability of complacent class
        confidence = float(max(probabilities))  # Confidence in prediction

        # Generate result
        result = {
            'complacent': bool(prediction == 1),
            'complacency_score': complacency_score,
            'confidence': confidence,
            'prediction_class': int(prediction),
            'timestamp': datetime.now().isoformat()
        }

        if return_features:
            result['features'] = features

        return result

    def predict_with_message(self, events: List[Dict[str, Any]]) -> str:
        """
        Predict complacency and return human-readable message

        Args:
            events: List of behavioral events

        Returns:
            Human-readable prediction message
        """
        result = self.predict(events)

        complacency_score = result['complacency_score']
        confidence = result['confidence']

        if result['complacent']:
            return f"Controller shows {complacency_score*100:.0f}% complacency signature (confidence: {confidence*100:.0f}%)"
        else:
            return f"Controller attention nominal (complacency: {complacency_score*100:.0f}%, confidence: {confidence*100:.0f}%)"

    def should_trigger_alert(
        self,
        events: List[Dict[str, Any]],
        alert_priority: str = 'medium'
    ) -> Dict[str, Any]:
        """
        Determine if a predictive alert should be triggered

        Args:
            events: List of behavioral events
            alert_priority: Priority level of potential alert

        Returns:
            Dictionary with recommendation and details
        """
        result = self.predict(events, return_features=True)

        complacency_score = result['complacency_score']
        confidence = result['confidence']

        # Adjust threshold based on alert priority
        threshold = self.complacency_threshold
        if alert_priority == 'critical':
            threshold = 0.6  # Lower threshold for critical alerts
        elif alert_priority == 'low':
            threshold = 0.85  # Higher threshold for low priority

        # Decision logic
        should_trigger = (
            complacency_score > threshold and
            confidence > self.confidence_threshold
        )

        # Identify risk regions based on features
        risk_regions = self._identify_risk_regions(result['features'])

        recommendation = {
            'trigger_alert': should_trigger,
            'complacency_score': complacency_score,
            'confidence': confidence,
            'threshold_used': threshold,
            'risk_regions': risk_regions,
            'reasoning': self._generate_reasoning(result['features'], complacency_score),
            'timestamp': result['timestamp']
        }

        return recommendation

    def _identify_risk_regions(self, features: Dict[str, float]) -> List[Dict[str, Any]]:
        """
        Identify regions/areas at risk based on behavioral features

        Args:
            features: Extracted behavioral features

        Returns:
            List of risk regions
        """
        risk_regions = []

        # Peripheral neglect
        if features['peripheral_neglect_duration'] > 0.8:
            risk_regions.append({
                'region': 'peripheral',
                'severity': 'high',
                'reason': 'Tunnel vision detected - periphery neglected',
                'metric': features['peripheral_neglect_duration']
            })

        # Low interaction in specific areas (inferred from click patterns)
        if features['click_pattern_entropy'] < 1.0:
            risk_regions.append({
                'region': 'diverse_areas',
                'severity': 'medium',
                'reason': 'Repetitive interaction pattern - some areas may be neglected',
                'metric': features['click_pattern_entropy']
            })

        # Low activity
        if features['activity_level'] < 0.5:
            risk_regions.append({
                'region': 'overall',
                'severity': 'high',
                'reason': 'Low overall activity level',
                'metric': features['activity_level']
            })

        return risk_regions

    def _generate_reasoning(self, features: Dict[str, float], complacency_score: float) -> str:
        """
        Generate human-readable reasoning for prediction

        Args:
            features: Extracted features
            complacency_score: Predicted complacency score

        Returns:
            Reasoning string
        """
        reasons = []

        if features['mouse_velocity_variance'] < 100:
            reasons.append("monotonous mouse movement")

        if features['interaction_entropy'] < 1.5:
            reasons.append("repetitive interactions")

        if features['peripheral_neglect_duration'] > 0.7:
            reasons.append("tunnel vision")

        if features['click_rate'] < 0.2:
            reasons.append("reduced click activity")

        if features['activity_level'] < 0.5:
            reasons.append("low overall activity")

        if not reasons:
            return "Normal engagement patterns detected"

        reasons_str = ", ".join(reasons)
        return f"Prediction based on: {reasons_str}"

    def save_model(self, filepath: str):
        """
        Save trained model to file

        Args:
            filepath: Path to save model
        """
        if not self.is_trained:
            raise ValueError("Cannot save untrained model")

        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'feature_names': self.feature_names,
            'metadata': self.model_metadata,
            'thresholds': {
                'complacency_threshold': self.complacency_threshold,
                'confidence_threshold': self.confidence_threshold
            }
        }

        filepath = Path(filepath)
        filepath.parent.mkdir(parents=True, exist_ok=True)

        with open(filepath, 'wb') as f:
            pickle.dump(model_data, f)

        print(f"✓ Model saved to: {filepath}")

    def load_model(self, filepath: str):
        """
        Load trained model from file

        Args:
            filepath: Path to model file
        """
        filepath = Path(filepath)

        if not filepath.exists():
            raise FileNotFoundError(f"Model file not found: {filepath}")

        with open(filepath, 'rb') as f:
            model_data = pickle.load(f)

        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.feature_names = model_data['feature_names']
        self.model_metadata = model_data['metadata']

        thresholds = model_data.get('thresholds', {})
        self.complacency_threshold = thresholds.get('complacency_threshold', 0.75)
        self.confidence_threshold = thresholds.get('confidence_threshold', 0.6)

        self.is_trained = True

        print(f"✓ Model loaded from: {filepath}")
        print(f"  Trained: {self.model_metadata['trained_at']}")
        print(f"  Accuracy: {self.model_metadata['accuracy']:.4f}")

    def get_model_info(self) -> Dict[str, Any]:
        """
        Get model information and metadata

        Returns:
            Dictionary with model information
        """
        return {
            'is_trained': self.is_trained,
            'metadata': self.model_metadata,
            'feature_names': self.feature_names,
            'thresholds': {
                'complacency_threshold': self.complacency_threshold,
                'confidence_threshold': self.confidence_threshold
            },
            'model_type': 'RandomForestClassifier',
            'n_estimators': self.model.n_estimators if self.is_trained else None
        }


# Convenience function for quick predictions
def predict_complacency(events: List[Dict[str, Any]], model_path: str = None) -> Dict[str, Any]:
    """
    Convenience function for quick complacency prediction

    Args:
        events: List of behavioral events
        model_path: Path to trained model (optional)

    Returns:
        Prediction results
    """
    if model_path is None:
        model_path = Path(__file__).parent / "trained_models" / "complacency_detector.pkl"

    detector = ComplacencyDetector(model_path=str(model_path))
    return detector.predict(events)
