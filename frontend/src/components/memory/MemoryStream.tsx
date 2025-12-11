"use client";

import { Memory } from '@/types/aura';
import { Database, Clock, Tag, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface Props {
  memories: Memory[];
  maxEntries?: number;
}

export default function MemoryStream({ memories, maxEntries = 10 }: Props) {
  const recentMemories = memories.slice(0, maxEntries);

  const getImportanceColor = (importance: number) => {
    if (importance >= 0.8) return 'text-red-400 border-red-900';
    if (importance >= 0.5) return 'text-yellow-400 border-yellow-900';
    return 'text-green-400 border-green-900';
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return 'Unknown';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-72 bg-black/40 border border-green-900/50 rounded-lg p-3 font-mono overflow-hidden flex flex-col backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between text-xs text-green-400 mb-3 border-b border-green-900 pb-2">
        <div className="flex items-center gap-2">
          <Database size={14} className="animate-pulse" />
          <span>MEMORY_STREAM</span>
        </div>
        <div className="text-[10px] text-gray-500">
          {memories.length} ENTRIES
        </div>
      </div>

      {/* Memory Entries */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {recentMemories.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] text-gray-600 text-center py-4"
            >
              &gt; Awaiting memory formation...
              <br />
              &gt; Graph database connected.
            </motion.div>
          ) : (
            recentMemories.map((memory, index) => (
              <motion.div
                key={memory.memory_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className={clsx(
                  'p-2 rounded border bg-black/30 hover:bg-black/50 transition-colors group',
                  getImportanceColor(memory.importance)
                )}
              >
                {/* Memory Header */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 text-[9px] text-gray-400">
                    <Clock size={10} />
                    <span>{formatTimestamp(memory.timestamp)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {memory.learned_from && (
                      <div className="bg-blue-900/40 border border-blue-700/50 rounded px-1 py-0.5 text-[8px] text-blue-300 flex items-center gap-1">
                        <Brain size={8} />
                        <span>LEARNED</span>
                      </div>
                    )}
                    <div
                      className={clsx(
                        'border rounded px-1 py-0.5 text-[8px] font-bold',
                        getImportanceColor(memory.importance)
                      )}
                    >
                      {(memory.importance * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>

                {/* Memory Content */}
                <div className="text-[10px] text-gray-300 line-clamp-2 mb-1">
                  {memory.content}
                </div>

                {/* Tags */}
                {memory.tags && memory.tags.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    <Tag size={8} className="text-gray-600" />
                    {memory.tags.slice(0, 3).map((tag, i) => (
                      <span
                        key={i}
                        className="text-[8px] bg-green-900/20 border border-green-900/50 text-green-500 rounded px-1 py-0.5"
                      >
                        {tag}
                      </span>
                    ))}
                    {memory.tags.length > 3 && (
                      <span className="text-[8px] text-gray-600">
                        +{memory.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Similarity Score (if from vector search) */}
                {memory.similarity !== undefined && (
                  <div className="mt-1 text-[8px] text-purple-400">
                    SIMILARITY: {(memory.similarity * 100).toFixed(1)}%
                  </div>
                )}

                {/* Hover: Show emotional signature */}
                <div className="hidden group-hover:block mt-1 pt-1 border-t border-gray-800 text-[8px] text-gray-500">
                  <span className="font-bold">EMOTIONAL_SIG:</span>{' '}
                  {Object.entries(memory.emotional_signature)
                    .filter(([, v]) => v > 0.3)
                    .map(([k, v]) => `${k}:${v.toFixed(2)}`)
                    .join(', ') || 'neutral'}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Footer Stats */}
      <div className="mt-2 pt-2 border-t border-green-900/50 text-[8px] text-gray-600 flex justify-between">
        <span>VECTOR_DIM: 1536</span>
        <span>SURREALDB_2.x</span>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #00000040;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #16653480;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #166534;
        }
      `}</style>
    </motion.div>
  );
}

