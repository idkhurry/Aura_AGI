/**
 * Aura Backend API Service
 * 
 * Provides typed methods for interacting with the Aura backend.
 */

import { API_BASE_URL } from '@/config';
import type { EmotionState, Memory, Goal, GoalContext } from '@/types/aura';

const API_URL = API_BASE_URL;

export interface SendMessageRequest {
  message: string;
  user_id?: string;
  conversation_history?: Array<{ role: string; content: string }>;
  stream?: boolean;
  // Optional context for persistence
  conversation_id?: string;
  // Advanced options
  context_limit?: number;      // Max conversation history messages
  enable_l2?: boolean;          // Enable L2 post-analysis
}

export interface SendMessageResponse {
  success: boolean;
  response: string;
  emotional_state?: {
    dominant: string;
    intensity: number;
    description: string;
  };
  learning_applied?: boolean;
}

export interface EmotionResponse {
  success: boolean;
  data?: {
    timestamp: string;
    vector: { [key: string]: number };
    dominant: [string, number];
    secondary: [string, number];
    valence: number;
    arousal: number;
    dominance: number;
    volatility: number;
    stability: number;
    description: string;
  };
  message?: string;
}

class AuraApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Send message to Aura and get response
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    const response = await fetch(`${this.baseUrl}/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: request.message,
        user_id: request.user_id || 'default',
        conversation_history: request.conversation_history || [],
        stream: request.stream || false,
        conversation_id: request.conversation_id,
        // Pass advanced options to backend
        context_limit: request.context_limit,
        enable_l2: request.enable_l2,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  /**
   * Stream message response (Server-Sent Events)
   */
  async *streamMessage(request: SendMessageRequest): AsyncGenerator<string, void, unknown> {
    const response = await fetch(`${this.baseUrl}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: request.message,
        user_id: request.user_id || 'default',
        conversation_history: request.conversation_history || [],
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Stream failed with status ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }
            yield data;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get current emotional state
   */
  async getEmotionState(): Promise<EmotionState> {
    const response = await fetch(`${this.baseUrl}/emotion/current`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch emotion state: ${response.status}`);
    }

    const json: EmotionResponse = await response.json();
    
    if (!json.success || !json.data) {
      throw new Error(json.message || 'Failed to get emotion state');
    }

    // Transform backend response to frontend EmotionState
    const data = json.data;
    const vector = data.vector || {};
    
    return {
      // Core 8 emotions (Plutchik) - for backward compatibility
      joy: vector.joy || 0,
      trust: vector.trust || 0,
      fear: vector.fear || 0,
      surprise: vector.surprise || 0,
      sadness: vector.sadness || 0,
      disgust: vector.disgust || 0,
      anger: vector.anger || 0,
      // Note: anticipation is calculated below from interest + curiosity
      
      // All 27 emotions from the vector
      love: vector.love || 0,
      interest: vector.interest || 0,
      
      // Aesthetic emotions
      awe: vector.awe || 0,
      beauty: vector.beauty || 0,
      wonder: vector.wonder || 0,
      serenity: vector.serenity || 0,
      melancholy: vector.melancholy || 0,
      nostalgia: vector.nostalgia || 0,
      
      // Social emotions
      empathy: vector.empathy || 0,
      gratitude: vector.gratitude || 0,
      pride: vector.pride || 0,
      shame: vector.shame || 0,
      envy: vector.envy || 0,
      compassion: vector.compassion || 0,
      
      // Cognitive emotions
      curiosity: vector.curiosity || 0,
      confusion: vector.confusion || 0,
      certainty: vector.certainty || 0,
      doubt: vector.doubt || 0,
      fascination: vector.fascination || 0,
      boredom: vector.boredom || 0,
      
      // Legacy: anticipation (map from interest + curiosity for backward compatibility)
      anticipation: (vector.interest || 0) * 0.5 + (vector.curiosity || 0) * 0.5,
      
      // Meta-state
      current_state: data.description || 'Unknown',
      dominant: data.dominant[0],
      valence: data.valence,
      arousal: data.arousal,
      entropy: data.volatility, // Using volatility as entropy proxy
    } as EmotionState;
  }

  /**
   * Get recent memories
   */
  async getRecentMemories(limit: number = 10, user_id?: string): Promise<Memory[]> {
    try {
      // Build query params
      const params = new URLSearchParams({ limit: limit.toString() });
      if (user_id) {
        params.append('user_id', user_id);
      }
      
      const response = await fetch(`${this.baseUrl}/memory/recent?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch memories: ${response.status}`);
      }

      const json = await response.json();
      
      if (!json.success) {
        throw new Error('Failed to retrieve memories');
      }

      return json.memories || [];
    } catch (error) {
      console.error('Error fetching recent memories:', error);
      return []; // Return empty array on error (graceful degradation)
    }
  }

  /**
   * Get active goals
   */
  async getActiveGoals(): Promise<Goal[]> {
    try {
      const response = await fetch(`${this.baseUrl}/goal/active`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch goals: ${response.status}`);
      }

      const json = await response.json();
      
      if (!json.success) {
        throw new Error('Failed to retrieve goals');
      }

      return json.goals || [];
    } catch (error) {
      console.error('Error fetching active goals:', error);
      return [];
    }
  }

  /**
   * Get goal context (active goals + current focus)
   */
  async getGoalContext(): Promise<GoalContext> {
    try {
      const response = await fetch(`${this.baseUrl}/goal/context`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch goal context: ${response.status}`);
      }

      const json = await response.json();
      
      if (!json.success) {
        throw new Error('Failed to retrieve goal context');
      }

      return json.context;
    } catch (error) {
      console.error('Error fetching goal context:', error);
      return { active_goals: [], current_focus: null, pending_proposals: [] };
    }
  }

  /**
   * Generate a new goal on demand
   */
  async generateGoal(trigger: string = 'user_requested', context?: Record<string, unknown>): Promise<Goal | null> {
    try {
      const response = await fetch(`${this.baseUrl}/goal/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trigger,
          context: context || {},
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate goal: ${response.status}`);
      }

      const json = await response.json();
      
      if (!json.success) {
        throw new Error('Failed to generate goal');
      }

      return json.goal || null;
    } catch (error) {
      console.error('Error generating goal:', error);
      return null;
    }
  }

  /**
   * Pursue a goal autonomously through multiple L2/L3 iterations
   */
  async pursueGoal(
    goalId: string,
    loopCount: number,
    toolPermissions: string[] = [],
    allowInterruption: boolean = true
  ): Promise<{
    success: boolean;
    goal_id: string;
    goal_name: string;
    iterations: Array<{ iteration: number; l3_response: string; progress: number }>;
    progress_updates: Array<{ iteration: number; progress: number; response: string }>;
    initial_progress: number;
    final_progress: number;
    progress_delta: number;
    loop_count: number;
    message: string;
  } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/goal/pursue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          goal_id: goalId,
          loop_count: loopCount,
          tool_permissions: toolPermissions,
          allow_interruption: allowInterruption,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `Request failed with status ${response.status}`);
      }
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.message || 'Failed to pursue goal');
      }
      return json;
    } catch (error) {
      console.error('Error pursuing goal:', error);
      return null;
    }
  }

  /**
   * Delete a goal by ID
   */
  async deleteGoal(goalId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/goal/${goalId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `Request failed with status ${response.status}`);
      }
      const json = await response.json();
      return json.success || false;
    } catch (error) {
      console.error('Error deleting goal:', error);
      return false;
    }
  }

  /**
   * Get system status
   */
  async getSystemStatus(): Promise<{ healthy: boolean; database: boolean }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      
      return {
        healthy: response.ok,
        database: data.database === 'connected',
      };
    } catch (error) {
      console.error('Failed to fetch system status:', error);
      return {
        healthy: false,
        database: false,
      };
    }
  }

  /**
   * Create WebSocket connection for real-time updates
   */
  createEmotionWebSocket(): WebSocket {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws');
    return new WebSocket(`${wsUrl}/ws/emotion`);
  }
}

// Export singleton instance
export const auraApi = new AuraApiService();

export default auraApi;

