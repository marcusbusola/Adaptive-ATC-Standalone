#!/usr/bin/env python3
"""
Quick Demo: How to Use the ATC API
Run this to see the API in action!
"""

import requests
import time
import json

BASE_URL = "http://localhost:8000"

print("=" * 70)
print("ATC Adaptive Alert System - API Demo")
print("=" * 70)

# 1. Create a session
print("\n1️⃣  Creating a new session (Scenario L1, Condition 2: Rule-Based)...")
response = requests.post(
    f"{BASE_URL}/api/sessions/start",
    json={
        "scenario": "L1",           # Baseline Emergency
        "condition": 2,              # 1=Traditional, 2=Rule-Based, 3=ML
        "participant_id": "DEMO_001"
    }
)

if response.status_code != 201:
    print(f"❌ Error: {response.status_code}")
    print(response.text)
    exit(1)

session_data = response.json()
session_id = session_data['session_id']
initial_state = session_data['initial_state']

print(f"✅ Session created: {session_id}")
print(f"   Aircraft count: {initial_state['aircraft_count']}")
print(f"   Condition: {initial_state['condition']}")
print(f"   Aircraft: {', '.join(initial_state['aircraft'].keys())}")

# 2. Start the scenario
print(f"\n2️⃣  Starting scenario timer...")
response = requests.post(f"{BASE_URL}/api/sessions/{session_id}/start")
start_data = response.json()
print(f"✅ Scenario started at T+{start_data['state']['elapsed_time']:.1f}s")

# 3. Run update loop
print(f"\n3️⃣  Running scenario for 10 seconds...")
print("   (In real app, call /update every 1 second)")

for i in range(10):
    response = requests.post(f"{BASE_URL}/api/sessions/{session_id}/update")
    update_data = response.json()['update_data']

    elapsed = update_data['elapsed_time']
    phase = update_data['current_phase']

    print(f"   T+{elapsed:5.1f}s | Phase {phase} | ", end="")

    # Check for events
    if update_data.get('triggered_events'):
        for event in update_data['triggered_events']:
            print(f"🚨 EVENT: {event['event_type']} - {event['target']}")
    else:
        print("No events")

    # Check for SAGAT probes
    if update_data.get('triggered_probes'):
        print(f"   📋 SAGAT Probe triggered!")

    time.sleep(1)

# 4. Record an interaction
print(f"\n4️⃣  Recording interaction (participant clicked on AAL119)...")
response = requests.post(
    f"{BASE_URL}/api/sessions/{session_id}/interactions",
    json={
        "interaction_type": "click",
        "target": "AAL119",
        "data": {"timestamp": time.time()}
    }
)

if response.status_code == 200:
    print("✅ Interaction recorded")
else:
    print(f"⚠️  Issue recording interaction: {response.status_code}")

# 5. End the session
print(f"\n5️⃣  Ending session...")
response = requests.post(
    f"{BASE_URL}/api/sessions/{session_id}/end",
    json={"reason": "demo_completed"}
)

if response.status_code == 200:
    end_data = response.json()
    summary = end_data['summary']

    print(f"✅ Session ended")
    print(f"\n📊 Summary:")
    print(f"   Duration: {summary['duration_seconds']:.1f} seconds")
    print(f"   Events: {summary['total_events']}")
    print(f"   Status: {summary['status']}")

    if 'performance' in summary:
        print(f"\n🎯 Performance:")
        print(json.dumps(summary['performance'], indent=2))
else:
    print(f"❌ Error ending session: {response.status_code}")

print("\n" + "=" * 70)
print("Demo complete! Check the API docs at: http://localhost:8000/docs")
print("=" * 70)
