#!/usr/bin/env python3
"""
Integrated ML System for Condition 3

Combines complacency detection with confidence scoring for
transparent, trustworthy ML-based adaptive alerts.

Usage:
    system = IntegratedMLSystem()
    result = system.predict_with_confidence(events, scenario_state)
    print(result['explanation'])
"""

from typing import Dict, List, Any, Optional
from pathlib import Path
from .complacency_detector import ComplacencyDetector
from .confidence_scorer import ConfidenceScorer, ConfidenceLevel, AlertPresentation


class IntegratedMLSystem:
    """
    Integrated ML system combining complacency detection and confidence scoring

    Provides:
    - Complacency prediction from behavioral data
    - Multi-factor confidence scoring
    - Human-readable explanations
    - Alert presentation recommendations
    """

    def __init__(
        self,
        model_path: str = None,
        track_history: bool = True
    ):
        """
        Initialize integrated ML system

        Args:
            model_path: Path to trained complacency detector model
            track_history: Whether to track prediction history
        """
        # Load complacency detector
        if model_path is None:
            model_path = Path(__file__).parent / "trained_models" / "complacency_detector.pkl"

        self.detector = ComplacencyDetector(model_path=str(model_path))

        # Initialize confidence scorer
        self.confidence_scorer = ConfidenceScorer(
            history_window=100,
            consistency_weight=0.4,
            accuracy_weight=0.35,
            clarity_weight=0.25
        )

        # Set feature importance from trained model
        if self.detector.is_trained:
            importances = dict(zip(
                self.detector.feature_names,
                self.detector.model.feature_importances_
            ))
            self.confidence_scorer.feature_importance = importances

        self.track_history = track_history

    def predict_with_confidence(
        self,
        events: List[Dict[str, Any]],
        scenario_state: Optional[Dict[str, Any]] = None,
        alert_priority: str = 'medium'
    ) -> Dict[str, Any]:
        """
        Predict complacency with confidence scoring and explanation

        Args:
            events: Behavioral events
            scenario_state: Current scenario state (optional)
            alert_priority: Alert priority level

        Returns:
            Dictionary with prediction, confidence, and presentation recommendations
        """
        # Get complacency prediction
        prediction = self.detector.predict(events, return_features=True)

        # Calculate confidence
        confidence_result = self.confidence_scorer.calculate_confidence(
            prediction_score=prediction['complacency_score'],
            features=prediction['features'],
            scenario_state=scenario_state
        )

        # Generate reasoning
        reasoning = self.confidence_scorer.generate_reasoning(
            prediction_score=prediction['complacency_score'],
            confidence_result=confidence_result,
            features=prediction['features']
        )

        # Get alert presentation recommendations
        presentation = self.confidence_scorer.get_alert_presentation(
            confidence_result=confidence_result,
            alert_priority=alert_priority
        )

        # Combine results
        result = {
            # Prediction
            'complacent': prediction['complacent'],
            'complacency_score': prediction['complacency_score'],
            'complacency_percentage': prediction['complacency_score'] * 100,

            # Confidence
            'confidence': confidence_result['confidence'],
            'confidence_percentage': confidence_result['confidence_percentage'],
            'confidence_level': confidence_result['level'],

            # Confidence breakdown
            'confidence_components': confidence_result['components'],

            # Explanation
            'reasoning': reasoning,
            'explanation': self._generate_full_explanation(
                prediction,
                confidence_result,
                reasoning
            ),

            # Presentation
            'presentation': presentation,
            'alert_style': presentation['style'],
            'alert_color': presentation['color'],

            # Metadata
            'timestamp': prediction['timestamp'],
            'features': prediction['features']
        }

        return result

    def _generate_full_explanation(
        self,
        prediction: Dict[str, Any],
        confidence_result: Dict[str, Any],
        reasoning: str
    ) -> str:
        """Generate complete human-readable explanation"""
        complacency_pct = prediction['complacency_score'] * 100
        confidence_pct = confidence_result['confidence_percentage']

        if prediction['complacent']:
            base = f"Complacency detected ({complacency_pct:.0f}%). "
        else:
            base = f"Normal attention ({100-complacency_pct:.0f}% engaged). "

        base += reasoning

        return base

    def should_trigger_alert(
        self,
        events: List[Dict[str, Any]],
        scenario_state: Optional[Dict[str, Any]] = None,
        alert_priority: str = 'medium',
        min_confidence: float = 0.6
    ) -> Dict[str, Any]:
        """
        Determine if ML-based alert should be triggered

        Args:
            events: Behavioral events
            scenario_state: Current scenario state
            alert_priority: Alert priority
            min_confidence: Minimum confidence threshold

        Returns:
            Alert recommendation with explanation
        """
        result = self.predict_with_confidence(events, scenario_state, alert_priority)

        # Decision logic
        complacency_threshold = {
            'critical': 0.6,
            'high': 0.75,
            'medium': 0.75,
            'low': 0.85
        }.get(alert_priority, 0.75)

        should_trigger = (
            result['complacency_score'] > complacency_threshold and
            result['confidence'] > min_confidence
        )

        recommendation = {
            'trigger': should_trigger,
            'complacency_score': result['complacency_score'],
            'confidence': result['confidence'],
            'confidence_level': result['confidence_level'],
            'reasoning': result['reasoning'],
            'explanation': result['explanation'],
            'presentation': result['presentation'],
            'alert_priority': alert_priority,
            'thresholds_used': {
                'complacency': complacency_threshold,
                'confidence': min_confidence
            }
        }

        return recommendation

    def get_detailed_analysis(
        self,
        events: List[Dict[str, Any]],
        scenario_state: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Get detailed analysis with all metrics and explanations

        Args:
            events: Behavioral events
            scenario_state: Current scenario state

        Returns:
            Comprehensive analysis dictionary
        """
        result = self.predict_with_confidence(events, scenario_state)

        # Add detailed feature analysis
        feature_analysis = self._analyze_features(result['features'])

        # Add calibration stats
        calibration = self.confidence_scorer.get_calibration_stats()

        analysis = {
            **result,
            'feature_analysis': feature_analysis,
            'calibration_stats': calibration,
            'model_info': self.detector.get_model_info()
        }

        return analysis

    def _analyze_features(self, features: Dict[str, float]) -> Dict[str, Any]:
        """Analyze individual features"""
        analysis = {}

        thresholds = self.confidence_scorer.complacency_feature_thresholds

        for feature_name, feature_value in features.items():
            if feature_name not in thresholds:
                continue

            thresh = thresholds[feature_name]

            # Determine status
            if feature_name in ['peripheral_neglect_duration', 'hover_stability', 'response_time_trend']:
                # Higher = more complacent
                if feature_value > thresh['high']:
                    status = 'complacent'
                    severity = min((feature_value - thresh['high']) / thresh['high'], 1.0) if thresh['high'] != 0 else 1.0
                elif feature_value < thresh['low']:
                    status = 'normal'
                    severity = min((thresh['low'] - feature_value) / thresh['low'], 1.0) if thresh['low'] != 0 else 1.0
                else:
                    status = 'neutral'
                    severity = 0.0
            else:
                # Lower = more complacent
                if feature_value < thresh['low']:
                    status = 'complacent'
                    severity = min((thresh['low'] - feature_value) / thresh['low'], 1.0) if thresh['low'] != 0 else 1.0
                elif feature_value > thresh['high']:
                    status = 'normal'
                    severity = min((feature_value - thresh['high']) / thresh['high'], 1.0) if thresh['high'] != 0 else 1.0
                else:
                    status = 'neutral'
                    severity = 0.0

            analysis[feature_name] = {
                'value': feature_value,
                'status': status,
                'severity': severity,
                'thresholds': thresh
            }

        return analysis

    def record_outcome(self, prediction_was_correct: bool):
        """Record prediction outcome for calibration"""
        if self.track_history:
            self.confidence_scorer.record_outcome(prediction_was_correct)

    def get_calibration_report(self) -> str:
        """Get human-readable calibration report"""
        stats = self.confidence_scorer.get_calibration_stats()

        if stats['predictions_tracked'] == 0:
            return "No predictions tracked yet."

        report = f"Calibration Report\n"
        report += f"{'='*60}\n"
        report += f"Predictions tracked: {stats['predictions_tracked']}\n"
        report += f"Overall accuracy: {stats['overall_accuracy']*100:.1f}%\n"
        report += f"Recent accuracy: {stats['recent_accuracy']*100:.1f}%\n"

        if stats['confidence_calibration']:
            report += f"\nConfidence Calibration:\n"
            for level, accuracy in stats['confidence_calibration'].items():
                report += f"  {level.replace('_', ' ').title()}: {accuracy*100:.1f}%\n"

        if stats['recommendations']:
            report += f"\nRecommendations:\n"
            for rec in stats['recommendations']:
                report += f"  - {rec}\n"

        return report

    def save_history(self, filepath: str = "ml_system_history.json"):
        """Save prediction history"""
        self.confidence_scorer.save_history(filepath)

    def load_history(self, filepath: str = "ml_system_history.json"):
        """Load prediction history"""
        self.confidence_scorer.load_history(filepath)


def demo():
    """Demonstration of integrated ML system"""
    print("\n" + "="*60)
    print("Integrated ML System Demo")
    print("="*60 + "\n")

    # Check if model exists
    model_path = Path(__file__).parent / "trained_models" / "complacency_detector.pkl"
    if not model_path.exists():
        print("⚠️  Model not found. Please run:")
        print("    python train_complacency_model.py")
        return

    # Initialize system
    system = IntegratedMLSystem()

    # Generate sample events
    from .train_complacency_model import SyntheticDataGenerator
    generator = SyntheticDataGenerator()

    # Test with complacent behavior
    print("Test 1: Complacent Behavior")
    print("-" * 60)
    events = generator.generate_complacent_behavior()

    scenario_state = {
        'aircraft_count': 5,
        'active_alerts': 1,
        'complexity': 'medium',
        'elapsed_time': 120,
        'recent_event_count': 2
    }

    result = system.predict_with_confidence(events, scenario_state)

    print(f"Explanation: {result['explanation']}")
    print(f"Confidence: {result['confidence_percentage']:.1f}% ({result['confidence_level']})")
    print(f"Alert Style: {result['alert_style']}")
    print(f"Alert Color: {result['alert_color']}")
    print(f"\nConfidence Breakdown:")
    for component, score in result['confidence_components'].items():
        print(f"  {component}: {score*100:.1f}%")

    # Test alert recommendation
    print("\n" + "-" * 60)
    print("Alert Recommendation:")
    recommendation = system.should_trigger_alert(events, scenario_state, alert_priority='high')

    print(f"Trigger: {'YES' if recommendation['trigger'] else 'NO'}")
    if recommendation['trigger']:
        print(f"Presentation: {recommendation['presentation']['presentation_type']}")
        print(f"Blocking: {recommendation['presentation']['blocking']}")
        print(f"Audio: {recommendation['presentation']['audio_enabled']}")

    # Test with normal behavior
    print("\n" + "="*60)
    print("Test 2: Normal Behavior")
    print("-" * 60)
    events = generator.generate_normal_behavior()

    result = system.predict_with_confidence(events, scenario_state)

    print(f"Explanation: {result['explanation']}")
    print(f"Confidence: {result['confidence_percentage']:.1f}% ({result['confidence_level']})")

    # Detailed analysis
    print("\n" + "="*60)
    print("Detailed Feature Analysis")
    print("="*60)

    analysis = system.get_detailed_analysis(events, scenario_state)

    print(f"\nTop Contributing Features:")
    feature_analysis = analysis['feature_analysis']
    complacent_features = [(k, v) for k, v in feature_analysis.items() if v['status'] == 'complacent']
    complacent_features.sort(key=lambda x: x[1]['severity'], reverse=True)

    for feature_name, info in complacent_features[:5]:
        print(f"  {feature_name}: {info['value']:.3f} (severity: {info['severity']*100:.0f}%)")

    print("\n" + "="*60 + "\n")


if __name__ == "__main__":
    demo()
