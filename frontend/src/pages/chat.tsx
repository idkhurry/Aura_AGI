import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  List,
  Divider,
  IconButton,
  Drawer,
  useMediaQuery,
  useTheme,
  CircularProgress,
  Fab,
  Button,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Container,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Tabs,
  Tab
} from '@mui/material';
import ChatInput from '@/components/chat/ChatInput';
import ChatMessage from '@/components/chat/ChatMessage';
import { useSocket } from '@/hooks/useSocket';
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { 
  fetchConversations as fetchConversationsAction, 
  setActiveConversation, 
  addMessage, 
  startStreamingResponse, 
  endStreamingResponse, 
  clearMessages, 
  fetchMessages 
} from '@/store/slices/chatSlice';
import MenuIcon from '@mui/icons-material/Menu';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import HomeIcon from '@mui/icons-material/Home';
import DeleteIcon from '@mui/icons-material/Delete';
import DebugPanel from '@/components/debug/DebugPanel';
import socketService, { StreamTokenData } from '@/services/socketService';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { apiService, Conversation } from '@/services/apiService';
import { auraApi } from '@/services/auraApiService';
import ChatIcon from '@mui/icons-material/Chat';
import BugReportIcon from '@mui/icons-material/BugReport';
import ServerStatusAlert from '@/components/common/ServerStatusAlert';
import { useServerStatus } from '@/contexts/ServerStatusContext';
import { useSettings } from '@/contexts/SettingsContext';
import RefreshIcon from '@mui/icons-material/Refresh';
import { ParticlesBackground } from '@/components/animation/ParticlesBackground';
import EditIcon from '@mui/icons-material/Edit';
import StreamingVisualizer from '../components/debug/StreamingVisualizer';
import TerminalIcon from '@mui/icons-material/Terminal';
import GoalPursuitModal from '@/components/goal/GoalPursuitModal';
import type { Goal } from '@/types/aura';

// Socket.IO backend URL no longer needed - using direct Aura API calls
// const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Left sidebar content component
const ConversationsList = React.memo(function ConversationsList({ onNewChat }: { onNewChat: () => void }) {
  const conversations = useAppSelector(state => state.chat.conversations);
  const activeConversationId = useAppSelector(state => state.chat.activeConversationId);
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [localConversations, setLocalConversations] = useState<Conversation[]>([]);
  
  // Get user settings for commander identity
  const { settings } = useSettings();
  const commanderIdentity = settings.commanderIdentity || "Mai";
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    conversationId: string;
  } | null>(null);
  
  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    conversationId: string;
    title: string;
  } | null>(null);
  
  // Rename dialog state
  const [renameDialog, setRenameDialog] = useState<{
    open: boolean;
    conversationId: string;
    title: string;
  } | null>(null);
  
  // For rename input
  const [newTitle, setNewTitle] = useState('');
  
  // Extract conversation ID from router
  const routeConversationId = router.query.id as string;
  
  // Track if window is visible to avoid polling when tab is hidden
  const [isWindowVisible, setIsWindowVisible] = useState(true);
  
  // Initial fetch and setup visibility listener
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setIsLoading(true);
        
        // Attempt to fetch via Redux
        await dispatch(fetchConversationsAction(commanderIdentity));
        
        // As a backup, also fetch directly from API to ensure we have data
        // This helps when Redux store might not be properly updated
        const directFetchedConversations = await apiService.getConversations(commanderIdentity);
        
        if (directFetchedConversations && directFetchedConversations.length > 0) {
          setLocalConversations(directFetchedConversations);
          
          // If we have a routeConversationId but no active conversation, set it
          if (routeConversationId && !activeConversationId) {
            dispatch(setActiveConversation(routeConversationId));
            
            // Also fetch messages for this conversation
            dispatch(fetchMessages(routeConversationId));
          }
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to fetch conversations:", error);
        setIsLoading(false);
      }
    };
    
    fetchConversations();
    
    // Setup visibility change listener
    const handleVisibilityChange = () => {
      setIsWindowVisible(!document.hidden);
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [dispatch, routeConversationId, activeConversationId, commanderIdentity]);
  
  // Smart polling - only when window is visible and less frequently
  useEffect(() => {
    // Only poll if window is visible
    if (!isWindowVisible) {
      return;
    }
    
    // Poll every 2 minutes (120000ms) instead of 30 seconds
    // This reduces backend spam significantly
    const intervalId = setInterval(() => {
      // Only poll if window is still visible
      if (!document.hidden) {
        dispatch(fetchConversationsAction(commanderIdentity));
      }
    }, 120000); // 2 minutes
    
    return () => clearInterval(intervalId);
  }, [dispatch, commanderIdentity, isWindowVisible]);
  
  // Combine Redux conversations with locally fetched ones
  const allConversations = useMemo(() => {
    // Create a map to deduplicate conversations by ID
    const conversationsMap = new Map();
    
    // Add Redux store conversations
    if (Array.isArray(conversations)) {
      conversations.forEach(conv => {
        if (conv && conv.id) {
          conversationsMap.set(conv.id, {
            ...conv,
            _key: `redux_${conv.id}` // Add unique key prefix
          });
        }
      });
    }
    
    // Add locally fetched conversations
    if (Array.isArray(localConversations)) {
      localConversations.forEach(conv => {
        if (conv && conv.id) {
          // Only add if not already present or replace with newer data
          if (!conversationsMap.has(conv.id) || 
              new Date(conv.updated_at || conv.created_at) > 
              new Date(conversationsMap.get(conv.id).updated_at || conversationsMap.get(conv.id).created_at)) {
            conversationsMap.set(conv.id, {
              ...conv,
              _key: `local_${conv.id}` // Add unique key prefix
            });
          }
        }
      });
    }
    
    // Convert map back to array and sort by most recent
    return Array.from(conversationsMap.values())
      .sort((a, b) => {
        // Try to sort by updated_at timestamp if available
        const aTime = a.updated_at ? new Date(a.updated_at).getTime() : new Date(a.created_at).getTime();
        const bTime = b.updated_at ? new Date(b.updated_at).getTime() : new Date(b.created_at).getTime();
        return bTime - aTime;
      });
  }, [conversations, localConversations]);
  
  // Right-click context menu handlers
  const handleContextMenu = (event: React.MouseEvent, conversationId: string) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
      conversationId
    });
  };
  
  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };
  
  const handleDeleteOption = () => {
    if (contextMenu) {
      // Find the conversation title
      const conversation = allConversations.find(conv => conv.id === contextMenu.conversationId);
      const title = conversation?.title || "Untitled Conversation";
      
      // Open the confirmation dialog
      setDeleteDialog({
        open: true,
        conversationId: contextMenu.conversationId,
        title
      });
      
      // Close the context menu
      handleCloseContextMenu();
    }
  };
  
  const handleRenameOption = () => {
    if (contextMenu) {
      // Find the conversation title
      const conversation = allConversations.find(conv => conv.id === contextMenu.conversationId);
      const title = conversation?.title || "Untitled Conversation";
      
      // Set the initial value for the rename input
      setNewTitle(title);
      
      // Open the rename dialog
      setRenameDialog({
        open: true,
        conversationId: contextMenu.conversationId,
        title
      });
      
      // Close the context menu
      handleCloseContextMenu();
    }
  };
  
  const handleConfirmDelete = async () => {
    if (deleteDialog) {
      try {
        // Delete the conversation using the API
        await apiService.deleteConversation(deleteDialog.conversationId);
        
        // If the deleted conversation is the active one, navigate to a new conversation
        if (deleteDialog.conversationId === activeConversationId) {
          dispatch(clearMessages());
          router.push('/chat', undefined, { shallow: true });
        }
        
        // Refresh the conversations list
        dispatch(fetchConversationsAction(commanderIdentity));
        
        // As a backup, also fetch directly from API
        const updatedConversations = await apiService.getConversations(commanderIdentity);
        setLocalConversations(updatedConversations);
        
        console.log(`Conversation deleted: ${deleteDialog.conversationId}`);
      } catch (error) {
        console.error("Failed to delete conversation:", error);
      }
      
      // Close the dialog
      setDeleteDialog(null);
    }
  };
  
  const handleConfirmRename = async () => {
    if (renameDialog && newTitle.trim()) {
      try {
        // Update the conversation title using the API
        await apiService.updateConversation(renameDialog.conversationId, { title: newTitle.trim() });
        
        // Refresh the conversations list
        dispatch(fetchConversationsAction(commanderIdentity));
        
        // As a backup, also fetch directly from API
        const updatedConversations = await apiService.getConversations(commanderIdentity);
        setLocalConversations(updatedConversations);
        
        console.log(`Conversation renamed: ${renameDialog.conversationId} to "${newTitle}"`);
      } catch (error) {
        console.error("Failed to rename conversation:", error);
      }
      
      // Close the dialog
      setRenameDialog(null);
    }
  };
  
  const handleCancelDelete = () => {
    setDeleteDialog(null);
  };
  
  const handleCancelRename = () => {
    setRenameDialog(null);
  };
  
  const handleSelectConversation = (id: string) => {
    if (!id) {
      console.error("Cannot select conversation: ID is empty");
      return;
    }
    
    console.log(`Selecting conversation: ${id}`);
    
    try {
      // Clear messages before loading new conversation
      dispatch(clearMessages());
      
      // Set active conversation immediately so UI updates
      dispatch(setActiveConversation(id));
      
      // Update URL - this happens synchronously
      router.push(`/chat?id=${id}`, undefined, { shallow: true });
      
      // Fetch messages for this conversation - happens asynchronously
      dispatch(fetchMessages(id))
        .unwrap()
        .then(messages => {
          console.log(`Loaded ${messages.length} messages for conversation ${id}`);
        })
        .catch(error => {
          console.error(`Error loading messages: ${error}`);
          alert(`Failed to load messages: ${error}`);
        });
    } catch (error) {
      console.error("Error selecting conversation:", error);
    }
  };

  useEffect(() => {
    // If there's a route conversation ID but it's not active in Redux, set it
    if (routeConversationId && routeConversationId !== activeConversationId) {
      console.log(`Setting active conversation from URL: ${routeConversationId}`);
      dispatch(setActiveConversation(routeConversationId));
      
      // Also fetch messages for this conversation
      dispatch(fetchMessages(routeConversationId));
    }
  }, [routeConversationId, activeConversationId, dispatch]);

  return (
    <Box sx={{ width: '100%', maxWidth: 360 }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        p: 2 
      }}>
        <Typography variant="h6">Conversations</Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={onNewChat}
          size="small"
        >
          New Chat
        </Button>
      </Box>
      <Divider />
      
      {isLoading && allConversations.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : allConversations.length > 0 ? (
        <List>
          {allConversations.map(conversation => (
            <ListItemButton 
              key={conversation._key || `conv-${conversation.id}-${Date.now().toString(36)}`}
              selected={conversation.id === activeConversationId}
              onClick={() => handleSelectConversation(conversation.id)}
              onContextMenu={(e) => handleContextMenu(e, conversation.id)}
              sx={{
                borderRadius: 1,
                my: 0.5,
                px: 2,
                '&.Mui-selected': {
                  backgroundColor: 'primary.dark',
                  '&:hover': {
                    backgroundColor: 'primary.main',
                  }
                }
              }}
            >
              <ListItemIcon>
                <ChatIcon color={conversation.id === activeConversationId ? "primary" : "inherit"} />
              </ListItemIcon>
              <ListItemText 
                primary={conversation.title || "New Conversation"} 
                secondary={conversation.last_message || "No messages yet"}
                sx={{
                  '& .MuiListItemText-primary': {
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontWeight: conversation.id === activeConversationId ? 'bold' : 'normal'
                  },
                  '& .MuiListItemText-secondary': {
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: '0.75rem'  // Equivalent to 'caption' variant
                  }
                }}
              />
            </ListItemButton>
          ))}
        </List>
      ) : (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography color="text.secondary">No conversations yet</Typography>
          <Button 
            variant="outlined" 
            startIcon={<AddIcon />} 
            onClick={onNewChat}
            sx={{ mt: 2 }}
          >
            Start a new chat
          </Button>
        </Box>
      )}
      
      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleRenameOption}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Rename conversation</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteOption}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete conversation</ListItemText>
        </MenuItem>
      </Menu>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog !== null}
        onClose={handleCancelDelete}
      >
        <DialogTitle>Delete conversation?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete &quot;{deleteDialog?.title}&quot;? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Rename Dialog */}
      <Dialog
        open={renameDialog !== null}
        onClose={handleCancelRename}
      >
        <DialogTitle>Rename conversation</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Enter a new name for this conversation.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Conversation Name"
            type="text"
            fullWidth
            variant="outlined"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            inputProps={{ maxLength: 100 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelRename}>Cancel</Button>
          <Button 
            onClick={handleConfirmRename} 
            color="primary" 
            variant="contained"
            disabled={!newTitle.trim()}
          >
            Rename
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

// FAISS activity indicator component
const FAISSActivityIndicator = () => {
  const [active, setActive] = useState(false);
  
  // Listen for FAISS activity events from the server
  useEffect(() => {
    const handleFAISSActivity = (data: { active: boolean }) => {
      setActive(data.active);
      
      // Auto-reset after 3 seconds if active
      if (data.active) {
        setTimeout(() => setActive(false), 3000);
      }
    };
    
    const unsubscribe = socketService.onFAISSActivity(handleFAISSActivity);
    return unsubscribe;
  }, []);
  
  if (!active) return null;
  
  return (
    <Box sx={{ 
      position: 'fixed',
      top: 70,
      right: 20,
      zIndex: 1500,
      display: 'flex',
      alignItems: 'center',
      background: 'rgba(18, 18, 22, 0.85)',
      backdropFilter: 'blur(15px)',
      borderRadius: '12px',
      padding: '6px 12px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    }}>
      <Box sx={{ 
        width: 12, 
        height: 12, 
        borderRadius: '50%',
        bgcolor: '#4CAF50',
        mr: 1,
        animation: 'pulse 1.5s infinite',
        '@keyframes pulse': {
          '0%': { opacity: 1 },
          '50%': { opacity: 0.4 },
          '100%': { opacity: 1 },
        }
      }} />
      <Typography variant="caption" sx={{ fontWeight: 500 }}>
        FAISS Search Active
      </Typography>
    </Box>
  );
};

// Define message type to replace any
interface Message {
  id: string;
  content: string;
  role: string;
  timestamp: string;
  conversationId: string;
}

// Add this new component that will display model thinking in chat
interface ModelThinkingDisplayProps {
  visible: boolean;
  activeTabIndex?: number;
}

const ModelThinkingDisplay = ({ visible, activeTabIndex = 0 }: ModelThinkingDisplayProps) => {
  const [activeTab, setActiveTab] = useState(activeTabIndex);
  const [streams] = useState({ l1: '', l2: '', l3: '' });
  
  if (!visible) return null;
  
  const streamTypes = ['l1', 'l2', 'l3'] as const;
  const streamContent = streams[streamTypes[activeTab]];
  
  return (
    <Box sx={{ 
      position: 'absolute', 
      bottom: '80px', 
      left: 0, 
      right: 0, 
      zIndex: 10,
      maxHeight: '40vh',
      overflow: 'auto',
      backgroundColor: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(4px)',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', padding: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="L1: Instinct" />
          <Tab label="L2: Reasoning" />
          <Tab label="L3: Synthesis" />
        </Tabs>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <StreamingVisualizer content={streamContent} height="100%" />
      </Box>
    </Box>
  );
};

export default function ChatPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const router = useRouter();
  const conversationId = router.query.id as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Add a ref to track if we've already joined this conversation
  const hasJoinedConversation = useRef<string | null>(null);
  
  // Create one-time initialization flag
  const isInitialMount = useRef(true);
  
  // Socket.IO removed - using direct API calls via useSocket for emotion updates
  useSocket();
  
  // Use server status for connection check (HTTP availability, not Socket.IO)
  const { isServerAvailable } = useServerStatus();
  const isConnected = isServerAvailable;  // Backend is available via HTTP
  
  // Get user settings for commander identity
  const { settings } = useSettings();
  const commanderIdentity = settings.commanderIdentity || "Mai";
  
  const dispatch = useAppDispatch();
  const { 
    messages, 
    isLoading, 
    streamingResponse, 
    streamedContent,
    activeConversationId
  } = useAppSelector(state => ({
    messages: Array.isArray(state.chat.messages) ? state.chat.messages : [],
    isLoading: state.chat.isLoading,
    streamingResponse: state.chat.streamingResponse,
    streamedContent: state.chat.streamedContent,
    activeConversationId: state.chat.activeConversationId
  }));
  // Debug features for showing model thinking process
  const [debugStreams, setDebugStreams] = useState({ l1: '', l2: '', l3: '' });
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);
  
  const toggleDebugPanel = () => setIsDebugPanelOpen(!isDebugPanelOpen);
  const updateDebugStream = useCallback((layer: 'l1' | 'l2' | 'l3', content: string) => {
    setDebugStreams(prev => ({ ...prev, [layer]: content }));
  }, []);
  
  // Set default to true for non-mobile, so it's open by default
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(!isMobile);
  
  // Goal pursuit modal state
  const [goalPursuitModal, setGoalPursuitModal] = useState<{
    open: boolean;
    goal: Goal | null;
  }>({
    open: false,
    goal: null,
  });
  
  // Helper function to fetch and join a conversation - wrap in useCallback
  const fetchAndJoinConversation = useCallback((id: string) => {
    if (!id) return;
    
    console.log(`Fetching conversation: ${id}`);
    
    // Only clear if we're changing conversations
    if (activeConversationId !== id) {
      dispatch(clearMessages());
    }
    
    // Set as active conversation
    dispatch(setActiveConversation(id));
    
    // Note: Socket.IO joinConversation removed - using direct API calls
    
    // First try to get the conversation details to ensure it exists
    apiService.getConversation(id)
      .then(conversation => {
        console.log(`Successfully loaded conversation: ${conversation.title}`);
        
        // Fetch messages
        dispatch(fetchMessages(id));
      })
      .catch((error: Error) => {
        console.error(`Failed to load conversation ${id}:`, error);
        // If we can't load the conversation, try to navigate to home
        if (router.pathname === '/chat') {
          router.push('/chat', undefined, { shallow: true });
        }
      });
  }, [activeConversationId, dispatch, router]);
  
  // Load conversation when ID changes
  useEffect(() => {
    if (conversationId && hasJoinedConversation.current !== conversationId) {
      console.log(`Loading conversation: ${conversationId}`);
      
      // Update the ref to track that we've loaded this conversation
      hasJoinedConversation.current = conversationId;
      
      // First clear any existing messages - only clear if we're switching conversations
      if (activeConversationId !== conversationId) {
        dispatch(clearMessages());
      }
      
      // Note: Socket.IO joinConversation removed - using direct API calls
      
      // Set active conversation in Redux
      dispatch(setActiveConversation(conversationId));
      
      // Fetch messages for this conversation
      dispatch(fetchMessages(conversationId));
    } else if (!conversationId) {
      // If we don't have a conversation ID, clear messages
      console.log('No active conversation, clearing messages');
      dispatch(clearMessages());
      
      // Reset the loaded conversation tracking
      hasJoinedConversation.current = null;
    }
  }, [conversationId, dispatch, activeConversationId]);
  
  // Handle streaming tokens from different models
  useEffect(() => {
    const handleStreamToken = (data: StreamTokenData) => {
      const { type, token, conversation_id, agent_id } = data;
      
      // Log agent ID and conversation ID relationship
      if (agent_id && conversation_id) {
        console.log(`Stream data received - Agent ID: ${agent_id}, Conversation ID: ${conversation_id}`);
      }
      
      // Only process tokens for the current conversation
      if (!conversationId || conversation_id !== conversationId) {
        return;
      }
      
      // Note: Streaming is now handled by the Aura API directly
      // This socket-based streaming is kept for backward compatibility
      // but may not be actively used with the new Aura backend
      
      // Update debug streams if needed (currently not used)
      console.log(`Received stream token from ${type}:`, token);
    };
    
    // Set up socket listeners for streaming
    const streamTokenUnsubscribe = socketService.onStreamToken(handleStreamToken);
    
    // Set up socket listener for stream end
    const streamEndUnsubscribe = socketService.onStreamEnd((data: {
      error?: string;
      cancelled?: boolean;
      conversation_id?: string;
    }) => {
      if (data.error) {
        console.error('Stream error:', data.error);
      } else if (!data.cancelled && conversationId === data.conversation_id) {
        dispatch(endStreamingResponse());
      }
    });
    
    return () => {
      streamTokenUnsubscribe();
      streamEndUnsubscribe();
    };
  }, [dispatch, conversationId, streamingResponse, updateDebugStream, debugStreams]);
  
  // Handle chat messages separately to avoid dependency issues
  useEffect(() => {
    // Handle incoming chat message
    const handleChatMessage = (message: {
      id: string;
      content: string;
      role: string;
      timestamp: string;
      conversationId: string;
    }) => {
      console.log('Received chat message:', message);
      if (message.conversationId === conversationId) {
        // Check if this message already exists in our messages array
        const messageExists = Array.isArray(messages) && 
          messages.some(m => m.id === message.id);
        
        if (!messageExists) {
          dispatch(addMessage(message));
        }
      }
    };
    
    const chatMessageUnsubscribe = socketService.onChatMessage(handleChatMessage);
    
    return () => {
      chatMessageUnsubscribe();
    };
  }, [dispatch, conversationId, messages]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamedContent]);
  
  // Check for goal pursuit request marker in Aura's response
  const checkForGoalPursuitRequest = useCallback(async (responseText: string) => {
    // Look for the marker: [GOAL_PURSUIT_REQUEST:goal_id]
    const match = responseText.match(/\[GOAL_PURSUIT_REQUEST:([^\]]+)\]/);
    if (match) {
      const goalId = match[1];
      
      // Fetch the goal to show in modal
      try {
        const goals = await auraApi.getActiveGoals();
        let goal = goals.find(g => g.goal_id === goalId);
        
        // Fallback: If exact ID match fails, try to match by name (resilient to LLM hallucinations)
        if (!goal) {
          // The LLM might use "goal:goal_name_snake_case" instead of the UUID
          // Example: goal:review_recent_learnings -> review recent learnings
          const potentialNamePart = goalId.replace(/^goal:/, '').replace(/_/g, ' ').toLowerCase();
          
          goal = goals.find(g => {
            const goalName = g.name.toLowerCase();
            return goalName === potentialNamePart || 
                   goalName.includes(potentialNamePart) || 
                   potentialNamePart.includes(goalName);
          });
          
          if (goal) {
            console.log(`Goal matched by name fallback: ${goalId} -> ${goal.goal_id} (${goal.name})`);
          }
        }
        
        if (goal) {
          setGoalPursuitModal({
            open: true,
            goal: goal,
          });
        } else {
          console.warn(`Goal ${goalId} not found in active goals`);
        }
      } catch (error) {
        console.error('Error fetching goal for pursuit request:', error);
      }
    }
  }, []);
  
  // Handle goal pursuit confirmation
  const handleGoalPursuitConfirm = useCallback(async (
    goalId: string,
    loopCount: number,
    toolPermissions: string[],
    allowInterruption: boolean
  ) => {
    // Close the modal immediately before starting the process if interruptible
    // For non-interruptible, we might want to keep it open or show a progress indicator (future improvement)
    setGoalPursuitModal(prev => ({ ...prev, open: false }));

    // Show starting message
    const startMessage: Message = {
      id: Date.now().toString() + '_pursuit_start',
      content: `🚀 Starting autonomous pursuit of goal... (${loopCount} cycles)`,
      role: 'system',
      timestamp: new Date().toISOString(),
      conversationId: conversationId || 'temp',
    };
    dispatch(addMessage(startMessage));

    try {
      const result = await auraApi.pursueGoal(goalId, loopCount, toolPermissions, allowInterruption);
      
      if (result && result.success) {
        // Add a message showing the pursuit results
        const pursuitMessage: Message = {
          id: Date.now().toString() + '_pursuit',
          content: `✅ Autonomous pursuit complete: ${result.goal_name}\n` +
                   `Progress: ${Math.round(result.initial_progress * 100)}% → ${Math.round(result.final_progress * 100)}% ` +
                   `(+${Math.round(result.progress_delta * 100)}%)\n` +
                   `Completed ${result.loop_count} reasoning cycles.`,
          role: 'system',
          timestamp: new Date().toISOString(),
          conversationId: conversationId || 'temp',
        };
        
        dispatch(addMessage(pursuitMessage));
      } else {
        throw new Error('Goal pursuit failed');
      }
    } catch (error) {
      console.error('Error pursuing goal:', error);
      // Add error message
      const errorMessage: Message = {
        id: Date.now().toString() + '_pursuit_error',
        content: `❌ Failed to pursue goal autonomously: ${error instanceof Error ? error.message : 'Unknown error'}`,
        role: 'system',
        timestamp: new Date().toISOString(),
        conversationId: conversationId || 'temp',
      };
      dispatch(addMessage(errorMessage));
    }
  }, [conversationId, dispatch]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;
    
    try {
      // Add the user message to the state
      const userMessage: Message = {
        id: Date.now().toString(),
        content,
        role: 'user',
        timestamp: new Date().toISOString(),
        conversationId: conversationId || 'temp'
      };
      
      // Make sure messages is an array before dispatching
      if (!Array.isArray(messages)) {
        dispatch(clearMessages());
      }
      
      // Add to Redux state for immediate UI update
      dispatch(addMessage(userMessage));
      
      // Start streaming response
      dispatch(startStreamingResponse());
      
      // Build conversation history from Redux messages
      // Format: [{ role: 'user' | 'assistant', content: string }]
      // Exclude the current message since it will be sent as user_input separately
      // Filter to only include messages before the one we just added
      const conversationHistory = messages
        .filter((msg, index) => {
          // Exclude the last message if it's the current user message we just added
          if (index === messages.length - 1 && msg.role === 'user' && msg.content === content) {
            return false;
          }
          return msg.role === 'user' || msg.role === 'assistant';
        })
        .map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        }));
      
      // Log for debugging
      console.log(`📤 Sending message with ${conversationHistory.length} messages in conversation history`);
      if (conversationHistory.length > 0) {
        console.log('Last 3 messages in history:', 
          conversationHistory.slice(-3).map(m => `${m.role}: ${m.content.substring(0, 60)}...`));
      }
      
      // Send to Aura backend and handle streaming response
      // commanderIdentity comes from settings (e.g., "Mai") and is used as user_id for memory storage
      const response = await auraApi.sendMessage({
        message: content,
        user_id: commanderIdentity,  // Commander identity from settings - used for memory storage
        conversation_id: conversationId,
        conversation_history: conversationHistory,  // Pass conversation history for context
        context_limit: 50,
        enable_l2: settings.enableL2Analysis ?? true  // Use settings, default to true
      });
      
      // Handle the streamed response
      if (response && response.response) {
        // Add assistant message
        const assistantMessage: Message = {
          id: Date.now().toString() + '_assistant',
          content: response.response,
          role: 'assistant',
          timestamp: new Date().toISOString(),
          conversationId: conversationId || 'temp'
        };
        
        dispatch(addMessage(assistantMessage));
        dispatch(endStreamingResponse());
        
        // Check for goal pursuit request in Aura's response
        checkForGoalPursuitRequest(response.response);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      dispatch(endStreamingResponse());
    }
  }, [conversationId, commanderIdentity, messages, dispatch, settings.enableL2Analysis, checkForGoalPursuitRequest]);
  
  // Simplify toggle handlers to avoid type issues
  const toggleLeftDrawer = () => {
    setLeftDrawerOpen(!leftDrawerOpen);
  };

  const handleToggleDebugPanel = () => {
    toggleDebugPanel();
  };
  
  const handleNewChat = useCallback(async () => {
    try {
      // Clear messages first to prevent any issues when navigating
      dispatch(clearMessages());
      
      // Create a new conversation with commander identity (no title = backend generates it)
      const newConversation = await apiService.createConversation(undefined, commanderIdentity);
      
      if (!newConversation || !newConversation.id) {
        throw new Error("Failed to create conversation: Invalid response from server");
      }
      
      console.log("Created new conversation:", newConversation);
      
      // Update Redux state with the new conversation
      dispatch({
        type: 'chat/createNewConversation/fulfilled',
        payload: newConversation
      });
      
      // Update the state by fetching conversations again to ensure UI is updated
      await dispatch(fetchConversationsAction(commanderIdentity));
      
      // Set active conversation
      dispatch(setActiveConversation(newConversation.id));
      
      // Navigate to new conversation with the ID in the URL
      await router.push(`/chat?id=${newConversation.id}`, undefined, { shallow: true });
      
      // Note: Socket.IO joinConversation removed - using direct API calls
      
      // Single fetch after a short delay to update the left panel
      // Reduced from multiple fetches to prevent spam
      setTimeout(() => {
        dispatch(fetchConversationsAction(commanderIdentity));
      }, 500);
      
    } catch (error) {
      console.error("Failed to create new conversation:", error instanceof Error ? error.message : String(error));
      
      // Ensure we still have empty messages array even if creation failed
      dispatch(clearMessages());
    }
  }, [dispatch, commanderIdentity, router]);
  
  // Add a ref to track initial setup
  const isInitialSetupDone = useRef(false);

  // Modify the useEffect to prevent reopening closed panels
  useEffect(() => {
    if (!isMobile) {
      // Small delay to ensure proper rendering after initial load
      const timer = setTimeout(() => {
        // Only set these states on first load - use a ref to track this
        if (!isInitialSetupDone.current) {
          setLeftDrawerOpen(true);
          isInitialSetupDone.current = true;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isMobile]); // Remove toggleDebugPanel and isDebugPanelOpen from dependencies
  
  // Socket.IO connection disabled - using native WebSocket and Aura API instead
  // Note: The old Socket.IO real-time features are replaced by:
  // 1. Direct API calls to Aura backend via auraApiService
  // 2. Native WebSocket at /ws/emotion for emotion updates
  useEffect(() => {
    // If we have a conversation ID from the URL but not in Redux, fetch it
    // Only do this on initial mount or when these values actually change
    if (conversationId && 
        (!activeConversationId || activeConversationId !== conversationId) && 
        isInitialMount.current) {
      console.log(`Initial load with conversation ID from URL: ${conversationId}`);
      fetchAndJoinConversation(conversationId);
      isInitialMount.current = false;
    }
    
    return () => {
      // Cleanup if needed
    };
  }, [conversationId, activeConversationId, fetchAndJoinConversation]);

  return (
    <ParticlesBackground disableMouseTracking>
      <Head>
        <title>Chat - Aura AI Agents</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
      </Head>
      
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        bgcolor: 'transparent',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Show connection status alert */}
        <ServerStatusAlert />
        
        {/* FAISS Activity Indicator */}
        <FAISSActivityIndicator />
        
        <Box sx={{ 
          display: 'flex', 
          position: 'relative',
          width: '100%',
          height: '100%',
          flexGrow: 1,
          overflow: 'hidden',
          zIndex: 5 // Above particles but below drawers
        }}>
          {/* Conversation List Drawer */}
          <Drawer
            variant={isMobile ? "temporary" : "persistent"}
            open={leftDrawerOpen}
            onClose={toggleLeftDrawer}
            ModalProps={{ 
              keepMounted: true,
              hideBackdrop: isMobile ? false : true
            }}
            sx={{
              width: 280,
              flexShrink: 0,
              zIndex: 1300,
              display: 'block',
              position: 'fixed',
              '& .MuiDrawer-paper': {
                width: 280,
                boxSizing: 'border-box',
                borderRight: '1px solid',
                borderColor: 'rgba(255, 255, 255, 0.08)',
                background: 'rgba(18, 18, 22, 0.95)',
                backdropFilter: 'blur(15px)',
                height: '100%',
                position: 'fixed',
                boxShadow: '4px 0 20px rgba(0, 0, 0, 0.25)',
                overflowY: 'auto',
                overflowX: 'hidden',
              },
            }}
          >
            <ConversationsList onNewChat={handleNewChat} />
          </Drawer>
          
          {/* Main Content Container - Proper width calculation */}
          <Box
            component="main"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              flexGrow: 1,
              height: '100%',
              position: 'relative',
              px: { xs: 1, sm: 2 },
              transition: theme.transitions.create(['margin', 'width'], {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.leavingScreen,
              }),
              // Set left margin based on drawer state
              marginLeft: leftDrawerOpen && !isMobile ? '280px' : 0,
              // Set right margin based on debug panel state with new width
              marginRight: isDebugPanelOpen && !isMobile ? '350px' : 0,
              width: '100%',
              boxSizing: 'border-box',
              // Use calc for accurate width adjustments only on desktop with new debug panel width
              ...((!isMobile && leftDrawerOpen && isDebugPanelOpen) && {
                width: 'calc(100% - 630px)', // Both open (280px + 350px)
              }),
              ...((!isMobile && leftDrawerOpen && !isDebugPanelOpen) && {
                width: 'calc(100% - 280px)', // Only left open
              }),
              ...((!isMobile && !leftDrawerOpen && isDebugPanelOpen) && {
                width: 'calc(100% - 350px)', // Only right open (new width)
              }),
              ...((!isMobile && !leftDrawerOpen && !isDebugPanelOpen) && {
                width: '100%', // Both closed
              }),
            }}
          >
            {/* App Bar - Fixed position */}
            <Box sx={{ 
              py: 1.5,
              px: 2,
              display: 'flex', 
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid',
              borderRadius: '0 0 12px 12px',
              borderColor: 'rgba(255, 255, 255, 0.08)',
              background: 'rgba(18, 18, 22, 0.85)',
              backdropFilter: 'blur(15px)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
              position: 'sticky',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 1100
            }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center'
              }}>
                <IconButton 
                  onClick={toggleLeftDrawer} 
                  color={leftDrawerOpen ? "primary" : "default"}
                  sx={{ 
                    "&:hover": { background: leftDrawerOpen ? "rgba(25, 118, 210, 0.1)" : "rgba(255, 255, 255, 0.1)" },
                    zIndex: 1200
                  }}
                >
                  <MenuIcon />
                </IconButton>
                <IconButton 
                  onClick={() => window.location.href = '/'}
                  color="primary" 
                  sx={{ 
                    ml: { xs: 1, md: 1 },
                    "&:hover": { background: "rgba(25, 118, 210, 0.1)" }
                  }}
                >
                  <HomeIcon />
                </IconButton>
              </Box>
              
              <Typography variant="h6" sx={{ 
                flexGrow: 1, 
                textAlign: 'center',
                fontWeight: 500,
                background: 'linear-gradient(90deg, #f5cc7f 0%, #c09c58 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                {conversationId ? "Conversation" : "New Chat"}
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton 
                  onClick={handleToggleDebugPanel}
                  color={isDebugPanelOpen ? "primary" : "default"}
                  size="small"
                  title="Toggle Debug Panel"
                >
                  <BugReportIcon />
                </IconButton>
                
                <IconButton
                  onClick={() => router.push('/mission-control')}
                  color="default"
                  size="small"
                  title="Mission Control"
                >
                  <TerminalIcon />
                </IconButton>
              </Box>
            </Box>
            
            {/* Messages Area */}
            <Box sx={{ 
              flexGrow: 1, 
              p: { xs: 1, sm: 2 }, 
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              height: 'calc(100vh - 138px)', // Subtract header and input area heights
              position: 'relative',
              '&:after': {
                content: '""',
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '60px',
                background: 'linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.2) 100%)',
                pointerEvents: 'none',
                opacity: 0.7,
                zIndex: 1
              },
              '&:before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '40px',
                background: 'linear-gradient(0deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.2) 100%)',
                pointerEvents: 'none',
                opacity: 0.7,
                zIndex: 1
              },
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255, 255, 255, 0.1) transparent',
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: 'rgba(255, 255, 255, 0.2)',
              },
            }}>
              <Container 
                maxWidth="md" 
                sx={{ 
                  flexGrow: 1, 
                  py: 2,
                  zIndex: 2,
                  position: 'relative',
                }}
              >
                {!Array.isArray(messages) || messages.length === 0 ? (
                  conversationId && isLoading ? (
                    // Loading state
                    <Box sx={{ 
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%'
                    }}>
                      <CircularProgress size={40} sx={{ mb: 2 }} />
                      <Typography variant="body1">Loading messages...</Typography>
                    </Box>
                  ) : (
                    // Empty state
                    <Box sx={{ 
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      opacity: 0.7
                    }}>
                      <Typography variant="h5" gutterBottom>
                        {conversationId ? "Start typing to begin your conversation" : "Start a conversation with a Aura Agent"}
                      </Typography>
                      <Typography variant="body1" sx={{ maxWidth: 500, textAlign: 'center', mb: 4 }}>
                        {isConnected 
                          ? "Chat about anything, Aura Agents are here to be your companions."
                          : "Waiting for connection to be established. Please ensure the backend is running."}
                      </Typography>
                      {!isConnected && (
                        <Button 
                          variant="contained" 
                          color="primary"
                          onClick={() => window.location.reload()}
                          startIcon={<RefreshIcon />}
                        >
                          Refresh Page
                        </Button>
                      )}
                    </Box>
                  )
                ) : (
                  // Messages list
                  <>
                    {messages.map((message, index) => (
                      <ChatMessage 
                        key={`${message.id}-${index}`}
                        message={message}
                        isLastMessage={index === messages.length - 1}
                      />
                    ))}
                    
                    {streamingResponse && (
                      <ChatMessage 
                        message={{
                          id: 'streaming',
                          content: streamedContent,
                          role: 'assistant',
                          timestamp: new Date().toISOString(),
                          conversationId: conversationId || 'temp'
                        }}
                        isLastMessage={true}
                      />
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </Container>
            </Box>
            
            {/* Add this before the MessageInput component */}
            <ModelThinkingDisplay 
              visible={false && 
                (!!debugStreams.l1 || !!debugStreams.l2 || !!debugStreams.l3)}
              activeTabIndex={2} // Default to L3 (synthesis) tab
            />
            
            {/* Input Area - Fixed at bottom */}
            <Box sx={{ 
              p: 2, 
              borderTop: '1px solid',
              borderColor: 'rgba(255, 255, 255, 0.08)',
              background: 'rgba(18, 18, 22, 0.85)',
              backdropFilter: 'blur(15px)',
              boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
              borderRadius: '12px 12px 0 0',
              position: 'sticky',
              bottom: 0,
              left: 0,
              right: 0,
              width: '100%',
              zIndex: 1090
            }}>
              <Container maxWidth="md">
                <ChatInput 
                  onSendMessage={handleSendMessage}
                  isLoading={isLoading || streamingResponse}
                  disabled={!isConnected}
                  placeholder={isConnected ? "Ask Aura anything..." : "Connecting to server..."}
                />
              </Container>
            </Box>
          </Box>
          
          {/* Debug Panel Drawer - Enhanced with real-time stream data */}
          <Drawer
            variant="persistent"
            anchor="right"
            open={isDebugPanelOpen}
            sx={{
              width: isMobile ? '100%' : '350px', // Reduced from 400px to 350px
              flexShrink: 0,
              zIndex: 1400, // Increased from 1300 to 1400 to be above the left drawer
              display: 'block',
              position: 'fixed',
              right: 0,
              '& .MuiDrawer-paper': {
                width: isMobile ? '100%' : '350px', // Reduced from 400px to 350px
                height: '100%',
                boxSizing: 'border-box',
                borderLeft: '1px solid',
                borderColor: 'rgba(255, 255, 255, 0.08)',
                background: 'rgba(18, 18, 22, 0.95)',
                backdropFilter: 'blur(15px)',
                position: 'fixed',
                right: 0,
                top: 0,
                boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'hidden',
              },
            }}
          >
            <Box sx={{ 
              p: 1, 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              flexShrink: 0
            }}>
              <Typography variant="subtitle1" sx={{ ml: 1 }}>Debug Panel</Typography>
              <IconButton 
                onClick={handleToggleDebugPanel}
                sx={{ 
                  "&:hover": { background: "rgba(255, 255, 255, 0.1)" },
                  zIndex: 1200
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
            <Box sx={{ 
              flexGrow: 1, 
              overflowY: 'auto',
              overflowX: 'hidden' 
            }}>
              <DebugPanel conversationId={conversationId} />
            </Box>
          </Drawer>
        </Box>
        
        {/* Mobile Debug Panel Toggle - fix callback */}
        {isMobile && (
          <Fab 
            color={isDebugPanelOpen ? "primary" : "default"}
            size="medium"
            aria-label="debug"
            onClick={handleToggleDebugPanel}
            sx={{ 
              position: 'fixed', 
              bottom: 20, 
              right: 20,
              display: isDebugPanelOpen ? 'none' : 'flex',
              zIndex: 2000,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
            }}
          >
            <BugReportIcon />
          </Fab>
        )}

        {/* Make sure mobile buttons are always visible even when panels are open */}
        {isMobile && (
          <Fab 
            color={leftDrawerOpen ? "primary" : "default"}
            size="medium"
            aria-label="menu"
            onClick={toggleLeftDrawer}
            sx={{ 
              position: 'fixed', 
              bottom: isDebugPanelOpen ? 80 : 20,
              left: 20,
              zIndex: 2000,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
              display: 'flex', // Always show
            }}
          >
            <MenuIcon />
          </Fab>
        )}
        
        {/* Goal Pursuit Modal */}
        <GoalPursuitModal
          open={goalPursuitModal.open}
          goal={goalPursuitModal.goal}
          onClose={() => setGoalPursuitModal({ open: false, goal: null })}
          onConfirm={handleGoalPursuitConfirm}
        />
      </Box>
    </ParticlesBackground>
  );
} 