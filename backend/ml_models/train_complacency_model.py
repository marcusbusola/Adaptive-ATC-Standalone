#!/usr/bin/env python3
"""
Training Script for Complacency Detection Model

Generates synthetic training data and trains the RandomForest classifier
for complacency detection in Condition 3.

Usage:
    python train_complacency_model.py
    python train_complacency_model.py --samples 1000 --output my_model.pkl
"""

import numpy as np
import pandas as pd
from pathlib import Path
import argparse
from typing import List, Dict, Any
import json
from datetime import datetime
from complacency_detector import ComplacencyDetector, BehavioralFeatureExtractor


class SyntheticDataGenerator:
    """Generate synthetic behavioral data for training"""

    def __init__(self, seed: int = 42):
        """
        Initialize data generator

        Args:
            seed: Random seed for reproducibility
        """
        np.random.seed(seed)

    def generate_normal_behavior(self, duration: float = 60.0, base_time: float = 0.0) -> List[Dict[str, Any]]:
        """
        Generate normal (non-complacent) behavioral event sequence

        Characteristics:
        - High mouse velocity variance
        - Diverse interactions
        - Good peripheral coverage
        - Regular clicking
        - Varied dwell times
        """
        events = []
        current_time = base_time

        # Generate mouse movements with varied velocity
        for _ in range(np.random.randint(100, 200)):
            # Random walk with occasional jumps
            if np.random.random() < 0.2:
                # Jump to random location
                x = np.random.randint(0, 1920)
                y = np.random.randint(0, 1080)
            else:
                # Small movement
                x = max(0, min(1920, int(np.random.normal(960, 400))))
                y = max(0, min(1080, int(np.random.normal(540, 300))))

            events.append({
                'timestamp': current_time,
                'event_type': 'mouse_move',
                'data': {'x': x, 'y': y}
            })

            current_time += np.random.exponential(0.05)

        # Generate clicks with diverse targets
        for _ in range(np.random.randint(20, 40)):
            x = np.random.randint(0, 1920)
            y = np.random.randint(0, 1080)

            events.append({
                'timestamp': current_time,
                'event_type': 'click',
                'data': {
                    'x': x,
                    'y': y,
                    'target': f'target_{np.random.randint(1, 20)}'
                }
            })

            current_time += np.random.exponential(2.0)

        # Generate hover events with varied durations
        for _ in range(np.random.randint(10, 25)):
            events.append({
                'timestamp': current_time,
                'event_type': 'hover',
                'data': {
                    'target': f'aircraft_{np.random.randint(1, 10)}',
                    'duration': np.random.uniform(0.5, 3.0)
                }
            })

            current_time += np.random.exponential(3.0)

        # Generate action/command events with varied sequences
        commands = ['altitude_change', 'heading_change', 'speed_change', 'handoff', 'direct_route']
        for _ in range(np.random.randint(8, 15)):
            events.append({
                'timestamp': current_time,
                'event_type': 'action',
                'data': {
                    'action': np.random.choice(commands),
                    'response_time_ms': np.random.uniform(800, 2000)
                }
            })

            current_time += np.random.exponential(5.0)

        # Sort by timestamp
        events.sort(key=lambda x: x['timestamp'])

        return events

    def generate_complacent_behavior(self, duration: float = 60.0, base_time: float = 0.0) -> List[Dict[str, Any]]:
        """
        Generate complacent behavioral event sequence

        Characteristics:
        - Low mouse velocity variance (repetitive)
        - Low interaction entropy (repetitive)
        - High peripheral neglect (tunnel vision)
        - Low click rate
        - Low dwell variance (monotonous)
        - Repetitive commands
        """
        events = []
        current_time = base_time

        # Generate monotonous mouse movements (mostly center)
        center_x, center_y = 960, 540
        for _ in range(np.random.randint(40, 80)):
            # Stay mostly in center with small movements
            x = int(np.random.normal(center_x, 150))
            y = int(np.random.normal(center_y, 100))
            x = max(400, min(1520, x))  # Constrain to center
            y = max(300, min(780, y))

            events.append({
                'timestamp': current_time,
                'event_type': 'mouse_move',
                'data': {'x': x, 'y': y}
            })

            current_time += np.random.exponential(0.1)

        # Generate fewer clicks, repetitive targets
        repetitive_targets = [f'target_{i}' for i in range(1, 4)]
        for _ in range(np.random.randint(5, 12)):
            x = int(np.random.normal(center_x, 100))
            y = int(np.random.normal(center_y, 80))

            events.append({
                'timestamp': current_time,
                'event_type': 'click',
                'data': {
                    'x': x,
                    'y': y,
                    'target': np.random.choice(repetitive_targets)
                }
            })

            current_time += np.random.exponential(5.0)

        # Generate hover events with similar durations
        hover_duration = np.random.uniform(1.5, 2.5)
        for _ in range(np.random.randint(4, 8)):
            events.append({
                'timestamp': current_time,
                'event_type': 'hover',
                'data': {
                    'target': f'aircraft_{np.random.randint(1, 3)}',
                    'duration': hover_duration + np.random.normal(0, 0.2)
                }
            })

            current_time += np.random.exponential(6.0)

        # Generate repetitive commands with increasing response time
        base_response_time = 1500
        for i in range(np.random.randint(3, 7)):
            events.append({
                'timestamp': current_time,
                'event_type': 'action',
                'data': {
                    'action': 'altitude_change',  # Repetitive command
                    'response_time_ms': base_response_time + i * 200  # Increasing
                }
            })

            current_time += np.random.exponential(8.0)

        # Sort by timestamp
        events.sort(key=lambda x: x['timestamp'])

        return events

    def generate_training_dataset(
        self,
        n_samples: int = 500,
        balance_classes: bool = True
    ) -> tuple[pd.DataFrame, np.ndarray]:
        """
        Generate complete training dataset

        Args:
            n_samples: Number of samples to generate
            balance_classes: Whether to balance normal vs complacent

        Returns:
            Tuple of (features DataFrame, labels array)
        """
        print(f"\nGenerating {n_samples} training samples...")

        extractor = BehavioralFeatureExtractor()

        features_list = []
        labels = []

        # Determine class distribution
        if balance_classes:
            n_normal = n_samples // 2
            n_complacent = n_samples - n_normal
        else:
            # More normal samples (realistic distribution)
            n_normal = int(n_samples * 0.7)
            n_complacent = n_samples - n_normal

        # Generate normal behavior samples
        print(f"  Generating {n_normal} normal behavior samples...")
        for i in range(n_normal):
            events = self.generate_normal_behavior()
            features = extractor.extract_features(events)
            features_list.append(features)
            labels.append(0)  # 0 = normal

            if (i + 1) % 100 == 0:
                print(f"    {i + 1}/{n_normal} completed")

        # Generate complacent behavior samples
        print(f"  Generating {n_complacent} complacent behavior samples...")
        for i in range(n_complacent):
            events = self.generate_complacent_behavior()
            features = extractor.extract_features(events)
            features_list.append(features)
            labels.append(1)  # 1 = complacent

            if (i + 1) % 100 == 0:
                print(f"    {i + 1}/{n_complacent} completed")

        # Convert to DataFrame and array
        features_df = pd.DataFrame(features_list)
        labels_array = np.array(labels)

        print(f"\n✓ Dataset generation complete!")
        print(f"  Total samples: {len(features_df)}")
        print(f"  Normal: {sum(labels_array == 0)} ({sum(labels_array == 0)/len(labels_array)*100:.1f}%)")
        print(f"  Complacent: {sum(labels_array == 1)} ({sum(labels_array == 1)/len(labels_array)*100:.1f}%)")

        return features_df, labels_array


def main():
    """Main training script"""
    parser = argparse.ArgumentParser(
        description='Train complacency detection model'
    )

    parser.add_argument(
        '--samples',
        type=int,
        default=500,
        help='Number of training samples to generate (default: 500)'
    )

    parser.add_argument(
        '--output',
        type=str,
        default='trained_models/complacency_detector.pkl',
        help='Output path for trained model (default: trained_models/complacency_detector.pkl)'
    )

    parser.add_argument(
        '--no-cv',
        action='store_true',
        help='Skip cross-validation'
    )

    parser.add_argument(
        '--seed',
        type=int,
        default=42,
        help='Random seed (default: 42)'
    )

    parser.add_argument(
        '--balanced',
        action='store_true',
        help='Balance classes (50/50 normal/complacent)'
    )

    args = parser.parse_args()

    print(f"\n{'='*60}")
    print("Complacency Detection Model Training")
    print(f"{'='*60}")

    # Create output directory
    output_path = Path(__file__).parent / args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Generate training data
    generator = SyntheticDataGenerator(seed=args.seed)
    X, y = generator.generate_training_dataset(
        n_samples=args.samples,
        balance_classes=args.balanced
    )

    # Save dataset for inspection
    dataset_path = output_path.parent / "training_data.csv"
    dataset = X.copy()
    dataset['label'] = y
    dataset.to_csv(dataset_path, index=False)
    print(f"\n✓ Training data saved to: {dataset_path}")

    # Initialize detector
    detector = ComplacencyDetector()

    # Train model
    metrics = detector.train(
        X, y,
        validation_split=0.2,
        cross_validate=not args.no_cv
    )

    # Save model
    detector.save_model(str(output_path))

    # Save training metadata
    metadata_path = output_path.parent / "training_metadata.json"
    metadata = {
        'training_date': datetime.now().isoformat(),
        'samples': args.samples,
        'balanced': args.balanced,
        'seed': args.seed,
        'metrics': {k: float(v) for k, v in metrics.items()},
        'model_path': str(output_path),
        'dataset_path': str(dataset_path)
    }

    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"✓ Training metadata saved to: {metadata_path}")

    # Test prediction on new sample
    print(f"\n{'='*60}")
    print("Testing Model with New Samples")
    print(f"{'='*60}\n")

    # Generate test samples
    test_normal = generator.generate_normal_behavior()
    test_complacent = generator.generate_complacent_behavior()

    # Predict
    print("Testing on normal behavior:")
    msg_normal = detector.predict_with_message(test_normal)
    print(f"  {msg_normal}")

    print("\nTesting on complacent behavior:")
    msg_complacent = detector.predict_with_message(test_complacent)
    print(f"  {msg_complacent}")

    # Alert recommendation
    print("\nAlert recommendation for complacent behavior:")
    recommendation = detector.should_trigger_alert(test_complacent, alert_priority='medium')
    print(f"  Trigger: {recommendation['trigger_alert']}")
    print(f"  Score: {recommendation['complacency_score']:.3f}")
    print(f"  Confidence: {recommendation['confidence']:.3f}")
    print(f"  Reasoning: {recommendation['reasoning']}")
    if recommendation['risk_regions']:
        print(f"  Risk regions: {len(recommendation['risk_regions'])}")
        for region in recommendation['risk_regions']:
            print(f"    - {region['region']}: {region['reason']}")

    print(f"\n{'='*60}")
    print("Training Complete!")
    print(f"{'='*60}")
    print(f"\nModel saved to: {output_path}")
    print(f"To use the model:")
    print(f"  from complacency_detector import ComplacencyDetector")
    print(f"  detector = ComplacencyDetector('{output_path}')")
    print(f"  result = detector.predict(events)")
    print(f"\n{'='*60}\n")


if __name__ == "__main__":
    main()
