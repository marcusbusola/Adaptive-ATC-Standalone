"""
Queue Manager for ATC Adaptive Alert System

Manages queued scenario/condition combinations for batch testing.
Allows researchers to set up multiple sessions and run them sequentially.
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
import json
from pathlib import Path


class QueueItemStatus(Enum):
    """Status of a queue item"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"
    ERROR = "error"


@dataclass
class QueueItem:
    """Single item in the session queue"""
    queue_id: str
    scenario_id: str
    condition: int
    participant_id: Optional[str] = None
    status: QueueItemStatus = QueueItemStatus.PENDING
    session_id: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_seconds: Optional[float] = None
    error_message: Optional[str] = None
    results: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        data = asdict(self)
        data['status'] = self.status.value
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'QueueItem':
        """Create from dictionary"""
        if 'status' in data and isinstance(data['status'], str):
            data['status'] = QueueItemStatus(data['status'])
        return cls(**data)


@dataclass
class SessionQueue:
    """Queue of scenarios/conditions to run"""
    queue_id: str
    participant_id: str
    created_at: str
    items: List[QueueItem] = field(default_factory=list)
    current_index: int = 0
    status: str = "active"  # active, paused, completed
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'queue_id': self.queue_id,
            'participant_id': self.participant_id,
            'created_at': self.created_at,
            'items': [item.to_dict() for item in self.items],
            'current_index': self.current_index,
            'status': self.status,
            'metadata': self.metadata,
            'progress': self.get_progress()
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SessionQueue':
        """Create from dictionary"""
        items = [QueueItem.from_dict(item) for item in data.get('items', [])]
        return cls(
            queue_id=data['queue_id'],
            participant_id=data['participant_id'],
            created_at=data['created_at'],
            items=items,
            current_index=data.get('current_index', 0),
            status=data.get('status', 'active'),
            metadata=data.get('metadata', {})
        )

    def get_progress(self) -> Dict[str, Any]:
        """Get queue progress statistics"""
        total = len(self.items)
        completed = sum(1 for item in self.items if item.status == QueueItemStatus.COMPLETED)
        in_progress = sum(1 for item in self.items if item.status == QueueItemStatus.IN_PROGRESS)
        pending = sum(1 for item in self.items if item.status == QueueItemStatus.PENDING)
        errors = sum(1 for item in self.items if item.status == QueueItemStatus.ERROR)

        return {
            'total': total,
            'completed': completed,
            'in_progress': in_progress,
            'pending': pending,
            'errors': errors,
            'percentage': (completed / total * 100) if total > 0 else 0
        }

    def get_current_item(self) -> Optional[QueueItem]:
        """Get the current queue item"""
        if 0 <= self.current_index < len(self.items):
            return self.items[self.current_index]
        return None

    def get_next_item(self) -> Optional[QueueItem]:
        """Get the next pending queue item"""
        for i in range(self.current_index, len(self.items)):
            if self.items[i].status == QueueItemStatus.PENDING:
                self.current_index = i
                return self.items[i]
        return None

    def mark_item_started(self, index: int, session_id: str) -> None:
        """Mark an item as started"""
        if 0 <= index < len(self.items):
            self.items[index].status = QueueItemStatus.IN_PROGRESS
            self.items[index].session_id = session_id
            self.items[index].start_time = datetime.now().isoformat()

    def mark_item_completed(self, index: int, results: Dict[str, Any]) -> None:
        """Mark an item as completed"""
        if 0 <= index < len(self.items):
            item = self.items[index]
            item.status = QueueItemStatus.COMPLETED
            item.end_time = datetime.now().isoformat()
            item.results = results

            # Calculate duration
            if item.start_time:
                start = datetime.fromisoformat(item.start_time)
                end = datetime.fromisoformat(item.end_time)
                item.duration_seconds = (end - start).total_seconds()

    def mark_item_error(self, index: int, error_message: str) -> None:
        """Mark an item as error"""
        if 0 <= index < len(self.items):
            self.items[index].status = QueueItemStatus.ERROR
            self.items[index].error_message = error_message
            self.items[index].end_time = datetime.now().isoformat()

    def reset_item(self, index: int) -> None:
        """Reset an item to pending so it can be rerun (clears session metadata)."""
        if 0 <= index < len(self.items):
            item = self.items[index]
            item.status = QueueItemStatus.PENDING
            item.session_id = None
            item.start_time = None
            item.end_time = None
            item.duration_seconds = None
            item.error_message = None
            item.results = None
            # Move pointer back so this item is next in line
            self.current_index = min(self.current_index, index)
            # If queue had been marked completed, reopen it
            if self.status == "completed":
                self.status = "active"

    def is_complete(self) -> bool:
        """Check if queue is complete"""
        return all(
            item.status in [QueueItemStatus.COMPLETED, QueueItemStatus.SKIPPED, QueueItemStatus.ERROR]
            for item in self.items
        )


class QueueManager:
    """
    Manages session queues for batch testing

    Handles creating, storing, and retrieving queues of scenario/condition
    combinations for research participants.
    """

    def __init__(self, storage_path: Optional[str] = None):
        """
        Initialize queue manager

        Args:
            storage_path: Path to store queue data (defaults to data/queues/)
        """
        if storage_path is None:
            storage_path = Path(__file__).parent.parent / 'data' / 'queues'

        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)

        # In-memory cache
        self.queues: Dict[str, SessionQueue] = {}

        # Load existing queues
        self._load_queues()

    def _load_queues(self) -> None:
        """Load all queues from storage"""
        for queue_file in self.storage_path.glob('*.json'):
            try:
                with open(queue_file, 'r') as f:
                    data = json.load(f)
                    queue = SessionQueue.from_dict(data)
                    self.queues[queue.queue_id] = queue
            except Exception as e:
                print(f"Error loading queue {queue_file}: {e}")

    def _save_queue(self, queue: SessionQueue) -> None:
        """Save queue to storage"""
        queue_file = self.storage_path / f"{queue.queue_id}.json"
        tmp_file = self.storage_path / f".{queue.queue_id}.json.tmp"
        try:
            with open(tmp_file, 'w') as f:
                json.dump(queue.to_dict(), f, indent=2)
            tmp_file.replace(queue_file)
        except Exception as e:
            print(f"Error saving queue {queue.queue_id}: {e}")

    def create_queue(
        self,
        participant_id: str,
        scenario_ids: List[str],
        condition: int,
        randomize_order: bool = False,
        metadata: Optional[Dict[str, Any]] = None
    ) -> SessionQueue:
        """
        Create a new session queue

        Args:
            participant_id: Unique participant identifier
            scenario_ids: List of scenario IDs to queue
            condition: Single condition to use for all scenarios
            randomize_order: Whether to randomize scenario order
            metadata: Optional metadata to attach to queue

        Returns:
            Created SessionQueue
        """
        import random

        # Generate queue ID
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        queue_id = f"queue_{participant_id}_{timestamp}"

        # Optionally randomize scenario order
        scenarios_to_use = list(scenario_ids)  # Make a copy
        if randomize_order:
            random.shuffle(scenarios_to_use)

        # Create queue items (one per scenario, all with same condition)
        items = []
        for scenario_id in scenarios_to_use:
            item = QueueItem(
                queue_id=queue_id,
                scenario_id=scenario_id,
                condition=condition,  # Same condition for all
                participant_id=participant_id
            )
            items.append(item)

        # Add randomization info to metadata
        queue_metadata = metadata or {}
        queue_metadata['randomized'] = randomize_order
        queue_metadata['condition_name'] = {1: 'Traditional Modal', 2: 'Rule-Based Adaptive', 3: 'ML-Based Adaptive'}.get(condition, f'Condition {condition}')

        # Create queue
        queue = SessionQueue(
            queue_id=queue_id,
            participant_id=participant_id,
            created_at=datetime.now().isoformat(),
            items=items,
            metadata=queue_metadata
        )

        # Store queue
        self.queues[queue_id] = queue
        self._save_queue(queue)

        return queue

    def get_queue(self, queue_id: str) -> Optional[SessionQueue]:
        """Get queue by ID"""
        return self.queues.get(queue_id)

    def get_participant_queues(self, participant_id: str) -> List[SessionQueue]:
        """Get all queues for a participant"""
        return [
            queue for queue in self.queues.values()
            if queue.participant_id == participant_id
        ]

    def get_all_queues(self) -> List[SessionQueue]:
        """Get all queues"""
        return list(self.queues.values())

    def update_queue(self, queue: SessionQueue) -> None:
        """Update and save queue"""
        self.queues[queue.queue_id] = queue
        self._save_queue(queue)

    def delete_queue(self, queue_id: str) -> bool:
        """Delete a queue"""
        if queue_id in self.queues:
            # Delete from memory
            del self.queues[queue_id]

            # Delete from storage
            queue_file = self.storage_path / f"{queue_id}.json"
            if queue_file.exists():
                queue_file.unlink()

            return True
        return False

    def get_queue_status(self, queue_id: str) -> Optional[Dict[str, Any]]:
        """Get queue status summary"""
        queue = self.get_queue(queue_id)
        if not queue:
            return None

        return {
            'queue_id': queue.queue_id,
            'participant_id': queue.participant_id,
            'status': queue.status,
            'created_at': queue.created_at,
            'progress': queue.get_progress(),
            'current_item': queue.get_current_item().to_dict() if queue.get_current_item() else None,
            'is_complete': queue.is_complete()
        }

    def find_queue_by_session(self, session_id: str) -> Optional[tuple]:
        """
        Find a queue and item index that contains the given session_id.

        Returns:
            Tuple of (SessionQueue, item_index) if found, None otherwise
        """
        for queue in self.queues.values():
            for idx, item in enumerate(queue.items):
                if item.session_id == session_id:
                    return (queue, idx)
        return None


# Singleton instance
_queue_manager_instance: Optional[QueueManager] = None


def get_queue_manager() -> QueueManager:
    """Get the global queue manager instance"""
    global _queue_manager_instance
    if _queue_manager_instance is None:
        _queue_manager_instance = QueueManager()
    return _queue_manager_instance
