"""
ML-Based Alert Presentation Predictor (Condition 3)
Predicts optimal alert presentation style based on context
"""
from typing import Dict, Any
from .integrated_ml_system import IntegratedMLSystem


class AlertPredictor:
    """
    Predicts optimal alert presentation style using the IntegratedMLSystem.
    """

    def __init__(self, model_path: str = None):
        """
        Initializes the AlertPredictor by loading the IntegratedMLSystem.
        """
        self.ml_system = IntegratedMLSystem(model_path=model_path)

    def predict(self, events: list, **kwargs) -> dict:
        """
        Predicts whether an alert should be triggered based on behavioral events.

        Args:
            events: A list of behavioral event dictionaries.
            **kwargs: Additional context for the ML system.

        Returns:
            A dictionary containing the prediction and supporting data.
        """
        return self.ml_system.should_trigger_alert(events, **kwargs)

    def get_model_info(self) -> dict:
        """Get information about the current model."""
        return self.ml_system.detector.get_model_info()


def predict_presentation(
    events: list,
    **kwargs
) -> Dict[str, Any]:
    """
    Helper function for making predictions.

    Returns:
        Dict with presentation_style, confidence, and reasoning.
    """
    predictor = AlertPredictor()
    result = predictor.predict(events, **kwargs)

    # Adapt the output to the previous format if necessary, or return the new richer format
    return {
        "presentation_style": result['presentation']['style'],
        "confidence": round(result['confidence'], 3),
        "trigger": result['trigger'],
        "explanation": result['explanation'],
        "factors": {
            "complacency_score": result['complacency_score'],
            "confidence_level": result['confidence_level'],
        }
    }


if __name__ == "__main__":
    # Example usage
    print("ML Alert Predictor - Example Predictions\n")

    # The new `predict` method requires event data, not just a workload score.
    # We'll create some dummy event data for the example.
    dummy_events = [
        {'event_type': 'mouse_click', 'timestamp': 1678886400, 'x': 100, 'y': 200},
        {'event_type': 'key_press', 'timestamp': 1678886401, 'key': 'a'},
    ]

    result = predict_presentation(dummy_events)
    print(f"Input Events: {dummy_events}")
    print(f"  -> Trigger Alert: {result['trigger']}")
    print(f"  -> Presentation Style: {result['presentation_style']} (confidence: {result['confidence']})")
    print(f"  -> Explanation: {result['explanation']}")
    print()
