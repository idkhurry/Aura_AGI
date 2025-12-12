# Aura Frontend Architecture

## ✅ Current Clean Architecture

### 🎯 Core Philosophy
**Keep what works, remove what conflicts with Aura's single-agent design.**

---

## 📦 API Services (BOTH KEPT)

### `apiService.ts` - Conversation Management
**Purpose**: Generic conversation CRUD operations  
**Endpoints**:
- `/conversations` - List, create, update, delete conversations
- `/conversations/:id/messages` - Message history
- `/agents` - Agent info (for chat context)
- `/memory/:agentId` - Memory access

**Why Keep**: Well-tested, generic, works perfectly for Aura's conversations.

### `auraApiService.ts` - Aura-Specific Features
**Purpose**: Aura cognitive architecture integration  
**Endpoints**:
- `/chat/message` - Send message with Aura processing (L1/L2/L3)
- `/emotion/current` - 27D emotion state
- `/memory/recent` - Recent memories with embeddings
- `/health` - Backend health check

**Why Keep**: Aura-specific features that apiService doesn't handle.

**Usage Pattern**:
```typescript
// For conversations and history
import { apiService } from '@/services/apiService';
const conversations = await apiService.getConversations();

// For Aura-specific features  
import { auraApi } from '@/services/auraApiService';
const response = await auraApi.sendMessage({ message: '...' });
const emotion = await auraApi.getEmotionState();
```

---

## 📄 Pages

### ✅ ACTIVE PAGES
- `index.tsx` - Landing/home page
- `chat.tsx` - Main chat interface (Aura-integrated)
- `mission-control.tsx` - Aura dashboard (emotion, cognitive status)
- `settings.tsx` - Aura configuration
- `metrics.tsx` - **KEPT** - Analytics/visualizations (can be adapted)

### ❌ REMOVED PAGES
- ~~`agents.tsx`~~ - Multi-agent management (incompatible with single Aura)
- ~~`memory.tsx`~~ - Redirect to agents page (no longer needed)

---

## 🧩 Components

### Aura-Specific:
- `emotion/EmotionRadar.tsx` - 27D emotion visualization
- `cognitive/CognitiveStatus.tsx` - L1/L2/L3 layer status
- `memory/MemoryStream.tsx` - Recent memory display
- `settings/SettingsPanel.tsx` - Configuration UI
- `debug/DebugPanel.tsx` - Internal telemetry
- `debug/StreamingVisualizer.tsx` - L1/L2/L3 streaming

### Generic (Reusable):
- `chat/*` - Chat UI components
- `common/*` - Shared UI elements
- `layout/*` - Page layouts
- `animation/*` - Visual effects

---

## 🗄️ State Management

### Redux (KEPT for Chat)
- `chatSlice.ts` - Conversation and message state
  - Used by chat.tsx for conversation management
  - Manages message history, streaming state
  
- ~~`emotionSlice.ts`~~ - **COULD BE REMOVED**
  - Emotion is now fetched directly via auraApiService
  - Not actively used

### React Context
- `SettingsContext.tsx` - User preferences (userId, contextLimit, enableL2)
- `ServerStatusContext.tsx` - Backend health monitoring

---

## 🎨 What Makes This Great

### From Original Frontend:
✅ Polished chat UI with streaming  
✅ Conversation management (list, create, delete, rename)  
✅ Message history persistence  
✅ Debug panels for transparency  
✅ Clean Material-UI design  
✅ Responsive layout (mobile-friendly)  
✅ WebSocket real-time updates  

### New Aura Features:
✅ 27D emotion visualization (EmotionRadar)  
✅ Cognitive layer monitoring (L1/L2/L3)  
✅ Memory stream display  
✅ Settings with LocalStorage persistence  
✅ Mission Control dashboard  

---

## 🔄 Data Flow

```
User Input
    ↓
chat.tsx
    ↓
┌───────────────────┐
│  Conversation Mgmt │ → apiService.ts → /conversations
└───────────────────┘
    ↓
┌───────────────────┐
│  Send to Aura     │ → auraApiService.ts → /chat/message
└───────────────────┘
    ↓
┌───────────────────┐
│  Aura Backend     │
│  - L3 generates   │
│  - Emotion update │
│  - Memory store   │
└───────────────────┘
    ↓
WebSocket Updates
    ↓
UI Reflects State
```

---

## 🚀 Why This Works

1. **Dual API Strategy**: 
   - Generic operations (apiService) are reusable and battle-tested
   - Aura-specific operations (auraApiService) leverage unique features

2. **Minimal Disruption**: 
   - Kept working conversation management
   - Removed only multi-agent incompatibilities

3. **Feature Rich**:
   - All the polish of the original
   - Plus Aura's cognitive architecture

4. **Clean Separation**:
   - Pages clearly defined (chat vs monitoring vs settings)
   - Services have clear boundaries
   - Components are modular

---

## 📊 File Count

**Before Cleanup**: ~50 files  
**After Cleanup**: ~48 files (removed 2 incompatible pages)  
**Lines Saved**: ~1,428 lines of incompatible code  

**Result**: Lean, focused Aura frontend with no bloat! 🎯

