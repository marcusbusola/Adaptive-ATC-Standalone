"""
Example client demonstrating how to use the ATC Adaptive Alert Research System API

This script shows:
1. Starting a session
2. Connecting to WebSocket
3. Sending behavioral data
4. Receiving alerts
5. Ending a session
"""

import asyncio
import json
import time
import requests
from websockets import connect
from typing import Dict, Any


class ATCResearchClient:
    """Client for interacting with the ATC Research API"""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session_id = None
        self.ws_url = None
        self.ws = None

    def start_session(self, scenario: str, condition: int, participant_id: str) -> Dict[str, Any]:
        """
        Start a new research session

        Args:
            scenario: Scenario type (L1, L2, H4, H5)
            condition: Alert condition (1, 2, 3)
            participant_id: Participant identifier

        Returns:
            Session data including session_id and websocket_url
        """
        print(f"\n{'='*60}")
        print(f"Starting session: {scenario} | Condition {condition} | Participant {participant_id}")
        print(f"{'='*60}")

        url = f"{self.base_url}/api/sessions/start"
        payload = {
            "scenario": scenario,
            "condition": condition,
            "participant_id": participant_id
        }

        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()

            data = response.json()
            self.session_id = data["session_id"]
            self.ws_url = data["websocket_url"]

            print(f"✓ Session started successfully")
            print(f"  Session ID: {self.session_id}")
            print(f"  WebSocket URL: {self.ws_url}")
            print(f"  Aircraft count: {len(data['initial_state'].get('aircraft', []))}")

            return data

        except requests.exceptions.RequestException as e:
            print(f"✗ Failed to start session: {e}")
            raise

    async def connect_websocket(self):
        """Connect to WebSocket for real-time communication"""
        if not self.ws_url:
            raise ValueError("No WebSocket URL available. Start a session first.")

        print(f"\n{'='*60}")
        print("Connecting to WebSocket...")
        print(f"{'='*60}")

        try:
            self.ws = await connect(self.ws_url)
            print("✓ WebSocket connected")

            # Receive connection confirmation
            message = await self.ws.recv()
            data = json.loads(message)
            print(f"  Message: {data['type']} - {data.get('session_id', 'N/A')}")

            return True

        except Exception as e:
            print(f"✗ WebSocket connection failed: {e}")
            raise

    async def send_behavioral_event(self, event_type: str, data: Dict[str, Any]):
        """
        Send a behavioral event via WebSocket

        Args:
            event_type: Type of event (mouse_move, click, etc.)
            data: Event data
        """
        if not self.ws:
            raise ValueError("WebSocket not connected")

        message = {
            "type": "behavioral_data",
            "event_type": event_type,
            "timestamp": time.time(),
            "data": data
        }

        await self.ws.send(json.dumps(message))
        print(f"  → Sent: {event_type}")

    async def send_action(self, action: str, action_data: Dict[str, Any]):
        """
        Send a user action via WebSocket

        Args:
            action: Action type
            action_data: Action details
        """
        if not self.ws:
            raise ValueError("WebSocket not connected")

        message = {
            "type": "action",
            "timestamp": time.time(),
            "data": {
                "action": action,
                **action_data
            }
        }

        await self.ws.send(json.dumps(message))
        print(f"  → Action: {action}")

    async def send_acknowledgment(self, alert_id: str, response_time_ms: float):
        """
        Send an alert acknowledgment

        Args:
            alert_id: Alert identifier
            response_time_ms: Response time in milliseconds
        """
        if not self.ws:
            raise ValueError("WebSocket not connected")

        message = {
            "type": "acknowledgment",
            "timestamp": time.time(),
            "alert_id": alert_id,
            "data": {
                "response_time_ms": response_time_ms,
                "action_taken": "acknowledged"
            }
        }

        await self.ws.send(json.dumps(message))
        print(f"  → Acknowledged alert: {alert_id} ({response_time_ms}ms)")

    async def listen_for_messages(self, duration: float = 10.0):
        """
        Listen for messages from server

        Args:
            duration: How long to listen (seconds)
        """
        if not self.ws:
            raise ValueError("WebSocket not connected")

        print(f"\n{'='*60}")
        print(f"Listening for messages (for {duration}s)...")
        print(f"{'='*60}")

        start_time = time.time()

        try:
            while time.time() - start_time < duration:
                try:
                    message = await asyncio.wait_for(self.ws.recv(), timeout=1.0)
                    data = json.loads(message)

                    msg_type = data.get("type")

                    if msg_type == "alert":
                        alert_data = data.get("data", {})
                        print(f"\n  🚨 ALERT RECEIVED:")
                        print(f"     ID: {alert_data.get('alert_id')}")
                        print(f"     Type: {alert_data.get('alert_type')}")
                        print(f"     Priority: {alert_data.get('priority')}")
                        print(f"     Message: {alert_data.get('message')}")

                        # Simulate acknowledgment
                        await self.send_acknowledgment(
                            alert_data.get('alert_id'),
                            response_time_ms=250.0
                        )

                    elif msg_type == "scenario_event":
                        print(f"\n  📋 Scenario Event: {data.get('event_type')}")

                    elif msg_type == "system":
                        print(f"\n  ℹ️  System: {data.get('message')}")

                except asyncio.TimeoutError:
                    continue

        except Exception as e:
            print(f"✗ Error listening for messages: {e}")

    def send_event_http(self, event_type: str, data: Dict[str, Any]):
        """
        Send an event via HTTP POST (alternative to WebSocket)

        Args:
            event_type: Type of event
            data: Event data
        """
        if not self.session_id:
            raise ValueError("No active session")

        url = f"{self.base_url}/api/events"
        payload = {
            "session_id": self.session_id,
            "event_type": event_type,
            "timestamp": time.time(),
            "data": data
        }

        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            print(f"  ✓ Event sent via HTTP: {event_type}")
            return response.json()

        except requests.exceptions.RequestException as e:
            print(f"  ✗ Failed to send event: {e}")
            raise

    def trigger_alert(self, alert_type: str, priority: str, message: str,
                     aircraft_id: str = None, data: Dict[str, Any] = None):
        """
        Trigger an alert (typically called by scenario controller)

        Args:
            alert_type: Type of alert
            priority: Alert priority
            message: Alert message
            aircraft_id: Related aircraft ID
            data: Additional alert data
        """
        if not self.session_id:
            raise ValueError("No active session")

        url = f"{self.base_url}/api/alerts/trigger"
        payload = {
            "session_id": self.session_id,
            "alert_type": alert_type,
            "priority": priority,
            "message": message,
            "aircraft_id": aircraft_id,
            "data": data or {}
        }

        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()

            result = response.json()
            print(f"\n  ✓ Alert triggered: {result['alert_id']}")
            return result

        except requests.exceptions.RequestException as e:
            print(f"  ✗ Failed to trigger alert: {e}")
            raise

    def get_session_data(self) -> Dict[str, Any]:
        """Get complete session data"""
        if not self.session_id:
            raise ValueError("No active session")

        url = f"{self.base_url}/api/sessions/{self.session_id}/data"

        try:
            response = requests.get(url)
            response.raise_for_status()

            data = response.json()
            print(f"\n{'='*60}")
            print(f"Session Data Retrieved")
            print(f"{'='*60}")
            print(f"  Events: {len(data.get('events', []))}")
            print(f"  Alerts: {len(data.get('alerts', []))}")
            print(f"  Behavioral Data: {len(data.get('behavioral_data', []))}")

            return data

        except requests.exceptions.RequestException as e:
            print(f"✗ Failed to get session data: {e}")
            raise

    def end_session(self, reason: str = "completed") -> Dict[str, Any]:
        """
        End the current session

        Args:
            reason: Reason for ending session

        Returns:
            Session summary
        """
        if not self.session_id:
            raise ValueError("No active session")

        print(f"\n{'='*60}")
        print(f"Ending session: {reason}")
        print(f"{'='*60}")

        url = f"{self.base_url}/api/sessions/{self.session_id}/end"
        payload = {"reason": reason}

        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()

            data = response.json()
            summary = data.get("summary", {})

            print(f"✓ Session ended successfully")
            print(f"\nSummary:")
            print(f"  Duration: {summary.get('duration_seconds', 0):.1f}s")
            print(f"  Total Events: {summary.get('total_events', 0)}")
            print(f"  Total Alerts: {summary.get('total_alerts', 0)}")
            print(f"  Behavioral Events: {summary.get('behavioral_events', 0)}")

            return data

        except requests.exceptions.RequestException as e:
            print(f"✗ Failed to end session: {e}")
            raise

    async def close_websocket(self):
        """Close WebSocket connection"""
        if self.ws:
            await self.ws.close()
            print("\n✓ WebSocket closed")


async def main():
    """Example usage of the ATC Research API"""

    print("\n" + "="*60)
    print("ATC Adaptive Alert Research System - Example Client")
    print("="*60)

    # Initialize client
    client = ATCResearchClient(base_url="http://localhost:8000")

    try:
        # 1. Start a session
        session_data = client.start_session(
            scenario="L1",
            condition=1,
            participant_id="P001_TEST"
        )

        # 2. Connect to WebSocket
        await client.connect_websocket()

        # 3. Simulate some behavioral events
        print(f"\n{'='*60}")
        print("Simulating behavioral events...")
        print(f"{'='*60}")

        # Mouse movements
        for i in range(5):
            await client.send_behavioral_event(
                "mouse_move",
                {"x": 100 + i * 50, "y": 200 + i * 30}
            )
            await asyncio.sleep(0.2)

        # Click event
        await client.send_behavioral_event(
            "click",
            {"x": 450, "y": 300, "target": "aircraft_AAL123"}
        )

        # User action
        await client.send_action(
            "clear_aircraft",
            {
                "aircraft_id": "AAL123",
                "command": "direct_to_airport",
                "runway": "24R"
            }
        )

        # 4. Trigger an alert (simulating scenario controller)
        client.trigger_alert(
            alert_type="fuel_emergency",
            priority="critical",
            message="AAL123 reports fuel critical. 15 minutes remaining.",
            aircraft_id="AAL123",
            data={
                "fuel_remaining_minutes": 15,
                "souls_on_board": 156
            }
        )

        # 5. Listen for messages (including the alert we just triggered)
        await client.listen_for_messages(duration=5.0)

        # 6. Send some events via HTTP as alternative
        print(f"\n{'='*60}")
        print("Sending events via HTTP...")
        print(f"{'='*60}")

        client.send_event_http(
            "command",
            {"command": "altitude_change", "aircraft": "UAL456", "new_altitude": 20000}
        )

        # 7. Get session data
        session_data = client.get_session_data()

        # 8. End session
        summary = client.end_session(reason="completed")

        # 9. Close WebSocket
        await client.close_websocket()

        print(f"\n{'='*60}")
        print("✓ Example completed successfully!")
        print(f"{'='*60}\n")

    except Exception as e:
        print(f"\n✗ Error: {e}")
        if client.ws:
            await client.close_websocket()


if __name__ == "__main__":
    # Run the example
    asyncio.run(main())
