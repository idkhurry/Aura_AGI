import React, { createContext, useState, useContext, ReactNode, useEffect, useRef, useCallback } from 'react';
// Socket.IO disabled - using native WebSocket at /ws/emotion instead
// import socketService from '@/services/socketService';

interface ServerStatusContextType {
  isServerAvailable: boolean;
  isSocketConnected: boolean;
  isCheckingStatus: boolean;
  serverError: string | null;
  checkServerStatus: () => Promise<boolean>;
}

const defaultContext: ServerStatusContextType = {
  isServerAvailable: false,
  isSocketConnected: false,
  isCheckingStatus: false,
  serverError: null,
  checkServerStatus: async () => false,
};

const ServerStatusContext = createContext<ServerStatusContextType>(defaultContext);

export const useServerStatus = () => useContext(ServerStatusContext);

interface ServerStatusProviderProps {
  children: ReactNode;
}

export const ServerStatusProvider: React.FC<ServerStatusProviderProps> = ({ children }) => {
  const [isServerAvailable, setIsServerAvailable] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const lastCheckedRef = useRef(0);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initialCheckDoneRef = useRef(false);
  
  // Function to check server status - wrapped in useCallback
  const checkServerStatus = useCallback(async (force = false): Promise<boolean> => {
    // Prevent multiple simultaneous checks or too frequent checks
    const now = Date.now();
    if (
      !force && 
      (isCheckingStatus || now - lastCheckedRef.current < 10000)
    ) {
      return isServerAvailable;
    }
    
    setIsCheckingStatus(true);
    setServerError(null);
    lastCheckedRef.current = now;
    
    try {
      // Try to get a response from the API health endpoint
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/health`,
        { 
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          // Add a timeout to the fetch request
          signal: AbortSignal.timeout(5000)
        }
      );
      
      if (response.ok) {
        setIsServerAvailable(true);
        
        // Backend uses native WebSocket at /ws/emotion, not Socket.IO
        // Socket.IO is not needed for core functionality
        setIsSocketConnected(true);
        
        // Note: Socket.IO connection disabled - using native WebSocket at /ws/emotion instead
        
        return true;
      } else {
        const text = await response.text();
        setServerError(`Server returned error: ${response.status} ${text}`);
        setIsServerAvailable(false);
        return false;
      }
    } catch (error) {
      console.error('Server status check failed:', error);
      setServerError(`Server unavailable: ${error instanceof Error ? error.message : String(error)}`);
      setIsServerAvailable(false);
      return false;
    } finally {
      setIsCheckingStatus(false);
    }
  }, [isCheckingStatus, isServerAvailable]);
  
  // Socket.IO connection tracking disabled - using native WebSocket instead
  // useEffect(() => {
  //   const handleConnectionChange = (connected: boolean) => {
  //     setIsSocketConnected(connected);
  //   };
  //   const unsubscribe = socketService.onConnectionChange(handleConnectionChange);
  //   setIsSocketConnected(socketService.isConnected());
  //   return () => unsubscribe();
  // }, []);
  
  // Set up periodic status checking
  useEffect(() => {
    // Do initial check when component mounts
    if (!initialCheckDoneRef.current) {
      checkServerStatus(true).catch(console.error);
      initialCheckDoneRef.current = true;
    }
    
    // Set up a less frequent interval (30 seconds)
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
    
    checkIntervalRef.current = setInterval(() => {
      // Only check if we're not connected or if it's been a while
      if (!isSocketConnected || Date.now() - lastCheckedRef.current > 30000) {
        checkServerStatus().catch(console.error);
      }
    }, 30000); // Check every 30 seconds instead of 5
    
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [isSocketConnected, checkServerStatus]);

  return (
    <ServerStatusContext.Provider
      value={{
        isServerAvailable,
        isSocketConnected,
        isCheckingStatus,
        serverError,
        checkServerStatus: () => checkServerStatus(true)
      }}
    >
      {children}
    </ServerStatusContext.Provider>
  );
}; 