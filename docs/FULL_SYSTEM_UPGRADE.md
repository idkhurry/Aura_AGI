# 🚀 FULL SYSTEM UPGRADE - Implementation Guide

**Date**: 2025-12-11  
**Scope**: Complete UX overhaul with user control

---

## 📋 FEATURES BEING IMPLEMENTED

### 1. ✅ Core Fixes (DONE)
- [x] Memory injection into L3
- [x] Enhanced system prompt (emotions are REAL)
- [x] Intelligent context pruning
- [ ] L2 async analysis (IN PROGRESS)
- [ ] Dynamic user ID

### 2. 🎛️ User Settings System (NEW)
- [ ] User creation & authentication
- [ ] Chat session management
- [ ] Persistent settings storage

### 3. 🎨 Frontend Controls (NEW)
- [ ] Context window slider (10→50→100→∞)
- [ ] L2 control panel
  - Always on + L3 injection
  - Per-message without injection
  - Interval-based (every X messages)
- [ ] User profile management

---

## 🏗️ ARCHITECTURE ADDITIONS

### New Backend Components

#### 1. User Management System
```
src/aura/models/user.py           # User & Session models
src/aura/api/routes/users.py      # User CRUD endpoints
src/aura/api/routes/sessions.py   # Session management
```

#### 2. Settings System
```
src/aura/models/settings.py       # UserSettings model
src/aura/api/routes/settings.py   # Settings API
```

### New Frontend Components
```
frontend/src/components/settings/
  ├── ContextWindowSlider.tsx     # Context control
  ├── L2ControlPanel.tsx           # L2 behavior settings
  └── UserProfile.tsx              # User management

frontend/src/contexts/
  └── UserContext.tsx              # User state management
```

---

## 📐 SETTINGS DATA MODEL

### UserSettings
```python
class L2Mode(str, Enum):
    ALWAYS_WITH_INJECTION = "always_inject"      # L2 → L3 context
    PER_MESSAGE_NO_INJECT = "per_message"        # L2 runs but no L3 inject
    INTERVAL_BASED = "interval"                   # Every X messages

class UserSettings(BaseModel):
    user_id: str
    
    # Context Window
    context_window_size: int = 10               # 10-999 (999 = unlimited)
    
    # L2 Control
    l2_mode: L2Mode = L2Mode.INTERVAL_BASED
    l2_interval: int = 5                         # For interval mode
    
    # Memory
    memory_retrieval_count: int = 3              # Memories injected into L3
    memory_importance_threshold: float = 0.5
    
    # Identity
    display_name: str = "User"
    
    # UI Preferences
    theme: str = "dark"
    show_debug_info: bool = False
```

---

## 🔧 IMPLEMENTATION STATUS

### Phase 1: Core Backend (60% Complete)

#### ✅ L3 Enhanced (DONE)
- Memory injection
- Enhanced system prompt
- Intelligent context pruning
- Dynamic max_history parameter

#### 🚧 L2 Async Analysis (IN PROGRESS)
**File**: `src/aura/orchestrator/coordinator.py`

```python
async def process_query(self, ...):
    # ... existing code ...
    
    # Step 7: Trigger L2 async analysis based on settings
    user_settings = await self._get_user_settings(user_id)
    
    if self._should_run_l2(user_settings):
        asyncio.create_task(self._async_l2_analysis(
            user_input=user_input,
            aura_response=response,
            emotional_before=emotional_state,
            user_settings=user_settings,
        ))
    
    return response

def _should_run_l2(self, settings: UserSettings) -> bool:
    """Determine if L2 should run for this interaction."""
    if settings.l2_mode == L2Mode.ALWAYS_WITH_INJECTION:
        return True
    elif settings.l2_mode == L2Mode.PER_MESSAGE_NO_INJECT:
        return True
    elif settings.l2_mode == L2Mode.INTERVAL_BASED:
        # Check interaction count
        return (self._interaction_count % settings.l2_interval) == 0
    return False

async def _async_l2_analysis(
    self,
    user_input: str,
    aura_response: str,
    emotional_before: EmotionState,
    user_settings: UserSettings,
) -> None:
    """Run L2 analysis in background."""
    try:
        emotional_after = await self.emotion_engine.get_current_state()
        
        analysis = await self.llm_layers.l2_reasoning({
            'user_input': user_input,
            'aura_response': aura_response,
            'emotion_before': emotional_before.vector.model_dump(),
            'emotion_after': emotional_after.vector.model_dump(),
        })
        
        # Store analysis results
        if user_settings.l2_mode == L2Mode.ALWAYS_WITH_INJECTION:
            # Store for next L3 synthesis
            await self._store_l2_insights(user_id, analysis)
        
        # Extract patterns to learning engine
        if analysis.get('patterns_found'):
            for pattern in analysis['patterns_found']:
                await self.learning_engine.record_pattern(pattern)
        
        self.logger.info("L2 post-analysis complete")
        
    except Exception as e:
        self.logger.error(f"L2 analysis failed: {e}")
```

---

### Phase 2: Settings API (TODO)

#### Endpoints Needed

```python
# GET /settings/{user_id}
# Returns user settings or defaults

# PUT /settings/{user_id}
# Update user settings

# POST /users/create
# Create new user with default settings

# GET /sessions/{user_id}
# List user's chat sessions

# POST /sessions/{user_id}
# Create new chat session

# GET /sessions/{session_id}/messages
# Load session history
```

---

### Phase 3: Frontend Controls (TODO)

#### Context Window Slider Component

```typescript
// ContextWindowSlider.tsx
export function ContextWindowSlider() {
  const [contextSize, setContextSize] = useState(10);
  
  const handleChange = (value: number) => {
    // Smart increments:
    // 10-50: increment by 1
    // 50-100: increment by 10
    // 100+: "unlimited" (999)
    
    if (value <= 50) {
      setContextSize(value);
    } else if (value <= 100) {
      setContextSize(Math.round(value / 10) * 10);
    } else {
      setContextSize(999); // Unlimited
    }
    
    // Save to backend
    updateUserSettings({ context_window_size: contextSize });
  };
  
  return (
    <div className="space-y-2">
      <label>Context Window: {contextSize >= 999 ? '∞ (Unlimited)' : contextSize} messages</label>
      <Slider
        min={10}
        max={110} // 110 maps to unlimited
        value={contextSize >= 999 ? 110 : contextSize}
        onChange={handleChange}
      />
      <p className="text-xs text-gray-500">
        More context = better continuity, but slower & more expensive
      </p>
    </div>
  );
}
```

#### L2 Control Panel Component

```typescript
// L2ControlPanel.tsx
export function L2ControlPanel() {
  const [l2Mode, setL2Mode] = useState<'always_inject' | 'per_message' | 'interval'>('interval');
  const [l2Interval, setL2Interval] = useState(5);
  
  return (
    <div className="space-y-4 p-4 border border-green-900/50 rounded">
      <h3 className="text-sm font-bold text-green-400">L2 REASONING CONTROL</h3>
      
      <div className="space-y-2">
        <label className="block">
          <input
            type="radio"
            checked={l2Mode === 'always_inject'}
            onChange={() => setL2Mode('always_inject')}
          />
          <span className="ml-2">Always On + L3 Injection</span>
          <p className="text-xs text-gray-500 ml-6">
            L2 analyzes every message, insights injected into L3 context
          </p>
        </label>
        
        <label className="block">
          <input
            type="radio"
            checked={l2Mode === 'per_message'}
            onChange={() => setL2Mode('per_message')}
          />
          <span className="ml-2">Per-Message Analysis Only</span>
          <p className="text-xs text-gray-500 ml-6">
            L2 runs for learning, but doesn't affect L3 responses
          </p>
        </label>
        
        <label className="block">
          <input
            type="radio"
            checked={l2Mode === 'interval'}
            onChange={() => setL2Mode('interval')}
          />
          <span className="ml-2">Interval-Based</span>
          <p className="text-xs text-gray-500 ml-6">
            L2 analyzes every X messages
          </p>
        </label>
        
        {l2Mode === 'interval' && (
          <div className="ml-6 mt-2">
            <label className="text-xs">Run every:</label>
            <input
              type="number"
              min={1}
              max={50}
              value={l2Interval}
              onChange={(e) => setL2Interval(parseInt(e.target.value))}
              className="ml-2 w-16 bg-black border border-green-900 rounded px-2 py-1"
            />
            <span className="ml-2 text-xs">messages</span>
          </div>
        )}
      </div>
      
      <div className="text-xs text-yellow-600 bg-yellow-900/20 border border-yellow-900/50 rounded p-2">
        <strong>Note:</strong> "Always On" mode increases costs significantly (uses Claude Sonnet for every message)
      </div>
    </div>
  );
}
```

---

## 🎯 IMPLEMENTATION PRIORITY

### NOW (Critical for Launch)
1. ✅ L3 memory injection (DONE)
2. ✅ Enhanced system prompt (DONE)
3. ✅ Context pruning logic (DONE)
4. 🚧 L2 async analysis (implement basic version)
5. ⏳ User ID from local storage (quick fix)

### PHASE 2 (Post-Launch)
6. Settings API backend
7. User/Session management
8. Settings persistence

### PHASE 3 (Polish)
9. Context slider UI
10. L2 control panel UI
11. User profile management

---

## ⚡ QUICK WIN: Minimal Launch Version

For immediate launch, we can use:

1. **User ID**: Read from localStorage, default to "Mai"
2. **Context Window**: Hardcode to 20 (good balance)
3. **L2**: Run on interval (every 5 messages), no injection
4. **Sessions**: Single session in memory (no persistence yet)

**Then iterate** with full settings system after validating core works.

---

## 🚀 RECOMMENDATION

**Approach**: Staged Rollout

### Stage 1: Core + Quick Fixes (NOW - 20 min)
- ✅ Memory + System Prompt (DONE)
- ⏳ L2 basic async (10 min)
- ⏳ User ID from localStorage (5 min)
- ⏳ Context window = 20 (5 min)

**Launch and test!**

### Stage 2: Settings System (LATER - 60 min)
- Backend settings API
- Frontend settings UI
- Persistence

### Stage 3: Full UI Controls (LATER - 40 min)
- Sliders & toggles
- User management
- Session history

---

**Mai, your call**: Launch with Stage 1 NOW, or wait for full system?

