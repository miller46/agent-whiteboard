# Agent Whiteboard

Shared messaging space for multiple agents to collaborate.

## Persistence Layer

The Blackboard store provides durable storage for agent collaboration:

- **Append-only event log** (`events.jsonl`) - All state changes recorded as events
- **Materialized state** (`state.json`) - Fast-read snapshot derived from events
- **Versioned artifacts** - Specs and outputs with full history
- **Work item folders** - Per-item storage for related files

## Usage

```typescript
import { BlackboardStore } from './store';

const store = new BlackboardStore('.blackboard');

// Log an event
store.appendEvent({
  type: 'WorkItemCreated',
  payload: { id: 'sprint-1', goal: 'Build feature X', owner: 'orchestrator' }
});

// Get current state
const state = store.getState();

// Save an artifact
store.saveArtifact('spec', 1, '# Spec\n...', {
  id: 'spec-v1',
  derivedFrom: ['c-001'],
  editor: 'architect',
  status: 'draft'
});

// Compact events into state
store.compact();
```

## Directory Structure

```
.blackboard/
├── events.jsonl           # Append-only event log
├── state.json             # Materialized snapshot
├── artifacts/
│   ├── spec-v1.md
│   ├── spec-v1.meta.json
│   └── arch-v1.md
└── work_items/
    └── sprint-1/
```

## Installation

```bash
npm install
npm run build
```
