import * as fs from 'fs';
import * as path from 'path';
import { BlackboardStore } from './store';
import { Event, EventType, WorkItemStage } from './types';

describe('BlackboardStore', () => {
  const testDir = path.join(__dirname, '..', '.test-blackboard');
  let store: BlackboardStore;

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    store = new BlackboardStore(testDir);
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('directory structure', () => {
    it('should create required directories on initialization', () => {
      expect(fs.existsSync(testDir)).toBe(true);
      expect(fs.existsSync(path.join(testDir, 'artifacts'))).toBe(true);
      expect(fs.existsSync(path.join(testDir, 'work_items'))).toBe(true);
    });
  });

  describe('events', () => {
    it('should append events to the event log', () => {
      const event = store.appendEvent({
        type: 'WorkItemCreated',
        payload: { id: 'test-1', goal: 'Test goal', owner: 'agent-1' },
      });

      expect(event.type).toBe('WorkItemCreated');
      expect(event.timestamp).toBeDefined();
      expect(event.payload).toEqual({ id: 'test-1', goal: 'Test goal', owner: 'agent-1' });

      const eventsPath = path.join(testDir, 'events.jsonl');
      expect(fs.existsSync(eventsPath)).toBe(true);
    });

    it('should read all events from the event log', () => {
      store.appendEvent({
        type: 'WorkItemCreated',
        payload: { id: 'test-1', goal: 'Test goal', owner: 'agent-1' },
      });
      store.appendEvent({
        type: 'TaskIssued',
        payload: { workItemId: 'test-1', task: 'Do something' },
      });

      const events = store.getEvents();
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('WorkItemCreated');
      expect(events[1].type).toBe('TaskIssued');
    });

    it('should return empty array when no events exist', () => {
      const events = store.getEvents();
      expect(events).toEqual([]);
    });

    it('should filter events by timestamp', async () => {
      const event1 = store.appendEvent({
        type: 'WorkItemCreated',
        payload: { id: 'test-1', goal: 'Test goal', owner: 'agent-1' },
      });
      
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      store.appendEvent({
        type: 'TaskIssued',
        payload: { workItemId: 'test-1', task: 'Do something' },
      });

      const eventsSince = store.getEventsSince(event1.timestamp);
      expect(eventsSince.length).toBeGreaterThanOrEqual(1);
      expect(eventsSince[eventsSince.length - 1].type).toBe('TaskIssued');
    });
  });

  describe('state', () => {
    it('should return default state when no state exists', () => {
      const state = store.getState();
      expect(state.version).toBe(0);
      expect(state.lastEventTimestamp).toBe('');
      expect(state.workItems).toEqual({});
      expect(state.artifacts).toEqual({});
    });

    it('should save and retrieve state', () => {
      const newState = {
        version: 1,
        lastEventTimestamp: '2024-01-01T00:00:00Z',
        workItems: {
          'item-1': {
            id: 'item-1',
            goal: 'Test goal',
            stage: 'discovery' as WorkItemStage,
            owner: 'agent-1',
            constraints: {},
            contributions: [],
            artifacts: [],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        },
        artifacts: {},
      };

      store.saveState(newState);
      const retrieved = store.getState();
      expect(retrieved).toEqual(newState);
    });
  });

  describe('artifacts', () => {
    it('should save and retrieve artifacts', () => {
      const artifact = store.saveArtifact(
        'spec',
        1,
        '# Specification\n\nThis is the spec.',
        {
          id: 'spec-v1',
          derivedFrom: [],
          editor: 'agent-1',
          status: 'draft',
        }
      );

      expect(artifact.name).toBe('spec');
      expect(artifact.version).toBe(1);
      expect(artifact.content).toBe('# Specification\n\nThis is the spec.');

      const retrieved = store.getArtifact('spec', 1);
      expect(retrieved).toEqual(artifact);
    });

    it('should return null for non-existent artifact', () => {
      const artifact = store.getArtifact('nonexistent', 1);
      expect(artifact).toBeNull();
    });

    it('should get all versions of an artifact', () => {
      store.saveArtifact('spec', 1, 'Content v1', {
        id: 'spec-v1',
        derivedFrom: [],
        editor: 'agent-1',
        status: 'draft',
      });
      store.saveArtifact('spec', 2, 'Content v2', {
        id: 'spec-v2',
        derivedFrom: ['spec-v1'],
        editor: 'agent-2',
        status: 'reviewed',
      });

      const versions = store.getArtifactVersions('spec');
      expect(versions).toHaveLength(2);
      expect(versions[0].version).toBe(1);
      expect(versions[1].version).toBe(2);
    });

    it('should create artifact files in correct format', () => {
      store.saveArtifact('arch', 1, 'Architecture doc', {
        id: 'arch-v1',
        derivedFrom: [],
        editor: 'agent-1',
        status: 'draft',
      });

      const mdPath = path.join(testDir, 'artifacts', 'arch-v1.md');
      const metaPath = path.join(testDir, 'artifacts', 'arch-v1.meta.json');

      expect(fs.existsSync(mdPath)).toBe(true);
      expect(fs.existsSync(metaPath)).toBe(true);

      const content = fs.readFileSync(mdPath, 'utf-8');
      expect(content).toBe('Architecture doc');

      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      expect(meta.name).toBe('arch');
      expect(meta.version).toBe(1);
    });
  });

  describe('work items', () => {
    it('should create work item folder', () => {
      const folderPath = store.createWorkItemFolder('sprint-2026-02-w1');
      expect(fs.existsSync(folderPath)).toBe(true);
      expect(folderPath).toContain('sprint-2026-02-w1');
    });

    it('should get work item folder path', () => {
      const folderPath = store.getWorkItemFolder('test-item');
      expect(folderPath).toContain('work_items');
      expect(folderPath).toContain('test-item');
    });

    it('should list work items', () => {
      store.createWorkItemFolder('item-1');
      store.createWorkItemFolder('item-2');

      const items = store.listWorkItems();
      expect(items).toContain('item-1');
      expect(items).toContain('item-2');
    });
  });

  describe('compaction', () => {
    it('should compact events into state', () => {
      // Create some events
      store.appendEvent({
        type: 'WorkItemCreated',
        payload: { id: 'test-1', goal: 'Test goal', owner: 'agent-1' },
      });
      store.appendEvent({
        type: 'PhaseAdvanced',
        payload: { workItemId: 'test-1', stage: 'synthesis' },
      });

      // Compact
      const state = store.compact();

      expect(state.version).toBe(2);
      expect(state.workItems['test-1']).toBeDefined();
      expect(state.workItems['test-1'].stage).toBe('synthesis');
      expect(state.lastEventTimestamp).toBeDefined();
    });

    it('should persist compacted state', () => {
      store.appendEvent({
        type: 'WorkItemCreated',
        payload: { id: 'test-1', goal: 'Test goal', owner: 'agent-1' },
      });

      store.compact();

      // Create new store instance to verify state was persisted
      const newStore = new BlackboardStore(testDir);
      const state = newStore.getState();

      expect(state.workItems['test-1']).toBeDefined();
      expect(state.version).toBe(1);
    });

    it('should apply WorkItemCreated event correctly', () => {
      store.appendEvent({
        type: 'WorkItemCreated',
        payload: { id: 'test-1', goal: 'Test goal', owner: 'agent-1', constraints: { tokenBudget: 1000 } },
      });

      const state = store.compact();
      const workItem = state.workItems['test-1'];

      expect(workItem.id).toBe('test-1');
      expect(workItem.goal).toBe('Test goal');
      expect(workItem.owner).toBe('agent-1');
      expect(workItem.stage).toBe('discovery');
      expect(workItem.constraints.tokenBudget).toBe(1000);
      expect(workItem.contributions).toEqual([]);
    });

    it('should apply PhaseAdvanced event correctly', () => {
      store.appendEvent({
        type: 'WorkItemCreated',
        payload: { id: 'test-1', goal: 'Test goal', owner: 'agent-1' },
      });
      store.appendEvent({
        type: 'PhaseAdvanced',
        payload: { workItemId: 'test-1', stage: 'decision' },
      });

      const state = store.compact();
      expect(state.workItems['test-1'].stage).toBe('decision');
    });

    it('should apply DecisionFrozen event correctly', () => {
      store.appendEvent({
        type: 'WorkItemCreated',
        payload: { id: 'test-1', goal: 'Test goal', owner: 'agent-1' },
      });
      store.appendEvent({
        type: 'DecisionFrozen',
        payload: { workItemId: 'test-1' },
      });

      const state = store.compact();
      expect(state.workItems['test-1'].stage).toBe('frozen');
    });

    it('should apply ContributionAdded event correctly', () => {
      store.appendEvent({
        type: 'WorkItemCreated',
        payload: { id: 'test-1', goal: 'Test goal', owner: 'agent-1' },
      });
      store.appendEvent({
        type: 'ContributionAdded',
        payload: {
          workItemId: 'test-1',
          contribution: {
            id: 'contrib-1',
            agent: 'agent-2',
            type: 'proposal',
            scope: 'broad',
            confidence: 0.8,
            payload: 'My proposal',
          },
        },
      });

      const state = store.compact();
      expect(state.workItems['test-1'].contributions).toHaveLength(1);
      expect(state.workItems['test-1'].contributions[0].agent).toBe('agent-2');
      expect(state.workItems['test-1'].contributions[0].type).toBe('proposal');
    });
  });

  describe('atomic writes', () => {
    it('should write files atomically (no temp files left)', () => {
      store.saveState({
        version: 1,
        lastEventTimestamp: '2024-01-01T00:00:00Z',
        workItems: {},
        artifacts: {},
      });

      const files = fs.readdirSync(testDir);
      const tempFiles = files.filter(f => f.endsWith('.tmp'));
      expect(tempFiles).toHaveLength(0);
    });
  });
});
