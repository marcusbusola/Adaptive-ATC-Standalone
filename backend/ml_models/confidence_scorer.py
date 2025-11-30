"""
Confidence Scoring System for ML-Based Adaptive Alerts

Provides transparency and trust for ML predictions by:
1. Calculating multi-factor confidence scores
2. Generating human-readable explanations
3. Categorizing confidence levels for alert presentation
4. Tracking historical accuracy for calibration

Author: ATC Adaptive Alert Research System
Version: 1.0.0
"""

import numpy as np
import json
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime, timedelta
from pathlib import Path
from collections import deque
from enum import Enum


class ConfidenceLevel(str, Enum):
    """Confidence level categories"""
    HIGH = "high"           # 90%+ - Strong red alert
    MEDIUM = "medium"       # 70-89% - Orange alert
    LOW = "low"            # <70% - Yellow suggestion
    VERY_LOW = "very_low"  # <50% - FYI only


class AlertPresentation(str, Enum):
    """Alert presentation styles based on confidence"""
    STRONG_RED = "strong_red_alert"          # High confidence, critical
    ORANGE_WARNING = "orange_warning"         # Medium confidence
    YELLOW_SUGGESTION = "yellow_suggestion"   # Low confidence
    INFO_ONLY = "info_only"                  # Very low confidence


class ConfidenceScorer:
    """
    Multi-factor confidence scoring for ML predictions

    Calculates confidence based on:
    - Feature consistency (agreement among features)
    - Historical accuracy (past performance)
    - Situation clarity (scenario state uncertainty)
    """

    def __init__(
        self,
        history_window: int = 100,
        consistency_weight: float = 0.4,
        accuracy_weight: float = 0.35,
        clarity_weight: float = 0.25
    ):
        """
        Initialize confidence scorer

        Args:
            history_window: Number of predictions to track
            consistency_weight: Weight for feature consistency (0-1)
            accuracy_weight: Weight for historical accuracy (0-1)
            clarity_weight: Weight for situation clarity (0-1)
        """
        # Validate weights sum to 1
        total_weight = consistency_weight + accuracy_weight + clarity_weight
        if abs(total_weight - 1.0) > 0.01:
            raise ValueError(f"Weights must sum to 1.0, got {total_weight}")

        self.history_window = history_window
        self.consistency_weight = consistency_weight
        self.accuracy_weight = accuracy_weight
        self.clarity_weight = clarity_weight

        # Historical tracking
        self.prediction_history = deque(maxlen=history_window)
        self.accuracy_history = deque(maxlen=history_window)

        # Feature importance (from trained model)
        self.feature_importance = {}

        # Thresholds for feature consistency
        self.complacency_feature_thresholds = {
            'mouse_velocity_variance': {'low': 100, 'high': 500},
            'interaction_entropy': {'low': 1.5, 'high': 3.0},
            'peripheral_neglect_duration': {'low': 0.3, 'high': 0.7},
            'click_rate': {'low': 0.2, 'high': 0.5},
            'click_pattern_entropy': {'low': 1.0, 'high': 2.5},
            'dwell_time_variance': {'low': 0.5, 'high': 2.0},
            'command_sequence_entropy': {'low': 1.0, 'high': 2.0},
            'hover_stability': {'low': 1.0, 'high': 3.0},
            'response_time_trend': {'low': 0, 'high': 100},
            'activity_level': {'low': 0.5, 'high': 2.0}
        }

    def calculate_confidence(
        self,
        prediction_score: float,
        features: Dict[str, float],
        scenario_state: Optional[Dict[str, Any]] = None,
        feature_importances: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Calculate multi-factor confidence score

        Args:
            prediction_score: Raw model prediction score (0-1)
            features: Extracted behavioral features
            scenario_state: Current scenario state (optional)
            feature_importances: Feature importance weights (optional)

        Returns:
            Dictionary with confidence score and breakdown
        """
        # Update feature importance if provided
        if feature_importances:
            self.feature_importance = feature_importances

        # Calculate individual components
        consistency_score = self._calculate_feature_consistency(features, prediction_score)
        accuracy_score = self._calculate_historical_accuracy()
        clarity_score = self._calculate_situation_clarity(scenario_state)

        # Weighted combination
        confidence = (
            consistency_score * self.consistency_weight +
            accuracy_score * self.accuracy_weight +
            clarity_score * self.clarity_weight
        )

        # Clamp to [0, 1]
        confidence = max(0.0, min(1.0, confidence))

        # Categorize confidence level
        level = self._categorize_confidence(confidence)

        # Store in history
        self.prediction_history.append({
            'timestamp': datetime.now().isoformat(),
            'prediction_score': prediction_score,
            'confidence': confidence,
            'features': features.copy()
        })

        return {
            'confidence': confidence,
            'confidence_percentage': confidence * 100,
            'level': level,
            'components': {
                'feature_consistency': consistency_score,
                'historical_accuracy': accuracy_score,
                'situation_clarity': clarity_score
            },
            'weights': {
                'feature_consistency': self.consistency_weight,
                'historical_accuracy': self.accuracy_weight,
                'situation_clarity': self.clarity_weight
            }
        }

    def _calculate_feature_consistency(
        self,
        features: Dict[str, float],
        prediction_score: float
    ) -> float:
        """
        Calculate how consistently features support the prediction

        High consistency = multiple features strongly indicate same prediction
        Low consistency = conflicting feature signals
        """
        if not features:
            return 0.5  # Neutral if no features

        # Determine expected direction for complacency (1) vs normal (0)
        is_complacent_prediction = prediction_score > 0.5

        # Count features supporting the prediction
        supporting_features = []
        conflicting_features = []
        neutral_features = []

        for feature_name, feature_value in features.items():
            if feature_name not in self.complacency_feature_thresholds:
                continue

            thresholds = self.complacency_feature_thresholds[feature_name]

            # Determine if feature indicates complacency
            if feature_name in ['peripheral_neglect_duration', 'hover_stability', 'response_time_trend']:
                # Higher values = more complacent
                feature_indicates_complacency = feature_value > thresholds['high']
                feature_indicates_normal = feature_value < thresholds['low']
            else:
                # Lower values = more complacent (for entropy, variance, etc.)
                feature_indicates_complacency = feature_value < thresholds['low']
                feature_indicates_normal = feature_value > thresholds['high']

            # Get feature importance weight
            importance = self.feature_importance.get(feature_name, 1.0)

            # Check consistency with prediction
            if is_complacent_prediction:
                if feature_indicates_complacency:
                    supporting_features.append((feature_name, importance))
                elif feature_indicates_normal:
                    conflicting_features.append((feature_name, importance))
                else:
                    neutral_features.append((feature_name, importance))
            else:
                if feature_indicates_normal:
                    supporting_features.append((feature_name, importance))
                elif feature_indicates_complacency:
                    conflicting_features.append((feature_name, importance))
                else:
                    neutral_features.append((feature_name, importance))

        # Calculate weighted consistency score
        total_importance = sum(imp for _, imp in supporting_features + conflicting_features + neutral_features)

        if total_importance == 0:
            return 0.5

        supporting_weight = sum(imp for _, imp in supporting_features)
        conflicting_weight = sum(imp for _, imp in conflicting_features)

        # Consistency = (supporting - conflicting) / total
        consistency = (supporting_weight - conflicting_weight) / total_importance

        # Normalize to [0, 1]
        consistency = (consistency + 1) / 2

        # Boost consistency if prediction is extreme (very confident)
        if prediction_score > 0.8 or prediction_score < 0.2:
            consistency *= 1.1

        return min(1.0, consistency)

    def _calculate_historical_accuracy(self) -> float:
        """
        Calculate historical prediction accuracy

        Uses recent prediction accuracy to calibrate confidence
        """
        if not self.accuracy_history:
            return 0.7  # Default moderate confidence

        # Calculate recent accuracy
        recent_accuracy = np.mean(list(self.accuracy_history))

        # Apply exponential smoothing to favor recent predictions
        if len(self.accuracy_history) > 10:
            weights = np.exp(np.linspace(-1, 0, len(self.accuracy_history)))
            weights /= weights.sum()
            recent_accuracy = np.average(list(self.accuracy_history), weights=weights)

        return float(recent_accuracy)

    def _calculate_situation_clarity(
        self,
        scenario_state: Optional[Dict[str, Any]]
    ) -> float:
        """
        Calculate clarity of current situation

        High clarity = scenario state is well-defined
        Low clarity = ambiguous or uncertain state
        """
        if scenario_state is None:
            return 0.6  # Moderate clarity if no state provided

        clarity_factors = []

        # Factor 1: Aircraft count (more aircraft = less clarity)
        aircraft_count = scenario_state.get('aircraft_count', 0)
        if aircraft_count > 0:
            aircraft_clarity = 1.0 / (1 + np.log(aircraft_count + 1) / 3)
            clarity_factors.append(aircraft_clarity)

        # Factor 2: Active alerts (more alerts = less clarity)
        active_alerts = scenario_state.get('active_alerts', 0)
        alert_clarity = 1.0 / (1 + active_alerts * 0.2)
        clarity_factors.append(alert_clarity)

        # Factor 3: Scenario complexity
        complexity = scenario_state.get('complexity', 'medium')
        complexity_clarity = {
            'low': 0.9,
            'medium': 0.7,
            'high': 0.5
        }.get(complexity, 0.7)
        clarity_factors.append(complexity_clarity)

        # Factor 4: Time in scenario (familiarity)
        elapsed_time = scenario_state.get('elapsed_time', 0)
        # Peak clarity around 60-120 seconds (familiar but not fatigued)
        if elapsed_time < 60:
            time_clarity = 0.6 + (elapsed_time / 60) * 0.3
        elif elapsed_time < 180:
            time_clarity = 0.9
        else:
            time_clarity = max(0.5, 0.9 - (elapsed_time - 180) / 600 * 0.3)
        clarity_factors.append(time_clarity)

        # Factor 5: Recent events (rapid events = less clarity)
        recent_event_count = scenario_state.get('recent_event_count', 0)
        event_clarity = 1.0 / (1 + recent_event_count * 0.1)
        clarity_factors.append(event_clarity)

        # Average clarity factors
        if clarity_factors:
            return float(np.mean(clarity_factors))
        else:
            return 0.6

    def _categorize_confidence(self, confidence: float) -> ConfidenceLevel:
        """
        Categorize confidence score into discrete levels

        Args:
            confidence: Confidence score (0-1)

        Returns:
            ConfidenceLevel enum
        """
        if confidence >= 0.90:
            return ConfidenceLevel.HIGH
        elif confidence >= 0.70:
            return ConfidenceLevel.MEDIUM
        elif confidence >= 0.50:
            return ConfidenceLevel.LOW
        else:
            return ConfidenceLevel.VERY_LOW

    def generate_reasoning(
        self,
        prediction_score: float,
        confidence_result: Dict[str, Any],
        features: Dict[str, float],
        top_n: int = 3
    ) -> str:
        """
        Generate human-readable reasoning for the prediction

        Args:
            prediction_score: Model prediction score
            confidence_result: Result from calculate_confidence()
            features: Feature values
            top_n: Number of top features to include

        Returns:
            Reasoning string
        """
        confidence_pct = confidence_result['confidence_percentage']
        level = confidence_result['level']

        # Start with confidence statement
        level_desc = {
            ConfidenceLevel.HIGH: "High confidence",
            ConfidenceLevel.MEDIUM: "Medium confidence",
            ConfidenceLevel.LOW: "Low confidence",
            ConfidenceLevel.VERY_LOW: "Very low confidence"
        }[level]

        reasoning = f"{level_desc} ({confidence_pct:.0f}%)"

        # Identify key features driving the prediction
        is_complacent = prediction_score > 0.5
        key_features = self._identify_key_features(features, is_complacent, top_n)

        if key_features:
            reasoning += " - "
            feature_descriptions = []

            for feature_name, feature_value, description in key_features:
                feature_descriptions.append(description)

            reasoning += " + ".join(feature_descriptions)

        # Add component breakdown for transparency
        components = confidence_result['components']
        if min(components.values()) < 0.5:
            # Highlight weak component
            weak_component = min(components.items(), key=lambda x: x[1])
            comp_name, comp_score = weak_component

            comp_display = {
                'feature_consistency': 'conflicting signals',
                'historical_accuracy': 'uncertain past performance',
                'situation_clarity': 'ambiguous situation'
            }.get(comp_name, comp_name)

            reasoning += f" [Note: {comp_display}]"

        return reasoning

    def _identify_key_features(
        self,
        features: Dict[str, float],
        is_complacent: bool,
        top_n: int = 3
    ) -> List[Tuple[str, float, str]]:
        """
        Identify key features driving the prediction

        Returns:
            List of (feature_name, value, description) tuples
        """
        feature_scores = []

        for feature_name, feature_value in features.items():
            if feature_name not in self.complacency_feature_thresholds:
                continue

            thresholds = self.complacency_feature_thresholds[feature_name]
            importance = self.feature_importance.get(feature_name, 1.0)

            # Calculate how strongly this feature indicates complacency
            if feature_name in ['peripheral_neglect_duration', 'hover_stability', 'response_time_trend']:
                # Higher = more complacent
                if feature_value > thresholds['high']:
                    strength = (feature_value - thresholds['high']) / thresholds['high']
                    indicates_complacency = True
                elif feature_value < thresholds['low']:
                    strength = (thresholds['low'] - feature_value) / thresholds['low']
                    indicates_complacency = False
                else:
                    continue
            else:
                # Lower = more complacent
                if feature_value < thresholds['low']:
                    strength = (thresholds['low'] - feature_value) / thresholds['low']
                    indicates_complacency = True
                elif feature_value > thresholds['high']:
                    strength = (feature_value - thresholds['high']) / thresholds['high']
                    indicates_complacency = False
                else:
                    continue

            # Only include features supporting the prediction
            if indicates_complacency == is_complacent:
                score = strength * importance
                description = self._get_feature_description(feature_name, feature_value, indicates_complacency)
                feature_scores.append((feature_name, feature_value, description, score))

        # Sort by score and take top N
        feature_scores.sort(key=lambda x: x[3], reverse=True)
        return [(name, value, desc) for name, value, desc, _ in feature_scores[:top_n]]

    def _get_feature_description(
        self,
        feature_name: str,
        feature_value: float,
        indicates_complacency: bool
    ) -> str:
        """
        Get human-readable description for a feature

        Returns:
            Description string
        """
        descriptions = {
            'peripheral_neglect_duration': lambda v: f"peripheral neglect {v*100:.0f}%",
            'mouse_velocity_variance': lambda v: f"monotonous movement",
            'interaction_entropy': lambda v: f"repetitive interactions",
            'click_rate': lambda v: f"low click rate ({v:.1f}/s)",
            'click_pattern_entropy': lambda v: f"repetitive clicking",
            'dwell_time_variance': lambda v: f"monotonous scanning",
            'command_sequence_entropy': lambda v: f"repetitive commands",
            'hover_stability': lambda v: f"fixation {v:.1f}s",
            'response_time_trend': lambda v: f"slowing responses (+{v:.0f}ms)",
            'activity_level': lambda v: f"low activity ({v:.1f} events/s)"
        }

        if indicates_complacency:
            if feature_name in descriptions:
                return descriptions[feature_name](feature_value)
            else:
                return f"{feature_name} indicates complacency"
        else:
            return f"active {feature_name.replace('_', ' ')}"

    def get_alert_presentation(
        self,
        confidence_result: Dict[str, Any],
        alert_priority: str = 'medium'
    ) -> Dict[str, Any]:
        """
        Determine alert presentation style based on confidence and priority

        Args:
            confidence_result: Result from calculate_confidence()
            alert_priority: Alert priority level

        Returns:
            Dictionary with presentation recommendations
        """
        confidence = confidence_result['confidence']
        level = confidence_result['level']

        # Determine presentation style
        if level == ConfidenceLevel.HIGH and alert_priority in ['high', 'critical']:
            presentation = AlertPresentation.STRONG_RED
            color = "#DC2626"  # Red
            style = "modal_blocking"
            audio = True
        elif level == ConfidenceLevel.MEDIUM or (level == ConfidenceLevel.HIGH and alert_priority == 'medium'):
            presentation = AlertPresentation.ORANGE_WARNING
            color = "#EA580C"  # Orange
            style = "banner_prominent"
            audio = True
        elif level == ConfidenceLevel.LOW:
            presentation = AlertPresentation.YELLOW_SUGGESTION
            color = "#CA8A04"  # Yellow
            style = "banner_subtle"
            audio = False
        else:
            presentation = AlertPresentation.INFO_ONLY
            color = "#3B82F6"  # Blue
            style = "notification"
            audio = False

        return {
            'presentation_type': presentation,
            'color': color,
            'style': style,
            'audio_enabled': audio,
            'blocking': level == ConfidenceLevel.HIGH and alert_priority == 'critical',
            'dismissable': level != ConfidenceLevel.HIGH or alert_priority != 'critical',
            'timeout_seconds': self._get_timeout(level, alert_priority),
            'visual_emphasis': {
                ConfidenceLevel.HIGH: 'strong',
                ConfidenceLevel.MEDIUM: 'moderate',
                ConfidenceLevel.LOW: 'subtle',
                ConfidenceLevel.VERY_LOW: 'minimal'
            }[level]
        }

    def _get_timeout(self, level: ConfidenceLevel, priority: str) -> Optional[int]:
        """Get alert timeout in seconds based on confidence and priority"""
        if level == ConfidenceLevel.HIGH and priority in ['high', 'critical']:
            return None  # No timeout for high confidence critical alerts
        elif level == ConfidenceLevel.MEDIUM:
            return 30
        elif level == ConfidenceLevel.LOW:
            return 15
        else:
            return 10

    def record_outcome(
        self,
        prediction_was_correct: bool,
        prediction_index: int = -1
    ):
        """
        Record the outcome of a prediction for calibration

        Args:
            prediction_was_correct: Whether the prediction was accurate
            prediction_index: Index in history (default: most recent)
        """
        accuracy = 1.0 if prediction_was_correct else 0.0
        self.accuracy_history.append(accuracy)

        # Update the prediction in history
        if prediction_index == -1 and self.prediction_history:
            self.prediction_history[-1]['outcome'] = prediction_was_correct

    def get_calibration_stats(self) -> Dict[str, Any]:
        """
        Get calibration statistics for model performance

        Returns:
            Dictionary with calibration metrics
        """
        if not self.accuracy_history:
            return {
                'predictions_tracked': 0,
                'overall_accuracy': None,
                'recent_accuracy': None,
                'confidence_calibration': None
            }

        overall_accuracy = np.mean(list(self.accuracy_history))

        # Recent accuracy (last 20 predictions)
        recent = list(self.accuracy_history)[-20:]
        recent_accuracy = np.mean(recent) if recent else overall_accuracy

        # Confidence calibration (are high confidence predictions actually more accurate?)
        calibration = self._calculate_calibration()

        return {
            'predictions_tracked': len(self.accuracy_history),
            'overall_accuracy': float(overall_accuracy),
            'recent_accuracy': float(recent_accuracy),
            'confidence_calibration': calibration,
            'recommendations': self._get_calibration_recommendations(overall_accuracy, calibration)
        }

    def _calculate_calibration(self) -> Dict[str, float]:
        """Calculate confidence calibration metrics"""
        if len(self.prediction_history) < 10:
            return {}

        # Group predictions by confidence level
        high_conf = []
        med_conf = []
        low_conf = []

        for pred in self.prediction_history:
            if 'outcome' not in pred:
                continue

            conf = pred.get('confidence', 0.5)
            outcome = 1.0 if pred['outcome'] else 0.0

            if conf >= 0.9:
                high_conf.append(outcome)
            elif conf >= 0.7:
                med_conf.append(outcome)
            else:
                low_conf.append(outcome)

        calibration = {}
        if high_conf:
            calibration['high_confidence_accuracy'] = float(np.mean(high_conf))
        if med_conf:
            calibration['medium_confidence_accuracy'] = float(np.mean(med_conf))
        if low_conf:
            calibration['low_confidence_accuracy'] = float(np.mean(low_conf))

        return calibration

    def _get_calibration_recommendations(
        self,
        overall_accuracy: float,
        calibration: Dict[str, float]
    ) -> List[str]:
        """Generate recommendations based on calibration"""
        recommendations = []

        if overall_accuracy < 0.7:
            recommendations.append("Model accuracy is low - consider retraining with more data")

        if calibration.get('high_confidence_accuracy', 1.0) < 0.85:
            recommendations.append("High confidence predictions are not well-calibrated - adjust thresholds")

        if calibration:
            high = calibration.get('high_confidence_accuracy', 0)
            low = calibration.get('low_confidence_accuracy', 0)
            if high and low and abs(high - low) < 0.1:
                recommendations.append("Confidence scores are not discriminative - review feature consistency calculation")

        return recommendations

    def save_history(self, filepath: str):
        """Save prediction history to file"""
        filepath = Path(filepath)
        filepath.parent.mkdir(parents=True, exist_ok=True)

        data = {
            'prediction_history': list(self.prediction_history),
            'accuracy_history': list(self.accuracy_history),
            'calibration_stats': self.get_calibration_stats()
        }

        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2, default=str)

    def load_history(self, filepath: str):
        """Load prediction history from file"""
        filepath = Path(filepath)

        if not filepath.exists():
            return

        with open(filepath, 'r') as f:
            data = json.load(f)

        self.prediction_history = deque(data.get('prediction_history', []), maxlen=self.history_window)
        self.accuracy_history = deque(data.get('accuracy_history', []), maxlen=self.history_window)
