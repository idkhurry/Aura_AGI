# Frontend Cleanup Plan - Remove Legacy Code

## ✅ KEEP (Aura-Specific Architecture)

### Pages:
- ✅ `src/pages/index.tsx` - Home/Landing page
- ✅ `src/pages/chat.tsx` - Main chat interface (Aura-integrated)
- ✅ `src/pages/mission-control.tsx` - Aura status dashboard
- ✅ `src/pages/settings.tsx` - Aura settings
- ✅ `src/pages/_app.tsx` - App wrapper
- ✅ `src/pages/_document.tsx` - Document wrapper (if exists)

### Services:
- ✅ `src/services/auraApiService.ts` - **PRIMARY** API service for Aura backend
- ✅ `src/services/socketService.ts` - WebSocket for real-time updates (if used)

### Components (Aura-Specific):
- ✅ `src/components/emotion/EmotionRadar.tsx`
- ✅ `src/components/cognitive/CognitiveStatus.tsx`
- ✅ `src/components/memory/MemoryStream.tsx`
- ✅ `src/components/settings/SettingsPanel.tsx`
- ✅ `src/components/debug/DebugPanel.tsx`
- ✅ `src/components/debug/StreamingVisualizer.tsx`
- ✅ `src/components/chat/*` - All chat components
- ✅ `src/components/common/*` - Common UI components
- ✅ `src/components/layout/*` - Layout components
- ✅ `src/components/animation/*` - Animations

### Contexts:
- ✅ `src/contexts/SettingsContext.tsx` - Aura settings management
- ✅ `src/contexts/ServerStatusContext.tsx` - Backend health

### Types:
- ✅ `src/types/aura.ts` - Aura type definitions

### Store (IF USED):
- ⚠️ `src/store/slices/chatSlice.ts` - **CHECK IF STILL USED** (chat.tsx might use it)
- ❌ `src/store/slices/emotionSlice.ts` - **REMOVE** (use auraApiService instead)

---

## ❌ REMOVE (Legacy Multi-Agent System)

### Pages:
- ❌ `src/pages/agents.tsx` - Old multi-agent management (not Aura-specific)
- ❌ `src/pages/memory.tsx` - Old memory redirect (redirect to agents page)
- ❌ `src/pages/metrics.tsx` - Old metrics page (use mission-control instead)

### Services:
- ❌ `src/services/apiService.ts` - **LEGACY** generic API service
  - Replace all imports with `auraApiService.ts`

### Store Slices (If Not Used):
- ❌ `src/store/slices/emotionSlice.ts` - Replaced by direct API calls
- ❌ Any other unused slices

---

## 🔧 MIGRATION STEPS

### Step 1: Fix chat.tsx Redux Dependencies
```typescript
// Check if chat.tsx uses these Redux actions:
- fetchConversations
- setActiveConversation
- addMessage
- clearMessages
- fetchMessages

// If YES: Keep chatSlice.ts
// If NO: Remove Redux entirely and use React state
```

### Step 2: Remove Legacy API Service
```bash
# Find all imports of apiService
grep -r "from '@/services/apiService'" src/
grep -r "from '../services/apiService'" src/

# Replace with auraApiService where needed
# Then delete apiService.ts
```

### Step 3: Delete Legacy Pages
```bash
rm src/pages/agents.tsx
rm src/pages/memory.tsx
rm src/pages/metrics.tsx  # If not using
```

### Step 4: Clean Up Store
```bash
# If chat.tsx doesn't need Redux:
rm -rf src/store/

# If keeping Redux for chat only:
rm src/store/slices/emotionSlice.ts
# Keep only chatSlice.ts
```

---

## 🎯 FINAL ARCHITECTURE

```
frontend/
├── src/
│   ├── pages/
│   │   ├── index.tsx          # Landing page
│   │   ├── chat.tsx           # Main Aura chat
│   │   ├── mission-control.tsx # Aura dashboard
│   │   ├── settings.tsx       # Aura settings
│   │   └── _app.tsx           # App wrapper
│   ├── services/
│   │   └── auraApiService.ts  # SINGLE API service
│   ├── contexts/
│   │   ├── SettingsContext.tsx
│   │   └── ServerStatusContext.tsx
│   ├── components/
│   │   ├── emotion/
│   │   ├── cognitive/
│   │   ├── memory/
│   │   ├── chat/
│   │   └── debug/
│   ├── types/
│   │   └── aura.ts
│   └── store/ (optional, only if chat needs Redux)
│       └── slices/
│           └── chatSlice.ts
```

---

## ⚠️ BREAKING CHANGES

Removing `apiService.ts` and legacy pages will break:
- Any links to `/agents` or `/memory` pages
- Any components importing from `apiService.ts`

**Solution**: Search and replace all imports before deleting.

---

## 🚀 RECOMMENDATION

**For a clean Aura-only frontend:**

1. **Remove Redux entirely** - Use React Query or simple React state
2. **Single API service** - Only `auraApiService.ts`
3. **Three main pages** - Home, Chat, Mission Control
4. **Settings** - Simple context-based configuration

This gives you a lean, maintainable Aura frontend with no legacy baggage.

