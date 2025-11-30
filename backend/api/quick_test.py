#!/usr/bin/env python3
"""
Quick test script to verify the ATC Research API is working correctly

This script performs a quick end-to-end test of all API endpoints.
"""

import requests
import time
from typing import Dict, Any


class Colors:
    """ANSI color codes for terminal output"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'
    BOLD = '\033[1m'


def print_header(text: str):
    """Print a formatted header"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")


def print_success(text: str):
    """Print success message"""
    print(f"{Colors.GREEN}✓ {text}{Colors.END}")


def print_error(text: str):
    """Print error message"""
    print(f"{Colors.RED}✗ {text}{Colors.END}")


def print_info(text: str):
    """Print info message"""
    print(f"{Colors.YELLOW}ℹ {text}{Colors.END}")


def test_health_check(base_url: str) -> bool:
    """Test health check endpoint"""
    print_header("Testing Health Check")

    try:
        response = requests.get(f"{base_url}/health")
        response.raise_for_status()

        data = response.json()
        print_success(f"Server is healthy")
        print_info(f"Active sessions: {data.get('active_sessions', 0)}")
        print_info(f"WebSocket connections: {data.get('websocket_connections', 0)}")
        return True

    except Exception as e:
        print_error(f"Health check failed: {e}")
        return False


def test_session_lifecycle(base_url: str) -> Dict[str, Any]:
    """Test complete session lifecycle"""
    print_header("Testing Session Lifecycle")

    session_id = None

    try:
        # Start session
        print("\n1. Starting session...")
        response = requests.post(
            f"{base_url}/api/sessions/start",
            json={
                "scenario": "L1",
                "condition": 1,
                "participant_id": f"TEST_{int(time.time())}"
            }
        )
        response.raise_for_status()

        data = response.json()
        session_id = data["session_id"]

        print_success(f"Session started: {session_id}")
        print_info(f"WebSocket URL: {data['websocket_url']}")
        print_info(f"Aircraft count: {len(data['initial_state'].get('aircraft', []))}")

        # Wait a bit
        time.sleep(1)

        # Send some events
        print("\n2. Sending behavioral events...")
        for i in range(3):
            event_response = requests.post(
                f"{base_url}/api/events",
                json={
                    "session_id": session_id,
                    "event_type": "click",
                    "timestamp": time.time(),
                    "data": {"x": 100 + i * 50, "y": 200}
                }
            )
            event_response.raise_for_status()

        print_success("Sent 3 behavioral events")

        # Trigger an alert
        print("\n3. Triggering alert...")
        alert_response = requests.post(
            f"{base_url}/api/alerts/trigger",
            json={
                "session_id": session_id,
                "alert_type": "test_alert",
                "priority": "medium",
                "message": "This is a test alert",
                "data": {"test": True}
            }
        )
        alert_response.raise_for_status()

        alert_data = alert_response.json()
        print_success(f"Alert triggered: {alert_data['alert_id']}")

        # Get session data
        print("\n4. Retrieving session data...")
        data_response = requests.get(f"{base_url}/api/sessions/{session_id}/data")
        data_response.raise_for_status()

        session_data = data_response.json()
        print_success("Session data retrieved")
        print_info(f"Total events: {len(session_data.get('events', []))}")
        print_info(f"Total alerts: {len(session_data.get('alerts', []))}")
        print_info(f"Behavioral data: {len(session_data.get('behavioral_data', []))}")

        # End session
        print("\n5. Ending session...")
        end_response = requests.post(
            f"{base_url}/api/sessions/{session_id}/end",
            json={"reason": "test_completed"}
        )
        end_response.raise_for_status()

        end_data = end_response.json()
        summary = end_data.get("summary", {})

        print_success("Session ended successfully")
        print_info(f"Duration: {summary.get('duration_seconds', 0):.1f}s")
        print_info(f"Total events: {summary.get('total_events', 0)}")
        print_info(f"Total alerts: {summary.get('total_alerts', 0)}")

        return {"success": True, "session_id": session_id}

    except Exception as e:
        print_error(f"Session lifecycle test failed: {e}")

        # Try to clean up
        if session_id:
            try:
                requests.post(f"{base_url}/api/sessions/{session_id}/end")
            except:
                pass

        return {"success": False, "error": str(e)}


def test_all_scenarios(base_url: str) -> bool:
    """Test all scenario types"""
    print_header("Testing All Scenarios")

    scenarios = ["L1", "L2", "H4", "H5"]
    conditions = [1, 2, 3]

    success_count = 0
    total_tests = len(scenarios) * len(conditions)

    print(f"\nTesting {total_tests} scenario/condition combinations...\n")

    for scenario in scenarios:
        for condition in conditions:
            try:
                response = requests.post(
                    f"{base_url}/api/sessions/start",
                    json={
                        "scenario": scenario,
                        "condition": condition,
                        "participant_id": f"TEST_{scenario}_{condition}"
                    }
                )
                response.raise_for_status()

                data = response.json()
                session_id = data["session_id"]

                # End session immediately
                requests.post(f"{base_url}/api/sessions/{session_id}/end")

                print_success(f"{scenario} + Condition {condition}")
                success_count += 1

            except Exception as e:
                print_error(f"{scenario} + Condition {condition}: {e}")

    print(f"\n{success_count}/{total_tests} tests passed")
    return success_count == total_tests


def test_error_handling(base_url: str) -> bool:
    """Test error handling"""
    print_header("Testing Error Handling")

    tests_passed = 0
    total_tests = 3

    # Test 1: Invalid session ID
    print("\n1. Testing invalid session ID...")
    try:
        response = requests.get(f"{base_url}/api/sessions/invalid_session_123/data")
        if response.status_code == 404:
            print_success("Correctly returns 404 for invalid session")
            tests_passed += 1
        else:
            print_error(f"Expected 404, got {response.status_code}")
    except Exception as e:
        print_error(f"Test failed: {e}")

    # Test 2: Invalid scenario
    print("\n2. Testing invalid scenario...")
    try:
        response = requests.post(
            f"{base_url}/api/sessions/start",
            json={
                "scenario": "INVALID",
                "condition": 1,
                "participant_id": "TEST"
            }
        )
        if response.status_code in [400, 422]:
            print_success(f"Correctly returns {response.status_code} for invalid scenario")
            tests_passed += 1
        else:
            print_error(f"Expected 400/422, got {response.status_code}")
    except Exception as e:
        print_error(f"Test failed: {e}")

    # Test 3: Missing required field
    print("\n3. Testing missing required field...")
    try:
        response = requests.post(
            f"{base_url}/api/sessions/start",
            json={
                "scenario": "L1",
                "condition": 1
                # Missing participant_id
            }
        )
        if response.status_code == 422:
            print_success("Correctly returns 422 for missing field")
            tests_passed += 1
        else:
            print_error(f"Expected 422, got {response.status_code}")
    except Exception as e:
        print_error(f"Test failed: {e}")

    print(f"\n{tests_passed}/{total_tests} error handling tests passed")
    return tests_passed == total_tests


def main():
    """Run all tests"""
    base_url = "http://localhost:8000"

    print(f"\n{Colors.BOLD}{'='*60}")
    print(f"ATC Adaptive Alert Research System - Quick Test")
    print(f"{'='*60}{Colors.END}")
    print(f"\nTesting server at: {base_url}")

    # Check if server is running
    try:
        requests.get(base_url, timeout=2)
    except requests.exceptions.ConnectionError:
        print_error(f"\nServer is not running at {base_url}")
        print_info("Start the server with: python server.py")
        return
    except Exception as e:
        print_error(f"\nFailed to connect to server: {e}")
        return

    # Run tests
    results = {
        "health_check": test_health_check(base_url),
        "session_lifecycle": test_session_lifecycle(base_url)["success"],
        "all_scenarios": test_all_scenarios(base_url),
        "error_handling": test_error_handling(base_url)
    }

    # Summary
    print_header("Test Summary")

    total = len(results)
    passed = sum(1 for v in results.values() if v)

    for test_name, result in results.items():
        status = "PASS" if result else "FAIL"
        color = Colors.GREEN if result else Colors.RED
        print(f"{color}{status}{Colors.END} - {test_name.replace('_', ' ').title()}")

    print(f"\n{Colors.BOLD}Total: {passed}/{total} test suites passed{Colors.END}")

    if passed == total:
        print(f"\n{Colors.GREEN}{Colors.BOLD}🎉 All tests passed! The API is working correctly.{Colors.END}\n")
    else:
        print(f"\n{Colors.RED}{Colors.BOLD}⚠️  Some tests failed. Check the output above for details.{Colors.END}\n")


if __name__ == "__main__":
    main()
