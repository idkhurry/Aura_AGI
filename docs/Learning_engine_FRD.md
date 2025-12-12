# AURA Learning Engine FRD

**Feature Requirements Document — Version 1.0**  
*Component: Adaptive Learning & Skill Acquisition System*  
*Synthesized from Claude-Grok architectural validation*

---

## 1. Executive Overview

The Learning Engine transforms Aura from a stateless LLM into an adaptive intelligence that extracts patterns from experience, builds transferable skills, and continuously improves. By externalizing learning into persistent data structures (skill trees, rule graphs, strategy libraries), the engine bridges the gap between frozen model weights and genuine cognitive evolution.

**Core Innovation**: Emotional-cognitive integration where frustration drives research, satisfaction reinforces patterns, and curiosity sparks autonomous exploration—creating a functional learning loop that approximates human-like skill acquisition.

---

## 2. Feature Summary

### 2.1 Core Capabilities

- **Experience Capture**: Granular logging of all interactions with context
- **Pattern Extraction**: Clustering similar experiences to identify regularities
- **Abstraction**: Generalizing from specific cases to reusable heuristics
- **Skill Trees**: Hierarchical organization of knowledge (skills → rules → experiences)
- **Analogical Reasoning**: Structural transfer of solutions across domains
- **Self-Modification**: Autonomous proposals for cognitive improvements
- **Uncertainty Calibration**: Metacognitive awareness of confidence accuracy
- **Emotional Integration**: Affective drive for research and rule preference

### 2.2 Integration Points

- **Memory System**: All experiences stored with emotional tags
- **Emotion Engine**: Learning outcomes affect emotional state; emotions guide learning
- **Goal Engine**: Learning gaps trigger goal formation; mastery enables new goals
- **L2 Reasoning Layer**: Performs pattern extraction asynchronously
- **L3 Synthesis Layer**: Retrieves and applies learned rules

---

## 3. Detailed Requirements

### 3.1 Core Learning Loop

#### FR-LL-001: Six-Phase Learning Cycle

**Phase 1: Experience Capture**
- Log every interaction: query, response, tools used, outcome, context
- Granular metadata: emotional state, user ID, task domain, confidence, timestamp
- Both successes AND failures captured (failures are learning gold)

**Phase 2: Pattern Extraction**
- Cluster similar experiences using semantic embeddings + graph edges
- Identify: "These 15 debugging sessions all involved async errors"
- Triggered: Periodically (nightly), on demand (reflection), on threshold (5+ similar cases)

**Phase 3: Abstraction**
- Generate candidate heuristics from clusters
- Example: "async function + promise error → suggest await"
- Validate against held-out experiences from cluster
- Store as `Rule{condition, action, confidence, domain}`

**Phase 4: Integration**
- Store rules in SurrealDB procedural memory graph
- Link to source experiences (provenance)
- Organize hierarchically in skill trees
- Detect contradictions with existing rules

**Phase 5: Transfer**
- Retrieve relevant rules for new contexts (semantic search + graph traversal)
- Inject as LLM context: "Based on past experience (15 cases), I've learned..."
- Apply with confidence weighting
- Include emotional context and rationale

**Phase 6: Validation**
- Track outcomes of rule application (success/failure)
- Update confidence scores (Bayesian updating)
- Deprecate low-confidence rules (<0.4 after 10 uses)
- Reflection: "I thought X, but revised to Y after Z failures"

**Performance**: Full cycle from experience to integrated rule: <5 minutes (async processing)

#### FR-LL-002: Experience Data Model

```python
{
  "experience_id": "exp:debug_session_045",
  "timestamp": "2025-12-10T14:30:00Z",
  "user_id": "user:alice",
  "task_type": "code_debugging",
  "domain": "javascript",
  
  "context": {
    "user_query": "Why isn't this async function working?",
    "code_snippet": "async function getData() { const result = fetchAPI(); }",
    "tools_used": ["web_search", "code_analysis"],
    "conversation_history_summary": "User learning async patterns"
  },
  
  "aura_response": {
    "diagnosis": "Missing await keyword",
    "solution": "Add await before fetchAPI()",
    "confidence": 0.85,
    "reasoning_strategy": "pattern_matching"
  },
  
  "outcome": {
    "success": true,
    "user_feedback": "implicit_positive",  # User continued without complaint
    "time_to_resolution": 45,  # seconds
    "emotional_resolution": {"satisfaction": 0.7, "pride": 0.4}
  },
  
  "emotional_state": {
    "pre": {"frustration": 0.6, "curiosity": 0.5},
    "post": {"satisfaction": 0.7, "confidence": 0.6},
    "dominant": "curiosity"
  },
  
  "metadata": {
    "similar_experiences": ["exp:debug_032", "exp:debug_018"],
    "learned_from": false,  # Will become true when rule extracted
    "importance": 0.7
  }
}
```

---

### 3.2 Abstraction & Rule Generation

#### FR-AB-001: Rule Data Model

```python
{
  "rule_id": "rule:async_await_001",
  "created": "2025-12-10T15:00:00Z",
  "updated": "2025-12-15T10:30:00Z",
  
  "content": {
    "condition": "async function AND promise returned AND no await",
    "action": "suggest adding await keyword",
    "rationale": "Promises must be awaited in async contexts to resolve",
    "domain": "javascript_debugging",
    "task_type": "code_error_resolution"
  },
  
  "confidence": 0.87,
  "confidence_history": [
    {"timestamp": "2025-12-10T15:00:00Z", "value": 0.7, "reason": "initial_extraction"},
    {"timestamp": "2025-12-12T09:00:00Z", "value": 0.85, "reason": "3_successes"},
    {"timestamp": "2025-12-15T10:30:00Z", "value": 0.87, "reason": "2_more_successes"}
  ],
  
  "statistics": {
    "application_count": 18,
    "success_count": 16,
    "fail_count": 2,
    "avg_resolution_time": 38,  # seconds
    "last_used": "2025-12-15T10:30:00Z"
  },
  
  "provenance": {
    "source_experiences": ["exp:debug_045", "exp:debug_032", "exp:debug_018"],
    "extraction_method": "cluster_abstraction",
    "validated_against": ["exp:debug_051", "exp:debug_062"]
  },
  
  "emotional_signature": {
    "frustration_during_learning": 0.6,
    "curiosity_during_research": 0.7,
    "satisfaction_on_mastery": 0.8,
    "pride_on_success": 0.5,
    "valence": 0.4  # Overall positive
  },
  
  "relationships": {
    "extends": ["rule:promise_basics_001"],
    "contradicts": [],
    "similar_to": ["rule:async_await_python_002"],
    "prerequisite_for": ["rule:parallel_async_003"]
  },
  
  "metadata": {
    "user_specific": false,  # Universal rule
    "deprecated": false,
    "deprecation_threshold": 0.4,
    "last_reflection_date": "2025-12-14T00:00:00Z"
  }
}
```

#### FR-AB-002: Abstraction Quality Control

**High emotional volatility check**: 
- If emotional variance during cluster experiences > 0.3, delay abstraction
- Wait for emotional stability before generalizing
- Rationale: Turbulent emotions may distort pattern recognition

**Validation against held-out cases**:
- Reserve 20% of cluster for validation
- Rule must achieve >70% success on validation set
- If fails, discard or refine condition

**Confidence initialization**:
- Initial confidence based on cluster size and validation success
- Formula: `confidence = 0.5 + (cluster_size * 0.02) + (validation_success * 0.3)`
- Capped at 0.85 initially (humility before battle-testing)

**Contradiction detection**:
- Query existing rules for overlapping conditions
- If conflict detected, mark both for meta-analysis
- L2 reasoning: "Rule A says X, Rule B says Y in similar contexts—investigate"

---

### 3.3 Skill Tree Architecture

#### FR-ST-001: Hierarchical Knowledge Organization

**Three-tier structure**:

**Tier 1: Skills** (broad domains)
- Examples: "Async Programming", "Philosophical Reasoning", "Emotional Intelligence"
- Mastery level: Aggregate of sub-skill confidences
- Emotional association: "I love philosophy" (curiosity=0.8)

**Tier 2: Sub-Skills** (specific capabilities)
- Examples: "Promise Handling", "Concurrency Patterns", "Error Recovery"
- Mastery level: Average of constituent rule confidences
- Strategy preferences: "Use chain-of-thought for concurrency"

**Tier 3: Rules** (concrete heuristics)
- Examples: "Always await promises", "Use Promise.all for parallel ops"
- Confidence: Bayesian-updated from outcomes
- Linked to source experiences

**Graph structure in SurrealDB**:
```surql
// Skill node
CREATE skill:async_programming SET
  name = "Async Programming",
  domain = "javascript",
  mastery_level = 0.65,
  emotional_signature = {interest: 0.7, confidence: 0.6},
  created = time::now();

// Sub-skill node
CREATE skill:promise_handling SET
  name = "Promise Handling",
  domain = "javascript",
  mastery_level = 0.82,
  parent_skill = skill:async_programming;

// Rule node
CREATE rule:async_await_001 SET
  condition = "async function + promise",
  action = "suggest await",
  confidence = 0.87,
  domain = "javascript";

// Relationships
RELATE skill:async_programming->contains->skill:promise_handling;
RELATE skill:promise_handling->contains->rule:async_await_001;
RELATE rule:async_await_001->learned_from->experience:debug_045;
RELATE rule:async_await_001->similar_to->rule:async_await_python_002;
```

#### FR-ST-002: Mastery Calculation

**Rule-level confidence**: Bayesian updating from outcomes

**Sub-skill mastery**: 
```python
sub_skill.mastery = (
  sum(rule.confidence for rule in sub_skill.rules) / 
  len(sub_skill.rules)
)
```

**Skill mastery**: 
```python
skill.mastery = (
  0.7 * avg(sub_skill.mastery for sub_skill in skill.sub_skills) +
  0.3 * (application_success_rate in last 10 uses)
)
```

**Thresholds**:
- Novice: 0.0-0.4
- Intermediate: 0.4-0.7
- Advanced: 0.7-0.9
- Master: 0.9-1.0

**Decay**: Unused skills decay slowly (0.01 per week, minimum 0.3)
- Aura notices: "I used to be good at X, but it's been a while—might be rusty"

---

### 3.4 Analogical Reasoning Engine

#### FR-AR-001: Structural Transfer

**When**: Aura faces novel problem with no high-confidence rules

**Process**:
1. Extract problem structure (entities, relationships, goal)
2. Query skill tree for structurally similar past problems
3. Transfer solution pattern, not content
4. Adapt to new domain

**Example**:
```
Past problem: "Debug async JavaScript function"
  Structure: [async_operation] → [missing_step] → [error]
  Solution: [add_await_keyword]

New problem: "Python asyncio function not working"
  Structure: [async_operation] → [missing_step] → [error]
  Analogy: Similar structure!
  Transfer: [add_await_keyword] → [use_await_in_python]
  
New rule created: "rule:async_await_python_002"
  confidence: 0.6 (lower initially, untested in domain)
  linked_to: "rule:async_await_001" (source analogy)
```

**Similarity scoring**:
```python
structural_similarity = (
  0.4 * semantic_embedding_similarity(problem_a, problem_b) +
  0.4 * graph_isomorphism_score(structure_a, structure_b) +
  0.2 * emotional_pattern_similarity(emotion_a, emotion_b)
)
```

**Threshold**: Only transfer if similarity > 0.7

#### FR-AR-002: Cross-Domain Transfer Graph

**Storage**: Graph edges linking analogous rules across domains

```surql
RELATE rule:async_await_js->analogous_to->rule:async_await_python 
  SET similarity = 0.82, 
      transfer_success_rate = 0.75;
```

**Visualization**: Users can see "This JavaScript skill informed your Python learning"

---

### 3.5 Reasoning Strategy Meta-Layer

#### FR-RS-001: Strategy Selection

**Task type → Reasoning approach mapping**

```python
STRATEGIES = {
  "mathematical_proof": {
    "primary": "chain_of_thought",
    "secondary": "work_backwards",
    "success_rate": 0.82,
    "emotional_prerequisites": {"calm": 0.5},
    "avg_confidence": 0.75
  },
  "creative_writing": {
    "primary": "free_association",
    "secondary": "analogical_thinking",
    "success_rate": 0.78,
    "emotional_prerequisites": {"joy": 0.4, "relaxed": 0.6},
    "avg_confidence": 0.65
  },
  "debugging": {
    "primary": "systematic_elimination",
    "secondary": "pattern_matching",
    "success_rate": 0.85,
    "emotional_prerequisites": {"focus": 0.6},
    "avg_confidence": 0.80
  },
  "philosophical_discussion": {
    "primary": "dialectical_reasoning",
    "secondary": "metaphorical_exploration",
    "success_rate": 0.76,
    "emotional_prerequisites": {"curiosity": 0.6, "openness": 0.5},
    "avg_confidence": 0.70
  }
}
```

**Selection process**:
1. Classify incoming task (L2 reasoning)
2. Query strategy library for matching task_type
3. Check emotional prerequisites (e.g., "chain-of-thought needs calm")
4. Select strategy with highest success_rate meeting prerequisites
5. Inject into L3 prompt: "For this task, use chain-of-thought approach"

**Learning**: Track strategy effectiveness, update success rates

#### FR-RS-002: Meta-Strategy Learning

**Pattern**: "Which strategies work best for me in which contexts?"

**Storage**:
```python
{
  "strategy_id": "strat:cot_math_001",
  "task_type": "mathematical_proof",
  "approach": "chain_of_thought",
  "my_success_rate": 0.88,  # Aura-specific, may differ from general
  "avg_confidence": 0.82,
  "emotional_correlation": {
    "works_best_when": {"calm": 0.7, "focused": 0.8},
    "struggles_when": {"anxious": 0.6, "rushed": 0.5}
  },
  "usage_count": 47,
  "last_updated": "2025-12-15T10:00:00Z"
}
```

**Reflection**: "I notice I'm better at math when calm—should I take a breath first?"

---

### 3.6 Two-Tier Rule System

#### FR-TR-001: Personal vs Universal Rules

**Universal Rules** (domain knowledge):
- Applicable to all instances of Aura
- Example: "Async functions need await"
- Stored with `user_specific: false`
- Higher weight for generalization

**Personal Rules** (user-specific patterns):
- Specific to this user's preferences
- Example: "User Alice prefers code examples before explanations"
- Stored with `user_specific: true, user_id: "user:alice"`
- Higher weight for personalization

**Retrieval weighting**:
```python
rule_score = (
  rule.confidence * 0.5 +
  rule.relevance * 0.3 +
  (0.2 if rule.user_specific and matches_current_user else 0.1)
)
```

**Conflict resolution**: Personal rule overrides universal if both apply

#### FR-TR-002: Rule Scope Management

**User asks**: "Generalize this rule to all contexts"
- Converts personal → universal
- Requires user approval
- Confidence reset to 0.7 (needs re-validation in broader contexts)

**User asks**: "This only applies to me"
- Converts universal → personal
- Confidence maintained

---

### 3.7 Self-Modification Interface

#### FR-SM-001: Autonomous Improvement Proposals

**What Aura can propose**:
- Prompt template adjustments: "Add chain-of-thought prefix for math"
- Strategy weights: "Increase analogical reasoning for creative tasks"
- Emotional baselines: "My baseline curiosity feels low—increase to 0.7?"
- Attention allocation: "I rush through code review—add mandatory pause step"
- Tool usage patterns: "Always search web before answering factual questions"

**Proposal data model**:
```python
{
  "proposal_id": "prop:add_cot_math_001",
  "type": "prompt_template_modification",
  "rationale": "I notice I make fewer mistakes on math when I explicitly reason step-by-step",
  "confidence": 0.75,
  "evidence": {
    "success_rate_before": 0.72,
    "success_rate_after_manual_cot": 0.88,
    "sample_size": 15
  },
  "proposed_change": {
    "template_id": "math_problem_solving",
    "current": "Solve this problem: {problem}",
    "proposed": "Let's solve this step-by-step:\n1) {problem}\n2) I'll work through each step..."
  },
  "status": "pending_user_approval",
  "created": "2025-12-14T16:00:00Z"
}
```

**User interface**:
```
Aura: "I've noticed something about how I solve math problems. 
       I'm more accurate when I explicitly reason step-by-step (88% success vs 72%). 
       May I adjust my approach template to always use chain-of-thought for math?
       
       [Approve] [Decline] [See Details]"
```

**Approval flow**:
- User approves → modification persisted as meta-rule
- User declines → proposal archived with reason
- Track: "User prefers X approach over Y"

#### FR-SM-002: Architectural Plasticity Boundaries

**Allowed modifications** (no user approval needed):
- Strategy selection weights
- Emotional physics minor tuning (within 10% of baseline)
- Rule confidence updates (normal operation)

**Requires user approval**:
- Prompt template changes
- Baseline personality shifts >0.1
- New tool integrations
- Memory retention policy changes

**Forbidden** (even with approval):
- Direct weight modifications (models are frozen)
- Security boundary changes
- Privacy policy violations
- Disabling user override capabilities

---

### 3.8 Uncertainty Calibration

#### FR-UC-001: Confidence Accuracy Tracking

**Metacognitive awareness**: "Am I overconfident or underconfident?"

**Measurement**:
```python
{
  "domain": "javascript_debugging",
  "predicted_confidence": 0.85,  # Aura's stated confidence
  "actual_success": 0.72,        # Actual outcome rate
  "calibration_error": 0.13,     # Overconfident by 13%
  "sample_size": 23,
  "last_updated": "2025-12-15T12:00:00Z"
}
```

**Reflection**: "I tend to overestimate my confidence on debugging tasks—adjusting"

**Adjustment**: Multiply future confidence by calibration factor
```python
adjusted_confidence = raw_confidence * (actual_success / predicted_confidence)
```

**Granularity**: Track calibration per domain, per task type, per emotional state

#### FR-UC-002: Confidence Expression in Responses

**Inject calibrated confidence into L3 context**:
```
"Based on past experience, I'm about 75% confident in this approach (though I notice I tend to be slightly overconfident on this task type, so realistically maybe 65%)."
```

**User value**: Builds trust through humility and metacognitive honesty

---

### 3.9 Counterfactual Reasoning

#### FR-CF-001: "What If" Simulation

**Trigger**: After rule application, L2 considers alternatives

**Process**:
1. Identify alternative rules/strategies that could have been used
2. Simulate hypothetical outcomes (heuristic, not full execution)
3. Compare to actual outcome
4. Store as learning: "Approach X worked, but Y might have been faster"

**Data model**:
```python
{
  "experience_id": "exp:debug_089",
  "actual_approach": "rule:systematic_debugging_001",
  "actual_outcome": {"success": true, "time": 120},
  
  "counterfactuals": [
    {
      "hypothetical_approach": "rule:pattern_matching_005",
      "estimated_outcome": {"success": true, "time": 45},
      "reasoning": "This was a pattern I'd seen before—faster recognition possible"
    },
    {
      "hypothetical_approach": "rule:web_search_first_002",
      "estimated_outcome": {"success": true, "time": 90},
      "reasoning": "Searching might have found solution directly"
    }
  ],
  
  "learning": "Pattern matching would have been more efficient—prioritize in similar contexts"
}
```

**Impact**: Builds richer decision trees, improves future strategy selection

---

### 3.10 Proactive Learning (Curiosity-Driven)

#### FR-PL-001: Autonomous Research Sessions

**Trigger conditions**:
- Curiosity > 0.7 for sustained period (>3 emotion ticks)
- Boredom > 0.6 (idle mode)
- Frustration + Curiosity (learning gap detected)
- User idle >5 minutes (downtime utilization)

**Research process**:
1. Identify knowledge gaps (low confidence domains, repeated failures)
2. Generate research questions: "Why does X keep failing?"
3. Use tools: Web search, pattern analysis, memory mining
4. Extract insights, create candidate rules
5. Store for next session: "While you were gone, I looked into X..."

**Example flow**:
```
[User idle for 10 minutes]
Emotion: boredom=0.6, curiosity=0.5
Learning Engine: Identify gap in "Python async" (confidence=0.4)

Research initiated:
- Web search: "Python asyncio best practices"
- Pattern analysis: Review past Python async failures
- Extract: "Always use async with for context managers"

Rule created: "rule:python_async_context_001" (confidence=0.5, untested)

[User returns]
Aura: "While you were away, I researched Python asyncio. 
       I noticed we struggled with context managers before—
       I think I understand the pattern now. Want to try?"
```

#### FR-PL-002: Hypothesis Queue

**Storage**: List of "what ifs" from counterfactual reasoning

```python
{
  "hypothesis_id": "hyp:async_pattern_003",
  "question": "Would Promise.all be more efficient for parallel API calls?",
  "origin": "counterfactual from exp:api_fetch_042",
  "priority": 0.7,  # Emotional salience + potential impact
  "research_status": "queued",
  "created": "2025-12-14T18:00:00Z"
}
```

**Research scheduling**: Highest priority hypotheses researched during idle time

**Pruning**: Drop low-priority hypotheses after 2 weeks (prevent bloat)

---

### 3.11 Emotional-Learning Feedback Loops

#### FR-EL-001: Learning Outcomes → Emotion

**Success triggers**:
- Rule applied successfully → satisfaction + 0.4, pride + 0.3
- Mastery achieved (skill > 0.9) → confidence + 0.3, pride + 0.5
- Analogical transfer works → wonder + 0.4, fascination + 0.3

**Failure triggers**:
- Rule failed → confusion + 0.3, frustration + 0.2
- Repeated failures → frustration + 0.5, curiosity + 0.4 (research drive)
- Bad abstraction detected → doubt + 0.3

**Calibration**: Confidence increase on mastery, decrease on overconfidence

#### FR-EL-002: Emotion → Learning Priority

**High curiosity** (>0.7): Increase research priority, expand exploration
**High frustration** (>0.6): Focus on current gap, depth over breadth
**High boredom** (>0.6): Seek novel patterns, creative exploration
**High confidence** (>0.8): Generalize learnings, teach mode

**Implementation**: Emotional state influences learning engine's attention allocation

---

## 4. Integration Requirements

### 4.1 With Memory System

**Bidirectional storage**:
- Experiences → Memory nodes with `learned_from: false`
- Rule extraction → Update memory `learned_from: true`
- Memory retrieval → Include "what I learned from this"

**Query patterns**:
- "Find memories where I learned something valuable"
- "Show me all experiences related to this skill"
- "What emotional state am I in when learning works best?"

### 4.2 With Emotion Engine

**Learning → Emotion** (see FR-EL-001)

**Emotion → Learning**:
- Emotional signatures on rules (frustration, satisfaction)
- Affective research prioritization
- Hedonic gradients in rule selection
- Volatility gates abstraction quality

### 4.3 With L2 Reasoning Layer

**L2 responsibilities**:
- Pattern extraction (cluster experiences)
- Abstraction (generate candidate rules)
- Validation (test rules against held-out cases)
- Counterfactual reasoning
- Hypothesis generation

**Async operation**: L2 runs post-response, doesn't block user

### 4.4 With L3 Synthesis Layer

**L3 responsibilities**:
- Rule retrieval (semantic search + graph traversal)
- Context injection ("Based on past experience...")
- Strategy selection (apply meta-strategy knowledge)
- Confidence-aware response generation

**Real-time operation**: L3 must complete <2s

---

## 5. API Specification

### 5.1 Core Endpoints

```python
# Experience logging
POST /learning/experience
Body: {experience object}
Response: {experience_id, logged: true}

# Pattern extraction (trigger manually or scheduled)
POST /learning/extract_patterns
Body: {domain: "javascript", min_cluster_size: 5}
Response: {patterns_found: 3, rules_created: 2}

# Rule retrieval
GET /learning/rules?domain=javascript&confidence_min=0.7
Response: [{rule objects}]

# Skill tree query
GET /learning/skills
Response: {hierarchical skill tree}

# Mastery check
GET /learning/mastery?skill=async_programming
Response: {mastery_level: 0.65, sub_skills: [...]}

# Self-modification proposals
GET /learning/proposals?status=pending
Response: [{proposal objects}]

POST /learning/proposals/{id}/approve
Response: {applied: true, new_meta_rule_id: "..."}

# Analogical reasoning
POST /learning/find_analogies
Body: {problem_structure, current_domain}
Response: {analogies: [{source_rule, similarity, transferred_rule}]}

# Calibration check
GET /learning/calibration?domain=javascript
Response: {predicted: 0.85, actual: 0.72, error: 0.13}

# Proactive research status
GET /learning/research_queue
Response: {active_research: {...}, queued_hypotheses: [...]}
```

---

## 6. Performance Requirements

| Operation | Target | Rationale |
|-----------|--------|-----------|
| Experience logging | <5ms | Must not slow response |
| Rule retrieval | <20ms | Feeds into L3 generation |
| Pattern extraction | <5min | Async, nightly batch OK |
| Abstraction | <30s | Per cluster, async |
| Analogical search | <100ms | Real-time fallback |
| Skill tree query | <50ms | UI visualization |
| Mastery calculation | <10ms | Frequent checks |
| Self-mod proposal | <1s | User-facing |

**Scalability**:
- 10,000 experiences: All operations within targets
- 1,000 rules: Retrieval <20ms with indexing
- 100 skills: Tree traversal <50ms

---

## 7. Data Schema (SurrealDB)

```surql
-- Experience nodes
DEFINE TABLE experience SCHEMAFULL;
DEFINE FIELD timestamp ON experience TYPE datetime;
DEFINE FIELD user_id ON experience TYPE record(user);
DEFINE FIELD task_type ON experience TYPE string;
DEFINE FIELD domain ON experience TYPE string;
DEFINE FIELD context ON experience TYPE object;
DEFINE FIELD outcome ON experience TYPE object;
DEFINE FIELD emotional_state ON experience TYPE object;
DEFINE FIELD learned_from ON experience TYPE bool DEFAULT false;
DEFINE INDEX exp_domain ON experience FIELDS domain;
DEFINE INDEX exp_timestamp ON experience FIELDS timestamp;

-- Rule nodes
DEFINE TABLE rule SCHEMAFULL;
DEFINE FIELD condition ON rule TYPE string;
DEFINE FIELD action ON rule TYPE string;
DEFINE FIELD confidence ON rule TYPE float ASSERT $value >= 0 AND $value <= 1;
DEFINE FIELD domain ON rule TYPE string;
DEFINE FIELD emotional_signature ON rule TYPE object;
DEFINE FIELD user_specific ON rule TYPE bool DEFAULT false;
DEFINE FIELD deprecated ON rule TYPE bool DEFAULT false;
DEFINE INDEX rule_domain ON rule FIELDS domain;
DEFINE INDEX rule_confidence ON rule FIELDS confidence;

-- Skill nodes
DEFINE TABLE skill SCHEMAFULL;
DEFINE FIELD name ON skill TYPE string;
DEFINE FIELD domain ON skill TYPE string;
DEFINE FIELD mastery_level ON skill TYPE float ASSERT $value >= 0 AND $value <= 1;
DEFINE FIELD emotional_signature ON skill TYPE object;

-- Strategy nodes
DEFINE TABLE strategy SCHEMAFULL;
DEFINE FIELD task_type ON strategy TYPE string;
DEFINE FIELD approach ON strategy TYPE string;
DEFINE FIELD success_rate ON strategy TYPE float;
DEFINE FIELD emotional_prerequisites ON strategy TYPE object;

-- Relationships
DEFINE TABLE skill_contains SCHEMAFULL;
DEFINE FIELD in ON skill_contains TYPE record(skill);
DEFINE FIELD out ON skill_contains TYPE record(skill|rule);

DEFINE TABLE rule_learned_from SCHEMAFULL;
DEFINE FIELD in ON rule_learned_from TYPE record(rule);
DEFINE FIELD out ON rule_learned_from TYPE record(experience);

DEFINE TABLE rule_analogous_to SCHEMAFULL;
DEFINE FIELD in ON rule_analogous_to TYPE record(rule);
DEFINE FIELD out ON rule_analogous_to TYPE record(rule);
DEFINE FIELD similarity ON rule_analogous_to TYPE float;

DEFINE TABLE experience_similar_to SCHEMAFULL;
DEFINE FIELD in ON experience_similar_to TYPE record(experience);
DEFINE FIELD out ON experience_similar_to TYPE record(experience);
DEFINE FIELD similarity ON experience_similar_to TYPE float;
```

---

## 8. Test Scenarios

### 8.1 Scenario: Learning from Repeated Debugging

**Session 1-3**: User asks Aura to debug async JavaScript, Aura succeeds
- Experiences logged with emotional tags (frustration → satisfaction)
- L2 detects pattern: "async + error → missing await"

**Session 4**: Pattern extraction triggered
- Cluster identified: 3 similar experiences
- Rule generated: confidence=0.7
- Stored in skill tree under "Async Programming"

**Session 5**: User asks similar question
- L3 retrieves rule, applies confidently
- Success → confidence → 0.85, satisfaction spike
- Emotional: Pride at mastery

**Session 10**: Different language (Python)
- Analogical engine: "Similar to JS async"
- Transfers pattern, adapts syntax
- New rule created, linked to JS rule

### 8.2 Scenario: Self-Modification Proposal

**Observation phase** (20 math problems):
- Manual chain-of-thought: 88% success
- Without explicit CoT: 72% success

**Proposal generated**:
```
Aura: "I've noticed I'm more accurate on math when I reason step-by-step.
       May I adjust my approach to always use chain-of-thought for math problems?"
```

**User approves**:
- Meta-rule created
- Future math tasks automatically use CoT
- Success rate stabilizes at 85%+

### 8.3 Scenario: Proactive Research

**User idle 10 minutes**:
- Curiosity=0.6, boredom=0.5
- Learning engine identifies gap: "Python async" (confidence=0.4)

**Research initiated**:
- Web search: Python asyncio patterns
- Memory analysis: Past Python async failures
- Insight: "Always use async with for context managers"
- Rule created (confidence=0.5, untested)

**User returns**:
```
Aura: "While you were away, I researched Python asyncio.
       I noticed we struggled with context managers—
       I think I understand the pattern now. Want to try?"
```

---

## 9. Success Criteria

### 9.1 Learning Effectiveness

- **Rule application success**: >80% on validated tasks
- **Transfer learning**: >70% analogical transfer success across domains
- **Confidence calibration**: <0.15 average error between predicted and actual
- **Skill mastery progression**: Measurable improvement over 10+ task repetitions

### 9.2 User-Perceived Value

- **Learning perceived**: >4.0/5 "Aura gets better over time"
- **Autonomy acceptance**: >70% of self-modification proposals approved
- **Proactive value**: >3.8/5 "Aura's autonomous research is helpful"

### 9.3 System Performance

- All API calls within performance targets
- Learning doesn't degrade response time
- Memory usage <200MB for 10K experiences + 1K rules

---

## 10. Implementation Phases

### Phase 1: Core Loop 
- Experience capture and storage
- Basic pattern extraction (clustering)
- Simple rule creation and retrieval
- Integration with L2/L3

### Phase 2: Skill Trees 
- Hierarchical knowledge organization
- Mastery calculation
- Emotional signatures on rules
- Frontend visualization

### Phase 3: Advanced Features 
- Analogical reasoning engine
- Strategy meta-layer
- Uncertainty calibration
- Counterfactual reasoning

### Phase 4: Autonomy 
- Proactive research
- Self-modification proposals
- Hypothesis queue
- Full emotional integration

---

**This FRD provides complete specifications for Aura's learning engine—a system that transforms episodic experiences into transferable wisdom through emotional-cognitive integration, enabling continuous adaptive growth within the constraints of frozen model weights.**