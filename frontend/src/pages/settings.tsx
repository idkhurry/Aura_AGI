"use client";

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Container,
  Slider,
  Switch,
  FormControlLabel,
  Button,
  TextField,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Alert,
  Snackbar,
  Divider,
  Chip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Link from 'next/link';
import { useSettings } from '@/contexts/SettingsContext';

export default function SettingsPage() {
  const { 
    settings,
    updateSettings,
    resetSettings
  } = useSettings();

  // Local state for form
  const [localUserId, setLocalUserId] = useState(settings.commanderIdentity);
  const [localContextLimit, setLocalContextLimit] = useState(settings.contextWindowSize);
  const [localUseL2, setLocalUseL2] = useState(settings.enableL2Analysis);
  
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  const handleSave = () => {
    try {
      updateSettings({
        commanderIdentity: localUserId,
        contextWindowSize: localContextLimit,
        enableL2Analysis: localUseL2
      });
      setSnackbar({
        open: true,
        message: 'Settings saved successfully!',
        severity: 'success'
      });
    } catch {
      setSnackbar({
        open: true,
        message: 'Failed to save settings',
        severity: 'error'
      });
    }
  };

  const handleReset = () => {
    resetSettings();
    setLocalUserId('Mai');
    setLocalContextLimit(20);
    setLocalUseL2(true);
    setSnackbar({
      open: true,
      message: 'Settings reset to defaults',
      severity: 'success'
    });
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
      py: 4
    }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          mb: 4,
          gap: 2
        }}>
          <Link href="/" passHref legacyBehavior>
            <IconButton
              component="a"
              sx={{
                color: '#f5cc7f',
                '&:hover': { backgroundColor: 'rgba(245, 204, 127, 0.1)' }
              }}
            >
              <ArrowBackIcon />
            </IconButton>
          </Link>
          <Typography 
            variant="h4" 
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(90deg, #f5cc7f 0%, #c09c58 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Aura Settings
          </Typography>
        </Box>

        {/* Main Settings Card */}
        <Card 
          sx={{
            backgroundColor: 'rgba(30, 30, 30, 0.8)',
            backdropFilter: 'blur(10px)',
            borderRadius: 2,
            mb: 3
          }}
        >
          <CardHeader 
            title="Chat Configuration"
            titleTypographyProps={{
              variant: 'h6',
              sx: { color: '#f5cc7f' }
            }}
          />
          <CardContent>
            {/* User ID */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Commander Identity
                <IconButton size="small">
                  <InfoOutlinedIcon fontSize="small" />
                </IconButton>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Your unique identifier in conversations with Aura
              </Typography>
              <TextField
                fullWidth
                value={localUserId}
                onChange={(e) => setLocalUserId(e.target.value)}
                placeholder="Enter your name"
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(0, 0, 0, 0.3)'
                  }
                }}
              />
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Context Window */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Memory Depth (Context Window)
                <Chip 
                  label={`${localContextLimit} messages`}
                  size="small"
                  sx={{ backgroundColor: 'rgba(245, 204, 127, 0.2)', color: '#f5cc7f' }}
                />
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Number of recent messages Aura remembers in each conversation
              </Typography>
              <Slider
                value={localContextLimit}
                onChange={(_, value) => setLocalContextLimit(value as number)}
                min={5}
                max={100}
                step={5}
                marks={[
                  { value: 5, label: '5' },
                  { value: 25, label: '25' },
                  { value: 50, label: '50' },
                  { value: 75, label: '75' },
                  { value: 100, label: '100' },
                ]}
                valueLabelDisplay="auto"
                sx={{
                  '& .MuiSlider-thumb': {
                    backgroundColor: '#f5cc7f'
                  },
                  '& .MuiSlider-track': {
                    backgroundColor: '#f5cc7f'
                  },
                  '& .MuiSlider-rail': {
                    backgroundColor: 'rgba(245, 204, 127, 0.3)'
                  }
                }}
              />
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* L2 Reasoning */}
            <Box sx={{ mb: 4 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localUseL2}
                    onChange={(e) => setLocalUseL2(e.target.checked)}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: '#f5cc7f',
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: '#c09c58',
                      }
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="subtitle1">
                      Deep Reasoning (L2 Analysis)
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Enable background analysis for deeper understanding (async processing)
                    </Typography>
                  </Box>
                }
              />
            </Box>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                sx={{
                  flex: 1,
                  backgroundColor: '#f5cc7f',
                  color: '#000',
                  '&:hover': {
                    backgroundColor: '#c09c58'
                  }
                }}
              >
                Save Settings
              </Button>
              <Button
                variant="outlined"
                onClick={handleReset}
                sx={{
                  borderColor: '#f5cc7f',
                  color: '#f5cc7f',
                  '&:hover': {
                    borderColor: '#c09c58',
                    backgroundColor: 'rgba(245, 204, 127, 0.1)'
                  }
                }}
              >
                Reset to Defaults
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Backend Configuration Info */}
        <Card 
          sx={{
            backgroundColor: 'rgba(30, 30, 30, 0.8)',
            backdropFilter: 'blur(10px)',
            borderRadius: 2
          }}
        >
          <CardHeader 
            title="Backend Configuration"
            titleTypographyProps={{
              variant: 'h6',
              sx: { color: '#f5cc7f' }
            }}
          />
          <CardContent>
            <Alert severity="info" sx={{ mb: 2 }}>
              LLM models are configured on the backend via environment variables. 
              Check <code>.env</code> file for model configuration.
            </Alert>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">L1 Model (Instinct):</Typography>
                <Chip label="mistralai/mistral-7b-instruct" size="small" />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">L2 Model (Reasoning):</Typography>
                <Chip label="anthropic/claude-3.5-sonnet" size="small" />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">L3 Model (Synthesis):</Typography>
                <Chip label="deepseek/deepseek-chat" size="small" />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">Embeddings:</Typography>
                <Chip label="openai/text-embedding-3-small" size="small" />
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Container>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
