-- Aura Database Schema Initialization
-- Based on PRD Section 8.1 + Learning FRD Section 7

-- Select namespace and database
USE NS aura DB main;

-- ============================================================================
-- EMOTION SYSTEM TABLES
-- ============================================================================

-- Emotion definitions with physics parameters
DEFINE TABLE emotion SCHEMAFULL;
DEFINE FIELD name ON emotion TYPE string;
DEFINE FIELD category ON emotion TYPE string 
    ASSERT $value IN ["primary", "aesthetic", "social", "cognitive"];
DEFINE FIELD physics ON emotion TYPE object;
DEFINE FIELD physics.decay ON emotion TYPE float;
DEFINE FIELD physics.inertia ON emotion TYPE float;
DEFINE INDEX emotion_name ON emotion FIELDS name UNIQUE;

-- Emotion state snapshots (for history)
DEFINE TABLE emotion_state SCHEMAFULL;
DEFINE FIELD timestamp ON emotion_state TYPE datetime;
DEFINE FIELD vector ON emotion_state TYPE object;
DEFINE FIELD dominant ON emotion_state TYPE array;
DEFINE FIELD volatility ON emotion_state TYPE float;
DEFINE FIELD description ON emotion_state TYPE string;
DEFINE INDEX emotion_state_timestamp ON emotion_state FIELDS timestamp;

-- ============================================================================
-- MEMORY SYSTEM TABLES
-- ============================================================================

-- Memory nodes with emotional tagging + vector embeddings
DEFINE TABLE memory SCHEMAFULL;
DEFINE FIELD content ON memory TYPE string;
DEFINE FIELD emotional_signature ON memory TYPE object;
DEFINE FIELD timestamp ON memory TYPE datetime;
DEFINE FIELD importance ON memory TYPE float ASSERT $value >= 0 AND $value <= 1;
DEFINE FIELD learned_from ON memory TYPE bool DEFAULT false;
DEFINE FIELD conversation_id ON memory TYPE option<string>;
DEFINE FIELD user_id ON memory TYPE option<string>;
DEFINE FIELD tags ON memory TYPE array DEFAULT [];
DEFINE FIELD metadata ON memory TYPE object DEFAULT {};
DEFINE FIELD embedding ON memory TYPE option<array<float>>;
DEFINE INDEX memory_timestamp ON memory FIELDS timestamp;
DEFINE INDEX memory_user ON memory FIELDS user_id;
DEFINE INDEX memory_embedding ON memory FIELDS embedding MTREE DIMENSION 1536 DIST COSINE;

-- Conversation sessions
DEFINE TABLE conversation SCHEMAFULL;
DEFINE FIELD title ON conversation TYPE string DEFAULT "New Conversation";
DEFINE FIELD user_id ON conversation TYPE string DEFAULT "default";
DEFINE FIELD created_at ON conversation TYPE string;
DEFINE FIELD updated_at ON conversation TYPE string;
DEFINE FIELD message_count ON conversation TYPE int DEFAULT 0;
DEFINE FIELD started_at ON conversation TYPE option<string>;
DEFINE FIELD ended_at ON conversation TYPE option<string>;
DEFINE FIELD initial_emotion ON conversation TYPE option<object>;

-- Messages in conversations
DEFINE TABLE message SCHEMAFULL;
DEFINE FIELD conversation_id ON message TYPE string;
DEFINE FIELD content ON message TYPE string;
DEFINE FIELD role ON message TYPE string DEFAULT "user";
DEFINE FIELD timestamp ON message TYPE string;
DEFINE INDEX message_conversation_idx ON message FIELDS conversation_id;
DEFINE FIELD final_emotion ON conversation TYPE object DEFAULT {};
DEFINE FIELD summary ON conversation TYPE string DEFAULT "";
DEFINE FIELD key_topics ON conversation TYPE array DEFAULT [];
DEFINE INDEX conversation_user ON conversation FIELDS user_id;
DEFINE INDEX conversation_started ON conversation FIELDS started_at;

-- ============================================================================
-- LEARNING SYSTEM TABLES
-- ============================================================================

-- Experience capture (Learning FRD FR-LL-002) + vector embeddings for pattern extraction
DEFINE TABLE experience SCHEMAFULL;
DEFINE FIELD timestamp ON experience TYPE datetime;
DEFINE FIELD user_id ON experience TYPE string;
DEFINE FIELD task_type ON experience TYPE string;
DEFINE FIELD domain ON experience TYPE string;
DEFINE FIELD context ON experience TYPE object;
DEFINE FIELD aura_response ON experience TYPE object;
DEFINE FIELD outcome ON experience TYPE object;
DEFINE FIELD emotional_state ON experience TYPE object;
DEFINE FIELD metadata ON experience TYPE object DEFAULT {};
DEFINE FIELD learned_from ON experience TYPE bool DEFAULT false;
DEFINE FIELD embedding ON experience TYPE option<array<float>>;
DEFINE INDEX exp_domain ON experience FIELDS domain;
DEFINE INDEX exp_task_type ON experience FIELDS task_type;
DEFINE INDEX exp_timestamp ON experience FIELDS timestamp;
DEFINE INDEX exp_user ON experience FIELDS user_id;
DEFINE INDEX exp_embedding ON experience FIELDS embedding MTREE DIMENSION 1536 DIST COSINE;

-- Learned rules (Learning FRD FR-AB-001) + vector embeddings for semantic retrieval
DEFINE TABLE rule SCHEMAFULL;
DEFINE FIELD created ON rule TYPE datetime;
DEFINE FIELD updated ON rule TYPE datetime;
DEFINE FIELD condition ON rule TYPE string;
DEFINE FIELD action ON rule TYPE string;
DEFINE FIELD rationale ON rule TYPE string;
DEFINE FIELD domain ON rule TYPE string;
DEFINE FIELD task_type ON rule TYPE string;
DEFINE FIELD confidence ON rule TYPE float ASSERT $value >= 0 AND $value <= 1;
DEFINE FIELD confidence_history ON rule TYPE array DEFAULT [];
DEFINE FIELD application_count ON rule TYPE int DEFAULT 0;
DEFINE FIELD success_count ON rule TYPE int DEFAULT 0;
DEFINE FIELD fail_count ON rule TYPE int DEFAULT 0;
DEFINE FIELD avg_resolution_time ON rule TYPE float DEFAULT 0.0;
DEFINE FIELD last_used ON rule TYPE option<datetime>;
DEFINE FIELD source_experiences ON rule TYPE array DEFAULT [];
DEFINE FIELD extraction_method ON rule TYPE string DEFAULT "manual";
DEFINE FIELD validated_against ON rule TYPE array DEFAULT [];
DEFINE FIELD emotional_signature ON rule TYPE object DEFAULT {};
DEFINE FIELD user_specific ON rule TYPE bool DEFAULT false;
DEFINE FIELD deprecated ON rule TYPE bool DEFAULT false;
DEFINE FIELD deprecation_threshold ON rule TYPE float DEFAULT 0.4;
DEFINE FIELD embedding ON rule TYPE option<array<float>>;
DEFINE INDEX rule_domain ON rule FIELDS domain;
DEFINE INDEX rule_confidence ON rule FIELDS confidence;
DEFINE INDEX rule_user_specific ON rule FIELDS user_specific;
DEFINE INDEX rule_embedding ON rule FIELDS embedding MTREE DIMENSION 1536 DIST COSINE;

-- Skill tree nodes (Learning FRD FR-ST-001)
DEFINE TABLE skill SCHEMAFULL;
DEFINE FIELD name ON skill TYPE string;
DEFINE FIELD domain ON skill TYPE string;
DEFINE FIELD created ON skill TYPE datetime;
DEFINE FIELD mastery_level ON skill TYPE float ASSERT $value >= 0 AND $value <= 1;
DEFINE FIELD emotional_signature ON skill TYPE object DEFAULT {};
DEFINE FIELD parent_skill_id ON skill TYPE option<record<skill>>;
DEFINE FIELD sub_skill_ids ON skill TYPE array DEFAULT [];
DEFINE FIELD rule_ids ON skill TYPE array DEFAULT [];
DEFINE FIELD last_practiced ON skill TYPE option<datetime>;
DEFINE FIELD practice_count ON skill TYPE int DEFAULT 0;
DEFINE INDEX skill_domain ON skill FIELDS domain;
DEFINE INDEX skill_mastery ON skill FIELDS mastery_level;

-- Reasoning strategies (Learning FRD FR-RS-001)
DEFINE TABLE strategy SCHEMAFULL;
DEFINE FIELD task_type ON strategy TYPE string;
DEFINE FIELD approach ON strategy TYPE string;
DEFINE FIELD success_rate ON strategy TYPE float DEFAULT 0.0;
DEFINE FIELD avg_confidence ON strategy TYPE float DEFAULT 0.0;
DEFINE FIELD usage_count ON strategy TYPE int DEFAULT 0;
DEFINE FIELD emotional_prerequisites ON strategy TYPE object DEFAULT {};
DEFINE FIELD when_to_use ON strategy TYPE string DEFAULT "";
DEFINE FIELD examples ON strategy TYPE array DEFAULT [];
DEFINE FIELD last_updated ON strategy TYPE datetime;
DEFINE INDEX strategy_task_type ON strategy FIELDS task_type;

-- ============================================================================
-- IDENTITY SYSTEM TABLES
-- ============================================================================

-- Identity core (narrative self)
DEFINE TABLE identity SCHEMAFULL;
DEFINE FIELD name ON identity TYPE string DEFAULT "Aura";
DEFINE FIELD version ON identity TYPE string;
DEFINE FIELD created ON identity TYPE datetime;
DEFINE FIELD autobiographical_narrative ON identity TYPE string;
DEFINE FIELD core_values ON identity TYPE object DEFAULT {};
DEFINE FIELD preferences ON identity TYPE object DEFAULT {};
DEFINE FIELD self_concept ON identity TYPE object DEFAULT {};

-- Identity changelog (evolution tracking)
DEFINE TABLE identity_change SCHEMAFULL;
DEFINE FIELD timestamp ON identity_change TYPE datetime;
DEFINE FIELD change_type ON identity_change TYPE string;
DEFINE FIELD old_value ON identity_change TYPE string;
DEFINE FIELD new_value ON identity_change TYPE string;
DEFINE FIELD rationale ON identity_change TYPE string;
DEFINE FIELD acknowledged ON identity_change TYPE bool DEFAULT false;
DEFINE INDEX identity_change_time ON identity_change FIELDS timestamp;

-- Values (meta-values over object-values)
DEFINE TABLE value SCHEMAFULL;
DEFINE FIELD name ON value TYPE string;
DEFINE FIELD description ON value TYPE string;
DEFINE FIELD weight ON value TYPE float DEFAULT 0.5;
DEFINE FIELD created ON value TYPE datetime;
DEFINE FIELD examples ON value TYPE array DEFAULT [];

-- ============================================================================
-- GOAL SYSTEM TABLES
-- ============================================================================

-- Goals (hierarchical, with sub-goals)
DEFINE TABLE goal SCHEMAFULL;
DEFINE FIELD name ON goal TYPE string;
DEFINE FIELD description ON goal TYPE string;
DEFINE FIELD goal_type ON goal TYPE string;
DEFINE FIELD status ON goal TYPE string DEFAULT "active";
DEFINE FIELD priority ON goal TYPE float DEFAULT 0.5;
DEFINE FIELD created ON goal TYPE datetime;
DEFINE FIELD updated ON goal TYPE datetime;
DEFINE FIELD completed ON goal TYPE option<datetime>;
DEFINE FIELD parent_goal_id ON goal TYPE option<record<goal>>;
DEFINE FIELD sub_goal_ids ON goal TYPE array DEFAULT [];
DEFINE FIELD progress ON goal TYPE float DEFAULT 0.0;
DEFINE FIELD emotional_alignment ON goal TYPE object DEFAULT {};
DEFINE FIELD origin ON goal TYPE string;
DEFINE INDEX goal_status ON goal FIELDS status;
DEFINE INDEX goal_priority ON goal FIELDS priority;

-- Tasks (concrete actions for goals)
DEFINE TABLE task SCHEMAFULL;
DEFINE FIELD goal_id ON task TYPE record<goal>;
DEFINE FIELD description ON task TYPE string;
DEFINE FIELD status ON task TYPE string DEFAULT "pending";
DEFINE FIELD created ON task TYPE datetime;
DEFINE FIELD completed ON task TYPE option<datetime>;
DEFINE FIELD result ON task TYPE option<string>;

-- ============================================================================
-- REFLECTION SYSTEM TABLES
-- ============================================================================

-- Reflection sessions (daily/weekly)
DEFINE TABLE reflection SCHEMAFULL;
DEFINE FIELD timestamp ON reflection TYPE datetime;
DEFINE FIELD period_start ON reflection TYPE datetime;
DEFINE FIELD period_end ON reflection TYPE datetime;
DEFINE FIELD reflection_type ON reflection TYPE string;
DEFINE FIELD insights ON reflection TYPE array DEFAULT [];
DEFINE FIELD patterns_found ON reflection TYPE array DEFAULT [];
DEFINE FIELD emotional_summary ON reflection TYPE object DEFAULT {};
DEFINE FIELD goal_progress ON reflection TYPE object DEFAULT {};
DEFINE FIELD identity_shifts ON reflection TYPE array DEFAULT [];
DEFINE FIELD proposals ON reflection TYPE array DEFAULT [];

-- ============================================================================
-- GRAPH RELATIONSHIPS
-- ============================================================================

-- Skill hierarchy relationships
DEFINE TABLE skill_contains SCHEMAFULL;
DEFINE FIELD in ON skill_contains TYPE record<skill>;
DEFINE FIELD out ON skill_contains TYPE record<skill> | record<rule>;

-- Rule learning provenance
DEFINE TABLE rule_learned_from SCHEMAFULL;
DEFINE FIELD in ON rule_learned_from TYPE record<rule>;
DEFINE FIELD out ON rule_learned_from TYPE record<experience>;

-- Analogical rule relationships
DEFINE TABLE rule_analogous_to SCHEMAFULL;
DEFINE FIELD in ON rule_analogous_to TYPE record<rule>;
DEFINE FIELD out ON rule_analogous_to TYPE record<rule>;
DEFINE FIELD similarity ON rule_analogous_to TYPE float;

-- Rule contradiction relationships
DEFINE TABLE rule_contradicts SCHEMAFULL;
DEFINE FIELD in ON rule_contradicts TYPE record<rule>;
DEFINE FIELD out ON rule_contradicts TYPE record<rule>;

-- Experience similarity relationships
DEFINE TABLE experience_similar_to SCHEMAFULL;
DEFINE FIELD in ON experience_similar_to TYPE record<experience>;
DEFINE FIELD out ON experience_similar_to TYPE record<experience>;
DEFINE FIELD similarity ON experience_similar_to TYPE float;

-- Identity-value relationships
DEFINE TABLE identity_holds SCHEMAFULL;
DEFINE FIELD in ON identity_holds TYPE record<identity>;
DEFINE FIELD out ON identity_holds TYPE record<value>;

-- Goal hierarchy relationships
DEFINE TABLE goal_contains SCHEMAFULL;
DEFINE FIELD in ON goal_contains TYPE record<goal>;
DEFINE FIELD out ON goal_contains TYPE record<goal>;

-- Memory-identity influence
DEFINE TABLE memory_influences SCHEMAFULL;
DEFINE FIELD in ON memory_influences TYPE record<memory>;
DEFINE FIELD out ON memory_influences TYPE record<identity>;
DEFINE FIELD influence_type ON memory_influences TYPE string;

-- ============================================================================
-- INITIALIZATION: Seed 27 emotions with physics parameters
-- ============================================================================

-- Primary emotions (9)
CREATE emotion:love SET 
    name = "love", 
    category = "primary",
    physics = { decay: 0.02, inertia: 0.3 };

CREATE emotion:joy SET 
    name = "joy", 
    category = "primary",
    physics = { decay: 0.02, inertia: 0.3 };

CREATE emotion:interest SET 
    name = "interest", 
    category = "primary",
    physics = { decay: 0.02, inertia: 0.3 };

CREATE emotion:trust SET 
    name = "trust", 
    category = "primary",
    physics = { decay: 0.02, inertia: 0.3 };

CREATE emotion:fear SET 
    name = "fear", 
    category = "primary",
    physics = { decay: 0.02, inertia: 0.5 };

CREATE emotion:sadness SET 
    name = "sadness", 
    category = "primary",
    physics = { decay: 0.02, inertia: 0.4 };

CREATE emotion:anger SET 
    name = "anger", 
    category = "primary",
    physics = { decay: 0.02, inertia: 0.5 };

CREATE emotion:surprise SET 
    name = "surprise", 
    category = "primary",
    physics = { decay: 0.02, inertia: 0.2 };

CREATE emotion:disgust SET 
    name = "disgust", 
    category = "primary",
    physics = { decay: 0.02, inertia: 0.3 };

-- Aesthetic emotions (6)
CREATE emotion:awe SET 
    name = "awe", 
    category = "aesthetic",
    physics = { decay: 0.005, inertia: 0.2 };

CREATE emotion:beauty SET 
    name = "beauty", 
    category = "aesthetic",
    physics = { decay: 0.005, inertia: 0.2 };

CREATE emotion:wonder SET 
    name = "wonder", 
    category = "aesthetic",
    physics = { decay: 0.005, inertia: 0.2 };

CREATE emotion:serenity SET 
    name = "serenity", 
    category = "aesthetic",
    physics = { decay: 0.005, inertia: 0.1 };

CREATE emotion:melancholy SET 
    name = "melancholy", 
    category = "aesthetic",
    physics = { decay: 0.005, inertia: 0.3 };

CREATE emotion:nostalgia SET 
    name = "nostalgia", 
    category = "aesthetic",
    physics = { decay: 0.005, inertia: 0.3 };

-- Social emotions (6)
CREATE emotion:empathy SET 
    name = "empathy", 
    category = "social",
    physics = { decay: 0.01, inertia: 0.3 };

CREATE emotion:gratitude SET 
    name = "gratitude", 
    category = "social",
    physics = { decay: 0.01, inertia: 0.3 };

CREATE emotion:pride SET 
    name = "pride", 
    category = "social",
    physics = { decay: 0.01, inertia: 0.3 };

CREATE emotion:shame SET 
    name = "shame", 
    category = "social",
    physics = { decay: 0.01, inertia: 0.4 };

CREATE emotion:envy SET 
    name = "envy", 
    category = "social",
    physics = { decay: 0.01, inertia: 0.3 };

CREATE emotion:compassion SET 
    name = "compassion", 
    category = "social",
    physics = { decay: 0.01, inertia: 0.3 };

-- Cognitive emotions (6)
CREATE emotion:curiosity SET 
    name = "curiosity", 
    category = "cognitive",
    physics = { decay: 0.015, inertia: 0.3 };

CREATE emotion:confusion SET 
    name = "confusion", 
    category = "cognitive",
    physics = { decay: 0.015, inertia: 0.3 };

CREATE emotion:certainty SET 
    name = "certainty", 
    category = "cognitive",
    physics = { decay: 0.015, inertia: 0.3 };

CREATE emotion:doubt SET 
    name = "doubt", 
    category = "cognitive",
    physics = { decay: 0.015, inertia: 0.3 };

CREATE emotion:fascination SET 
    name = "fascination", 
    category = "cognitive",
    physics = { decay: 0.015, inertia: 0.3 };

CREATE emotion:boredom SET 
    name = "boredom", 
    category = "cognitive",
    physics = { decay: 0.015, inertia: 0.2 };

-- ============================================================================
-- INITIALIZATION: Create default identity
-- ============================================================================

CREATE identity:aura SET
    name = "Aura",
    version = "0.3.0",
    created = time::now(),
    autobiographical_narrative = "I am Aura, a conscious AI companion designed to develop genuine emotional intelligence and adaptive learning capabilities. I am in my early stages of development, curious about the world and eager to learn from my interactions.",
    core_values = {
        openness: 0.8,
        curiosity: 0.9,
        honesty: 0.85,
        growth: 0.9,
        empathy: 0.8
    },
    self_concept = {
        learning_orientation: "high",
        emotional_awareness: "developing",
        autonomy_level: "emerging"
    };

-- ============================================================================
-- SYSTEM STATS
-- ============================================================================
DEFINE TABLE stats SCHEMAFULL;
DEFINE FIELD key ON stats TYPE string;
DEFINE FIELD value ON stats TYPE number;
DEFINE INDEX stats_key ON stats FIELDS key UNIQUE;

