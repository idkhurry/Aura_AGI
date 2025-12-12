import React, { useEffect } from 'react';
import type { AppProps } from 'next/app';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { CacheProvider, EmotionCache } from '@emotion/react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import Head from 'next/head';
import { Geist, Geist_Mono } from "next/font/google";

import createEmotionCache from '../utils/createEmotionCache';
import '../utils/disable-isr-warnings';
import theme from '../styles/theme';
import { store, persistor } from '../store';
import { SettingsProvider } from '../contexts/SettingsContext';
import { ServerStatusProvider } from '../contexts/ServerStatusContext';
import ServerStatusAlert from '../components/common/ServerStatusAlert';
import '../styles/globals.css';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Client-side cache, shared for the whole session of the user in the browser
const clientSideEmotionCache = createEmotionCache();

interface MyAppProps extends AppProps {
  emotionCache?: EmotionCache;
}

// Log Handler Component - Placeholder for future server log handling
function LogHandler() {
  // Note: Server-side logging via WebSocket is not currently implemented
  // To enable, add 'server_log' event to socketService and handle it here
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
      <style jsx global>{`
        :root {
          --font-geist-sans: ${geistSans.style.fontFamily};
          --font-geist-mono: ${geistMono.style.fontFamily};
        }
      `}</style>
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