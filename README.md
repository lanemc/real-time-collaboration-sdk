# 🚀 Real-Time Collaboration Core

> **Transform any app into a collaborative experience in minutes, not months**

A developer-first SDK that brings Google Docs-style real-time collaboration to your web and mobile apps. Built on battle-tested Operational Transformation algorithms, but designed to feel as simple as working with local state.

[![npm](https://img.shields.io/npm/v/@rtcc/core)](https://npmjs.com/package/@rtcc/core) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT) [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

---

## ⚡ **Quick Start - Get collaborative in 3 minutes**

### 1. Start the collaboration server
```bash
npx @rtcc/server --port 3001
```

### 2. Add real-time collaboration to your app
```typescript
import { CollabClient, SharedText } from '@rtcc/client-web';

// Connect to collaboration server
const client = new CollabClient({
  serverUrl: 'ws://localhost:3001/ws'
});

await client.connect();

// Open a shared document
const doc = await client.openDocument('my-doc', {
  type: 'text',
  initialValue: 'Hello, World!'
});

// Get the shared text object
const sharedText = doc.getText();

// ✨ That's it! Now any changes sync in real-time across all connected clients
```

### 3. Connect it to your UI
```typescript
// Listen for changes from other users
sharedText.on('change', (newContent) => {
  // Update your UI - could be React state, Vue data, vanilla DOM, etc.
  setEditorContent(newContent);
});

// Send your changes to other users
function handleUserEdit(newContent) {
  sharedText.setText(newContent); // 🪄 Automatically syncs to everyone
}
```

**That's it!** You now have real-time collaboration with automatic conflict resolution. Open multiple browser tabs to see the magic happen.

---

## 🎯 **Why Developers Love RTCC**

### **Before RTCC** 😰
```typescript
// Months of complex implementation
class CollaborativeEditor {
  // 500+ lines of operational transform logic
  // Custom WebSocket management
  // Conflict resolution algorithms
  // User presence tracking
  // Connection state management
  // Error handling and reconnection
  // ... and so much more complexity
}
```

### **With RTCC** 😍
```typescript
// 5 minutes to collaborative features
const doc = await client.openDocument('doc-id');
const sharedText = doc.getText();

sharedText.on('change', updateUI);
sharedText.insert(position, text); // ✨ Auto-syncs everywhere
```

---

## 🛠️ **Built for Real Developer Workflows**

### **React Integration** ⚛️
```tsx
import { useSharedDocument } from '@rtcc/react-hooks';

function CollaborativeEditor({ documentId }) {
  const { document, isLoading, error } = useSharedDocument(documentId);
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  const sharedText = document.getText();
  
  return (
    <TextEditor
      value={sharedText.value}
      onChange={(newValue) => sharedText.setText(newValue)}
      onCursorChange={(position) => {
        // 👥 Share cursor position with other users
        document.updatePresence({ cursor: position });
      }}
    />
  );
}
```

### **Vue Integration** 🟢
```vue
<template>
  <div>
    <textarea 
      v-model="documentText" 
      @input="handleInput"
      :disabled="!isConnected"
    />
    <UsersList :users="onlineUsers" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { CollabClient } from '@rtcc/client-web';

const documentText = ref('');
const onlineUsers = ref([]);
const isConnected = ref(false);

onMounted(async () => {
  const client = new CollabClient({ serverUrl: 'ws://localhost:3001/ws' });
  await client.connect();
  
  const doc = await client.openDocument('my-doc');
  const sharedText = doc.getText();
  
  documentText.value = sharedText.value;
  isConnected.value = true;
  
  sharedText.on('change', (newValue) => {
    documentText.value = newValue;
  });
  
  doc.on('presenceUpdate', () => {
    onlineUsers.value = doc.getUsers();
  });
});

function handleInput() {
  if (sharedText) {
    sharedText.setText(documentText.value);
  }
}
</script>
```

### **Vanilla JavaScript** 🟨
```javascript
// Works with any framework or no framework at all
const editor = document.getElementById('editor');
const client = new CollabClient({ serverUrl: 'ws://localhost:3001/ws' });

client.connect().then(async () => {
  const doc = await client.openDocument('shared-doc');
  const sharedText = doc.getText();
  
  // Update UI when others make changes
  sharedText.on('change', (newContent) => {
    if (editor.value !== newContent) {
      const cursorPos = editor.selectionStart;
      editor.value = newContent;
      editor.setSelectionRange(cursorPos, cursorPos);
    }
  });
  
  // Send changes to others
  editor.addEventListener('input', () => {
    sharedText.setText(editor.value);
  });
});
```

---

## 🎨 **Multiple Data Types, One Consistent API**

### **Collaborative Text** 📝
Perfect for documents, comments, code editors
```typescript
const sharedText = doc.getText();

sharedText.insert(10, 'Hello ');        // Insert at position
sharedText.delete(5, 3);                // Delete 3 chars at position 5
sharedText.replace(0, 5, 'Hi');         // Replace range with new text

// Listen for granular changes
sharedText.on('insert', (pos, text) => showInsertAnimation(pos, text));
sharedText.on('delete', (pos, length) => showDeleteAnimation(pos, length));
```

### **Collaborative Lists** 📋
Perfect for todo lists, tables, collections
```typescript
const sharedList = doc.getList();

sharedList.push('New item');            // Add to end
sharedList.insert(2, 'Middle item');    // Insert at index
sharedList.move(0, 3);                  // Reorder items
sharedList.delete(1);                   // Remove item

// Real-time updates
sharedList.on('insert', (index, item) => addListItem(index, item));
sharedList.on('move', (from, to) => animateItemMove(from, to));
```

### **Collaborative Objects** 🗃️
Perfect for forms, settings, metadata
```typescript
const sharedMap = doc.getMap();

sharedMap.set('title', 'My Document');   // Set field
sharedMap.set('status', 'draft');       // Update status
sharedMap.delete('temporary');          // Remove field

// Batch updates for performance
sharedMap.batch({
  title: 'New Title',
  author: 'Jane Doe',
  lastModified: Date.now()
});

// Track field changes
sharedMap.on('set', (key, value) => updateForm(key, value));
```

---

## 👥 **User Presence & Awareness Made Easy**

```typescript
const doc = await client.openDocument('my-doc');

// Share your cursor position
doc.updatePresence({
  cursor: { position: 42, selection: [10, 20] },
  user: { name: 'Alice', avatar: '/avatars/alice.jpg' }
});

// See what others are doing
doc.on('presenceUpdate', (user) => {
  showUserCursor(user.clientId, user.cursor.position);
  updateUsersList(doc.getUsers());
});

// Know when people join or leave
doc.on('userJoined', (user) => showNotification(`${user.name} joined`));
doc.on('userLeft', (user) => showNotification(`${user.name} left`));
```

---

## 🏗️ **Architecture That Scales**

```
     Your App                RTCC Core               Your Server
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  ┌─────────────┐│    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│  │ React/Vue   ││    │ │ SharedText  │ │    │ │   Document  │ │
│  │ Component   ││◄──►│ │ SharedList  │◄┼───►│ │   Manager   │ │
│  │             ││    │ │ SharedMap   │ │    │ │             │ │
│  └─────────────┘│    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │        ▲        │    │        ▲        │
│  ┌─────────────┐│    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│  │   Your UI   ││    │ │  WebSocket  │ │    │ │ Persistence │ │
│  │   Logic     ││    │ │  Transport  │◄┼───►│ │   Layer     │ │
│  │             ││    │ │             │ │    │ │             │ │
│  └─────────────┘│    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **What RTCC Handles For You**
- ✅ **Operational Transform algorithms** - Complex conflict resolution
- ✅ **WebSocket management** - Connection, reconnection, error handling  
- ✅ **State synchronization** - Keeping everyone in sync
- ✅ **User presence** - Who's online, where their cursor is
- ✅ **Performance optimization** - Batching, compression, efficient diffs

### **What You Focus On**
- 🎨 **Your amazing UI** - Make it beautiful and intuitive
- 🏗️ **Your app logic** - Business rules and user experience
- 🎯 **Your users** - Solving their real problems

---

## 📚 **Complete Examples**

### **Collaborative Todo App** ✅
```typescript
import { CollabClient } from '@rtcc/client-web';

class TodoApp {
  async init() {
    const client = new CollabClient({ serverUrl: 'ws://localhost:3001/ws' });
    await client.connect();
    
    const doc = await client.openDocument('todos', {
      type: 'list',
      initialValue: []
    });
    
    this.todos = doc.getList();
    this.setupEventListeners();
    this.render();
  }
  
  setupEventListeners() {
    // Real-time updates from other users
    this.todos.on('insert', (index, todo) => {
      this.insertTodoElement(index, todo);
      this.showNotification(`New todo added: ${todo.text}`);
    });
    
    this.todos.on('replace', (index, newTodo, oldTodo) => {
      this.updateTodoElement(index, newTodo);
      if (newTodo.completed !== oldTodo.completed) {
        this.showNotification(`Todo ${newTodo.completed ? 'completed' : 'reopened'}`);
      }
    });
    
    this.todos.on('delete', (index, todo) => {
      this.removeTodoElement(index);
      this.showNotification(`Todo deleted: ${todo.text}`);
    });
  }
  
  addTodo(text) {
    this.todos.push({
      id: Date.now(),
      text,
      completed: false,
      createdBy: this.client.id
    });
  }
  
  toggleTodo(index) {
    const todo = this.todos.get(index);
    this.todos.replace(index, { ...todo, completed: !todo.completed });
  }
  
  deleteTodo(index) {
    this.todos.delete(index);
  }
}
```

### **Real-time Code Editor** 💻
```typescript
import { CollabClient } from '@rtcc/client-web';
import { EditorView, basicSetup } from 'codemirror';

class CollaborativeCodeEditor {
  async init(elementId, documentId) {
    // Setup collaboration
    const client = new CollabClient({ serverUrl: 'ws://localhost:3001/ws' });
    await client.connect();
    
    const doc = await client.openDocument(documentId, {
      type: 'text',
      initialValue: '// Start coding together!\n'
    });
    
    this.sharedText = doc.getText();
    
    // Setup CodeMirror editor
    this.editor = new EditorView({
      doc: this.sharedText.value,
      extensions: [
        basicSetup,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !this.ignoreChanges) {
            this.handleLocalChanges(update);
          }
        })
      ],
      parent: document.getElementById(elementId)
    });
    
    // Handle remote changes
    this.sharedText.on('change', (newContent) => {
      if (this.editor.state.doc.toString() !== newContent) {
        this.ignoreChanges = true;
        this.editor.dispatch({
          changes: {
            from: 0,
            to: this.editor.state.doc.length,
            insert: newContent
          }
        });
        this.ignoreChanges = false;
      }
    });
    
    // Show collaborator cursors
    doc.on('presenceUpdate', (user) => {
      this.updateCollaboratorCursor(user);
    });
  }
  
  handleLocalChanges(update) {
    // Convert CodeMirror changes to RTCC operations
    update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
      if (fromA !== toA) {
        this.sharedText.delete(fromA, toA - fromA);
      }
      if (inserted.length > 0) {
        this.sharedText.insert(fromA, inserted.toString());
      }
    });
  }
  
  updateCollaboratorCursor(user) {
    // Show other users' cursors in the editor
    const cursorWidget = this.createCursorWidget(user);
    // Implementation depends on your cursor visualization
  }
}
```

---

## 🚀 **Production Ready Features**

### **Robust Error Handling** 🛡️
```typescript
const client = new CollabClient({
  serverUrl: 'ws://localhost:3001/ws',
  reconnection: {
    enabled: true,
    attempts: 5,
    delay: 1000,
    delayMax: 30000
  }
});

client.on('connectionStateChange', (state) => {
  switch (state) {
    case 'connecting':
      showStatus('Connecting...');
      break;
    case 'connected':
      showStatus('Connected', 'success');
      break;
    case 'reconnecting':
      showStatus('Reconnecting...', 'warning');
      break;
    case 'disconnected':
      showStatus('Offline', 'error');
      break;
  }
});

client.on('error', (error) => {
  console.error('Collaboration error:', error);
  showErrorNotification('Collaboration temporarily unavailable');
});
```

### **Authentication & Security** 🔐
```typescript
const client = new CollabClient({
  serverUrl: 'ws://localhost:3001/ws',
  token: await getAuthToken(), // Your auth token
});

// Server-side validation
const server = new CollaborationServer({
  port: 3001,
  auth: {
    required: true,
    verify: async (token) => {
      // Validate JWT token, check permissions, etc.
      const user = await validateToken(token);
      return user ? {
        clientId: user.id,
        userId: user.id,
        name: user.name,
        permissions: user.permissions
      } : null;
    }
  }
});
```

### **Data Persistence** 💾
```typescript
import { CollaborationServer } from '@rtcc/server';
import { PostgresPersistenceAdapter } from '@rtcc/persistence-postgres';

const server = new CollaborationServer({
  port: 3001,
  persistence: {
    enabled: true,
    adapter: new PostgresPersistenceAdapter({
      connectionString: process.env.DATABASE_URL
    })
  }
});

// Documents automatically save to database
// Users can rejoin and see full history
// No data loss on server restart
```

---

## 📦 **Installation & Setup**

### **Client SDK**
```bash
npm install @rtcc/client-web @rtcc/core
```

### **React Integration**
```bash
npm install @rtcc/react-hooks
```

### **Server** 
```bash
npm install @rtcc/server
```

### **Quick Server Start**
```bash
# Global installation for quick testing
npm install -g @rtcc/server
rtcc-server --port 3001

# Or run directly with npx
npx @rtcc/server --port 3001
```

---

## 🎪 **Try It Now - Live Demo**

Experience real-time collaboration in your browser:

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/real-time-collaboration-sdk.git
cd real-time-collaboration-sdk

# 2. Install dependencies
npm install

# 3. Start the collaboration server
npm run start:server

# 4. Start the demo app
npm run dev

# 5. Open multiple browser tabs and start typing! 🎉
```

**What you'll see:**
- ✨ Text appearing in real-time across all tabs
- 👥 User presence indicators showing who's online
- 🔄 Automatic conflict resolution when typing simultaneously
- 📊 Live document statistics and version tracking
- 🌐 Connection status and reconnection handling

---

## 🗺️ **Roadmap**

### **Coming Soon** 🔜
- 📱 **Flutter SDK** - Mobile-first collaboration
- ⚛️ **Enhanced React Hooks** - Even simpler React integration
- 🎨 **Rich Text Support** - Collaborative formatting and styles
- 📁 **File Collaboration** - Share images, documents, and media
- 🔍 **Conflict Visualization** - See and resolve conflicts visually

### **Future Vision** 🌟
- 🤖 **AI-Powered Suggestions** - Smart auto-completion across users
- 🎮 **Game Engine Integration** - Multiplayer game state management
- 🏢 **Enterprise Features** - Advanced permissions, audit logs, compliance
- 🌍 **Edge Computing** - Global low-latency collaboration networks

---

## 🤝 **Contributing**

We'd love your help making RTCC even better! Here's how to get involved:

### **Quick Contributions** ⚡
- 🐛 **Report bugs** - Found an issue? Let us know!
- 💡 **Suggest features** - What would make your life easier?
- 📖 **Improve docs** - Help other developers get started faster
- ⭐ **Star the repo** - Show some love!

### **Code Contributions** 🛠️
```bash
# Fork and clone the repo
git clone https://github.com/yourusername/real-time-collaboration-sdk.git

# Create a feature branch
git checkout -b feature/amazing-new-feature

# Make your changes and add tests
npm test

# Submit a pull request
```

### **Areas We Need Help** 🙋‍♂️
- 📱 **Flutter SDK implementation**
- ⚛️ **React hooks and components**
- 🗄️ **Database persistence adapters**
- 🧪 **Test coverage expansion**
- 📚 **Documentation and examples**
- 🚀 **Performance optimizations**

---

## 💬 **Community & Support**

- 📚 **Documentation**: [rtcc-docs.com](https://rtcc-docs.com) *(coming soon)*
- 💬 **Discord**: [Join our community](https://discord.gg/rtcc) *(coming soon)*
- 🐛 **Issues**: [GitHub Issues](https://github.com/yourusername/real-time-collaboration-sdk/issues)
- 📧 **Email**: support@rtcc.dev *(coming soon)*

---

## 📄 **License**

MIT License - use it in your commercial projects, open source projects, wherever!

---

<div align="center">

**Built with ❤️ by developers, for developers**

*Real-time collaboration shouldn't be rocket science.*

[⭐ Star on GitHub](https://github.com/yourusername/real-time-collaboration-sdk) • [📖 Read the Docs](https://rtcc-docs.com) • [🚀 Try the Demo](https://demo.rtcc.dev)

</div>