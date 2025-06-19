# RTCC Examples

This package contains example applications demonstrating the Real-Time Collaboration Core SDK.

## Collaborative Text Editor

A simple collaborative text editor that demonstrates real-time text synchronization, user presence, and conflict resolution.

### Features

- ✅ Real-time text synchronization
- ✅ User presence indicators
- ✅ Automatic conflict resolution
- ✅ Connection status monitoring
- ✅ Document statistics
- ✅ Simple and clean UI

### Running the Example

1. **Start the collaboration server:**
   ```bash
   npm run start:server
   ```

2. **Start the web application:**
   ```bash
   npm run dev
   ```

3. **Open multiple browser tabs** to see real-time collaboration in action.

### How It Works

1. **Connection**: The client connects to the WebSocket server running on `localhost:3001`
2. **Document**: Opens a shared document with ID `example-doc-1`
3. **Real-time Sync**: All text changes are synchronized via operational transformation
4. **Presence**: Shows which users are currently online and editing
5. **Conflict Resolution**: Multiple users can type simultaneously without conflicts

### Architecture

```
Browser Client 1 ─┐
                  ├─ WebSocket ─ Collaboration Server ─ Document State
Browser Client 2 ─┘
```

### Key Components

- **CollabClient**: Main client for connecting to the server
- **SharedText**: Collaborative text data type with OT
- **WebSocket Transport**: Real-time communication layer
- **Document Manager**: Server-side document coordination
- **Operation Transform**: Conflict resolution algorithms

### Customization

You can modify the example to:

- Change the server URL in `src/main.ts`
- Add authentication (see server configuration)
- Implement cursor position sharing
- Add rich text formatting
- Create different document types (lists, maps)

## Next Steps

This example demonstrates the core concepts of RTCC. For production use, consider:

- Adding proper error handling
- Implementing authentication and authorization
- Adding persistence for document storage
- Optimizing for larger documents
- Adding more sophisticated presence features