/**
 * Collaborative Text Editor Example
 * Demonstrates the Real-Time Collaboration Core SDK
 */

import { CollabClient, ConnectionState, UserPresence } from '@thesaasdevkit/rtc-client-web';
import { SharedText } from '@thesaasdevkit/rtc-core';

// Application state
let client: CollabClient | null = null;
let document: any = null;
let isConnected = false;
let isSyncing = false;

// DOM elements
const statusIndicator = document.getElementById('statusIndicator') as HTMLElement;
const statusText = document.getElementById('statusText') as HTMLElement;
const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement;
const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;
const editor = document.getElementById('editor') as HTMLTextAreaElement;
const documentTitle = document.getElementById('documentTitle') as HTMLInputElement;
const userList = document.getElementById('userList') as HTMLElement;
const versionStat = document.getElementById('versionStat') as HTMLElement;
const charsStat = document.getElementById('charsStat') as HTMLElement;
const wordsStat = document.getElementById('wordsStat') as HTMLElement;
const linesStat = document.getElementById('linesStat') as HTMLElement;

// Configuration
const SERVER_URL = 'ws://localhost:3001/ws';
const DOCUMENT_ID = 'example-doc-1';

/**
 * Initialize the application
 */
async function init(): Promise<void> {
  console.log('🚀 Initializing Collaborative Text Editor...');
  
  setupEventListeners();
  updateUI();
  
  // Auto-connect for demo purposes
  await connect();
}

/**
 * Set up event listeners
 */
function setupEventListeners(): void {
  // Connection button
  connectBtn.addEventListener('click', async () => {
    if (isConnected) {
      await disconnect();
    } else {
      await connect();
    }
  });

  // Clear button
  clearBtn.addEventListener('click', () => {
    if (document) {
      const sharedText = document.getText() as SharedText;
      sharedText.clear();
    }
  });

  // Editor changes
  let lastContent = '';
  editor.addEventListener('input', () => {
    if (!document || isSyncing) return;

    const currentContent = editor.value;
    const sharedText = document.getText() as SharedText;
    
    // Simple diff - in production, you'd use a more sophisticated algorithm
    if (currentContent !== lastContent) {
      const operations = sharedText.generateOperations(lastContent, currentContent);
      for (const operation of operations) {
        sharedText.apply(operation);
      }
      lastContent = currentContent;
    }
    
    updateStats();
  });

  // Document title changes
  documentTitle.addEventListener('input', () => {
    updateStats();
  });
}

/**
 * Connect to the collaboration server
 */
async function connect(): Promise<void> {
  try {
    console.log('🔌 Connecting to server...');
    updateStatus('Connecting...', false);

    // Create collaboration client
    client = new CollabClient({
      serverUrl: SERVER_URL,
      clientId: generateClientId(),
    });

    // Set up client event listeners
    setupClientEventListeners();

    // Connect to server
    await client.connect();
    
    // Open the document
    document = await client.openDocument(DOCUMENT_ID, {
      type: 'text',
      initialValue: '',
    });

    // Set up document event listeners
    setupDocumentEventListeners();

    isConnected = true;
    updateStatus('Connected', true);
    updateUI();

    console.log('✅ Connected successfully!');

  } catch (error) {
    console.error('❌ Connection failed:', error);
    updateStatus('Connection Failed', false);
    showError('Failed to connect to server. Make sure the server is running.');
  }
}

/**
 * Disconnect from the server
 */
async function disconnect(): Promise<void> {
  try {
    console.log('🔌 Disconnecting...');
    
    if (client) {
      client.disconnect();
      client = null;
    }
    
    document = null;
    isConnected = false;
    
    updateStatus('Disconnected', false);
    updateUI();
    clearUserList();
    
    console.log('👋 Disconnected');

  } catch (error) {
    console.error('❌ Disconnect error:', error);
  }
}

/**
 * Set up collaboration client event listeners
 */
function setupClientEventListeners(): void {
  if (!client) return;

  client.on('connectionStateChange', (state) => {
    console.log('🔄 Connection state:', state);
    
    switch (state) {
      case ConnectionState.CONNECTING:
        updateStatus('Connecting...', false);
        break;
      case ConnectionState.CONNECTED:
        updateStatus('Connected', true);
        break;
      case ConnectionState.RECONNECTING:
        updateStatus('Reconnecting...', false);
        break;
      case ConnectionState.DISCONNECTED:
        updateStatus('Disconnected', false);
        break;
      case ConnectionState.ERROR:
        updateStatus('Connection Error', false);
        break;
    }
  });

  client.on('error', (error) => {
    console.error('❌ Client error:', error);
    showError(`Error: ${error.message}`);
  });

  client.on('userJoined', (documentId, user) => {
    console.log('👤 User joined:', user);
    updateUserList();
  });

  client.on('userLeft', (documentId, user) => {
    console.log('👋 User left:', user);
    updateUserList();
  });

  client.on('presenceUpdate', (documentId, presence) => {
    console.log('📍 Presence update:', presence);
    updateUserList();
  });
}

/**
 * Set up document event listeners
 */
function setupDocumentEventListeners(): void {
  if (!document) return;

  document.on('change', (newValue: string, oldValue: string) => {
    console.log('📝 Document changed');
    
    // Update editor content without triggering input event
    isSyncing = true;
    if (editor.value !== newValue) {
      const cursorPosition = editor.selectionStart;
      editor.value = newValue;
      
      // Restore cursor position (simplified)
      editor.setSelectionRange(cursorPosition, cursorPosition);
    }
    isSyncing = false;
    
    updateStats();
  });

  document.on('synced', (version: number) => {
    console.log('🔄 Document synced, version:', version);
    updateStats();
  });

  document.on('userJoined', (user: UserPresence) => {
    console.log('👤 User joined document:', user);
    updateUserList();
  });

  document.on('userLeft', (user: UserPresence) => {
    console.log('👋 User left document:', user);
    updateUserList();
  });
}

/**
 * Update connection status
 */
function updateStatus(text: string, connected: boolean): void {
  statusText.textContent = text;
  statusIndicator.className = `status-indicator ${connected ? 'connected' : ''}`;
}

/**
 * Update UI state
 */
function updateUI(): void {
  connectBtn.textContent = isConnected ? 'Disconnect' : 'Connect';
  connectBtn.className = isConnected ? 'btn secondary' : 'btn';
  
  editor.disabled = !isConnected;
  clearBtn.disabled = !isConnected;
  
  if (!isConnected) {
    editor.value = '';
    editor.placeholder = 'Connect to start collaborating...';
  } else {
    editor.placeholder = 'Start typing to see real-time collaboration in action...';
  }
}

/**
 * Update statistics
 */
function updateStats(): void {
  const content = editor.value;
  const chars = content.length;
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const lines = content.split('\n').length;
  
  charsStat.textContent = chars.toString();
  wordsStat.textContent = words.toString();
  linesStat.textContent = lines.toString();
  
  if (document) {
    versionStat.textContent = document.currentVersion.toString();
  }
}

/**
 * Update user list
 */
function updateUserList(): void {
  if (!document) {
    userList.innerHTML = '<div class="loading">Not connected</div>';
    return;
  }

  const users = document.getUsers();
  
  if (users.length === 0) {
    userList.innerHTML = '<div class="loading">No users online</div>';
    return;
  }

  userList.innerHTML = users.map((user: UserPresence) => `
    <div class="user-item">
      <div class="user-avatar" style="background: ${generateUserColor(user.clientId)}">
        ${getUserInitials(user.name || user.clientId)}
      </div>
      <span>${user.name || `User ${user.clientId.substring(0, 8)}`}</span>
    </div>
  `).join('');
}

/**
 * Clear user list
 */
function clearUserList(): void {
  userList.innerHTML = '<div class="loading">Not connected</div>';
}

/**
 * Generate a unique client ID
 */
function generateClientId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).substring(2)}`;
}

/**
 * Generate user color based on client ID
 */
function generateUserColor(clientId: string): string {
  const colors = [
    '#2563eb', '#dc2626', '#059669', '#d97706',
    '#7c3aed', '#db2777', '#0891b2', '#65a30d'
  ];
  
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) {
    hash = clientId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Get user initials
 */
function getUserInitials(name: string): string {
  if (!name) return '?';
  
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  
  return name.substring(0, 2).toUpperCase();
}

/**
 * Show error message
 */
function showError(message: string): void {
  // Simple error display - in production, you'd use a proper notification system
  alert(message);
}

// Initialize the application when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}