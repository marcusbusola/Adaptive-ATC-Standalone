"""
ATC Scenario Event Generator
Generates realistic ATC events and alerts for research scenarios
"""

import random
from datetime import datetime, timedelta
from typing import List, Dict, Any
from enum import Enum


class AlertPriority(Enum):
    """Alert priority levels"""
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class AlertType(Enum):
    """Types of ATC alerts"""
    CONFLICT_ALERT = "conflict_alert"
    MINIMUM_SAFE_ALTITUDE = "minimum_safe_altitude"
    COORDINATION_REQUIRED = "coordination_required"
    EQUIPMENT_FAILURE = "equipment_failure"
    WEATHER_ADVISORY = "weather_advisory"
    EMERGENCY_DECLARED = "emergency_declared"
    AIRSPACE_VIOLATION = "airspace_violation"


class ScenarioGenerator:
    """Generates events for ATC research scenarios"""

    def __init__(self, scenario_id: str):
        self.scenario_id = scenario_id
        self.config = self._get_scenario_config(scenario_id)

    def _get_scenario_config(self, scenario_id: str) -> Dict[str, Any]:
        """Get configuration for specific scenario"""
        configs = {
            "L1": {
                "aircraft_count": 4,
                "complexity": "low",
                "traffic": "low",
                "conflict_probability": 0.08,
                "alert_frequency": 2.5,  # per 10 minutes
                "duration": 600,  # seconds
                "weather": "clear"
            },
            "L2": {
                "aircraft_count": 13,
                "complexity": "low",
                "traffic": "high",
                "conflict_probability": 0.18,
                "alert_frequency": 7,
                "duration": 600,
                "weather": "clear"
            },
            "H4": {
                "aircraft_count": 5,
                "complexity": "high",
                "traffic": "low",
                "conflict_probability": 0.22,
                "alert_frequency": 6,
                "duration": 600,
                "weather": "adverse"
            },
            "H5": {
                "aircraft_count": 17,
                "complexity": "high",
                "traffic": "high",
                "conflict_probability": 0.28,
                "alert_frequency": 11,
                "duration": 600,
                "weather": "adverse"
            }
        }
        return configs.get(scenario_id, configs["L1"])

    def generate_scenario(self) -> Dict[str, Any]:
        """Generate complete scenario with all events"""
        alerts = self._generate_alerts()
        aircraft = self._generate_aircraft()

        return {
            "scenario_id": self.scenario_id,
            "config": self.config,
            "aircraft": aircraft,
            "alerts": alerts,
            "duration": self.config["duration"],
            "generated_at": datetime.now().isoformat()
        }

    def _generate_alerts(self) -> List[Dict[str, Any]]:
        """Generate alert events for the scenario"""
        duration = self.config["duration"]
        frequency = self.config["alert_frequency"]
        total_alerts = int((frequency / 10) * (duration / 60))

        alerts = []
        for i in range(total_alerts):
            # Distribute alerts throughout scenario with some randomness
            base_time = (duration / total_alerts) * i
            variance = (duration / total_alerts) * 0.4
            time = max(0, min(duration, base_time + random.uniform(-variance/2, variance/2)))

            alert = {
                "id": f"alert_{self.scenario_id}_{i+1}",
                "time": round(time, 2),
                "priority": self._get_random_priority().value,
                "type": self._get_random_alert_type().value,
                "title": self._generate_alert_title(),
                "message": self._generate_alert_message(),
                "details": self._generate_alert_details()
            }
            alerts.append(alert)

        return sorted(alerts, key=lambda x: x["time"])

    def _generate_aircraft(self) -> List[Dict[str, Any]]:
        """Generate aircraft for the scenario"""
        aircraft_count = self.config["aircraft_count"]
        aircraft = []

        callsigns = self._generate_callsigns(aircraft_count)

        for i, callsign in enumerate(callsigns):
            aircraft.append({
                "id": f"ac_{self.scenario_id}_{i+1}",
                "callsign": callsign,
                "type": random.choice(["B737", "A320", "B777", "A350", "E190"]),
                "altitude": random.randint(200, 400) * 100,
                "speed": random.randint(250, 450),
                "heading": random.randint(0, 359),
                "departure": self._random_airport(),
                "arrival": self._random_airport()
            })

        return aircraft

    def _get_random_priority(self) -> AlertPriority:
        """Get random priority based on scenario complexity"""
        rand = random.random()
        complexity = self.config["complexity"]

        if complexity == "high":
            if rand < 0.3:
                return AlertPriority.CRITICAL
            elif rand < 0.6:
                return AlertPriority.WARNING
            else:
                return AlertPriority.INFO
        else:
            if rand < 0.1:
                return AlertPriority.CRITICAL
            elif rand < 0.4:
                return AlertPriority.WARNING
            else:
                return AlertPriority.INFO

    def _get_random_alert_type(self) -> AlertType:
        """Get random alert type based on scenario"""
        basic_types = [
            AlertType.CONFLICT_ALERT,
            AlertType.MINIMUM_SAFE_ALTITUDE,
            AlertType.COORDINATION_REQUIRED,
            AlertType.EQUIPMENT_FAILURE,
            AlertType.WEATHER_ADVISORY
        ]

        if self.config["complexity"] == "high":
            basic_types.extend([
                AlertType.EMERGENCY_DECLARED,
                AlertType.AIRSPACE_VIOLATION
            ])

        return random.choice(basic_types)

    def _generate_alert_title(self) -> str:
        """Generate alert title"""
        titles = {
            "conflict_alert": "Conflict Alert",
            "minimum_safe_altitude": "Minimum Safe Altitude Warning",
            "coordination_required": "Coordination Required",
            "equipment_failure": "Equipment Failure",
            "weather_advisory": "Weather Advisory",
            "emergency_declared": "Emergency Declared",
            "airspace_violation": "Airspace Violation"
        }
        return random.choice(list(titles.values()))

    def _generate_alert_message(self) -> str:
        """Generate alert message"""
        messages = [
            "Potential conflict detected between aircraft",
            "Aircraft approaching minimum safe altitude",
            "Handoff coordination required with adjacent sector",
            "Radio communication equipment malfunction reported",
            "Severe weather cell moving into sector",
            "Aircraft declaring emergency - fuel state critical",
            "Unauthorized aircraft detected in restricted airspace"
        ]
        return random.choice(messages)

    def _generate_alert_details(self) -> Dict[str, str]:
        """Generate alert details"""
        return {
            "Aircraft": random.choice(["UAL123", "AAL456", "DAL789", "SWA321"]),
            "Altitude": f"{random.randint(200, 400) * 100} ft",
            "Location": f"{random.randint(10, 50)} nm {random.choice(['N', 'S', 'E', 'W'])}",
            "Time": f"{random.randint(1, 10)} minutes"
        }

    def _generate_callsigns(self, count: int) -> List[str]:
        """Generate realistic aircraft callsigns"""
        airlines = ["UAL", "AAL", "DAL", "SWA", "JBU", "ASA", "FFT", "NKS"]
        callsigns = []

        for _ in range(count):
            airline = random.choice(airlines)
            number = random.randint(100, 999)
            callsigns.append(f"{airline}{number}")

        return callsigns

    def _random_airport(self) -> str:
        """Get random airport code"""
        airports = ["KJFK", "KLAX", "KORD", "KATL", "KDFW", "KDEN", "KSFO", "KLAS"]
        return random.choice(airports)

    def calculate_workload(self) -> float:
        """Calculate workload score for scenario (0-1)"""
        complexity_score = 0.6 if self.config["complexity"] == "high" else 0.2
        traffic_score = (self.config["aircraft_count"] / 20) * 0.4
        return min(complexity_score + traffic_score, 1.0)


def generate_scenario(scenario_id: str) -> Dict[str, Any]:
    """Helper function to generate a scenario"""
    generator = ScenarioGenerator(scenario_id)
    return generator.generate_scenario()


if __name__ == "__main__":
    # Example usage
    for scenario_id in ["L1", "L2", "H4", "H5"]:
        scenario = generate_scenario(scenario_id)
        print(f"\nScenario {scenario_id}:")
        print(f"  Aircraft: {len(scenario['aircraft'])}")
        print(f"  Alerts: {len(scenario['alerts'])}")
        print(f"  Workload: {ScenarioGenerator(scenario_id).calculate_workload():.2f}")
