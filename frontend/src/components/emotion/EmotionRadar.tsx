"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { EmotionState } from '@/types/aura';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

interface Props {
  data: EmotionState;
  showPhysics?: boolean;
}

export default function EmotionRadar({ data, showPhysics = true }: Props) {
  // Transform 8 core emotions to chart data
  // Note: "anticipation" is not in the 27D model, replaced with "interest" which is a valid emotion
  const chartData = [
    { subject: 'Joy', value: data.joy * 100, fullMark: 100 },
    { subject: 'Trust', value: data.trust * 100, fullMark: 100 },
    { subject: 'Fear', value: data.fear * 100, fullMark: 100 },
    { subject: 'Surprise', value: data.surprise * 100, fullMark: 100 },
    { subject: 'Sadness', value: data.sadness * 100, fullMark: 100 },
    { subject: 'Disgust', value: data.disgust * 100, fullMark: 100 },
    { subject: 'Anger', value: data.anger * 100, fullMark: 100 },
    { subject: 'Interest', value: (data.interest || 0) * 100, fullMark: 100 },
  ];

  // Color based on valence
  const getEmotionColor = () => {
    if (data.valence > 0.3) return { stroke: '#22c55e', fill: '#22c55e' }; // Green (positive)
    if (data.valence < -0.3) return { stroke: '#ef4444', fill: '#ef4444' }; // Red (negative)
    return { stroke: '#eab308', fill: '#eab308' }; // Yellow (neutral)
  };

  const colors = getEmotionColor();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="h-80 w-full bg-black/40 border border-green-900/50 rounded-lg p-3 relative backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="absolute top-3 left-3 z-10">
        <div className="flex items-center gap-2 text-xs font-mono text-green-400">
          <Activity size={14} className="animate-pulse" />
          <span>EMOTION_ENGINE_V2</span>
        </div>
        <div className="text-sm font-bold text-white mt-1">
          {data.current_state.toUpperCase()}
        </div>
      </div>

      {/* Dominant Emotion Badge */}
      <div className="absolute top-3 right-3 z-10 bg-black/60 border border-green-700/50 rounded px-2 py-1 text-[10px] font-mono">
        <span className="text-green-600">DOMINANT:</span>{' '}
        <span className="text-green-300">{data.dominant}</span>
      </div>

      {/* Radar Chart */}
      <div className="h-64 w-full pt-12">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
            <PolarGrid stroke="#166534" strokeWidth={0.5} />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={{ fill: '#4ade80', fontSize: 10, fontFamily: 'monospace' }} 
            />
            <PolarRadiusAxis 
              angle={90} 
              domain={[0, 100]} 
              tick={{ fill: '#166534', fontSize: 8 }}
            />
            <Radar
              name="Intensity"
              dataKey="value"
              stroke={colors.stroke}
              strokeWidth={2}
              fill={colors.fill}
              fillOpacity={0.25}
              animationDuration={800}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#000',
                border: '1px solid #166534',
                borderRadius: '4px',
                fontSize: '10px',
                fontFamily: 'monospace',
              }}
              labelStyle={{ color: '#4ade80' }}
              itemStyle={{ color: '#22c55e' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Physics Metrics */}
      {showPhysics && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="absolute bottom-2 left-2 right-2 flex justify-between text-[9px] font-mono space-x-2"
        >
          <div className="bg-black/60 border border-green-900/50 rounded px-2 py-1 flex-1">
            <span className="text-green-600">VALENCE:</span>{' '}
            <span className={(data.valence ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}>
              {(data.valence ?? 0).toFixed(3)}
            </span>
          </div>
          <div className="bg-black/60 border border-green-900/50 rounded px-2 py-1 flex-1">
            <span className="text-green-600">AROUSAL:</span>{' '}
            <span className="text-blue-400">{(data.arousal ?? 0).toFixed(3)}</span>
          </div>
          <div className="bg-black/60 border border-green-900/50 rounded px-2 py-1 flex-1">
            <span className="text-green-600">ENTROPY:</span>{' '}
            <span className="text-yellow-400">{(data.entropy ?? 0).toFixed(3)}</span>
          </div>
          {data.inertia !== undefined && (
            <div className="bg-black/60 border border-green-900/50 rounded px-2 py-1 flex-1">
              <span className="text-green-600">INERTIA:</span>{' '}
              <span className="text-purple-400">{(data.inertia ?? 0).toFixed(3)}</span>
            </div>
          )}
        </motion.div>
      )}

      {/* Animated border glow based on arousal */}
      <div 
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={{
          boxShadow: `inset 0 0 ${(data.arousal ?? 0) * 30}px ${colors.stroke}`,
          opacity: (data.arousal ?? 0) * 0.3,
        }}
      />
    </motion.div>
  );
}

