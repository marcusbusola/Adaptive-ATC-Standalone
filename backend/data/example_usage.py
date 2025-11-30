#!/usr/bin/env python3
"""
Database Usage Examples for ATC Adaptive Alert Research System

Demonstrates how to use the database utilities to:
- Create sessions
- Store behavioral events
- Track alerts
- Record metrics
- Store survey data
"""

import time
import json
from datetime import datetime
from db_utils import get_db_manager


def example_complete_session():
    """Example: Complete session lifecycle"""
    print("\n" + "="*60)
    print("Example: Complete Session Lifecycle")
    print("="*60 + "\n")

    # Get database manager
    db = get_db_manager()

    # 1. Create a session
    print("1. Creating session...")
    session_id = f"example_session_{int(time.time())}"

    db.create_session(
        session_id=session_id,
        participant_id="P001",
        scenario="L1",
        condition=1,
        initial_state={
            "aircraft_count": 3,
            "scenario_type": "baseline_emergency",
            "weather": "clear"
        }
    )
    print(f"   ✓ Session created: {session_id}")

    # 2. Add behavioral events
    print("\n2. Adding behavioral events...")
    for i in range(5):
        db.add_behavioral_event(
            session_id=session_id,
            event_type="mouse_move",
            timestamp=time.time(),
            event_data={
                "x": 100 + i * 50,
                "y": 200 + i * 30,
                "target": "radar_display"
            },
            screen_width=1920,
            screen_height=1080
        )

    db.add_behavioral_event(
        session_id=session_id,
        event_type="click",
        timestamp=time.time(),
        event_data={
            "x": 450,
            "y": 300,
            "target": "aircraft_AAL123",
            "button": "left"
        }
    )
    print("   ✓ Added 6 behavioral events")

    # 3. Add scenario events
    print("\n3. Adding scenario events...")
    db.add_scenario_event(
        session_id=session_id,
        event_id="L1_001",
        event_name="Scenario Begin",
        event_type="system_event",
        scenario_time=0.0,
        event_data={"traffic_count": 3, "sector_status": "normal"}
    )

    db.add_scenario_event(
        session_id=session_id,
        event_id="L1_002",
        event_name="Fuel Emergency",
        event_type="emergency",
        scenario_time=60.0,
        event_data={
            "aircraft": "AAL123",
            "fuel_remaining": "15 minutes",
            "souls_on_board": 156
        },
        severity="critical",
        aircraft_id="AAL123"
    )
    print("   ✓ Added 2 scenario events")

    # 4. Add alerts
    print("\n4. Adding alerts...")
    alert_id = f"alert_{int(time.time())}"

    db.add_alert(
        session_id=session_id,
        alert_id=alert_id,
        alert_type="fuel_emergency",
        condition=1,
        priority="critical",
        message="AAL123 reports fuel critical. 15 minutes remaining.",
        aircraft_id="AAL123",
        presentation_data={
            "style": "modal",
            "blocking": True,
            "audio": True
        },
        additional_data={
            "fuel_remaining_minutes": 15,
            "recommended_action": "immediate_landing"
        }
    )
    print(f"   ✓ Alert created: {alert_id}")

    # Simulate delay before acknowledgment
    time.sleep(0.5)

    # 5. Acknowledge alert
    print("\n5. Acknowledging alert...")
    db.acknowledge_alert(
        alert_id=alert_id,
        action_taken="cleared_to_land",
        action_correct=True
    )
    print("   ✓ Alert acknowledged")

    # 6. Add metrics
    print("\n6. Adding performance metrics...")
    db.add_metric(
        session_id=session_id,
        metric_name="alert_response_time",
        metric_category="performance",
        metric_value=1.234,
        metric_unit="seconds",
        phase="during",
        alert_id=alert_id
    )

    db.add_metric(
        session_id=session_id,
        metric_name="workload_score",
        metric_category="workload",
        metric_value=6.5,
        metric_unit="score",
        phase="during",
        metric_data={"scale": "1-10", "method": "continuous_assessment"}
    )
    print("   ✓ Added 2 metrics")

    # 7. Add survey
    print("\n7. Adding survey data...")
    survey_id = f"survey_{int(time.time())}"

    db.add_survey(
        session_id=session_id,
        survey_id=survey_id,
        survey_type="NASA-TLX",
        survey_phase="post",
        responses={
            "mental_demand": 7,
            "physical_demand": 3,
            "temporal_demand": 8,
            "performance": 6,
            "effort": 7,
            "frustration": 4
        },
        overall_score=58.3,
        subscale_scores={
            "mental_demand": 7,
            "physical_demand": 3,
            "temporal_demand": 8,
            "performance": 6,
            "effort": 7,
            "frustration": 4
        },
        duration_seconds=120
    )
    print(f"   ✓ Survey added: {survey_id}")

    # 8. End session
    print("\n8. Ending session...")
    db.end_session(
        session_id=session_id,
        end_reason="completed",
        final_state={
            "emergency_resolved": True,
            "aircraft_landed": True,
            "completion_status": "success"
        },
        performance_score=85.5
    )
    print("   ✓ Session ended")

    # 9. Retrieve session summary
    print("\n9. Retrieving session summary...")
    summary = db.get_session_summary(session_id)
    if summary:
        print(f"   Session ID: {summary['session_id']}")
        print(f"   Participant: {summary['participant_id']}")
        print(f"   Scenario: {summary['scenario']} (Condition {summary['condition']})")
        print(f"   Duration: {summary['duration_seconds']:.1f}s")
        print(f"   Behavioral Events: {summary['behavioral_event_count']}")
        print(f"   Scenario Events: {summary['scenario_event_count']}")
        print(f"   Alerts: {summary['alert_count']}")
        print(f"   Avg Response Time: {summary['avg_alert_response_time']:.3f}ms" if summary['avg_alert_response_time'] else "   Avg Response Time: N/A")
        print(f"   Performance Score: {summary['performance_score']}")

    print("\n✓ Example completed successfully!\n")


def example_query_data():
    """Example: Query and analyze data"""
    print("\n" + "="*60)
    print("Example: Query and Analyze Data")
    print("="*60 + "\n")

    db = get_db_manager()

    # Get participant performance
    print("1. Participant Performance:")
    perf = db.get_participant_performance("P001")
    if perf:
        print(f"   Total Sessions: {perf['total_sessions']}")
        print(f"   Avg Performance: {perf['avg_performance']:.1f}" if perf['avg_performance'] else "   Avg Performance: N/A")
        print(f"   Avg Duration: {perf['avg_session_duration']:.1f}s" if perf['avg_session_duration'] else "   Avg Duration: N/A")

    # Get scenario difficulty
    print("\n2. Scenario Difficulty Analysis:")
    difficulties = db.get_scenario_difficulty()
    for diff in difficulties:
        print(f"   {diff['scenario']}: Score={diff['avg_performance']:.1f}, Sessions={diff['session_count']}")

    # Get alerts by condition
    print("\n3. Alert Performance by Condition:")
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                condition,
                COUNT(*) as total,
                AVG(response_time) as avg_response,
                SUM(CASE WHEN was_acknowledged THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as ack_rate
            FROM alerts
            GROUP BY condition
        """)

        for row in cursor.fetchall():
            print(f"   Condition {row[0]}: {row[1]} alerts, "
                  f"{row[2]:.1f}ms avg response, {row[3]:.1f}% acknowledged")

    print()


def example_export_data():
    """Example: Export session data"""
    print("\n" + "="*60)
    print("Example: Export Session Data")
    print("="*60 + "\n")

    db = get_db_manager()

    # Get all sessions for a participant
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT session_id FROM sessions
            WHERE participant_id = ?
            ORDER BY started_at DESC
            LIMIT 1
        """, ("P001",))

        row = cursor.fetchone()
        if not row:
            print("No sessions found for P001")
            return

        session_id = row[0]

    print(f"Exporting session: {session_id}\n")

    # Get complete session data
    session = db.get_session(session_id)
    behavioral_events = db.get_behavioral_events(session_id)
    alerts = db.get_alerts(session_id)
    metrics = db.get_metrics(session_id)

    # Create export structure
    export_data = {
        "session": session,
        "behavioral_events": behavioral_events,
        "alerts": alerts,
        "metrics": metrics
    }

    # Save to JSON
    filename = f"session_export_{session_id}.json"
    with open(filename, 'w') as f:
        json.dump(export_data, f, indent=2, default=str)

    print(f"✓ Session data exported to: {filename}")
    print(f"  - Session metadata: 1 record")
    print(f"  - Behavioral events: {len(behavioral_events)} records")
    print(f"  - Alerts: {len(alerts)} records")
    print(f"  - Metrics: {len(metrics)} records")
    print()


def example_batch_insert():
    """Example: Batch insert behavioral events"""
    print("\n" + "="*60)
    print("Example: Batch Insert Behavioral Events")
    print("="*60 + "\n")

    db = get_db_manager()

    # Create test session
    session_id = f"batch_test_{int(time.time())}"
    db.create_session(
        session_id=session_id,
        participant_id="P002",
        scenario="L2",
        condition=2
    )

    print(f"Created session: {session_id}\n")

    # Batch insert events
    print("Inserting 1000 behavioral events...")
    start_time = time.time()

    with db.get_connection() as conn:
        cursor = conn.cursor()

        # Use executemany for batch insert
        events = []
        for i in range(1000):
            events.append((
                session_id,
                "mouse_move",
                time.time() + i * 0.001,
                json.dumps({"x": i % 1920, "y": i % 1080}),
                1920,
                1080
            ))

        cursor.executemany("""
            INSERT INTO behavioral_events
            (session_id, event_type, timestamp, event_data, screen_width, screen_height)
            VALUES (?, ?, ?, ?, ?, ?)
        """, events)

        conn.commit()

    elapsed = time.time() - start_time
    print(f"✓ Inserted 1000 events in {elapsed:.3f}s ({1000/elapsed:.0f} events/sec)")

    # Clean up
    db.end_session(session_id)
    print()


def main():
    """Run all examples"""
    print("\n" + "="*60)
    print("ATC Research Database - Usage Examples")
    print("="*60)

    try:
        # Run examples
        example_complete_session()
        example_query_data()
        example_export_data()
        example_batch_insert()

        print("="*60)
        print("All examples completed successfully!")
        print("="*60 + "\n")

    except Exception as e:
        print(f"\n✗ Error: {e}\n")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
