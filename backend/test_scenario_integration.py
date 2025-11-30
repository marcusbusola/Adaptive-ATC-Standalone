"""
Minimal integration sanity check for scenario lifecycle against current API contract.
Starts a session, starts the scenario timer, polls updates with elapsed_time, and ends.
"""

import time
import requests

BASE_URL = "http://localhost:8000"


def run_scenario(scenario: str, condition: int) -> bool:
    print(f"\n=== Running {scenario} (condition {condition}) ===")
    try:
        # Create session
        resp = requests.post(
            f"{BASE_URL}/api/sessions/start",
            json={"scenario": scenario, "condition": condition, "participant_id": f"TEST_{scenario}_001"},
        )
        resp.raise_for_status()
        session = resp.json()
        session_id = session["session_id"]
        print(f"Session created: {session_id}")

        # Start scenario timer
        resp = requests.post(f"{BASE_URL}/api/sessions/{session_id}/start")
        resp.raise_for_status()
        start_info = resp.json()
        print(f"Scenario started: {start_info.get('status', 'started')}")

        # Poll updates with explicit elapsed_time to match API contract
        for i in range(5):
            elapsed = (i + 1) * 5
            resp = requests.post(
                f"{BASE_URL}/api/sessions/{session_id}/update",
                json={"elapsed_time": float(elapsed)},
            )
            resp.raise_for_status()
            update = resp.json()
            print(f"T+{elapsed}s phase={update.get('current_phase')} events={len(update.get('triggered_events', []))}")
            time.sleep(0.5)

        # End session
        resp = requests.post(f"{BASE_URL}/api/sessions/{session_id}/end", json={"reason": "test_completed"})
        resp.raise_for_status()
        summary = resp.json()
        print(f"Ended session {session_id} at {summary.get('ended_at')}")
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"Test failed for {scenario}: {exc}")
        return False


if __name__ == "__main__":
    all_passed = run_scenario("L1", 2)
    if all_passed:
        print("\nAll integration checks passed")
    else:
        raise SystemExit(1)
