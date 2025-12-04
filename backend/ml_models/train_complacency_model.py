#!/usr/bin/env python3
"""
Training Script for Complacency Detection Model

Generates synthetic training data and trains the RandomForest classifier
for complacency detection in Condition 3.

Supports:
- Synthetic data training (for initial bootstrap)
- Real data training from database (continuous learning)

Usage:
    python train_complacency_model.py
    python train_complacency_model.py --samples 1000 --output my_model.pkl
    python train_complacency_model.py --from-db  # Train from real session data
"""

import numpy as np
import pandas as pd
from pathlib import Path
import argparse
from typing import List, Dict, Any, Optional, Tuple
import json
import asyncio
from datetime import datetime
from complacency_detector import ComplacencyDetector, BehavioralFeatureExtractor

# Import for database training
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from data.db_utils import DatabaseManager, get_db_manager


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


# ============================================================
# CONTINUOUS LEARNING: Train from Real Database Data
# ============================================================

async def fetch_training_data_from_db(
    db_manager: DatabaseManager,
    min_performance_threshold: float = 50.0,
    max_performance_threshold: float = 80.0
) -> Tuple[List[Dict[str, float]], List[int]]:
    """
    Fetch training data from completed sessions in the database.

    Auto-labeling heuristic:
    - performance_score < min_threshold (50) → Complacent (1)
    - performance_score > max_threshold (80) → Normal (0)
    - Middle scores are ignored (too ambiguous)

    Args:
        db_manager: Database manager instance
        min_performance_threshold: Below this = complacent
        max_performance_threshold: Above this = normal

    Returns:
        Tuple of (features_list, labels_list)
    """
    extractor = BehavioralFeatureExtractor()
    features_list = []
    labels = []

    # Query all completed sessions with performance scores
    async with db_manager.get_connection() as conn:
        query = """
            SELECT session_id, participant_id, scenario, condition, performance_score
            FROM sessions
            WHERE status = 'completed'
            AND performance_score IS NOT NULL
        """
        sessions = await conn.fetch_all(query)

    print(f"\nFound {len(sessions)} completed sessions with performance scores")

    labeled_count = 0
    skipped_count = 0

    for session in sessions:
        session_id = session['session_id']
        score = session['performance_score']

        # Auto-label based on performance score
        if score < min_performance_threshold:
            label = 1  # Complacent
        elif score > max_performance_threshold:
            label = 0  # Normal
        else:
            # Ambiguous score - skip this session
            skipped_count += 1
            continue

        # Fetch behavioral events for this session
        events = await db_manager.get_behavioral_events(session_id)

        if len(events) < 10:
            # Not enough events to extract meaningful features
            skipped_count += 1
            continue

        # Convert event_data from JSON string if needed
        processed_events = []
        for event in events:
            processed_event = {
                'timestamp': event.get('timestamp', 0),
                'event_type': event.get('event_type', 'unknown'),
                'data': event.get('event_data', {})
            }
            # Parse event_data if it's a string
            if isinstance(processed_event['data'], str):
                try:
                    processed_event['data'] = json.loads(processed_event['data'])
                except json.JSONDecodeError:
                    processed_event['data'] = {}
            processed_events.append(processed_event)

        # Extract features
        try:
            features = extractor.extract_features(processed_events)
            features_list.append(features)
            labels.append(label)
            labeled_count += 1
        except Exception as e:
            print(f"  Warning: Could not extract features for session {session_id}: {e}")
            skipped_count += 1
            continue

    print(f"  Labeled: {labeled_count} sessions")
    print(f"  Skipped: {skipped_count} sessions (ambiguous score or insufficient events)")
    print(f"  Normal (0): {labels.count(0)}")
    print(f"  Complacent (1): {labels.count(1)}")

    return features_list, labels


async def train_from_db(
    db_manager: Optional[DatabaseManager] = None,
    output_path: Optional[str] = None,
    min_samples: int = 10,
    augment_with_synthetic: bool = True,
    synthetic_samples: int = 100
) -> Dict[str, Any]:
    """
    Train the complacency model using real data from the database.

    This function implements continuous learning - it queries all completed
    sessions, auto-labels them based on performance score, and retrains
    the model with the cumulative dataset.

    Args:
        db_manager: Database manager instance (will create one if not provided)
        output_path: Path to save the trained model
        min_samples: Minimum samples required to train (will augment if below)
        augment_with_synthetic: If True, add synthetic data when real data is sparse
        synthetic_samples: Number of synthetic samples to add if augmenting

    Returns:
        Dictionary with training results:
        - status: 'success' or 'insufficient_data'
        - samples: Number of samples used
        - accuracy: Model accuracy
        - message: Human-readable result
    """
    print(f"\n{'='*60}")
    print("Continuous Learning: Training from Database")
    print(f"{'='*60}\n")

    # Initialize database manager if not provided
    if db_manager is None:
        db_manager = get_db_manager()
        await db_manager.connect()
        should_disconnect = True
    else:
        should_disconnect = False

    try:
        # Fetch training data from database
        features_list, labels = await fetch_training_data_from_db(db_manager)

        # Check if we have enough data
        if len(features_list) < min_samples:
            print(f"\nInsufficient real data ({len(features_list)} samples, need {min_samples})")

            if augment_with_synthetic:
                print(f"Augmenting with {synthetic_samples} synthetic samples...")
                generator = SyntheticDataGenerator()

                # Generate balanced synthetic data
                synthetic_X, synthetic_y = generator.generate_training_dataset(
                    n_samples=synthetic_samples,
                    balance_classes=True
                )

                # Merge real and synthetic data
                if features_list:
                    real_df = pd.DataFrame(features_list)
                    combined_X = pd.concat([real_df, synthetic_X], ignore_index=True)
                    combined_y = np.concatenate([np.array(labels), synthetic_y])
                else:
                    combined_X = synthetic_X
                    combined_y = synthetic_y

                print(f"Total training samples: {len(combined_X)} (real: {len(features_list)}, synthetic: {len(synthetic_X)})")
            else:
                return {
                    'status': 'insufficient_data',
                    'samples': len(features_list),
                    'accuracy': None,
                    'message': f'Need at least {min_samples} labeled sessions to train. Current: {len(features_list)}'
                }
        else:
            # Enough real data - use it directly
            combined_X = pd.DataFrame(features_list)
            combined_y = np.array(labels)
            print(f"\nUsing {len(combined_X)} real samples for training")

        # Ensure we have both classes represented
        unique_labels = np.unique(combined_y)
        if len(unique_labels) < 2:
            print("Warning: Only one class present in data. Adding synthetic samples for balance...")
            generator = SyntheticDataGenerator()

            # Generate samples for missing class
            if 0 not in unique_labels:
                normal_events = [generator.generate_normal_behavior() for _ in range(20)]
                extractor = BehavioralFeatureExtractor()
                normal_features = [extractor.extract_features(e) for e in normal_events]
                normal_df = pd.DataFrame(normal_features)
                combined_X = pd.concat([combined_X, normal_df], ignore_index=True)
                combined_y = np.concatenate([combined_y, np.zeros(20)])

            if 1 not in unique_labels:
                complacent_events = [generator.generate_complacent_behavior() for _ in range(20)]
                extractor = BehavioralFeatureExtractor()
                complacent_features = [extractor.extract_features(e) for e in complacent_events]
                complacent_df = pd.DataFrame(complacent_features)
                combined_X = pd.concat([combined_X, complacent_df], ignore_index=True)
                combined_y = np.concatenate([combined_y, np.ones(20)])

        # Train the model
        detector = ComplacencyDetector()
        metrics = detector.train(
            combined_X, combined_y,
            validation_split=0.2,
            cross_validate=len(combined_X) >= 20  # Only CV if enough samples
        )

        # Determine output path
        if output_path is None:
            output_path = Path(__file__).parent / "trained_models" / "complacency_detector.pkl"
        else:
            output_path = Path(output_path)

        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Save model
        detector.save_model(str(output_path))

        # Save training metadata
        metadata = {
            'training_date': datetime.now().isoformat(),
            'training_type': 'continuous_learning',
            'total_samples': len(combined_X),
            'real_samples': len(features_list),
            'synthetic_samples': len(combined_X) - len(features_list),
            'class_distribution': {
                'normal': int(np.sum(combined_y == 0)),
                'complacent': int(np.sum(combined_y == 1))
            },
            'metrics': {k: float(v) for k, v in metrics.items()},
            'model_path': str(output_path)
        }

        metadata_path = output_path.parent / "training_metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        print(f"\n{'='*60}")
        print("Continuous Learning Complete!")
        print(f"{'='*60}")
        print(f"Model saved to: {output_path}")
        print(f"Total samples: {len(combined_X)}")
        print(f"Accuracy: {metrics['accuracy']:.4f}")

        return {
            'status': 'success',
            'samples': len(combined_X),
            'real_samples': len(features_list),
            'accuracy': metrics['accuracy'],
            'f1_score': metrics.get('f1_score', 0),
            'message': f"Model updated with {len(combined_X)} samples. Accuracy: {metrics['accuracy']:.2%}"
        }

    finally:
        if should_disconnect:
            await db_manager.disconnect()


def train_from_db_sync(db_manager: Optional[DatabaseManager] = None) -> Dict[str, Any]:
    """
    Synchronous wrapper for train_from_db for use in background tasks.

    Args:
        db_manager: Optional database manager instance

    Returns:
        Training results dictionary
    """
    return asyncio.run(train_from_db(db_manager))


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

    parser.add_argument(
        '--from-db',
        action='store_true',
        help='Train from real session data in database (continuous learning)'
    )

    parser.add_argument(
        '--augment',
        action='store_true',
        default=True,
        help='Augment with synthetic data if real data is sparse (default: True)'
    )

    args = parser.parse_args()

    # If training from database, use continuous learning
    if args.from_db:
        print(f"\n{'='*60}")
        print("Training from Database (Continuous Learning Mode)")
        print(f"{'='*60}")

        output_path = Path(__file__).parent / args.output
        result = asyncio.run(train_from_db(
            output_path=str(output_path),
            augment_with_synthetic=args.augment,
            synthetic_samples=args.samples
        ))

        print(f"\nResult: {result['message']}")
        return

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
