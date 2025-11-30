#!/usr/bin/env python3
"""
Example Usage of Complacency Detection Model

Demonstrates how to use the complacency detector in real-time scenarios.
"""

import time
from pathlib import Path
from complacency_detector import ComplacencyDetector
from train_complacency_model import SyntheticDataGenerator


def example_real_time_detection():
    """Example: Real-time complacency detection"""
    print("\n" + "="*60)
    print("Example: Real-Time Complacency Detection")
    print("="*60 + "\n")

    # Load trained model
    model_path = Path(__file__).parent / "trained_models" / "complacency_detector.pkl"

    if not model_path.exists():
        print("⚠️  Model not found. Training a new model...")
        print("   Run: python train_complacency_model.py")
        return

    detector = ComplacencyDetector(model_path=str(model_path))

    # Simulate real-time event collection
    generator = SyntheticDataGenerator()

    print("Simulating 5 time windows of behavioral data...\n")

    for window_num in range(1, 6):
        print(f"Window {window_num}:")

        # Generate behavioral events (mix of normal and complacent)
        if window_num <= 2:
            events = generator.generate_normal_behavior()
            print("  [Generating normal behavior]")
        else:
            events = generator.generate_complacent_behavior()
            print("  [Generating complacent behavior]")

        # Predict complacency
        result = detector.predict(events, return_features=True)

        # Display results
        print(f"  Complacency Score: {result['complacency_score']:.3f}")
        print(f"  Confidence: {result['confidence']:.3f}")
        print(f"  Classification: {'COMPLACENT' if result['complacent'] else 'NORMAL'}")

        # Get human-readable message
        message = detector.predict_with_message(events)
        print(f"  Message: {message}")

        # Check if alert should be triggered
        recommendation = detector.should_trigger_alert(events, alert_priority='medium')

        if recommendation['trigger_alert']:
            print(f"  🚨 ALERT RECOMMENDATION: Trigger predictive alert")
            print(f"     Reasoning: {recommendation['reasoning']}")

            if recommendation['risk_regions']:
                print(f"     Risk regions identified:")
                for region in recommendation['risk_regions'][:3]:
                    print(f"       - {region['region']}: {region['reason']}")
        else:
            print(f"  ✓ No alert needed")

        print()
        time.sleep(0.5)


def example_alert_priority_adaptation():
    """Example: Alert priority-based threshold adaptation"""
    print("\n" + "="*60)
    print("Example: Alert Priority-Based Threshold Adaptation")
    print("="*60 + "\n")

    model_path = Path(__file__).parent / "trained_models" / "complacency_detector.pkl"

    if not model_path.exists():
        print("⚠️  Model not found. Run: python train_complacency_model.py")
        return

    detector = ComplacencyDetector(model_path=str(model_path))
    generator = SyntheticDataGenerator()

    # Generate moderately complacent behavior
    events = generator.generate_complacent_behavior()

    print("Testing same behavioral data with different alert priorities:\n")

    priorities = ['low', 'medium', 'high', 'critical']

    for priority in priorities:
        recommendation = detector.should_trigger_alert(events, alert_priority=priority)

        print(f"{priority.upper():10} priority:")
        print(f"  Threshold: {recommendation['threshold_used']:.3f}")
        print(f"  Score: {recommendation['complacency_score']:.3f}")
        print(f"  Trigger: {'YES' if recommendation['trigger_alert'] else 'NO'}")
        print()


def example_feature_analysis():
    """Example: Feature extraction and analysis"""
    print("\n" + "="*60)
    print("Example: Feature Extraction and Analysis")
    print("="*60 + "\n")

    model_path = Path(__file__).parent / "trained_models" / "complacency_detector.pkl"

    if not model_path.exists():
        print("⚠️  Model not found. Run: python train_complacency_model.py")
        return

    detector = ComplacencyDetector(model_path=str(model_path))
    generator = SyntheticDataGenerator()

    # Generate both types of behavior
    normal_events = generator.generate_normal_behavior()
    complacent_events = generator.generate_complacent_behavior()

    # Extract features
    print("Comparing features between normal and complacent behavior:\n")

    normal_result = detector.predict(normal_events, return_features=True)
    complacent_result = detector.predict(complacent_events, return_features=True)

    feature_names = detector.feature_names

    print(f"{'Feature':40} {'Normal':>12} {'Complacent':>12} {'Difference':>12}")
    print("-" * 78)

    for feature in feature_names:
        normal_val = normal_result['features'][feature]
        complacent_val = complacent_result['features'][feature]
        diff = complacent_val - normal_val

        print(f"{feature:40} {normal_val:12.3f} {complacent_val:12.3f} {diff:12.3f}")

    print()


def example_batch_prediction():
    """Example: Batch prediction on multiple sessions"""
    print("\n" + "="*60)
    print("Example: Batch Prediction on Multiple Sessions")
    print("="*60 + "\n")

    model_path = Path(__file__).parent / "trained_models" / "complacency_detector.pkl"

    if not model_path.exists():
        print("⚠️  Model not found. Run: python train_complacency_model.py")
        return

    detector = ComplacencyDetector(model_path=str(model_path))
    generator = SyntheticDataGenerator()

    # Simulate 10 sessions
    print("Analyzing 10 simulated sessions:\n")

    results = []
    for session_num in range(1, 11):
        # Randomly choose behavior type
        if session_num % 3 == 0:
            events = generator.generate_complacent_behavior()
            actual_label = "complacent"
        else:
            events = generator.generate_normal_behavior()
            actual_label = "normal"

        result = detector.predict(events)
        predicted_label = "complacent" if result['complacent'] else "normal"

        results.append({
            'session': session_num,
            'actual': actual_label,
            'predicted': predicted_label,
            'score': result['complacency_score'],
            'confidence': result['confidence'],
            'correct': actual_label == predicted_label
        })

        status = "✓" if actual_label == predicted_label else "✗"
        print(f"Session {session_num:2d}: Actual={actual_label:10} "
              f"Predicted={predicted_label:10} "
              f"Score={result['complacency_score']:.3f} {status}")

    # Calculate accuracy
    accuracy = sum(r['correct'] for r in results) / len(results)
    print(f"\nBatch Accuracy: {accuracy*100:.1f}%")


def example_integration_with_scenario():
    """Example: Integration with ATC scenario"""
    print("\n" + "="*60)
    print("Example: Integration with ATC Scenario")
    print("="*60 + "\n")

    model_path = Path(__file__).parent / "trained_models" / "complacency_detector.pkl"

    if not model_path.exists():
        print("⚠️  Model not found. Run: python train_complacency_model.py")
        return

    detector = ComplacencyDetector(model_path=str(model_path))

    print("Simulating Scenario L1 (Baseline Emergency):\n")

    # Simulate scenario progression
    scenario_phases = [
        {
            'time': '0:00-1:00',
            'phase': 'Baseline (Normal traffic)',
            'behavior': 'normal'
        },
        {
            'time': '1:00-2:00',
            'phase': 'Pre-emergency (Routine operations)',
            'behavior': 'complacent'
        },
        {
            'time': '2:00-3:00',
            'phase': 'Emergency declared (AAL123 fuel critical)',
            'behavior': 'normal'  # Should snap back to attention
        }
    ]

    generator = SyntheticDataGenerator()

    for phase_info in scenario_phases:
        print(f"Phase: {phase_info['phase']} ({phase_info['time']})")

        # Generate appropriate behavior
        if phase_info['behavior'] == 'normal':
            events = generator.generate_normal_behavior()
        else:
            events = generator.generate_complacent_behavior()

        # Predict
        result = detector.predict(events)
        message = detector.predict_with_message(events)

        print(f"  {message}")

        # Check if predictive alert needed
        recommendation = detector.should_trigger_alert(events)

        if recommendation['trigger_alert']:
            print(f"  🚨 PREDICTIVE ALERT: {recommendation['reasoning']}")
            print(f"     Recommend pre-emptive alert for upcoming critical event")

        print()


def main():
    """Run all examples"""
    print("\n" + "="*60)
    print("Complacency Detection Model - Usage Examples")
    print("="*60)

    examples = [
        ("Real-Time Detection", example_real_time_detection),
        ("Alert Priority Adaptation", example_alert_priority_adaptation),
        ("Feature Analysis", example_feature_analysis),
        ("Batch Prediction", example_batch_prediction),
        ("Scenario Integration", example_integration_with_scenario)
    ]

    for i, (name, func) in enumerate(examples, 1):
        print(f"\n[{i}/{len(examples)}] Running: {name}")
        input("Press Enter to continue...")

        try:
            func()
        except Exception as e:
            print(f"✗ Error: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "="*60)
    print("All examples completed!")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()
