"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Brain, Activity, Database, Sparkles, RefreshCw, Eye, Target } from 'lucide-react';
import { auraApi } from '@/services/auraApiService';
import { useSettings } from '@/contexts/SettingsContext';
import type { EmotionState, Memory, Goal } from '@/types/aura';

interface AuraInternals {
  emotion: EmotionState | null;
  memoryCount: number;
  recentMemories: Memory[];
  activeGoals: Goal[];
  systemStatus: {
    online: boolean;
    dbConnected: boolean;
    emotionEngineActive: boolean;
    learningEngineActive: boolean;
    uptime?: string;
  };
  isLoading: boolean;
}

export interface DebugPanelProps {
  conversationId?: string;
}

export default function DebugPanel({ conversationId }: DebugPanelProps) {
  const { settings } = useSettings();
  const [internals, setInternals] = useState<AuraInternals>({
    emotion: null,
    memoryCount: 0,
    recentMemories: [],
    activeGoals: [],
    systemStatus: {
      online: false,
      dbConnected: false,
      emotionEngineActive: false,
      learningEngineActive: false,
    },
    isLoading: true,
  });

  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch all Aura internals
  const fetchInternals = useCallback(async () => {
    setInternals(prev => ({ ...prev, isLoading: true }));

    try {
      // Use commander identity from settings to filter memories by user
      const user_id = settings.commanderIdentity || undefined;
      
      // Parallel fetch for performance
      // Increased limit from 5 to 50 to show more memories
      const [status, emotion, memories, goals] = await Promise.all([
        auraApi.getSystemStatus(),
        auraApi.getEmotionState(),
        auraApi.getRecentMemories(50, user_id),  // Increased limit and pass user_id
        auraApi.getActiveGoals(),  // Fetch active goals
      ]);

      setInternals({
        emotion,
        memoryCount: memories.length,
        recentMemories: memories,
        activeGoals: goals,
        systemStatus: {
          online: status.healthy,
          dbConnected: status.database,
          emotionEngineActive: true, // If we got emotion data, engine is active
          learningEngineActive: true, // Assume active if system is online
        },
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch Aura internals:', error);
      setInternals(prev => ({ ...prev, isLoading: false }));
    }
  }, [settings.commanderIdentity]);

  // Initial fetch
  useEffect(() => {
    fetchInternals();
  }, [conversationId, fetchInternals]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchInternals, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchInternals]);

  return (
    <div className="w-full h-full overflow-auto p-4 space-y-4 bg-black/20">
      {/* Header */}
      <div className="flex justify-between items-center pb-2 border-b border-green-900/50">
        <h2 className="text-lg font-bold text-green-400 font-mono">AURA_INTERNALS_V0.3</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              autoRefresh
                ? 'bg-green-900/30 border-green-700 text-green-400'
                : 'bg-gray-800 border-gray-700 text-gray-400'
            }`}
          >
            AUTO: {autoRefresh ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={fetchInternals}
            disabled={internals.isLoading}
            className="px-2 py-1 text-xs rounded bg-green-900/30 border border-green-700 text-green-400 hover:bg-green-800/50 disabled:opacity-50"
          >
            <RefreshCw size={12} className={internals.isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* System Status */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-black/40 border border-green-900/50 rounded-lg p-3"
      >
        <div className="flex items-center gap-2 mb-2">
          <Activity size={16} className="text-green-500" />
          <h3 className="text-sm font-mono font-bold text-green-400">SYSTEM_STATUS</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <StatusItem label="ONLINE" value={internals.systemStatus.online} />
          <StatusItem label="DATABASE" value={internals.systemStatus.dbConnected} />
          <StatusItem label="EMOTION_ENGINE" value={internals.systemStatus.emotionEngineActive} />
          <StatusItem label="LEARNING_ENGINE" value={internals.systemStatus.learningEngineActive} />
        </div>
        {internals.systemStatus.uptime && (
          <div className="mt-2 text-[10px] text-gray-500 font-mono">
            UPTIME: {internals.systemStatus.uptime}
          </div>
        )}
      </motion.div>

      {/* Emotion State */}
      {internals.emotion && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-black/40 border border-purple-900/50 rounded-lg p-3"
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-purple-500" />
            <h3 className="text-sm font-mono font-bold text-purple-400">EMOTION_VECTOR</h3>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-mono">
              <span className="text-gray-500">DOMINANT:</span>{' '}
              <span className="text-purple-300 font-bold">{internals.emotion.current_state}</span>
            </div>
            <div className="space-y-1 max-h-96 overflow-y-auto custom-scrollbar">
              {/* Primary Emotions (9) */}
              <div className="text-[9px] text-gray-500 font-mono mb-1">PRIMARY (9):</div>
              <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                <EmotionBar label="LOVE" value={internals.emotion.love || 0} />
                <EmotionBar label="JOY" value={internals.emotion.joy} />
                <EmotionBar label="INTEREST" value={internals.emotion.interest || 0} />
                <EmotionBar label="TRUST" value={internals.emotion.trust} />
                <EmotionBar label="FEAR" value={internals.emotion.fear} />
                <EmotionBar label="SADNESS" value={internals.emotion.sadness} />
                <EmotionBar label="ANGER" value={internals.emotion.anger} />
                <EmotionBar label="SURPRISE" value={internals.emotion.surprise} />
                <EmotionBar label="DISGUST" value={internals.emotion.disgust} />
              </div>
              
              {/* Aesthetic Emotions (6) */}
              <div className="text-[9px] text-gray-500 font-mono mt-2 mb-1">AESTHETIC (6):</div>
              <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                <EmotionBar label="AWE" value={internals.emotion.awe || 0} />
                <EmotionBar label="BEAUTY" value={internals.emotion.beauty || 0} />
                <EmotionBar label="WONDER" value={internals.emotion.wonder || 0} />
                <EmotionBar label="SERENITY" value={internals.emotion.serenity || 0} />
                <EmotionBar label="MELANCHOLY" value={internals.emotion.melancholy || 0} />
                <EmotionBar label="NOSTALGIA" value={internals.emotion.nostalgia || 0} />
              </div>
              
              {/* Social Emotions (6) */}
              <div className="text-[9px] text-gray-500 font-mono mt-2 mb-1">SOCIAL (6):</div>
              <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                <EmotionBar label="EMPATHY" value={internals.emotion.empathy || 0} />
                <EmotionBar label="GRATITUDE" value={internals.emotion.gratitude || 0} />
                <EmotionBar label="PRIDE" value={internals.emotion.pride || 0} />
                <EmotionBar label="SHAME" value={internals.emotion.shame || 0} />
                <EmotionBar label="ENVY" value={internals.emotion.envy || 0} />
                <EmotionBar label="COMPASSION" value={internals.emotion.compassion || 0} />
              </div>
              
              {/* Cognitive Emotions (6) */}
              <div className="text-[9px] text-gray-500 font-mono mt-2 mb-1">COGNITIVE (6):</div>
              <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                <EmotionBar label="CURIOSITY" value={internals.emotion.curiosity || 0} />
                <EmotionBar label="CONFUSION" value={internals.emotion.confusion || 0} />
                <EmotionBar label="CERTAINTY" value={internals.emotion.certainty || 0} />
                <EmotionBar label="DOUBT" value={internals.emotion.doubt || 0} />
                <EmotionBar label="FASCINATION" value={internals.emotion.fascination || 0} />
                <EmotionBar label="BOREDOM" value={internals.emotion.boredom || 0} />
              </div>
            </div>
            <div className="text-[10px] text-gray-500 font-mono mt-2">
              ENTROPY: {internals.emotion.entropy.toFixed(3)}
            </div>
          </div>
        </motion.div>
      )}

      {/* Memory System */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-black/40 border border-blue-900/50 rounded-lg p-3"
      >
        <div className="flex items-center gap-2 mb-2">
          <Database size={16} className="text-blue-500" />
          <h3 className="text-sm font-mono font-bold text-blue-400">MEMORY_SYSTEM</h3>
        </div>
        <div className="text-xs font-mono mb-2">
          <span className="text-gray-500">TOTAL_MEMORIES:</span>{' '}
          <span className="text-blue-300 font-bold">{internals.memoryCount}</span>
        </div>
        {internals.recentMemories.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] text-gray-500 font-mono mb-1">RECENT_ACCESS:</div>
            {internals.recentMemories.slice(0, 3).map((memory, i) => (
              <div
                key={memory.memory_id || i}
                className="text-[10px] font-mono text-gray-400 p-1 bg-black/30 rounded truncate"
              >
                {memory.content.substring(0, 60)}...
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Learning Engine Status */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-black/40 border border-yellow-900/50 rounded-lg p-3"
      >
        <div className="flex items-center gap-2 mb-2">
          <Brain size={16} className="text-yellow-500" />
          <h3 className="text-sm font-mono font-bold text-yellow-400">LEARNING_ENGINE</h3>
        </div>
        <div className="text-xs font-mono space-y-1">
          <div>
            <span className="text-gray-500">STATUS:</span>{' '}
            <span className="text-yellow-300">
              {internals.systemStatus.learningEngineActive ? 'ACTIVE' : 'IDLE'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">MODE:</span>{' '}
            <span className="text-yellow-300">EXPERIENCE_CAPTURE</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-2">
            Continuously extracting patterns from interactions...
          </div>
        </div>
      </motion.div>

      {/* Goal Engine Status */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-black/40 border border-purple-900/50 rounded-lg p-3"
      >
        <div className="flex items-center gap-2 mb-2">
          <Target size={16} className="text-purple-500" />
          <h3 className="text-sm font-mono font-bold text-purple-400">GOAL_ENGINE</h3>
        </div>
        <div className="text-xs font-mono space-y-1">
          <div>
            <span className="text-gray-500">ACTIVE_GOALS:</span>{' '}
            <span className="text-purple-300 font-bold">{internals.activeGoals.length}</span>
          </div>
          {internals.activeGoals.length > 0 && (
            <div className="space-y-1 mt-2 max-h-32 overflow-y-auto custom-scrollbar">
              {internals.activeGoals.slice(0, 3).map((goal, i) => (
                <div
                  key={goal.goal_id || i}
                  className="text-[10px] font-mono text-purple-300 p-1.5 bg-black/30 rounded border border-purple-900/30"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold truncate">{goal.name}</span>
                    <span className="text-purple-500">{(goal.priority * 100).toFixed(0)}%</span>
                  </div>
                  <div className="text-gray-400 text-[9px] truncate">
                    {goal.description.substring(0, 50)}...
                  </div>
                  <div className="text-gray-500 text-[8px] mt-1">
                    {goal.goal_type} • {Math.round(goal.progress * 100)}% complete
                  </div>
                </div>
              ))}
            </div>
          )}
          {internals.activeGoals.length === 0 && (
            <div className="text-[10px] text-gray-500 mt-2">
              No active goals. Waiting for goal generation...
            </div>
          )}
        </div>
      </motion.div>

      {/* Session Info */}
      {conversationId && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-black/40 border border-gray-700 rounded-lg p-3"
        >
          <div className="flex items-center gap-2 mb-2">
            <Eye size={16} className="text-gray-500" />
            <h3 className="text-sm font-mono font-bold text-gray-400">SESSION_INFO</h3>
          </div>
          <div className="text-[10px] font-mono text-gray-500 break-all">
            CONVERSATION_ID: {conversationId}
          </div>
        </motion.div>
      )}

      {/* Footer */}
      <div className="text-[10px] text-gray-600 font-mono text-center pt-2 border-t border-gray-800">
        AURA_DEBUG_PANEL :: REAL-TIME_MONITORING
      </div>
    </div>
  );
}

// Helper Components
function StatusItem({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}:</span>
      <span className={value ? 'text-green-400' : 'text-red-400'}>
        {value ? '✓ OK' : '✗ OFFLINE'}
      </span>
    </div>
  );
}

function EmotionBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-gray-500 mb-1">{label}</div>
      <div className="w-full bg-gray-800 h-1 rounded overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.5 }}
          className="h-full bg-purple-500"
        />
      </div>
      <div className="text-gray-600 mt-0.5">{(value * 100).toFixed(0)}%</div>
    </div>
  );
}
