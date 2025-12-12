import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiService, Conversation } from '@/services/apiService';
import { ChatMessage } from '@/services/socketService';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  streamingResponse: boolean;
  streamedContent: string;
}

const initialState: ChatState = {
  conversations: [],
  activeConversationId: null,
  messages: [],
  isLoading: false,
  error: null,
  streamingResponse: false,
  streamedContent: ''
};

// Async thunks for API interactions
export const fetchConversations = createAsyncThunk(
  'chat/fetchConversations',
  async (userId: string = "default", { rejectWithValue }) => {
    try {
      return await apiService.getConversations(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchConversation = createAsyncThunk(
  'chat/fetchConversation',
  async (id: string, { rejectWithValue }) => {
    try {
      return await apiService.getConversation(id);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async (conversationId: string, { rejectWithValue }) => {
    try {
      return await apiService.getMessages(conversationId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ conversationId, content }: { conversationId: string; content: string }, { rejectWithValue }) => {
    try {
      return await apiService.sendMessage(conversationId, content);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createNewConversation = createAsyncThunk(
  'chat/createConversation',
  async (title: string, { rejectWithValue }) => {
    try {
      return await apiService.createConversation(title);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const deleteConversation = createAsyncThunk(
  'chat/deleteConversation',
  async (id: string, { rejectWithValue }) => {
    try {
      await apiService.deleteConversation(id);
      return id;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveConversation(state, action: PayloadAction<string>) {
      state.activeConversationId = action.payload;
    },
    addMessage: (state, action) => {
      // Check if messages array exists, if not initialize it
      if (!Array.isArray(state.messages)) {
        state.messages = [];
      }
      
      // Check if message has an ID, if not generate one
      const message = action.payload;
      if (!message.id) {
        message.id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      }
      
      // Ensure we're not adding a duplicate message
      const isDuplicate = state.messages.some(m => m.id === message.id);
      if (!isDuplicate) {
        state.messages.push(message);
      }
    },
    clearMessages(state) {
      state.messages = [];
      state.streamingResponse = false;
      state.streamedContent = '';
    },
    startStreamingResponse(state) {
      state.streamingResponse = true;
      state.streamedContent = '';
    },
    appendStreamToken(state, action: PayloadAction<string>) {
      state.streamedContent += action.payload;
    },
    endStreamingResponse(state) {
      state.streamingResponse = false;
      
      // If we have an active conversation, add the streamed content as a message
      if (state.activeConversationId && state.streamedContent.trim()) {
        const uniqueId = `streamed-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        
        state.messages.push({
          id: uniqueId,
          content: state.streamedContent,
          role: 'assistant',
          timestamp: new Date().toISOString(),
          conversationId: state.activeConversationId
        });
      }
      
      state.streamedContent = '';
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch conversations
      .addCase(fetchConversations.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.isLoading = false;
        state.conversations = action.payload;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Fetch single conversation
      .addCase(fetchConversation.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchConversation.fulfilled, (state, action) => {
        state.isLoading = false;
        state.activeConversationId = action.payload.id;
        
        // Update conversation in the list or add it if not present
        const index = state.conversations.findIndex(c => c.id === action.payload.id);
        if (index >= 0) {
          state.conversations[index] = action.payload;
        } else {
          state.conversations.push(action.payload);
        }
      })
      .addCase(fetchConversation.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Fetch messages
      .addCase(fetchMessages.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.isLoading = false;
        state.messages = action.payload;
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Send message
      .addCase(sendMessage.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.isLoading = false;
        state.messages.push(action.payload);
        
        // Update last message in conversation
        const index = state.conversations.findIndex(c => c.id === action.payload.conversationId);
        if (index >= 0) {
          state.conversations[index].last_message = action.payload.content;
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Create conversation
      .addCase(createNewConversation.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createNewConversation.fulfilled, (state, action) => {
        state.isLoading = false;
        
        if (action.payload && action.payload.id) {
          // Add the new conversation to the list if it doesn't already exist
          const conversationExists = state.conversations.some(c => c.id === action.payload.id);
          if (!conversationExists) {
            state.conversations.push(action.payload);
          }
          
          // Set it as the active conversation
          state.activeConversationId = action.payload.id;
          
          // Ensure messages is an empty array (not undefined)
          state.messages = [];
        }
      })
      .addCase(createNewConversation.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Delete conversation
      .addCase(deleteConversation.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteConversation.fulfilled, (state, action) => {
        state.isLoading = false;
        state.conversations = state.conversations.filter(c => c.id !== action.payload);
        
        // If active conversation was deleted, clear it
        if (state.activeConversationId === action.payload) {
          state.activeConversationId = null;
          state.messages = [];
        }
      })
      .addCase(deleteConversation.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  }
});

export const { 
  setActiveConversation, 
  addMessage, 
  clearMessages,
  startStreamingResponse,
  appendStreamToken,
  endStreamingResponse
} = chatSlice.actions;

export default chatSlice.reducer; 