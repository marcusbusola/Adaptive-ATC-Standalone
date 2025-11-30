"""
Example usage of ML Complacency Classifier

This demonstrates how to:
1. Generate synthetic training data
2. Train the classifier
3. Make predictions
4. Save and load models
"""

from ml_classifier import (
    MLComplacencyClassifier,
    BehavioralState,
    generate_synthetic_training_data,
    train_default_model
)
from pathlib import Path


def example_1_train_and_save():
    """Example 1: Train classifier on synthetic data and save model"""
    print("\n" + "="*60)
    print("Example 1: Training and Saving Model")
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
    y = data['label']

    # Create and train classifier
    clf = MLComplacencyClassifier()
    metrics = clf.train(X, y)

    # Save model
    model_path = Path(__file__).parent.parent / 'data' / 'ml_model' / 'complacency_classifier.pkl'
    clf.save_model(str(model_path))

    print(f"\n✓ Model saved to: {model_path}")

    return clf


def example_2_load_and_predict():
    """Example 2: Load pre-trained model and make predictions"""
    print("\n" + "="*60)
    print("Example 2: Loading Model and Making Predictions")
    print("="*60 + "\n")

    # Load pre-trained model
    model_path = Path(__file__).parent.parent / 'data' / 'ml_model' / 'complacency_classifier.pkl'

    if not model_path.exists():
        print("⚠ Model not found. Training new model first...")
        clf = example_1_train_and_save()
    else:
        clf = MLComplacencyClassifier(model_path=str(model_path))

    # Example prediction: Normal behavior
    print("\nPrediction 1: Normal Attention")
    print("-" * 40)

    normal_state = BehavioralState(
        peripheral_neglect_max=15.0,  # 15 seconds
        interaction_entropy=1.8,  # High entropy (diverse interactions)
        crisis_fixation_ratio=0.35,  # 35% fixation on crisis
        mouse_velocity_variance=1000.0  # Normal variance
    )

    prob, confidence = clf.predict_proba(normal_state, scenario_id='L3')

    print(f"Features:")
    print(f"  Peripheral neglect: {normal_state.peripheral_neglect_max:.1f}s")
    print(f"  Interaction entropy: {normal_state.interaction_entropy:.2f}")
    print(f"  Crisis fixation: {normal_state.crisis_fixation_ratio:.2%}")
    print(f"  Mouse variance: {normal_state.mouse_velocity_variance:.1f}")
    print(f"\nPrediction:")
    print(f"  Tunneling probability: {prob:.3f}")
    print(f"  Confidence: {confidence:.3f}")
    print(f"  Classification: {'🟢 NORMAL' if prob < 0.5 else '🔴 TUNNELING'}")

    # Example prediction: Tunneling behavior
    print("\n\nPrediction 2: Tunneling Detected")
    print("-" * 40)

    tunneling_state = BehavioralState(
        peripheral_neglect_max=45.0,  # 45 seconds (long neglect)
        interaction_entropy=0.5,  # Low entropy (repetitive)
        crisis_fixation_ratio=0.85,  # 85% fixation (tunnel vision)
        mouse_velocity_variance=400.0,  # Low variance (monotonous)
        scenario_features={
            'manual_check_frequency': 0.2,  # L3 scenario feature
            'scan_thoroughness': 0.3  # L3 scenario feature
        }
    )

    prob, confidence = clf.predict_proba(tunneling_state, scenario_id='L3')

    print(f"Features:")
    print(f"  Peripheral neglect: {tunneling_state.peripheral_neglect_max:.1f}s")
    print(f"  Interaction entropy: {tunneling_state.interaction_entropy:.2f}")
    print(f"  Crisis fixation: {tunneling_state.crisis_fixation_ratio:.2%}")
    print(f"  Mouse variance: {tunneling_state.mouse_velocity_variance:.1f}")
    print(f"\nPrediction:")
    print(f"  Tunneling probability: {prob:.3f}")
    print(f"  Confidence: {confidence:.3f}")
    print(f"  Classification: {'🟢 NORMAL' if prob < 0.5 else '🔴 TUNNELING'}")


def example_3_scenario_specific_features():
    """Example 3: Using scenario-specific features"""
    print("\n" + "="*60)
    print("Example 3: Scenario-Specific Features")
    print("="*60 + "\n")

    # Load or train model
    model_path = Path(__file__).parent.parent / 'data' / 'ml_model' / 'complacency_classifier.pkl'

    if not model_path.exists():
        clf = example_1_train_and_save()
    else:
        clf = MLComplacencyClassifier(model_path=str(model_path))

    # L1 scenario: Communication frequency
    print("L1 Scenario - Peripheral Comm Loss")
    print("-" * 40)

    l1_state = BehavioralState(
        peripheral_neglect_max=35.0,
        interaction_entropy=0.8,
        crisis_fixation_ratio=0.7,
        mouse_velocity_variance=500.0,
        scenario_features={
            'communication_frequency': 0.3  # Low communication frequency
        }
    )

    prob, conf = clf.predict_proba(l1_state, scenario_id='L1')
    print(f"Tunneling probability: {prob:.3f}, Confidence: {conf:.3f}")

    # L3 scenario: Manual checks
    print("\nL3 Scenario - Automation Surprise")
    print("-" * 40)

    l3_state = BehavioralState(
        peripheral_neglect_max=40.0,
        interaction_entropy=0.6,
        crisis_fixation_ratio=0.75,
        mouse_velocity_variance=450.0,
        scenario_features={
            'manual_check_frequency': 0.2,  # Low manual check frequency
            'scan_thoroughness': 0.3  # Low scan thoroughness
        }
    )

    prob, conf = clf.predict_proba(l3_state, scenario_id='L3')
    print(f"Tunneling probability: {prob:.3f}, Confidence: {conf:.3f}")

    # H5 scenario: Multi-crisis attention
    print("\nH5 Scenario - Multi-Crisis Management")
    print("-" * 40)

    h5_state = BehavioralState(
        peripheral_neglect_max=50.0,
        interaction_entropy=0.4,
        crisis_fixation_ratio=0.9,
        mouse_velocity_variance=350.0,
        scenario_features={
            'multi_crisis_attention_distribution': 0.15  # Poor attention distribution
        }
    )

    prob, conf = clf.predict_proba(h5_state, scenario_id='H5')
    print(f"Tunneling probability: {prob:.3f}, Confidence: {conf:.3f}")


def example_4_model_info():
    """Example 4: Get model information"""
    print("\n" + "="*60)
    print("Example 4: Model Information")
    print("="*60 + "\n")

    # Load or train model
    model_path = Path(__file__).parent.parent / 'data' / 'ml_model' / 'complacency_classifier.pkl'

    if not model_path.exists():
        clf = example_1_train_and_save()
    else:
        clf = MLComplacencyClassifier(model_path=str(model_path))

    # Get model info
    info = clf.get_model_info()

    print(f"Model Type: {info['model_type']}")
    print(f"Number of Estimators: {info['n_estimators']}")
    print(f"Max Depth: {info['max_depth']}")
    print(f"Number of Features: {info['n_features']}")
    print(f"\nFeatures:")
    for i, feature in enumerate(info['feature_names'], 1):
        print(f"  {i}. {feature}")

    print(f"\nPerformance Metrics:")
    metrics = info['metrics']
    print(f"  Accuracy:            {metrics['accuracy']:.4f}")
    print(f"  Precision:           {metrics['precision']:.4f}")
    print(f"  Recall:              {metrics['recall']:.4f}")
    print(f"  F1-Score:            {metrics['f1_score']:.4f}")
    print(f"  False Positive Rate: {metrics['false_positive_rate']:.4f}")

    print(f"\nScenario-Specific Features:")
    for scenario, features in info['scenario_feature_map'].items():
        print(f"  {scenario}: {', '.join(features)}")


def example_5_quick_training():
    """Example 5: Quick training with default settings"""
    print("\n" + "="*60)
    print("Example 5: Quick Training (Default Settings)")
    print("="*60 + "\n")

    # Use convenience function
    model_path = Path(__file__).parent.parent / 'data' / 'ml_model' / 'complacency_classifier.pkl'
    clf = train_default_model(save_path=str(model_path))

    print(f"\n✓ Quick training complete!")
    print(f"✓ Model saved to: {model_path}")


if __name__ == '__main__':
    print("\n" + "="*70)
    print("ML Complacency Classifier - Usage Examples")
    print("="*70)

    # Run examples
    print("\n[Choose which example to run]")
    print("1. Train and save model")
    print("2. Load and predict")
    print("3. Scenario-specific features")
    print("4. Model information")
    print("5. Quick training (default)")
    print("0. Run all examples")

    try:
        choice = input("\nEnter choice (0-5): ").strip()

        if choice == '1':
            example_1_train_and_save()
        elif choice == '2':
            example_2_load_and_predict()
        elif choice == '3':
            example_3_scenario_specific_features()
        elif choice == '4':
            example_4_model_info()
        elif choice == '5':
            example_5_quick_training()
        elif choice == '0':
            example_1_train_and_save()
            example_2_load_and_predict()
            example_3_scenario_specific_features()
            example_4_model_info()
        else:
            print("Invalid choice. Running default example...")
            example_2_load_and_predict()

    except KeyboardInterrupt:
        print("\n\n✓ Examples interrupted")
    except Exception as e:
        print(f"\n✗ Error: {e}")

    print("\n" + "="*70)
    print("Examples Complete")
    print("="*70 + "\n")
