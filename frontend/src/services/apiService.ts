import { ChatMessage, EmotionalState, Memory, Reflection } from './socketService';
import { API_BASE_URL } from '@/config';

const API_URL = API_BASE_URL;

// Interface for conversation data
export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string;
  agent_id?: string;
  last_message?: string;
  messages?: ChatMessage[];
  _key?: string; // For React key management
}

// Interface for Agent
export interface Agent {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  stats?: {
    memory_count?: number;
    conversation_count?: number;
    last_active?: string;
  };
  [key: string]: unknown; // For additional properties
}

// Interface for Debug Info
export interface DebugInfo {
  version: string;
  environment: string;
  uptime: number;
  memory_usage?: {
    total: number;
    used: number;
    free: number;
  };
  status: {
    database: boolean;
    socket_service: boolean;
    memory_service: boolean;
  };
  [key: string]: unknown; // For additional properties
}

// API service for RESTful endpoints
class ApiService {
  // Authentication methods
  async login(username: string, password: string): Promise<{ token: string }> {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    return response.json();
  }

  async register(username: string, password: string, email: string): Promise<{ token: string }> {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password, email }),
    });

    if (!response.ok) {
      throw new Error('Registration failed');
    }

    return response.json();
  }

  // Conversation methods
  async getConversations(userId: string = "default"): Promise<Conversation[]> {
    try {
      console.log("Fetching conversations from:", `${API_URL}/api/conversations/?user_id=${userId}`);
      const response = await this.authenticatedRequest(`${API_URL}/api/conversations/?user_id=${userId}`);
      
      if (!response.ok) {
        console.error(`Error fetching conversations: ${response.status} ${response.statusText}`);
        return [];
      }
      
      const data = await response.json();
      console.log("Raw conversations data:", data);
      
      // Handle different response formats
      if (data && data.conversations && Array.isArray(data.conversations)) {
        console.log("Processing conversations array from 'conversations' field:", data.conversations.length);
        return data.conversations.map((conv: Conversation) => ({
          ...conv,
          _key: conv.id, // Add a key for React rendering
          created_at: typeof conv.created_at === 'number' 
            ? new Date(conv.created_at * 1000).toISOString() 
            : conv.created_at
        }));
      } else if (Array.isArray(data)) {
        console.log("Processing direct conversations array:", data.length);
        return data.map((conv: Conversation) => ({
          ...conv,
          _key: conv.id, // Add a key for React rendering
          created_at: typeof conv.created_at === 'number' 
            ? new Date(conv.created_at * 1000).toISOString() 
            : conv.created_at
        }));
      } else {
        console.error("Unexpected response format:", data);
        return [];
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
      // Return empty array on error
      return [];
    }
  }

  async getConversation(id: string): Promise<Conversation> {
    const response = await this.authenticatedRequest(`${API_URL}/api/conversations/${id}`);
    return response.json();
  }

  async createConversation(title?: string, userId: string = "default"): Promise<Conversation> {
    const response = await this.authenticatedRequest(`${API_URL}/api/conversations`, {
      method: 'POST',
      body: JSON.stringify({ 
        title: title || undefined, // Let backend generate if not provided
        user_id: userId 
      }),
    });
    return response.json();
  }

  async updateConversation(id: string, updates: { title?: string }): Promise<Conversation> {
    const response = await this.authenticatedRequest(`${API_URL}/api/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return response.json();
  }

  async deleteConversation(id: string): Promise<void> {
    await this.authenticatedRequest(`${API_URL}/api/conversations/${id}`, {
      method: 'DELETE',
    });
  }

  // Message methods
  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const response = await this.authenticatedRequest(
      `${API_URL}/api/conversations/${conversationId}/messages`
    );
    return response.json();
  }

  async sendMessage(conversationId: string, content: string): Promise<ChatMessage> {
    const response = await this.authenticatedRequest(
      `${API_URL}/api/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      }
    );
    return response.json();
  }

  // Memory methods
  async getMemories(query: string = '', limit: number = 10): Promise<Memory[]> {
    const response = await this.authenticatedRequest(
      `${API_URL}/memories?query=${encodeURIComponent(query)}&limit=${limit}`
    );
    return response.json();
  }

  async getMemoryById(id: string): Promise<Memory> {
    const response = await this.authenticatedRequest(`${API_URL}/memories/${id}`);
    return response.json();
  }

  // Emotion methods
  async getEmotionalState(): Promise<EmotionalState> {
    const response = await this.authenticatedRequest(`${API_URL}/emotional-state`);
    return response.json();
  }

  async getEmotionalHistory(timeframe: 'day' | 'week' | 'month' = 'day'): Promise<{ timestamp: string; state: EmotionalState }[]> {
    const response = await this.authenticatedRequest(
      `${API_URL}/emotional-state/history?timeframe=${timeframe}`
    );
    return response.json();
  }

  // Reflection methods
  async getReflections(limit: number = 5): Promise<Reflection[]> {
    const response = await this.authenticatedRequest(
      `${API_URL}/reflections?limit=${limit}`
    );
    return response.json();
  }

  // Agent-related methods
  async getAgents(): Promise<Agent[]> {
    try {
      const response = await this.authenticatedRequest(`${API_URL}/agents/`);
      return response.json();
    } catch (error) {
      console.error("Error fetching agents:", error);
      return [];
    }
  }

  async getAgent(id: string): Promise<Agent> {
    try {
      const response = await this.authenticatedRequest(`${API_URL}/agents/${id}?with_stats=true`);
      return response.json();
    } catch (error) {
      console.error(`Error fetching agent ${id}:`, error);
      throw error;
    }
  }

  async getAgentConfig(id: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.authenticatedRequest(`${API_URL}/config/agent/${id}`);
      return response.json();
    } catch (error) {
      console.error(`Error fetching agent config ${id}:`, error);
      throw error;
    }
  }

  async updateAgentConfig(id: string, config: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const response = await this.authenticatedRequest(`${API_URL}/config/agent/${id}`, {
        method: 'PUT',
        body: JSON.stringify(config),
      });
      return response.json();
    } catch (error) {
      console.error(`Error updating agent config ${id}:`, error);
      throw error;
    }
  }

  async getAgentMemories(agentId: string, limit: number = 20): Promise<Memory[]> {
    const response = await this.authenticatedRequest(`${API_URL}/memory/${agentId}?limit=${limit}`);
    return response.json();
  }

  async getAgentMemoryStats(agentId: string): Promise<{ count: number, last_access?: string }> {
    const response = await this.authenticatedRequest(`${API_URL}/memory/stats/${agentId}`);
    return response.json();
  }

  async initializeMemoryForAgent(agentId: string): Promise<boolean> {
    if (!agentId) throw new Error('Agent ID is required');
    
    const response = await this.authenticatedRequest(`${API_URL}/debug/init-memory/${agentId}`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to initialize memory');
    }
    
    return true;
  }

  // Debug-related methods
  async getServerLogs(lines: number = 100): Promise<string[]> {
    try {
      const response = await this.authenticatedRequest(`${API_URL}/debug/logs?lines=${lines}`);
      const data = await response.json();
      return data.logs || [];
    } catch (error) {
      console.error("Error fetching server logs:", error);
      return [];
    }
  }

  async getDebugInfo(): Promise<DebugInfo> {
    try {
      const response = await this.authenticatedRequest(`${API_URL}/debug/info`);
      return response.json();
    } catch (error) {
      console.error("Error fetching debug info:", error);
      return {} as DebugInfo;
    }
  }

  // Helper for authenticated requests
  private async authenticatedRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = localStorage.getItem('auth_token');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
      throw new Error('Authentication required');
    }

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response;
  }
}

// Export as singleton
export const apiService = new ApiService();
export default apiService; 