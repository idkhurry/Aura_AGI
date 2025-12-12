import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { createNoopStorage } from './noopStorage';

import chatReducer from './slices/chatSlice';
import emotionReducer from './slices/emotionSlice';

// Create a storage that works in any environment
const createSafeStorage = () => {
  // Check if window is defined (client-side)
  if (typeof window !== 'undefined') {
    return storage;
  }
  // Return a no-op storage for server-side rendering
  return createNoopStorage();
};

// Configure persisted reducers
const persistConfig = {
  key: 'Aura-state',
  storage: createSafeStorage(),
  whitelist: ['chat'], // Only persist chat state
  blacklist: ['emotion'], // Don't persist emotion - fetched from backend
};

const rootReducer = combineReducers({
  chat: chatReducer,
  emotion: emotionReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

// Create the store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        // Ignore these fields from the state when checking serializability
        ignoredPaths: ['chat.streamingResponse'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export const persistor = persistStore(store);

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 