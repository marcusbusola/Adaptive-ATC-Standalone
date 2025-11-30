#!/usr/bin/env python3
"""
Quick WebSocket Connection Test Script
Tests if the WebSocket endpoint is working correctly
"""

import asyncio
import json
import sys
from websockets import connect
import requests

API_URL = "http://localhost:8000"

async def test_websocket():
    """Test WebSocket connection end-to-end"""

    print("=" * 60)
    print("WebSocket Connection Test")
    print("=" * 60)

    # Step 1: Check if backend is running
    print("\n1. Checking if backend is running...")
    try:
        response = requests.get(f"{API_URL}/health", timeout=5)
        print(f"   ✓ Backend is running: {response.json()}")
    except requests.exceptions.ConnectionError:
        print("   ✗ Backend is NOT running!")
        print("   Please start the backend server first:")
        print("   cd backend && uvicorn api.server:app --reload")
        return False
    except Exception as e:
        print(f"   ✗ Error checking backend: {e}")
        return False

    # Step 2: Create a session
    print("\n2. Creating test session...")
    try:
        response = requests.post(
            f"{API_URL}/api/sessions/start",
            json={
                "scenario": "L1",
                "condition": 1,
                "participant_id": "test_ws_connection"
            }
        )
        response.raise_for_status()
        session_data = response.json()
        session_id = session_data["session_id"]
        ws_url = session_data["websocket_url"]
        print(f"   ✓ Session created: {session_id}")
        print(f"   ✓ WebSocket URL: {ws_url}")
    except Exception as e:
        print(f"   ✗ Failed to create session: {e}")
        return False

    # Step 3: Connect to WebSocket
    print("\n3. Connecting to WebSocket...")
    try:
        async with connect(ws_url) as websocket:
            print(f"   ✓ WebSocket connected!")

            # Step 4: Receive connection confirmation
            print("\n4. Waiting for connection confirmation...")
            message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            data = json.loads(message)
            print(f"   ✓ Received: {data}")

            if data.get("type") == "connected":
                print("   ✓ Connection confirmed by server!")

            # Step 5: Send a test message
            print("\n5. Sending test message...")
            test_msg = {
                "type": "ping",
                "timestamp": 1234567890
            }
            await websocket.send(json.dumps(test_msg))
            print(f"   ✓ Sent: {test_msg}")

            # Step 6: Wait for response
            print("\n6. Waiting for pong response...")
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            response_data = json.loads(response)
            print(f"   ✓ Received: {response_data}")

            if response_data.get("type") == "pong":
                print("   ✓ Pong received - WebSocket is working!")

            # Close connection
            print("\n7. Closing connection...")
            await websocket.close()
            print("   ✓ Connection closed gracefully")

    except asyncio.TimeoutError:
        print("   ✗ Timeout waiting for WebSocket message")
        return False
    except Exception as e:
        print(f"   ✗ WebSocket error: {e}")
        return False

    print("\n" + "=" * 60)
    print("✓ ALL TESTS PASSED - WebSocket is working correctly!")
    print("=" * 60)
    return True

if __name__ == "__main__":
    try:
        result = asyncio.run(test_websocket())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
