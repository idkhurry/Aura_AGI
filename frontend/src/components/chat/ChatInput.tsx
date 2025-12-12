import React, { useState, KeyboardEvent, memo, useRef, useEffect } from 'react';
import { 
  Box, 
  TextField, 
  IconButton, 
  InputAdornment,
  Paper,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CodeIcon from '@mui/icons-material/Code';
import MicIcon from '@mui/icons-material/Mic';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const ChatInput = memo(function ChatInput({ 
  onSendMessage, 
  isLoading = false, 
  disabled = false,
  placeholder = "Ask Aura anything..." 
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Preserve focus when component re-renders
  useEffect(() => {
    if (isFocused && inputRef.current && document.activeElement !== inputRef.current) {
      // Only restore focus if we were previously focused and the input is not disabled
      if (!disabled && !isLoading) {
        inputRef.current.focus();
      }
    }
  }, [isFocused, disabled, isLoading]);
  
  const handleSendMessage = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };
  
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  return (
    <Paper
      elevation={0}
      sx={{ 
        p: 1.5,
        borderRadius: 3,
        background: 'rgba(18, 18, 22, 0.75)',
        backdropFilter: 'blur(15px)',
        border: '1px solid',
        borderColor: isFocused 
          ? 'rgba(245, 204, 127, 0.3)' 
          : 'rgba(255, 255, 255, 0.08)',
        boxShadow: isFocused 
          ? '0 0 15px rgba(245, 204, 127, 0.2)' 
          : '0 4px 20px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.3s ease',
        overflow: 'hidden',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, rgba(245, 204, 127, 0), rgba(245, 204, 127, 0.3), rgba(245, 204, 127, 0))',
          opacity: isFocused ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          multiline
          maxRows={4}
          variant="standard"
          placeholder={placeholder}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled || isLoading}
          InputProps={{
            disableUnderline: true,
            sx: { 
              fontSize: '0.95rem',
              px: 2,
              py: 1.2,
              color: 'rgba(255, 255, 255, 0.9)',
              transition: 'all 0.2s ease',
              '&.Mui-focused': {
                backgroundColor: 'transparent'
              },
            },
            startAdornment: (
              <InputAdornment position="start">
                <Tooltip title="Code snippet">
                  <span>
                    <IconButton
                      size="small"
                      sx={{ 
                        mr: 0.5,
                        color: 'rgba(255, 255, 255, 0.6)',
                        '&:hover': {
                          color: 'rgba(245, 204, 127, 0.9)',
                          background: 'rgba(245, 204, 127, 0.1)',
                        },
                        transition: 'all 0.2s ease',
                      }}
                      onClick={() => setMessage(prev => prev + '```\n\n```')}
                      disabled={disabled || isLoading}
                    >
                      <CodeIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiInputBase-root': {
              backgroundColor: 'transparent',
              borderRadius: 2,
            },
            '& .MuiInputBase-input': {
              '&::placeholder': {
                color: 'rgba(255, 255, 255, 0.4)',
                opacity: 1,
              },
            },
          }}
        />
        
        <Box sx={{ display: 'flex', alignItems: 'center', px: 1 }}>
          <Tooltip title="Attach file">
            <span>
              <IconButton 
                size="small" 
                sx={{ 
                  mx: 0.5, 
                  color: 'rgba(255, 255, 255, 0.6)',
                  '&:hover': {
                    color: 'rgba(245, 204, 127, 0.9)',
                    background: 'rgba(245, 204, 127, 0.1)',
                  },
                  transition: 'all 0.2s ease',
                }} 
                disabled={disabled || isLoading}
              >
                <AttachFileIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          
          <Tooltip title="Voice input">
            <span>
              <IconButton 
                size="small" 
                sx={{ 
                  mx: 0.5, 
                  color: 'rgba(255, 255, 255, 0.6)',
                  '&:hover': {
                    color: 'rgba(245, 204, 127, 0.9)',
                    background: 'rgba(245, 204, 127, 0.1)',
                  },
                  transition: 'all 0.2s ease',
                }} 
                disabled={disabled || isLoading}
              >
                <MicIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          
          <Tooltip title="Send message">
            <span>
              <IconButton 
                color="primary" 
                onClick={handleSendMessage}
                disabled={!message.trim() || disabled || isLoading}
                sx={{ 
                  ml: 0.5,
                  background: message.trim() && !disabled && !isLoading ? 
                    'rgba(245, 204, 127, 0.15)' : 'transparent',
                  '&:hover': {
                    background: message.trim() && !disabled && !isLoading ? 
                      'rgba(245, 204, 127, 0.25)' : 'transparent',
                  },
                  transition: 'all 0.2s ease',
                  '&.Mui-disabled': {
                    color: 'rgba(255, 255, 255, 0.3)',
                  },
                }}
              >
                {isLoading ? 
                  <CircularProgress size={24} /> : 
                  <SendIcon sx={{ 
                    color: message.trim() && !disabled ? 
                      'rgba(245, 204, 127, 0.9)' : 'inherit'
                  }} />
                }
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Paper>
  );
});

export default ChatInput; 