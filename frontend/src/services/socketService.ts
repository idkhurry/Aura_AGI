import { io, Socket } from 'socket.io-client';

// Types for our events
export interface StreamTokenData {
  type: 'orchestrator' | 'reasoning' | 'gemini';
  token: string;
  conversation_id: string;
  agent_id?: string;
}

export interface StreamEndData {
  conversation_id: string;
  user_id?: string;
  message?: string;
  response?: string;
  emotions?: EmotionalState;
  processing_time?: number;
  cancelled?: boolean;
  error?: string;
}

export interface ServerToClientEvents {
  chat_message: (message: ChatMessage) => void;
  emotion_update: (state: EmotionalState) => void;
  memory_update: (memories: Memory[]) => void;
  reflection_insight: (reflection: Reflection) => void;
  stream_token: (data: StreamTokenData) => void;
  stream_end: (data: StreamEndData) => void;
  connection_established: (data: { status: string }) => void;
  error: (data: { message: string, code?: string }) => void;
  conversation_joined: (data: { conversation_id: string, user_id: string, status: string }) => void;
  conversation_left: (data: { conversation_id: string, status: string }) => void;
  faiss_activity: (data: { active: boolean, agent_id?: string, conversation_id?: string }) => void;
}

export interface ClientToServerEvents {
  send_message: (message: string, conversationId?: string) => void;
  join_conversation: (conversationId: string) => void;
  leave_conversation: (conversationId: string) => void;
  request_memories: (query: string, limit?: number) => void;
  request_emotional_state: () => void;
  request_reflections: (limit?: number) => void;
}

// Types for our data models
export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  conversationId: string;
}

export interface EmotionalState {
  [emotion: string]: number;
  // e.g. joy: 0.8, sadness: 0.2, etc.
}

export interface Memory {
  id: string;
  content: string;
  importance: number;
  source: string;
  created_at: string;
}

export interface Reflection {
  id: string;
  insight: string;
  action_items: string[];
  timestamp: string;
}

class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private messageHandlers: ((message: ChatMessage) => void)[] = [];
  private emotionHandlers: ((state: EmotionalState) => void)[] = [];
  private memoryHandlers: ((memories: Memory[]) => void)[] = [];
  private reflectionHandlers: ((reflection: Reflection) => void)[] = [];
  private streamTokenHandlers: ((data: StreamTokenData) => void)[] = [];
  private streamEndHandlers: ((data: StreamEndData) => void)[] = [];
  private errorHandlers: ((error: { message: string, code?: string }) => void)[] = [];
  private connectionHandlers: ((connected: boolean) => void)[] = [];
  private faissActivityHandlers: ((data: { active: boolean, agent_id?: string, conversation_id?: string }) => void)[] = [];
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private reconnectDelay: number = 2000;
  private connectionTimer: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private lastConnectionAttempt: number = 0;
  private activeConversations: Set<string> = new Set();

  // Save active conversations to localStorage
  private saveActiveConversations(): void {
    try {
      localStorage.setItem('activeConversations', JSON.stringify(Array.from(this.activeConversations)));
    } catch (error) {
      console.error('Failed to save active conversations:', error);
    }
  }

  // Load active conversations from localStorage
  private loadActiveConversations(): void {
    try {
      const saved = localStorage.getItem('activeConversations');
      if (saved) {
        const conversations = JSON.parse(saved);
        if (Array.isArray(conversations)) {
          this.activeConversations = new Set(conversations);
        }
      }
    } catch (error) {
      console.error('Failed to load active conversations:', error);
    }
  }

  connect(backendUrl: string = 'http://localhost:8080'): void {
    if (this.socket && this.socket.connected) {
      console.log('Socket already connected');
      this.notifyConnectionHandlers(true);
      return;
    }

    const now = Date.now();
    if (this.isConnecting && now - this.lastConnectionAttempt < 5000) {
      console.log('Already attempting to connect, skipping duplicate attempt');
      return;
    }

    this.isConnecting = true;
    this.lastConnectionAttempt = now;

    try {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }

      if (this.connectionTimer) {
        clearTimeout(this.connectionTimer);
        this.connectionTimer = null;
      }

      // Load active conversations from local storage
      this.loadActiveConversations();

      console.log(`Connecting to Socket.IO server at ${backendUrl}`);
      this.socket = io(backendUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 2,
        reconnectionDelay: 1000,
        timeout: 5000,
        forceNew: false
      });

      this.setupEventListeners();
    } catch (error) {
      console.error('Error connecting to Socket.IO server:', error);
      this.notifyConnectionHandlers(false);
      this.notifyErrorHandlers({
        message: `Socket connection error: ${error instanceof Error ? error.message : String(error)}`,
        code: 'socket_init_error'
      });
      this.isConnecting = false;
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
    
    this.isConnecting = false;
    this.notifyConnectionHandlers(false);
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      this.reconnectAttempts = 0;
      this.isConnecting = false;
      this.notifyConnectionHandlers(true);
      
      // Rejoin all active conversations after reconnection
      this.rejoinActiveConversations();
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`Disconnected from Socket.IO server: ${reason}`);
      this.isConnecting = false;
      this.notifyConnectionHandlers(false);
      
      if (reason === 'transport error' || reason === 'transport close' || reason === 'ping timeout') {
        console.log('Disconnection was due to network issue, scheduling reconnect');
        this.scheduleReconnect();
      } else if (reason === 'io server disconnect') {
        // The server intentionally closed the connection
        console.log('Server intentionally closed connection, attempting reconnect once');
        setTimeout(() => this.connect(), 5000);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      this.isConnecting = false;
      this.notifyErrorHandlers({
        message: `Connection error: ${error.message}`,
        code: 'connect_error'
      });
      this.notifyConnectionHandlers(false);
      
      // Handle different connection errors
      if (error.message.includes('ECONNREFUSED') || error.message.includes('xhr poll error')) {
        console.log('Server appears to be down, scheduling longer reconnect delay');
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => this.connect(), 10000); // Longer delay for server issues
        }
      } else {
        // Standard reconnect for other errors
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      }
    });

    this.socket.on('chat_message', (message) => {
      console.log('Received chat message:', message);
      this.messageHandlers.forEach(handler => handler(message));
    });

    this.socket.on('emotion_update', (state) => {
      console.log('Received emotion update:', state);
      this.emotionHandlers.forEach(handler => handler(state));
    });

    this.socket.on('memory_update', (memories) => {
      console.log('Received memory update:', memories);
      this.memoryHandlers.forEach(handler => handler(memories));
    });

    this.socket.on('reflection_insight', (reflection) => {
      console.log('Received reflection insight:', reflection);
      this.reflectionHandlers.forEach(handler => handler(reflection));
    });

    this.socket.on('stream_token', (data) => {
      this.streamTokenHandlers.forEach(handler => handler(data));
    });

    this.socket.on('stream_end', (data) => {
      console.log('Stream ended:', data);
      this.streamEndHandlers.forEach(handler => handler(data));
    });

    this.socket.on('faiss_activity', (data: { active: boolean, agent_id?: string, conversation_id?: string }) => {
      console.log(`FAISS activity event received: ${data.active ? 'active' : 'inactive'}`, 
        data.agent_id ? `for agent ${data.agent_id}` : '',
        data.conversation_id ? `in conversation ${data.conversation_id}` : '');
      this.faissActivityHandlers.forEach(handler => handler(data));
    });

    this.socket.on('error', (data) => {
      console.error('Socket error:', data);
      this.notifyErrorHandlers(data);
      this.isConnecting = false;
    });

    this.socket.on('connection_established', (data) => {
      console.log('Connection established:', data);
      this.isConnecting = false;
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached, giving up automatic reconnection');
      this.isConnecting = false;
      return;
    }

    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    this.connectionTimer = setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect();
    }, delay);
  }

  private notifyErrorHandlers(error: { message: string, code?: string }): void {
    this.errorHandlers.forEach(handler => handler(error));
  }

  private notifyConnectionHandlers(connected: boolean): void {
    this.connectionHandlers.forEach(handler => handler(connected));
  }

  sendMessage(message: string, conversationId?: string): void {
    if (!this.socket || !this.socket.connected) {
      console.error('Cannot send message: Socket not connected');
      this.notifyErrorHandlers({
        message: 'Cannot send message: Socket not connected',
        code: 'socket_not_connected'
      });
      return;
    }
    this.socket.emit('send_message', message, conversationId);
  }

  joinConversation(conversationId: string): void {
    if (!this.socket || !this.socket.connected) {
      console.error('Socket not connected, cannot join conversation');
      return;
    }
    
    // Track this as an active conversation
    this.activeConversations.add(conversationId);
    this.saveActiveConversations();
    
    // Emit the join event
    this.socket.emit('join_conversation', conversationId);
  }

  leaveConversation(conversationId: string): void {
    if (!this.socket || !this.socket.connected) {
      console.error('Cannot leave conversation: Socket not connected');
      return;
    }
    this.socket.emit('leave_conversation', conversationId);
  }

  requestMemories(query: string, limit: number = 10): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('request_memories', query, limit);
  }

  requestEmotionalState(): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('request_emotional_state');
  }

  requestReflections(limit: number = 5): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('request_reflections', limit);
  }

  onChatMessage(handler: (message: ChatMessage) => void): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  onEmotionUpdate(handler: (state: EmotionalState) => void): () => void {
    this.emotionHandlers.push(handler);
    return () => {
      this.emotionHandlers = this.emotionHandlers.filter(h => h !== handler);
    };
  }

  onMemoryUpdate(handler: (memories: Memory[]) => void): () => void {
    this.memoryHandlers.push(handler);
    return () => {
      this.memoryHandlers = this.memoryHandlers.filter(h => h !== handler);
    };
  }

  onReflectionInsight(handler: (reflection: Reflection) => void): () => void {
    this.reflectionHandlers.push(handler);
    return () => {
      this.reflectionHandlers = this.reflectionHandlers.filter(h => h !== handler);
    };
  }

  onStreamToken(handler: (data: StreamTokenData) => void): () => void {
    this.streamTokenHandlers.push(handler);
    return () => {
      this.streamTokenHandlers = this.streamTokenHandlers.filter(h => h !== handler);
    };
  }

  onStreamEnd(handler: (data: StreamEndData) => void): () => void {
    this.streamEndHandlers.push(handler);
    return () => {
      this.streamEndHandlers = this.streamEndHandlers.filter(h => h !== handler);
    };
  }

  onFAISSActivity(handler: (data: { active: boolean, agent_id?: string, conversation_id?: string }) => void): () => void {
    this.faissActivityHandlers.push(handler);
    return () => {
      this.faissActivityHandlers = this.faissActivityHandlers.filter(h => h !== handler);
    };
  }

  onError(handler: (error: { message: string, code?: string }) => void): () => void {
    this.errorHandlers.push(handler);
    return () => {
      this.errorHandlers = this.errorHandlers.filter(h => h !== handler);
    };
  }

  onConnectionChange(handler: (connected: boolean) => void): () => void {
    this.connectionHandlers.push(handler);
    return () => {
      this.connectionHandlers = this.connectionHandlers.filter(h => h !== handler);
    };
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // Add method to rejoin all active conversations
  private rejoinActiveConversations(): void {
    if (!this.socket || !this.socket.connected) return;
    
    console.log(`Rejoining ${this.activeConversations.size} active conversations`);
    this.activeConversations.forEach(conversationId => {
      console.log(`Rejoining conversation: ${conversationId}`);
      this.socket?.emit('join_conversation', conversationId);
    });
  }
}

const socketService = new SocketService();
export default socketService; 