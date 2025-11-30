"""
ATC Adaptive Alerts Research System - Scenario Controllers

This module contains scenario controllers for the ATC adaptive alerts research.
Each scenario tests different aspects of controller performance under varying
workload conditions and alert presentation methods.

Scenarios:
- L1: Baseline Emergency (Low Workload)
- L2: System Failure / Irony of Automation (Low Workload)
- L3: Automation Complacency (Low Workload)
- H4: Conflict-Driven Tunneling (High Workload)
- H5: Compounded Stress / Multi-Crisis (High Workload)
- H6: High Workload Test (High Workload)

Usage:
    from scenarios import ScenarioL1, ScenarioH4

    # Initialize scenario
    scenario = ScenarioL1()

    # Start session
    init_data = scenario.initialize(condition=2, participant_id="P001")

    # Get events
    event = scenario.get_next_event(current_time=65.0)

    # Record actions
    scenario.record_action("acknowledge_alert", {"timestamp": 67.5})

    # Complete scenario
    results = scenario.complete()
"""

from .base_scenario import BaseScenario, WorkloadLevel, EventType, AlertSeverity
from .scenario_l1 import ScenarioL1
from .scenario_l2 import ScenarioL2
from .scenario_l3 import ScenarioL3
from .scenario_h4 import ScenarioH4
from .scenario_h5 import ScenarioH5
from .scenario_h6 import ScenarioH6

# Keep existing imports if available
try:
    from .generator import ScenarioGenerator, generate_scenario
    __all__ = [
        'BaseScenario',
        'WorkloadLevel',
        'EventType',
        'AlertSeverity',
        'ScenarioL1',
        'ScenarioL2',
        'ScenarioL3',
        'ScenarioH4',
        'ScenarioH5',
        'ScenarioH6',
        'ScenarioGenerator',
        'generate_scenario',
        'get_scenario',
        'get_all_scenarios',
        'get_scenarios_by_workload'
    ]
except ImportError:
    __all__ = [
        'BaseScenario',
        'WorkloadLevel',
        'EventType',
        'AlertSeverity',
        'ScenarioL1',
        'ScenarioL2',
        'ScenarioL3',
        'ScenarioH4',
        'ScenarioH5',
        'ScenarioH6',
        'get_scenario',
        'get_all_scenarios',
        'get_scenarios_by_workload'
    ]

# Scenario registry
SCENARIOS = {
    'L1': ScenarioL1,
    'L2': ScenarioL2,
    'L3': ScenarioL3,
    'H4': ScenarioH4,
    'H5': ScenarioH5,
    'H6': ScenarioH6
}


def get_scenario(scenario_id: str) -> BaseScenario:
    """
    Get scenario instance by ID

    Args:
        scenario_id: Scenario identifier (L1, L2, L3, H4, H5, H6)

    Returns:
        Scenario instance

    Raises:
        KeyError: If scenario_id not found

    Example:
        >>> scenario = get_scenario('L1')
        >>> scenario.initialize(condition=1, participant_id='P001')
    """
    if scenario_id not in SCENARIOS:
        raise KeyError(f"Scenario '{scenario_id}' not found. "
                      f"Available: {list(SCENARIOS.keys())}")

    return SCENARIOS[scenario_id]()


def get_all_scenarios() -> dict:
    """
    Get all available scenarios

    Returns:
        Dictionary of {scenario_id: ScenarioClass}

    Example:
        >>> scenarios = get_all_scenarios()
        >>> for sid, sclass in scenarios.items():
        ...     print(f"{sid}: {sclass}")
    """
    return SCENARIOS.copy()


def get_scenarios_by_workload(workload: WorkloadLevel) -> dict:
    """
    Get scenarios filtered by workload level

    Args:
        workload: WorkloadLevel.LOW or WorkloadLevel.HIGH

    Returns:
        Dictionary of scenarios matching workload level

    Example:
        >>> low_scenarios = get_scenarios_by_workload(WorkloadLevel.LOW)
        >>> print(list(low_scenarios.keys()))  # ['L1', 'L2', 'L3']
    """
    filtered = {}

    for scenario_id, scenario_class in SCENARIOS.items():
        scenario = scenario_class()
        if scenario.metadata['workload_level'] == workload:
            filtered[scenario_id] = scenario_class

    return filtered
