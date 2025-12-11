"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Sparkles, Zap, Eye } from 'lucide-react';

interface LayerStream {
  layer: 'L1' | 'L2' | 'L3';
  content: string;
  status: 'idle' | 'processing' | 'complete';
  timestamp: string;
  latency_ms?: number;
  model?: string;
}

interface StreamingVisualizerProps {
  isLoading?: boolean;
  content?: string;
  height?: string;
  streams?: {
    l1?: string;
    l2?: string;
    l3?: string;
  };
}

export default function StreamingVisualizer({
  isLoading = false,
  content = '',
  height = '400px',
  streams = {},
}: StreamingVisualizerProps) {
  const [activeLayer, setActiveLayer] = useState<'L1' | 'L2' | 'L3'>('L1');
  const [layerStates, setLayerStates] = useState<Record<string, LayerStream>>({
    L1: {
      layer: 'L1',
      content: streams.l1 || 'L1 INSTINCT LAYER: Fast RAG-based responses (<500ms target)\n\nWaiting for query...',
      status: 'idle',
      timestamp: new Date().toISOString(),
      model: 'mistralai/mistral-7b-instruct',
    },
    L2: {
      layer: 'L2',
      content: streams.l2 || 'L2 REASONING LAYER: Deep analysis and pattern extraction\n\nAsync processing... No active task.',
      status: 'idle',
      timestamp: new Date().toISOString(),
      model: 'anthropic/claude-3.5-sonnet',
    },
    L3: {
      layer: 'L3',
      content: streams.l3 || 'L3 SYNTHESIS LAYER: Persona-driven response generation\n\nIntegrating: Emotion + Memory + Identity + Goals',
      status: 'idle',
      timestamp: new Date().toISOString(),
      model: 'deepseek/deepseek-chat',
    },
  });

  // Update layer states when streams prop changes
  useEffect(() => {
    if (streams.l1 || streams.l2 || streams.l3) {
      setLayerStates(prev => ({
        L1: { ...prev.L1, content: streams.l1 || prev.L1.content },
        L2: { ...prev.L2, content: streams.l2 || prev.L2.content },
        L3: { ...prev.L3, content: streams.l3 || prev.L3.content },
      }));
    }
  }, [streams]);

  const getLayerIcon = (layer: 'L1' | 'L2' | 'L3') => {
    switch (layer) {
      case 'L1':
        return <Zap size={14} className="text-green-500" />;
      case 'L2':
        return <Brain size={14} className="text-blue-500" />;
      case 'L3':
        return <Sparkles size={14} className="text-purple-500" />;
    }
  };

  const getLayerColor = (layer: 'L1' | 'L2' | 'L3') => {
    switch (layer) {
      case 'L1':
        return 'border-green-700 text-green-400';
      case 'L2':
        return 'border-blue-700 text-blue-400';
      case 'L3':
        return 'border-purple-700 text-purple-400';
    }
  };

  const getLayerBg = (layer: 'L1' | 'L2' | 'L3') => {
    switch (layer) {
      case 'L1':
        return 'bg-green-900/30';
      case 'L2':
        return 'bg-blue-900/30';
      case 'L3':
        return 'bg-purple-900/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing':
        return 'bg-yellow-500 animate-pulse';
      case 'complete':
        return 'bg-green-500';
      default:
        return 'bg-gray-600';
    }
  };

  return (
    <div className="w-full bg-black/40 border border-gray-800 rounded-lg overflow-hidden">
      {/* Layer Selector */}
      <div className="flex border-b border-gray-800">
        {(['L1', 'L2', 'L3'] as const).map((layer) => (
          <button
            key={layer}
            onClick={() => setActiveLayer(layer)}
            className={`flex-1 p-3 text-xs font-mono transition-all relative ${
              activeLayer === layer
                ? `${getLayerBg(layer)} ${getLayerColor(layer)} border-b-2`
                : 'text-gray-500 hover:bg-gray-900/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              {getLayerIcon(layer)}
              <span className="font-bold">{layer}</span>
              <div className={`w-2 h-2 rounded-full ${getStatusColor(layerStates[layer].status)}`} />
            </div>
            <div className="text-[8px] text-gray-600 mt-1 truncate">
              {layerStates[layer].model}
            </div>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="relative" style={{ height }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeLayer}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 overflow-auto p-4"
          >
            {/* Layer Header */}
            <div className="mb-3 pb-2 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getLayerIcon(activeLayer)}
                  <span className={`text-sm font-mono font-bold ${getLayerColor(activeLayer)}`}>
                    {activeLayer === 'L1' && 'INSTINCT LAYER'}
                    {activeLayer === 'L2' && 'REASONING LAYER'}
                    {activeLayer === 'L3' && 'SYNTHESIS LAYER'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {layerStates[activeLayer].latency_ms && (
                    <span className="text-[10px] text-gray-500 font-mono">
                      {layerStates[activeLayer].latency_ms}ms
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    <Eye size={10} className="text-gray-600" />
                    <span className="text-[10px] text-gray-600 font-mono">
                      {layerStates[activeLayer].status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Layer Description */}
            <div className="mb-4 p-2 bg-black/40 rounded border border-gray-800">
              <div className="text-[10px] text-gray-500 font-mono space-y-1">
                {activeLayer === 'L1' && (
                  <>
                    <div><span className="text-green-400">TARGET:</span> {'<'}500ms response time</div>
                    <div><span className="text-green-400">FUNCTION:</span> Fast pattern matching, RAG retrieval</div>
                    <div><span className="text-green-400">MODEL:</span> {layerStates.L1.model}</div>
                  </>
                )}
                {activeLayer === 'L2' && (
                  <>
                    <div><span className="text-blue-400">MODE:</span> Async background processing</div>
                    <div><span className="text-blue-400">FUNCTION:</span> Deep analysis, learning, memory consolidation</div>
                    <div><span className="text-blue-400">MODEL:</span> {layerStates.L2.model}</div>
                  </>
                )}
                {activeLayer === 'L3' && (
                  <>
                    <div><span className="text-purple-400">TARGET:</span> {'<'}2s persona-driven response</div>
                    <div><span className="text-purple-400">FUNCTION:</span> Emotional integration, identity synthesis</div>
                    <div><span className="text-purple-400">MODEL:</span> {layerStates.L3.model}</div>
                  </>
                )}
              </div>
            </div>

            {/* Stream Content */}
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
                  <span className="text-xs font-mono">Processing...</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap break-words">
                  {content || layerStates[activeLayer].content}
                </pre>
              </div>
            )}

            {/* Timestamp */}
            <div className="mt-4 pt-2 border-t border-gray-800 text-[8px] text-gray-600 font-mono">
              LAST_UPDATE: {new Date(layerStates[activeLayer].timestamp).toLocaleTimeString()}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-800 p-2 bg-black/60">
        <div className="text-[8px] text-gray-600 font-mono text-center">
          AURA_COGNITIVE_STACK :: 3-LAYER_ARCHITECTURE
        </div>
      </div>
    </div>
  );
}
