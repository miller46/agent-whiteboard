import * as fs from 'fs';
import * as path from 'path';
import { Event, State, WorkItem, Artifact, ArtifactMeta } from './types';

/**
 * BlackboardStore - Persistence layer for agent collaboration
 * 
 * Provides:
 * - Append-only event log (events.jsonl)
 * - Materialized state snapshot (state.json)
 * - Versioned artifact storage
 * - Atomic operations via temp file + rename
 */
export class BlackboardStore {
  private baseDir: string;
  private eventsPath: string;
  private statePath: string;
  private artifactsDir: string;
  private workItemsDir: string;

  constructor(baseDir: string = '.blackboard') {
    this.baseDir = baseDir;
    this.eventsPath = path.join(baseDir, 'events.jsonl');
    this.statePath = path.join(baseDir, 'state.json');
    this.artifactsDir = path.join(baseDir, 'artifacts');
    this.workItemsDir = path.join(baseDir, 'work_items');
    this.ensureDirectories();
  }

  /**
   * Ensure all required directories exist
   */
  private ensureDirectories(): void {
    fs.mkdirSync(this.baseDir, { recursive: true });
    fs.mkdirSync(this.artifactsDir, { recursive: true });
    fs.mkdirSync(this.workItemsDir, { recursive: true });
  }

  /**
   * Atomically write to a file (temp + rename)
   */
  private atomicWrite(filePath: string, content: string): void {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, content, 'utf-8');
    fs.renameSync(tempPath, filePath);
  }

  /**
   * Append an event to the event log
   */
  appendEvent(event: Omit<Event, 'timestamp'>): Event {
    const fullEvent: Event = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    const line = JSON.stringify(fullEvent) + '\n';
    fs.appendFileSync(this.eventsPath, line, 'utf-8');

    return fullEvent;
  }

  /**
   * Read all events from the event log
   */
  getEvents(): Event[] {
    if (!fs.existsSync(this.eventsPath)) {
      return [];
    }

    const content = fs.readFileSync(this.eventsPath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.length > 0);

    return lines.map(line => JSON.parse(line));
  }

  /**
   * Get events after a specific timestamp
   */
  getEventsSince(timestamp: string): Event[] {
    return this.getEvents().filter(e => e.timestamp > timestamp);
  }

  /**
   * Read the materialized state
   */
  getState(): State {
    if (!fs.existsSync(this.statePath)) {
      return {
        version: 0,
        lastEventTimestamp: '',
        workItems: {},
        artifacts: {},
      };
    }

    const content = fs.readFileSync(this.statePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Save the materialized state
   */
  saveState(state: State): void {
    const content = JSON.stringify(state, null, 2);
    this.atomicWrite(this.statePath, content);
  }

  /**
   * Save a versioned artifact
   */
  saveArtifact(
    name: string,
    version: number,
    content: string,
    meta: Omit<ArtifactMeta, 'name' | 'version' | 'createdAt' | 'updatedAt'>
  ): Artifact {
    const now = new Date().toISOString();
    const fullMeta: ArtifactMeta = {
      ...meta,
      name,
      version,
      createdAt: now,
      updatedAt: now,
    };

    const artifactPath = path.join(this.artifactsDir, `${name}-v${version}.md`);
    const metaPath = path.join(this.artifactsDir, `${name}-v${version}.meta.json`);

    this.atomicWrite(artifactPath, content);
    this.atomicWrite(metaPath, JSON.stringify(fullMeta, null, 2));

    return {
      ...fullMeta,
      content,
    };
  }

  /**
   * Read an artifact by name and version
   */
  getArtifact(name: string, version: number): Artifact | null {
    const artifactPath = path.join(this.artifactsDir, `${name}-v${version}.md`);
    const metaPath = path.join(this.artifactsDir, `${name}-v${version}.meta.json`);

    if (!fs.existsSync(artifactPath) || !fs.existsSync(metaPath)) {
      return null;
    }

    const content = fs.readFileSync(artifactPath, 'utf-8');
    const meta: ArtifactMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

    return {
      ...meta,
      content,
    };
  }

  /**
   * Get all versions of an artifact
   */
  getArtifactVersions(name: string): ArtifactMeta[] {
    const versions: ArtifactMeta[] = [];
    const files = fs.readdirSync(this.artifactsDir);

    for (const file of files) {
      const match = file.match(new RegExp(`^${name}-v(\\d+)\\.meta\\.json$`));
      if (match) {
        const metaPath = path.join(this.artifactsDir, file);
        const meta: ArtifactMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        versions.push(meta);
      }
    }

    return versions.sort((a, b) => a.version - b.version);
  }

  /**
   * Create a work item folder
   */
  createWorkItemFolder(id: string): string {
    const folderPath = path.join(this.workItemsDir, id);
    fs.mkdirSync(folderPath, { recursive: true });
    return folderPath;
  }

  /**
   * Get work item folder path
   */
  getWorkItemFolder(id: string): string {
    return path.join(this.workItemsDir, id);
  }

  /**
   * List all work item folders
   */
  listWorkItems(): string[] {
    if (!fs.existsSync(this.workItemsDir)) {
      return [];
    }
    return fs.readdirSync(this.workItemsDir).filter(id => {
      const stat = fs.statSync(path.join(this.workItemsDir, id));
      return stat.isDirectory();
    });
  }

  /**
   * Compaction: rebuild state from events
   */
  compact(): State {
    const events = this.getEvents();
    const state = this.applyEvents(events);
    this.saveState(state);
    return state;
  }

  /**
   * Apply events to build state
   */
  private applyEvents(events: Event[]): State {
    const state: State = {
      version: events.length,
      lastEventTimestamp: events.length > 0 ? events[events.length - 1].timestamp : '',
      workItems: {},
      artifacts: {},
    };

    for (const event of events) {
      this.applyEvent(state, event);
    }

    return state;
  }

  /**
   * Apply a single event to the state
   */
  private applyEvent(state: State, event: Event): void {
    switch (event.type) {
      case 'WorkItemCreated': {
        const { id, goal, owner, constraints } = event.payload as {
          id: string;
          goal: string;
          owner: string;
          constraints?: { tokenBudget?: number; deadline?: string };
        };
        state.workItems[id] = {
          id,
          goal,
          stage: 'discovery',
          owner,
          constraints: constraints || {},
          contributions: [],
          artifacts: [],
          createdAt: event.timestamp,
          updatedAt: event.timestamp,
        };
        this.createWorkItemFolder(id);
        break;
      }

      case 'PhaseAdvanced': {
        const { workItemId, stage } = event.payload as {
          workItemId: string;
          stage: string;
        };
        if (state.workItems[workItemId]) {
          state.workItems[workItemId].stage = stage as any;
          state.workItems[workItemId].updatedAt = event.timestamp;
        }
        break;
      }

      case 'DecisionFrozen': {
        const { workItemId } = event.payload as { workItemId: string };
        if (state.workItems[workItemId]) {
          state.workItems[workItemId].stage = 'frozen';
          state.workItems[workItemId].updatedAt = event.timestamp;
        }
        break;
      }

      case 'ContributionAdded': {
        const { workItemId, contribution } = event.payload as {
          workItemId: string;
          contribution: { id: string; agent: string; type: string; scope: string; confidence: number; payload: string };
        };
        if (state.workItems[workItemId]) {
          state.workItems[workItemId].contributions.push({
            ...contribution,
            workItemId,
            createdAt: event.timestamp,
          });
          state.workItems[workItemId].updatedAt = event.timestamp;
        }
        break;
      }

      case 'ArtifactUpdated': {
        const { name, version, meta } = event.payload as {
          name: string;
          version: number;
          meta: ArtifactMeta;
        };
        state.artifacts[`${name}-v${version}`] = meta;
        break;
      }

      case 'TaskIssued': {
        // Task issuance is logged but doesn't modify state directly
        break;
      }
    }
  }
}
