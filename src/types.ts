/**
 * Event types for the append-only event log
 */
export type EventType =
  | 'WorkItemCreated'
  | 'TaskIssued'
  | 'ContributionAdded'
  | 'ArtifactUpdated'
  | 'PhaseAdvanced'
  | 'DecisionFrozen';

/**
 * Base event structure
 */
export interface Event {
  type: EventType;
  timestamp: string;
  payload: Record<string, unknown>;
}

/**
 * Work item status/stage
 */
export type WorkItemStage = 'discovery' | 'synthesis' | 'decision' | 'execution' | 'frozen';

/**
 * Work item definition
 */
export interface WorkItem {
  id: string;
  goal: string;
  stage: WorkItemStage;
  owner: string;
  constraints: {
    tokenBudget?: number;
    deadline?: string;
  };
  contributions: Contribution[];
  artifacts: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Contribution types
 */
export type ContributionType = 'risk' | 'proposal' | 'critique' | 'decomposition' | 'unknowns';

/**
 * Contribution from an agent
 */
export interface Contribution {
  id: string;
  workItemId: string;
  agent: string;
  type: ContributionType;
  scope: 'narrow' | 'broad';
  confidence: number;
  payload: string;
  createdAt: string;
}

/**
 * Artifact metadata
 */
export interface ArtifactMeta {
  id: string;
  name: string;
  version: number;
  derivedFrom: string[];
  editor: string;
  status: 'draft' | 'reviewed' | 'frozen';
  createdAt: string;
  updatedAt: string;
}

/**
 * Artifact with content
 */
export interface Artifact extends ArtifactMeta {
  content: string;
}

/**
 * Materialized state snapshot
 */
export interface State {
  version: number;
  lastEventTimestamp: string;
  workItems: Record<string, WorkItem>;
  artifacts: Record<string, ArtifactMeta>;
}
