import React, { useEffect } from 'react';
import type { AppProps } from 'next/app';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { CacheProvider, EmotionCache } from '@emotion/react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import Head from 'next/head';

import createEmotionCache from '../utils/createEmotionCache';
import '../utils/disable-isr-warnings';
import theme from '../styles/theme';
import { store, persistor } from '../store';
import { SettingsProvider } from '../contexts/SettingsContext';
import { ServerStatusProvider } from '../contexts/ServerStatusContext';
import ServerStatusAlert from '../components/common/ServerStatusAlert';
import '../styles/globals.css';

// Client-side cache, shared for the whole session of the user in the browser
const clientSideEmotionCache = createEmotionCache();

interface MyAppProps extends AppProps {
  emotionCache?: EmotionCache;
}

// Log Handler Component
function LogHandler() {
  useEffect(() => {
    // Import socket service dynamically to avoid SSR issues
    import('../services/socketService').then(({ getSocket }) => {
      const socket = getSocket();

      // Function to format server logs for the browser console
      const handleServerLog = (logData: unknown) => {
        if (!logData) return;
        
        // Format depends on whether it's an important log or not
        if (typeof logData === 'string' && logData.includes('IMPORTANT:')) {
          // Extract the actual message from the IMPORTANT: prefix
          const message = logData.replace('IMPORTANT:', '').trim();
          console.log(`%c[SERVER] ${message}`, 'color: #0066cc; font-weight: bold;');
        } else if (typeof logData === 'string' && logData.includes('WARNING')) {
          console.warn(`[SERVER WARNING] ${logData}`);
        } else if (typeof logData === 'string' && logData.includes('ERROR')) {
          console.error(`[SERVER ERROR] ${logData}`);
        } else if (typeof logData === 'object') {
          // For error objects or complex structures
          console.debug('[SERVER Debug]', logData);
        } else {
          console.debug(`[SERVER] ${logData}`);
        }
      };

      // Set up socket.io event listener for server logs
      if (socket) {
        socket.on('server_log', handleServerLog);
      }
    }).catch((err) => {
      console.error('Failed to load socket service:', err);
    });

    // No cleanup needed as we're not tracking the socket reference
  }, []);

  // This component doesn't render anything
  return null;
}

export default function App(props: MyAppProps) {
  const { Component, emotionCache = clientSideEmotionCache, pageProps } = props;

  // Remove the server-side generated CSS
  useEffect(() => {
    const jssStyles = document.querySelector('#jss-server-side');
    if (jssStyles && jssStyles.parentElement) {
      jssStyles.parentElement.removeChild(jssStyles);
    }
  }, []);

  return (
    <CacheProvider value={emotionCache}>
      <Head>
        <title>Aura - AI Companion</title>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
        <meta name="description" content="Aura - Your versatile AI companion with advanced cognitive architecture" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <ThemeProvider theme={theme}>
            <ServerStatusProvider>
              <SettingsProvider>
                <CssBaseline />
                <ServerStatusAlert />
                <LogHandler />
                <Component {...pageProps} />
              </SettingsProvider>
            </ServerStatusProvider>
          </ThemeProvider>
        </PersistGate>
      </Provider>
    </CacheProvider>
  );
} 