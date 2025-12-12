# 🗂️ Conversation Management Features

## ✨ **What's New**

### 1. **Rename Conversations**
- **Right-click** on any conversation in the sidebar
- Select **"Rename conversation"**
- Enter a new name and hit **"Rename"**
- Changes are instantly saved and reflected everywhere

### 2. **Delete Conversations**
- **Right-click** on any conversation
- Select **"Delete conversation"**
- Confirm in the dialog
- Conversation and all its messages are permanently removed

### 3. **Meaningful Default Titles**
- **Old behavior**: Every new conversation was called "New Conversation"
- **New behavior**: Auto-generated titles like:
  ```
  Aura & Mai - Dec 11, 2025 14:30
  ```
- Format: `Aura & {Commander Identity} - {Timestamp}`
- Uses your **Commander Identity** from Settings (defaults to "Mai")

---

## 📋 **How to Use**

### Creating a New Conversation
1. Click **"New Chat"** button in the sidebar
2. A conversation is created with an auto-generated title
3. Start chatting immediately!

### Renaming a Conversation
1. **Right-click** on any conversation in the list
2. Select **"Rename conversation"**
3. Type your desired name (up to 100 characters)
4. Click **"Rename"** or press **Enter**

### Deleting a Conversation
1. **Right-click** on the conversation you want to delete
2. Select **"Delete conversation"**
3. Confirm by clicking **"Delete"** in the dialog
4. If it's the active conversation, you'll be redirected to a blank chat

---

## 🎯 **Technical Implementation**

### Frontend (`chat.tsx`)
- **Context Menu**: Right-click detection on conversation items
- **Dialogs**: Material-UI modals for rename/delete confirmation
- **State Management**: Redux + local state for instant UI updates
- **API Integration**: 
  - `apiService.updateConversation()` for rename
  - `apiService.deleteConversation()` for delete
  - `apiService.createConversation()` with `commanderIdentity`

### Backend (`conversations.py`)
- **PATCH** `/api/conversations/{id}`: Update title
- **DELETE** `/api/conversations/{id}`: Remove conversation
- **POST** `/api/conversations`: 
  - Accepts `user_id` from frontend
  - Auto-generates title if not provided:
    ```python
    timestamp_str = now.strftime("%b %d, %Y %H:%M")
    default_title = f"Aura & {request.user_id} - {timestamp_str}"
    ```

### Settings Integration
- Uses **Commander Identity** from `SettingsContext`
- Falls back to `"Mai"` if not set
- Persisted in LocalStorage across sessions

---

## 🔧 **Configuration**

Change your default user name in **Settings**:
1. Click the gear icon (⚙️) in the navigation
2. Update **"Commander Identity"** field
3. Click **"Save Configuration"**
4. All new conversations will use this name

---

## 📝 **Example Flow**

```
1. User: Opens /chat
2. User: Clicks "New Chat"
3. Backend: Creates conversation with title "Aura & Mai - Dec 11, 2025 14:30"
4. Frontend: Displays in sidebar
5. User: Right-clicks → "Rename conversation"
6. User: Types "Discussion about Emotions"
7. Frontend: Updates immediately
8. Backend: Persists to SurrealDB
```

---

## 🎉 **Benefits**

✅ **No more confusion**: Every conversation has a unique, meaningful name  
✅ **Easy organization**: Rename conversations to track topics  
✅ **Clean workspace**: Delete old or test conversations  
✅ **Personalized**: Uses your Commander Identity  
✅ **Context-aware**: Timestamps help you find recent chats  

---

**Enjoy your organized conversation experience!** 🚀✨

