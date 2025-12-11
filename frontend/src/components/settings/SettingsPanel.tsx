"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, ChevronDown, ChevronUp, User, Brain, Layers, Save, RotateCcw } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';

export default function SettingsPanel() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Local state for inputs (before save)
  const [localIdentity, setLocalIdentity] = useState(settings.commanderIdentity);
  const [localContextSize, setLocalContextSize] = useState(settings.contextWindowSize);
  const [localEnableL2, setLocalEnableL2] = useState(settings.enableL2Analysis);

  const handleSave = () => {
    updateSettings({
      commanderIdentity: localIdentity,
      contextWindowSize: localContextSize,
      enableL2Analysis: localEnableL2,
    });
    setIsDirty(false);
  };

  const handleReset = () => {
    resetSettings();
    setLocalIdentity('Mai');
    setLocalContextSize(20);
    setLocalEnableL2(true);
    setIsDirty(false);
  };

  const checkDirty = () => {
    const changed = 
      localIdentity !== settings.commanderIdentity ||
      localContextSize !== settings.contextWindowSize ||
      localEnableL2 !== settings.enableL2Analysis;
    setIsDirty(changed);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full bg-black/40 border border-green-900/50 rounded-lg backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-green-900/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-green-400" />
          <span className="font-mono text-sm text-green-400">COMMAND_SETTINGS</span>
          {isDirty && (
            <span className="text-[10px] bg-yellow-900/40 border border-yellow-700/50 text-yellow-400 px-2 py-0.5 rounded">
              UNSAVED
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={16} className="text-green-400" /> : <ChevronDown size={16} className="text-green-400" />}
      </button>

      {/* Settings Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-green-900/50"
          >
            <div className="p-4 space-y-4">
              
              {/* Commander Identity */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-mono text-green-400">
                  <User size={12} />
                  <span>COMMANDER_IDENTITY</span>
                </label>
                <input
                  type="text"
                  value={localIdentity}
                  onChange={(e) => {
                    setLocalIdentity(e.target.value);
                    checkDirty();
                  }}
                  placeholder="Your name"
                  className="w-full bg-black/50 border border-green-900/50 rounded px-3 py-2 text-green-300 placeholder-green-900 focus:outline-none focus:border-green-500 font-mono text-sm"
                />
                <p className="text-[10px] text-gray-500">
                  How Aura identifies you in logs and context
                </p>
              </div>

              {/* Context Window Slider */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-mono text-green-400">
                  <Layers size={12} />
                  <span>MEMORY_DEPTH: {localContextSize} messages</span>
                </label>
                <div className="relative">
                  <input
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={localContextSize}
                    onChange={(e) => {
                      setLocalContextSize(parseInt(e.target.value));
                      checkDirty();
                    }}
                    className="w-full h-2 bg-black/50 rounded-lg appearance-none cursor-pointer slider-green"
                  />
                  <div className="flex justify-between mt-1 text-[9px] text-gray-600 font-mono">
                    <span>5</span>
                    <span>25</span>
                    <span>50</span>
                    <span>75</span>
                    <span>100</span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500">
                  {localContextSize < 20 && 'Short-term focus (faster, cheaper)'}
                  {localContextSize >= 20 && localContextSize < 50 && 'Balanced context window'}
                  {localContextSize >= 50 && 'Deep context (slower, expensive, better continuity)'}
                </p>
              </div>

              {/* L2 Analysis Toggle */}
              <div className="space-y-2">
                <label className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-mono text-green-400">
                    <Brain size={12} />
                    <span>DEEP_REASONING (L2)</span>
                  </div>
                  <button
                    onClick={() => {
                      setLocalEnableL2(!localEnableL2);
                      checkDirty();
                    }}
                    className={cn(
                      "relative w-12 h-6 rounded-full transition-colors",
                      localEnableL2 ? "bg-green-600" : "bg-gray-700"
                    )}
                  >
                    <motion.div
                      animate={{ x: localEnableL2 ? 24 : 2 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full"
                    />
                  </button>
                </label>
                <p className="text-[10px] text-gray-500">
                  {localEnableL2 
                    ? '✅ Async post-response analysis running (learns from every interaction)'
                    : '❌ L2 disabled (no learning or meta-analysis)'
                  }
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-green-900/50">
                <button
                  onClick={handleSave}
                  disabled={!isDirty}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded font-mono text-sm transition-all",
                    isDirty
                      ? "bg-green-900/30 border border-green-700 text-green-400 hover:bg-green-800/50"
                      : "bg-gray-900/30 border border-gray-800 text-gray-600 cursor-not-allowed"
                  )}
                >
                  <Save size={14} />
                  <span>SAVE_CONFIG</span>
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 rounded border border-red-900/50 bg-red-900/20 text-red-400 hover:bg-red-900/30 transition-colors"
                  title="Reset to defaults"
                >
                  <RotateCcw size={14} />
                </button>
              </div>

              {/* Info Panel */}
              <div className="mt-3 p-2 bg-blue-900/20 border border-blue-900/50 rounded text-[10px] text-blue-300 font-mono">
                <strong>SETTINGS_STATUS:</strong>
                <br />
                • Identity: <span className="text-blue-100">{settings.commanderIdentity}</span>
                <br />
                • Context: <span className="text-blue-100">{settings.contextWindowSize} msgs</span>
                <br />
                • L2: <span className="text-blue-100">{settings.enableL2Analysis ? 'ENABLED' : 'DISABLED'}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slider Styles */}
      <style jsx global>{`
        .slider-green::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #22c55e;
          cursor: pointer;
          border: 2px solid #166534;
        }
        .slider-green::-webkit-slider-thumb:hover {
          background: #4ade80;
        }
        .slider-green::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #22c55e;
          cursor: pointer;
          border: 2px solid #166534;
        }
        .slider-green::-moz-range-thumb:hover {
          background: #4ade80;
        }
      `}</style>
    </motion.div>
  );
}

