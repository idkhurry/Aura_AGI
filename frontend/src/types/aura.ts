/**
 * AURA DATA CONTRACT
 * 
 * Type definitions for the Backend ↔ Frontend communication.
 * Based on the actual Pydantic models from the backend.
 */

// ============================================
// EMOTION ENGINE (27D Physics Model)
// ============================================

export interface EmotionState {
  // Primary Emotions (9)
  love: number;
  joy: number;
  interest: number;
  trust: number;
  fear: number;
  sadness: number;
  anger: number;
  surprise: number;
  disgust: number;
  
  // Aesthetic Emotions (6)
  awe: number;
  beauty: number;
  wonder: number;
  serenity: number;
  melancholy: number;
  nostalgia: number;
  
  // Social Emotions (6)
  empathy: number;
  gratitude: number;
  pride: number;
  shame: number;
  envy: number;
  compassion: number;
  
  // Cognitive Emotions (6)
  curiosity: number;
  confusion: number;
  certainty: number;
  doubt: number;
  fascination: number;
  boredom: number;
  
  // Legacy: anticipation (mapped from interest/curiosity)
  anticipation?: number;
  
  // Meta-State (Derived from 27D)
  current_state: string; // e.g., "Optimism", "Anxiety", "Curiosity"
  dominant: string;      // Most prominent emotion
  valence: number;       // Overall positivity [-1, 1]
  arousal: number;       // Activation level [0, 1]
  entropy: number;       // System chaos/complexity
  
  // Physics Metrics
  inertia?: number;      // Resistance to change
  momentum?: number;     // Current velocity
}

export interface EmotionVector {
  [key: string]: number;
}

// ============================================
// COGNITIVE LAYERS (L1/L2/L3 Architecture)
// ============================================

export interface CognitiveTrace {
  layer: 'L1' | 'L2' | 'L3' | 'Dream' | 'Orchestrator';
  status: 'idle' | 'processing' | 'streaming' | 'complete';
  model: string;         // e.g., "mistralai/mistral-7b-instruct"
  latency_ms: number;
  
  // Optional metadata
  tokens_used?: number;
  temperature?: number;
  confidence?: number;
}

// ============================================
// MEMORY SYSTEM
// ============================================

export interface Memory {
  memory_id: string;
  content: string;
  timestamp: string;
  emotional_signature: EmotionVector;
  importance: number;
  learned_from: boolean;
  tags?: string[];
  
  // Vector search metadata
  similarity?: number;
}

// ============================================
// LEARNING ENGINE
// ============================================

export interface Rule {
  rule_id: string;
  condition: string;
  action: string;
  rationale: string;
  domain: string;
  confidence: number;
  application_count: number;
  success_count: number;
  last_used?: string;
}

export interface Skill {
  skill_id: string;
  name: string;
  domain: string;
  mastery_level: number;
  sub_skills: string[];
}

// ============================================
// GOAL & IDENTITY
// ============================================

export interface Goal {
  goal_id: string;
  name: string;
  description: string;
  goal_type: 'curiosity_driven' | 'user_requested' | 'maintenance' | 'learning_gap' | 'creative';
  status: 'active' | 'completed' | 'cancelled' | 'paused';
  priority: number;
  progress: number;
  emotional_alignment: Record<string, number>;
  origin: string;
  created: string;
  updated: string;
  completed?: string | null;
  parent_goal_id?: string | null;
  sub_goal_ids?: string[];
  metadata?: Record<string, unknown>;
}

export interface GoalProposal {
  name: string;
  description: string;
  priority: number;
  reasoning: string;
}

export interface GoalContext {
  active_goals: Goal[];
  current_focus: Goal | null;
  pending_proposals: GoalProposal[];
}

export interface IdentityContext {
  narrative: string;
  values: { [key: string]: number };
  preferences: { [key: string]: unknown };
  version: string;
}

// ============================================
// REFLECTION
// ============================================

export interface Reflection {
  reflection_id: string;
  timestamp: string;
  summary: string;
  insights: string[];
  emotional_trajectory_summary: Record<string, unknown>;
  learning_patterns_identified: string[];
  shareable: boolean;
}

// ============================================
// SYSTEM STATUS (Real-Time State)
// ============================================

export interface AuraStatus {
  online: boolean;
  emotion: EmotionState;
  cognitive: CognitiveTrace;
  last_memory: Memory | null;
  active_goals: Goal[];
  identity_snapshot: string; // Short narrative
  
  // System metrics
  uptime_seconds?: number;
  total_interactions?: number;
  database_connected?: boolean;
}

// ============================================
// CHAT INTERFACE
// ============================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'aura' | 'system';
  content: string;
  timestamp: string;
  
  // Metadata
  emotional_state?: EmotionState;
  cognitive_layer?: 'L1' | 'L2' | 'L3';
  confidence?: number;
  tokens?: number;
}

export interface ChatSession {
  session_id: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

// ============================================
// WEBSOCKET EVENTS
// ============================================

export type WebSocketEvent =
  | { type: 'emotion_update'; data: EmotionState }
  | { type: 'cognitive_update'; data: CognitiveTrace }
  | { type: 'message'; data: ChatMessage }
  | { type: 'memory_created'; data: Memory }
  | { type: 'goal_created'; data: Goal }
  | { type: 'learning_update'; data: { rule?: Rule; skill?: Skill } }
  | { type: 'system_status'; data: AuraStatus }
  | { type: 'error'; data: { message: string } };

