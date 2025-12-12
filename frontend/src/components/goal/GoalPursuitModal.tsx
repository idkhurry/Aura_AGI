import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Slider,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  FormControl,
  FormLabel,
  Divider,
} from '@mui/material';
import type { Goal } from '@/types/aura';

interface GoalPursuitModalProps {
  open: boolean;
  goal: Goal | null;
  onClose: () => void;
  onConfirm: (
    goalId: string,
    loopCount: number,
    toolPermissions: string[],
    allowInterruption: boolean
  ) => Promise<void>;
  onDeny?: () => void;
}

// Available tools for goal pursuit
const AVAILABLE_TOOLS = [
  { id: 'web_search', label: 'Web Search', description: 'Search the internet for information' },
  { id: 'image_analysis', label: 'Image Analysis', description: 'Analyze and understand images' },
  { id: 'code_execution', label: 'Code Execution', description: 'Run code snippets' },
  { id: 'file_operations', label: 'File Operations', description: 'Read and write files' },
  { id: 'api_calls', label: 'API Calls', description: 'Make external API requests' },
];

// Estimated time per loop (in seconds) - adjust based on actual performance
const ESTIMATED_SECONDS_PER_LOOP = 90; // ~1.5 minutes per loop

export default function GoalPursuitModal({
  open,
  goal,
  onClose,
  onConfirm,
  onDeny,
}: GoalPursuitModalProps) {
  const [loopCount, setLoopCount] = useState(20);
  const [toolPermissions, setToolPermissions] = useState<string[]>([]);
  const [allowInterruption, setAllowInterruption] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate estimated time
  const estimatedTime = useMemo(() => {
    const totalSeconds = loopCount * ESTIMATED_SECONDS_PER_LOOP;
    const minutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  }, [loopCount]);

  const handleToolToggle = (toolId: string) => {
    setToolPermissions(prev =>
      prev.includes(toolId)
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    );
  };

  const handleConfirm = async () => {
    if (!goal) return;
    
    setIsProcessing(true);
    try {
      await onConfirm(goal.goal_id, loopCount, toolPermissions, allowInterruption);
      onClose();
    } catch (error) {
      console.error('Error pursuing goal:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeny = () => {
    if (onDeny) {
      onDeny();
    }
    onClose();
  };

  if (!goal) return null;

  return (
    <Dialog
      open={open}
      onClose={isProcessing ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
        },
      }}
    >
      <DialogTitle sx={{ color: '#e0e0e0', borderBottom: '1px solid rgba(139, 92, 246, 0.2)' }}>
        <Typography variant="h6" component="div" sx={{ fontFamily: 'monospace' }}>
          🎯 Autonomous Goal Pursuit Request
        </Typography>
      </DialogTitle>
      
      <DialogContent sx={{ mt: 2 }}>
        {/* Goal Info */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ color: '#9e9e9e', mb: 1, fontFamily: 'monospace' }}>
            GOAL:
          </Typography>
          <Typography variant="h6" sx={{ color: '#e0e0e0', mb: 1 }}>
            {goal.name}
          </Typography>
          <Typography variant="body2" sx={{ color: '#b0b0b0', mb: 2 }}>
            {goal.description}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Typography variant="body2" sx={{ color: '#9e9e9e' }}>
              Progress: <span style={{ color: '#8b5cf6' }}>{Math.round(goal.progress * 100)}%</span>
            </Typography>
            <Typography variant="body2" sx={{ color: '#9e9e9e' }}>
              Priority: <span style={{ color: '#8b5cf6' }}>{goal.priority.toFixed(2)}</span>
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 3, borderColor: 'rgba(139, 92, 246, 0.2)' }} />

        {/* Loop Count */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="body2" sx={{ color: '#9e9e9e', fontFamily: 'monospace' }}>
              REASONING CYCLES (L2/L3 iterations):
            </Typography>
            <Typography variant="body2" sx={{ color: '#8b5cf6', fontFamily: 'monospace' }}>
              {loopCount} loops
            </Typography>
          </Box>
          <Box sx={{ px: 2 }}>
            <Slider
              value={loopCount}
              onChange={(_, value) => setLoopCount(value as number)}
              min={1}
              max={100}
              step={1}
              marks={[
                { value: 1, label: '1' },
                { value: 25, label: '25' },
                { value: 50, label: '50' },
                { value: 75, label: '75' },
                { value: 100, label: '100' },
              ]}
              sx={{
                color: '#8b5cf6',
                '& .MuiSlider-thumb': {
                  backgroundColor: '#8b5cf6',
                },
                '& .MuiSlider-track': {
                  backgroundColor: '#8b5cf6',
                },
              }}
            />
          </Box>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
            <TextField
              type="number"
              value={loopCount}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= 100) {
                  setLoopCount(val);
                }
              }}
              inputProps={{ min: 1, max: 100, step: 1 }}
              sx={{
                width: '100px',
                '& .MuiOutlinedInput-root': {
                  color: '#e0e0e0',
                  '& fieldset': {
                    borderColor: 'rgba(139, 92, 246, 0.3)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(139, 92, 246, 0.5)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#8b5cf6',
                  },
                },
              }}
            />
            <Typography variant="body2" sx={{ color: '#9e9e9e' }}>
              Estimated time: <span style={{ color: '#8b5cf6', fontWeight: 'bold' }}>~{estimatedTime}</span>
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 3, borderColor: 'rgba(139, 92, 246, 0.2)' }} />

        {/* Tool Permissions */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ color: '#9e9e9e', mb: 2, fontFamily: 'monospace' }}>
            TOOL PERMISSIONS:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {AVAILABLE_TOOLS.map((tool) => (
              <FormControlLabel
                key={tool.id}
                control={
                  <Checkbox
                    checked={toolPermissions.includes(tool.id)}
                    onChange={() => handleToolToggle(tool.id)}
                    sx={{
                      color: '#8b5cf6',
                      '&.Mui-checked': {
                        color: '#8b5cf6',
                      },
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                      {tool.label}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#9e9e9e' }}>
                      {tool.description}
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start' }}
              />
            ))}
          </Box>
        </Box>

        <Divider sx={{ my: 3, borderColor: 'rgba(139, 92, 246, 0.2)' }} />

        {/* Priority/Interruption Setting */}
        <FormControl component="fieldset" sx={{ width: '100%' }}>
          <FormLabel component="legend" sx={{ color: '#9e9e9e', fontFamily: 'monospace', mb: 1 }}>
            PRIORITY:
          </FormLabel>
          <RadioGroup
            value={allowInterruption ? 'interruptible' : 'uninterrupted'}
            onChange={(e) => setAllowInterruption(e.target.value === 'interruptible')}
          >
            <FormControlLabel
              value="interruptible"
              control={
                <Radio
                  sx={{
                    color: '#8b5cf6',
                    '&.Mui-checked': {
                      color: '#8b5cf6',
                    },
                  }}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    Allow interruption if you message
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#9e9e9e' }}>
                    Aura will pause and respond to your messages
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              value="uninterrupted"
              control={
                <Radio
                  sx={{
                    color: '#8b5cf6',
                    '&.Mui-checked': {
                      color: '#8b5cf6',
                    },
                  }}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    Complete uninterrupted
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#9e9e9e' }}>
                    Aura will complete all cycles before responding
                  </Typography>
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, borderTop: '1px solid rgba(139, 92, 246, 0.2)', gap: 1 }}>
        <Button
          onClick={handleDeny}
          disabled={isProcessing}
          variant="outlined"
          sx={{
            color: '#ef4444',
            borderColor: 'rgba(239, 68, 68, 0.5)',
            '&:hover': {
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderColor: '#ef4444',
            },
          }}
        >
          Deny
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isProcessing}
          variant="contained"
          sx={{
            backgroundColor: '#8b5cf6',
            color: '#fff',
            '&:hover': {
              backgroundColor: '#7c3aed',
            },
            '&:disabled': {
              backgroundColor: 'rgba(139, 92, 246, 0.3)',
            },
          }}
        >
          {isProcessing ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1, color: '#fff' }} />
              Processing...
            </>
          ) : (
            'Approve'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
