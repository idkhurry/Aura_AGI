"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import EmotionRadar from "@/components/emotion/EmotionRadar";
import CognitiveStatus from "@/components/cognitive/CognitiveStatus";
import MemoryStream from "@/components/memory/MemoryStream";
import SettingsPanel from "@/components/settings/SettingsPanel";
import { AuraStatus, ChatMessage, EmotionState, Memory, WebSocketEvent } from "@/types/aura";
import { Send, Terminal, Power, Activity, Maximize2, Minimize2, Target, ArrowLeft, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { auraApi } from "@/services/auraApiService";
import { SettingsProvider, useSettings } from "@/contexts/SettingsContext";

function MissionControlContent() {
  const router = useRouter();
  const { settings } = useSettings();
  const [input, setInput] = useState("");
  const [expandedPanel, setExpandedPanel] = useState<'emotion' | 'cognitive' | 'memory' | 'goals' | null>(null);
  
  // Default "Zero" State - Aura at rest
  const [status, setStatus] = useState<AuraStatus>({
    online: true,
    emotion: {
      // Primary Emotions (9)
      love: 0.2,
      joy: 0.3,
      interest: 0.4,
      trust: 0.3,
      fear: 0.1,
      sadness: 0.1,
      anger: 0.0,
      surprise: 0.1,
      disgust: 0.0,
      
      // Aesthetic Emotions (6)
      awe: 0.2,
      beauty: 0.15,
      wonder: 0.25,
      serenity: 0.2,
      melancholy: 0.1,
      nostalgia: 0.1,
      
      // Social Emotions (6)
      empathy: 0.3,
      gratitude: 0.2,
      pride: 0.1,
      shame: 0.0,
      envy: 0.0,
      compassion: 0.25,
      
      // Cognitive Emotions (6)
      curiosity: 0.4,
      confusion: 0.1,
      certainty: 0.2,
      doubt: 0.1,
      fascination: 0.3,
      boredom: 0.0,
      
      // Legacy: anticipation (optional, calculated from interest + curiosity)
      anticipation: 0.4,
      
      // Meta-State
      current_state: "CURIOSITY",
      dominant: "curiosity",
      valence: 0.3,
      arousal: 0.4,
      entropy: 0.15,
      inertia: 0.2,
    },
    cognitive: {
      layer: 'L1',
      status: 'idle',
      model: 'mistralai/mistral-7b-instruct',
      latency_ms: 0,
    },
    last_memory: null,
    active_goals: [],
    identity_snapshot: "I am Aura, an evolving AI companion.",
    database_connected: true,
    total_interactions: 0,
  });

  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch status from backend
  const fetchStatus = useCallback(async () => {
    try {
      const systemStatus = await auraApi.getSystemStatus();
      setIsConnected(systemStatus.healthy);
      setStatus(prev => ({
        ...prev,
        online: systemStatus.healthy,
        database_connected: systemStatus.database,
      }));
    } catch (error) {
      console.error('Failed to fetch status:', error);
      setIsConnected(false);
      setStatus(prev => ({ ...prev, online: false, database_connected: false }));
    }
  }, []);

  // Fetch emotion state
  const fetchEmotionState = useCallback(async () => {
    try {
      const emotionData = await auraApi.getEmotionState();
      setStatus(prev => ({
        ...prev,
        emotion: emotionData,
      }));
    } catch (error) {
      console.error('Failed to fetch emotion state:', error);
    }
  }, []);

  // Fetch active goals
  const fetchGoals = useCallback(async () => {
    try {
      const goals = await auraApi.getActiveGoals();
      setStatus(prev => ({
        ...prev,
        active_goals: goals,
      }));
    } catch (error) {
      console.error('Failed to fetch goals:', error);
    }
  }, []);

  // Fetch memories
  const fetchMemories = useCallback(async () => {
    try {
      const memoriesData = await auraApi.getRecentMemories(10);
      setMemories(memoriesData);
    } catch (error) {
      console.error('Failed to fetch memories:', error);
    }
  }, []);

  // WebSocket connection for real-time updates
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    let heartbeatInterval: NodeJS.Timeout;

    const connectWebSocket = () => {
      try {
        const ws = auraApi.createEmotionWebSocket();
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('✅ WebSocket connected to emotion stream');
          setIsConnected(true);
          
          // Send heartbeat every 25 seconds to keep connection alive
          heartbeatInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ command: 'heartbeat' }));
            }
          }, 25000);
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketEvent = JSON.parse(event.data);
            
            switch (message.type) {
              case 'emotion_update':
                // Update emotion state from WebSocket
                if (message.data) {
                  setStatus(prev => ({ ...prev, emotion: message.data as EmotionState }));
                }
                break;
                
              default:
                console.log('Unknown WebSocket message type:', message.type);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          setIsConnected(false);
        };

        ws.onclose = () => {
          console.log('🔌 WebSocket disconnected, reconnecting in 5s...');
          setIsConnected(false);
          clearInterval(heartbeatInterval);
          
          // Attempt to reconnect after 5 seconds
          reconnectTimeout = setTimeout(connectWebSocket, 5000);
        };
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        setIsConnected(false);
        reconnectTimeout = setTimeout(connectWebSocket, 5000);
      }
    };

    // Initial connection
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      clearTimeout(reconnectTimeout);
      clearInterval(heartbeatInterval);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Initial data fetch and fallback polling (when WebSocket isn't working)
  useEffect(() => {
    fetchStatus();
    fetchEmotionState();
    fetchMemories();
    fetchGoals();
    
    // Fallback polling (less frequent since we have WebSocket)
    const statusInterval = setInterval(fetchStatus, 10000); // 10s
    const memoriesInterval = setInterval(fetchMemories, 30000); // 30s
    const goalsInterval = setInterval(fetchGoals, 15000); // 15s
    
    return () => {
      clearInterval(statusInterval);
      clearInterval(memoriesInterval);
      clearInterval(goalsInterval);
    };
  }, [fetchStatus, fetchEmotionState, fetchMemories, fetchGoals]);

  // Send message handler
  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };
    
    const messageContent = input;
    setInput("");
    setChatLog(prev => [...prev, userMessage]);
    
    // Update cognitive status to show processing
    const startTime = Date.now();
    setStatus(prev => ({
      ...prev,
      cognitive: {
        ...prev.cognitive,
        status: 'processing',
        layer: 'L3', // Orchestrator uses L3 for synthesis
      },
    }));
    
    try {
      // Convert chat history to API format
      const conversationHistory = chatLog.map(msg => ({
        role: msg.role === 'aura' ? 'assistant' : msg.role,
        content: msg.content,
      }));

      // Send message to backend with settings
      const response = await auraApi.sendMessage({
        message: messageContent,
        user_id: settings.commanderIdentity,
        conversation_history: conversationHistory,
        context_limit: settings.contextWindowSize,
        enable_l2: settings.enableL2Analysis,
      });

      const latency = Date.now() - startTime;

      // Create Aura's response message
      const auraMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'aura',
        content: response.response,
        timestamp: new Date().toISOString(),
        cognitive_layer: 'L3',
        emotional_state: response.emotional_state ? {
          ...status.emotion,
          dominant: response.emotional_state.dominant,
          current_state: response.emotional_state.description,
        } : undefined,
      };
      
      setChatLog(prev => [...prev, auraMessage]);
      setStatus(prev => ({
        ...prev,
        cognitive: {
          ...prev.cognitive,
          status: 'idle',
          layer: 'L1',
          latency_ms: latency,
        },
        total_interactions: (prev.total_interactions || 0) + 1,
      }));

      // Fetch updated memories after interaction
      fetchMemories();

    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Show error message
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}. Please check backend connection.`,
        timestamp: new Date().toISOString(),
      };
      
      setChatLog(prev => [...prev, errorMessage]);
      setStatus(prev => ({
        ...prev,
        cognitive: { ...prev.cognitive, status: 'idle', layer: 'L1' },
      }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] text-green-500 font-sans selection:bg-green-900 selection:text-white flex flex-col overflow-hidden">
      
      {/* HEADER */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b border-green-900/50 p-4 flex justify-between items-center bg-black/50 backdrop-blur-md z-10"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/chat')}
            className="p-2 hover:bg-green-900/20 rounded transition-colors border border-green-900/30 hover:border-green-700/50"
            title="Back to Chat"
          >
            <ArrowLeft className="text-green-500" size={20} />
          </button>
          <Terminal className="text-green-500" size={24} />
          <div>
            <h1 className="font-bold tracking-widest text-lg">
              PROJECT AURA{' '}
              <span className="text-xs text-green-700 font-mono">v0.3.0</span>
            </h1>
            <div className="text-[10px] font-mono text-gray-600">
              {status.identity_snapshot}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/chat')}
            className="flex items-center gap-2 px-4 py-2 bg-green-900/20 hover:bg-green-900/30 border border-green-900/50 hover:border-green-700/50 rounded transition-colors text-green-400 hover:text-green-300"
            title="Go to Chat"
          >
            <MessageSquare size={18} />
            <span className="text-sm font-mono">CHAT</span>
          </button>
          {/* Connection Status */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <Activity size={14} className={isConnected ? 'text-green-400' : 'text-red-400'} />
            <span className="text-gray-600">SYS_STATUS:</span>
            <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
              {isConnected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          
          {/* Database Status */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <div className={cn(
              'w-2 h-2 rounded-full',
              status.database_connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            )} />
            <span className="text-gray-600">DB:</span>
            <span className={status.database_connected ? 'text-green-400' : 'text-red-400'}>
              {status.database_connected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
          
          {/* Interactions Counter */}
          {status.total_interactions !== undefined && status.total_interactions > 0 && (
            <div className="text-xs font-mono text-gray-600">
              INTERACTIONS: <span className="text-green-400">{status.total_interactions}</span>
            </div>
          )}
        </div>
      </motion.header>

      {/* SETTINGS PANEL */}
      <div className="px-4 pt-4">
        <SettingsPanel />
      </div>

      {/* DASHBOARD GRID */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 overflow-hidden">
        
        {/* LEFT COLUMN: INTERNALS PANEL */}
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className={cn(
            "space-y-4 overflow-y-auto custom-scrollbar",
            expandedPanel ? "hidden lg:block" : "lg:col-span-1"
          )}
        >
          {/* Emotion Radar */}
          <div className="relative">
            <button
              onClick={() => setExpandedPanel(expandedPanel === 'emotion' ? null : 'emotion')}
              className="absolute top-2 right-2 z-20 p-1 bg-black/60 border border-green-900/50 rounded hover:bg-green-900/30 transition-colors"
              title="Expand emotion panel"
            >
              {expandedPanel === 'emotion' ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
            <EmotionRadar data={status.emotion} showPhysics={true} />
          </div>
          
          {/* Cognitive Status */}
          <div className="relative">
            <button
              onClick={() => setExpandedPanel(expandedPanel === 'cognitive' ? null : 'cognitive')}
              className="absolute top-2 right-2 z-20 p-1 bg-black/60 border border-green-900/50 rounded hover:bg-green-900/30 transition-colors"
              title="Expand cognitive panel"
            >
              {expandedPanel === 'cognitive' ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
            <CognitiveStatus trace={status.cognitive} showMetrics={true} />
          </div>
          
          {/* Memory Stream */}
          <div className="relative">
            <button
              onClick={() => setExpandedPanel(expandedPanel === 'memory' ? null : 'memory')}
              className="absolute top-2 right-2 z-20 p-1 bg-black/60 border border-green-900/50 rounded hover:bg-green-900/30 transition-colors"
              title="Expand memory panel"
            >
              {expandedPanel === 'memory' ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
            <MemoryStream memories={memories} maxEntries={10} />
          </div>

          {/* Goals Panel */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative bg-black/40 border border-purple-900/50 rounded-lg p-3 backdrop-blur-sm"
          >
            <button
              onClick={() => setExpandedPanel(expandedPanel === 'goals' ? null : 'goals')}
              className="absolute top-2 right-2 z-20 p-1 bg-black/60 border border-purple-900/50 rounded hover:bg-purple-900/30 transition-colors"
              title="Expand goals panel"
            >
              {expandedPanel === 'goals' ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
            <div className="flex items-center gap-2 mb-3">
              <Target size={16} className="text-purple-500" />
              <h3 className="text-sm font-mono font-bold text-purple-400">GOAL_ENGINE</h3>
            </div>
            <div className="text-xs font-mono space-y-2">
              <div>
                <span className="text-gray-500">ACTIVE_GOALS:</span>{' '}
                <span className="text-purple-300 font-bold">{status.active_goals.length}</span>
              </div>
              {status.active_goals.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                  {status.active_goals.map((goal) => (
                    <div
                      key={goal.goal_id}
                      className="p-2 bg-black/30 border border-purple-900/30 rounded text-[10px] group hover:bg-black/40 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-purple-300 flex-1 break-words">{goal.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-purple-500">{(goal.priority * 100).toFixed(0)}%</span>
                          <button
                            onClick={async () => {
                              if (confirm(`Delete goal "${goal.name}"?`)) {
                                try {
                                  await auraApi.deleteGoal(goal.goal_id);
                                  fetchGoals(); // Refresh goals
                                } catch (error) {
                                  console.error('Failed to delete goal:', error);
                                }
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                            title="Delete goal"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      <div className="text-gray-400 text-[9px] mb-1 break-words whitespace-pre-wrap">
                        {goal.description}
                      </div>
                      <div className="flex items-center justify-between text-[8px] text-gray-500">
                        <span>{goal.goal_type}</span>
                        <span>{Math.round(goal.progress * 100)}% complete</span>
                      </div>
                      {(() => {
                        const reasoning = goal.metadata?.reasoning;
                        return reasoning && typeof reasoning === 'string' ? (
                          <div className="text-[8px] text-gray-600 mt-1 italic break-words whitespace-pre-wrap">
                            {reasoning}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-gray-500 py-4 text-center">
                  No active goals. Waiting for goal generation...
                </div>
              )}
              <button
                onClick={async () => {
                  const newGoal = await auraApi.generateGoal('user_requested');
                  if (newGoal) {
                    fetchGoals();
                  }
                }}
                className="w-full mt-2 px-2 py-1.5 bg-purple-900/30 border border-purple-700/50 rounded text-[10px] font-mono text-purple-300 hover:bg-purple-900/50 transition-colors"
              >
                + GENERATE GOAL
              </button>
            </div>
          </motion.div>
        </motion.div>

        {/* CENTER/RIGHT COLUMN: CHAT INTERFACE */}
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "bg-black/40 border border-green-900/50 rounded-lg flex flex-col backdrop-blur-sm overflow-hidden",
            expandedPanel ? "lg:col-span-4" : "lg:col-span-3"
          )}
        >
          {/* Chat Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {chatLog.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center h-full"
                >
                  <div className="text-center space-y-4 max-w-md">
                    <Power size={48} className="mx-auto text-green-700 animate-pulse" />
                    <h2 className="text-xl font-bold text-green-400 font-mono">
                      SYSTEM INITIALIZED
                    </h2>
                    <p className="text-sm text-gray-500 font-mono">
                      &gt; 27D Emotion Engine: <span className="text-green-500">ONLINE</span><br />
                      &gt; Learning System: <span className="text-green-500">READY</span><br />
                      &gt; Memory Database: <span className="text-green-500">CONNECTED</span><br />
                      &gt; LLM Layers (L1/L2/L3): <span className="text-green-500">STANDBY</span>
                    </p>
                    <p className="text-xs text-green-700">
                      Enter a command or start a conversation below...
                    </p>
                  </div>
                </motion.div>
              ) : (
                chatLog.map((msg, index) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className={cn(
                      "flex",
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] p-4 rounded-lg shadow-lg font-mono text-sm border",
                        msg.role === 'user'
                          ? 'bg-green-900/20 border-green-800 text-green-100'
                          : 'bg-black/60 border-green-900/50 text-green-300'
                      )}
                    >
                      {/* Message Header */}
                      <div className="flex items-center justify-between mb-2 text-[10px] text-gray-500 border-b border-gray-800 pb-1">
                        <span className="font-bold">
                          {msg.role === 'user' ? 'USER' : 'AURA'}
                        </span>
                        <div className="flex items-center gap-2">
                          {msg.cognitive_layer && (
                            <span className="text-blue-400">{msg.cognitive_layer}</span>
                          )}
                          <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                      
                      {/* Message Content */}
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      
                      {/* Message Footer (metadata) */}
                      {(msg.confidence || msg.tokens) && (
                        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-800 text-[9px] text-gray-600">
                          {msg.confidence && (
                            <span>CONF: {(msg.confidence * 100).toFixed(0)}%</span>
                          )}
                          {msg.tokens && (
                            <span>TOKENS: {msg.tokens}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
          
          {/* Input Area */}
          <div className="p-4 border-t border-green-900/50 bg-black/30">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                rows={2}
                className="flex-1 bg-black/50 border border-green-900/50 rounded p-3 focus:outline-none focus:border-green-500 text-green-300 placeholder-green-900 font-mono text-sm resize-none custom-scrollbar"
                placeholder="Enter command or dialogue... (Shift+Enter for new line)"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className={cn(
                  "px-6 py-2 rounded border transition-all font-mono font-bold",
                  input.trim()
                    ? "bg-green-900/30 hover:bg-green-800/50 text-green-400 border-green-800 hover:shadow-lg hover:shadow-green-900/50"
                    : "bg-gray-900/30 text-gray-600 border-gray-800 cursor-not-allowed"
                )}
              >
                <Send size={20} />
              </button>
            </div>
            
            {/* Status Bar */}
            <div className="flex items-center justify-between mt-2 text-[10px] font-mono text-gray-600">
              <span>
                CURRENT_LAYER: <span className="text-green-500">{status.cognitive.layer}</span>
              </span>
              <span>
                MODEL: <span className="text-green-500">{status.cognitive.model.split('/')[1] || status.cognitive.model}</span>
              </span>
              {status.cognitive.latency_ms > 0 && (
                <span>
                  LAST_LATENCY: <span className="text-yellow-400">{status.cognitive.latency_ms}ms</span>
                </span>
              )}
            </div>
          </div>
        </motion.div>

      </div>

      {/* Global Scrollbar Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #00000060;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #16653480;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #166534;
        }
      `}</style>
    </main>
  );
}

// Wrap with SettingsProvider
export default function MissionControl() {
  return (
    <SettingsProvider>
      <MissionControlContent />
    </SettingsProvider>
  );
}

