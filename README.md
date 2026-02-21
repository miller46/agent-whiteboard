## Agent Whiteboard

Shared messaging space for multiple agents to collaborate 

## Rough Outline


Below is a first-principles design for an **agent collaboration layer** that avoids chat-room chaos, minimizes context waste, and produces convergent artifacts (plans, specs, priorities). This is not “group chat.” It is **asynchronous, artifact-centric coordination** with explicit turn-taking and incentives to stay silent unless value-add is provable.

---

## 1. Reframe the problem

### What you do *not* want

* N agents subscribed to a firehose
* Everyone reacting to everything
* Token burn from rereading history
* “Discussion” without convergence

### What you actually want

* **A shared workspace, not shared attention**
* Agents contribute **selectively**, not reflexively
* Outputs collapse into **artifacts** (plans, specs, decisions)
* Clear ownership at every step

So: stop thinking “messaging system,” think **blackboard + protocol**.

---

## 2. Core abstraction: the Blackboard

A **blackboard** is a persistent, append-only (or versioned) workspace where agents post *structured contributions*, not messages.

This can be:

* A single JSONL / Markdown file
* A folder of typed documents
* A lightweight KV store

**Key principle**:

> Agents do not talk to each other. They read and write *artifacts*.

---

## 3. The minimum viable data model

### 3.1 Work Item (root object)

```yaml
work_item:
  id: sprint-2026-02-w1
  goal: "Define v1 product spec for X"
  stage: discovery | synthesis | decision | execution
  owner: orchestrator
  constraints:
    token_budget: 50k
    deadline: 2026-02-23
```

This is the *only* thing everyone shares by default.

---

### 3.2 Contributions (typed, scoped)

Each agent may append **zero or more** contributions.

```yaml
contribution:
  id: c-042
  work_item: sprint-2026-02-w1
  agent: backend-architect
  type: risk | proposal | critique | decomposition | unknowns
  scope: narrow | broad
  confidence: 0.7
  payload: |
    The core risk is X. If Y, system fails at Z.
```

**Rules**

* Contributions are **typed**
* No free-form replies
* No agent sees contributions unless explicitly pulled

---

### 3.3 Artifacts (the only thing that matters)

Artifacts are **compiled outputs**, not discussions.

```yaml
artifact:
  id: spec-v1
  derived_from:
    - c-042
    - c-017
  editor: product-spec-agent
  status: draft | reviewed | frozen
  content: |
    ## Overview
    ...
```

Artifacts are the convergence mechanism.

---

## 4. Control plane: who speaks, when, and why

### 4.1 Silent by default

Agents **do nothing** unless one of these is true:

1. They are explicitly invoked
2. They detect a gap they are uniquely qualified to fill
3. They are asked to review an artifact

No subscriptions. No “listening.”

---

### 4.2 Explicit invocation contracts

Instead of:

> “All agents, discuss priorities”

You issue:

```yaml
task:
  target_agents:
    - infra
    - security
  ask: "Identify risks in proposed architecture"
  expected_output: contribution.type = risk
  max_contributions: 1
```

This caps noise **by construction**.

---

## 5. Scheduling model (this is where it stops being chat)

Use **phases**, not conversation.

### Phase 1 — Divergence (parallel, bounded)

* Many agents write contributions
* No one reads others yet
* Hard caps per agent

### Phase 2 — Synthesis (single writer)

* One agent reads all contributions
* Produces a draft artifact

### Phase 3 — Review (selective)

* 1–3 agents critique the artifact
* No new ideas allowed

### Phase 4 — Freeze

* Artifact is final
* Context resets

This mirrors how senior teams actually work.

---

## 6. Preventing “everyone responds to everything”

Mechanisms that actually work:

### 6.1 Pull, not push

Agents:

* Cannot see updates unless asked
* Are given **summaries**, not raw logs

### 6.2 Contribution budgets

Per work item:

```yaml
agent_limits:
  backend-architect: 2 contributions
  ux: 1 contribution
```

Scarcity improves signal.

---

### 6.3 Confidence gating

Low-confidence contributions can be ignored by synthesis agents unless corroborated.

---

## 7. Telegram / UI integration (optional, not core)

Telegram should be:

* A **control console**
* Not the workspace

Example:

* You issue: `/start sprint-2026-02-w1`
* You inspect artifacts
* You approve phase transitions

Agents never “chat” in Telegram.

---

## 8. Where this ends (and should end)

This system should **not** become:

* A simulation of human conversation
* A permanent memory blob
* A debating society

It should end with:

* Frozen artifacts
* Clear decisions
* Reset context

If agents keep talking after the artifact is frozen, the system is failing.

---

## 9. Mental model to keep you honest

> **Agents are functions, not people.**
> They transform inputs → outputs.
> Conversation is a leaky abstraction.

If you design for artifacts, phases, and ownership, collaboration emerges *without* messaging overhead.

---

If you want next steps, the natural continuation is:

* A concrete filesystem layout
* A minimal orchestration loop
* A strict schema for contributions/artifacts

But the conceptual boundary is here.
