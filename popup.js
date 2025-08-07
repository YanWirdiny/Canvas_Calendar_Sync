// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  const canvasStatus = document.getElementById('canvas-status');
  const googleStatus = document.getElementById('google-status');
  const canvasTokenInput = document.getElementById('canvas-token');
  const authCanvasBtn = document.getElementById('auth-canvas-btn');
  const authGoogleBtn = document.getElementById('auth-google-btn');
  const syncNowBtn = document.getElementById('sync-now-btn');
  const lastSyncTime = document.getElementById('last-sync-time');
  const openOptionsBtn = document.getElementById('open-options-btn');
  
  // Load current state
  loadState();
  
  // Add event listeners
  authCanvasBtn.addEventListener('click', handleCanvasAuth);
  authGoogleBtn.addEventListener('click', () => {
    chrome.identity.getAuthToken({ interactive: true }, function(token) {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        // Show error to user
        return;
      }
      // Save token or notify background.js
      console.log('Google OAuth token:', token);
      // You can now use this token to call Google Calendar API
    });
  });
  syncNowBtn.addEventListener('click', handleSync);
  openOptionsBtn.addEventListener('click', openOptions);
  
  // Load current state from storage
  async function loadState() {
    const data = await chrome.storage.sync.get([
      'isCanvasAuthenticated', 
      'isGoogleAuthenticated',
      'lastSyncTime'
    ]);
    
    // Update UI based on auth status
    updateCanvasStatus(data.isCanvasAuthenticated);
    updateGoogleStatus(data.isGoogleAuthenticated);
    
    // Update sync button status
    syncNowBtn.disabled = !(data.isCanvasAuthenticated && data.isGoogleAuthenticated);
    
    // Update last sync time
    if (data.lastSyncTime) {
      lastSyncTime.textContent = new Date(data.lastSyncTime).toLocaleString();
    } else {
      lastSyncTime.textContent = 'Never';
    }
  }
  
  // Handle Canvas authentication
  async function handleCanvasAuth() {
    const token = canvasTokenInput.value.trim();
    
    if (!token) {
      updateCanvasStatus(false, 'Please enter a valid API token');
      return;
    }
    
    // Show loading state
    authCanvasBtn.disabled = true;
    authCanvasBtn.textContent = 'Authenticating...';
    
    try {
      // Send authentication request to background script
      const response = await chrome.runtime.sendMessage({
        action: 'authenticateCanvas',
        token: token
      });
      
      if (response.success) {
        updateCanvasStatus(true);
        // Clear input for security
        canvasTokenInput.value = '';
      } else {
        updateCanvasStatus(false, response.error || 'Authentication failed');
      }
    } catch (error) {
      updateCanvasStatus(false, error.message);
    } finally {
      // Reset button
      authCanvasBtn.disabled = false;
      authCanvasBtn.textContent = 'Authenticate';
      // Check if sync button should be enabled
      updateSyncButton();
    }
  }
  
  // Handle Google authentication
  async function handleGoogleAuth() {
    // Show loading state
    authGoogleBtn.disabled = true;
    authGoogleBtn.textContent = 'Connecting...';
    
    try {
      // Send authentication request to background script
      const response = await chrome.runtime.sendMessage({
        action: 'authenticateGoogle'
      });
      
      if (response.success) {
        updateGoogleStatus(true);
      } else {
        updateGoogleStatus(false, response.error || 'Authentication failed');
      }
    } catch (error) {
      updateGoogleStatus(false, error.message);
    } finally {
      // Reset button
      authGoogleBtn.disabled = false;
      authGoogleBtn.textContent = 'Connect Google Calendar';
      // Check if sync button should be enabled
      updateSyncButton();
    }
  }
  
  // Handle sync action
  async function handleSync() {
    // Show loading state
    syncNowBtn.disabled = true;
    syncNowBtn.textContent = 'Syncing...';
    
    try {
      // Send sync request to background script
      const response = await chrome.runtime.sendMessage({
        action: 'syncAssignments'
      });
      
      if (response.success) {
        // Update UI with success message
        lastSyncTime.textContent = new Date().toLocaleString();
        // Update storage
        await chrome.storage.sync.set({ lastSyncTime: new Date().toISOString() });
      } else {
        console.error('Sync failed:', response.error);
        // Could display error in UI
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      // Reset button
      syncNowBtn.disabled = false;
      syncNowBtn.textContent = 'Sync Now';
    }
  }
  
  // Open options page
  function openOptions() {
    chrome.runtime.openOptionsPage();
  }
  
  // Update Canvas authentication status in UI
  function updateCanvasStatus(isAuthenticated, errorMsg = '') {
    if (isAuthenticated) {
      canvasStatus.textContent = 'Connected';
      canvasStatus.className = 'status connected';
      document.getElementById('canvas-auth-form').style.display = 'none';
    } else {
      canvasStatus.textContent = errorMsg || 'Not connected';
      canvasStatus.className = 'status' + (errorMsg ? ' error' : '');
      document.getElementById('canvas-auth-form').style.display = 'block';
    }
  }
  
  // Update Google authentication status in UI
  function updateGoogleStatus(isAuthenticated, errorMsg = '') {
    if (isAuthenticated) {
      googleStatus.textContent = 'Connected';
      googleStatus.className = 'status connected';
    } else {
      googleStatus.textContent = errorMsg || 'Not connected';
      googleStatus.className = 'status' + (errorMsg ? ' error' : '');
    }
  }
  
  // Update sync button enabled state
  async function updateSyncButton() {
    const data = await chrome.storage.sync.get([
      'isCanvasAuthenticated', 
      'isGoogleAuthenticated'
    ]);
    
    syncNowBtn.disabled = !(data.isCanvasAuthenticated && data.isGoogleAuthenticated);
  }
});
