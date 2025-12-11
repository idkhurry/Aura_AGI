/**
 * Aura Backend API Service
 * 
 * Provides typed methods for interacting with the Aura backend.
 */

import { API_BASE_URL } from '@/config';
import type { EmotionState, Memory } from '@/types/aura';

const API_URL = API_BASE_URL;

export interface SendMessageRequest {
  message: string;
  user_id?: string;
  conversation_history?: Array<{ role: string; content: string }>;
  stream?: boolean;
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
    return {
      // Core 8 emotions (Plutchik)
      joy: data.vector.joy || 0,
      trust: data.vector.trust || 0,
      fear: data.vector.fear || 0,
      surprise: data.vector.surprise || 0,
      sadness: data.vector.sadness || 0,
      disgust: data.vector.disgust || 0,
      anger: data.vector.anger || 0,
      anticipation: data.vector.anticipation || 0,
      
      // Meta-state
      current_state: data.description || 'Unknown',
      dominant: data.dominant[0],
      valence: data.valence,
      arousal: data.arousal,
      entropy: data.volatility, // Using volatility as entropy proxy
      
      // Extended emotions (if available)
      ...Object.fromEntries(
        Object.entries(data.vector).filter(([key]) => 
          !['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation'].includes(key)
        )
      ),
    } as EmotionState;
  }

  /**
   * Get recent memories
   */
  async getRecentMemories(limit: number = 10): Promise<Memory[]> {
    try {
      const response = await fetch(`${this.baseUrl}/memory/recent?limit=${limit}`);
      
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

