// Background script
// Handles authentication, API calls, and communication between components

// Initialize extension when installed or updated
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Canvas to Google Calendar Sync extension installed');
  
  // Initialize default settings
  await chrome.storage.sync.set({
    canvasToken: '',
    isCanvasAuthenticated: false,
    isGoogleAuthenticated: false,
    selectedCalendarId: 'primary',
    syncFrequency: 'daily',
    lastSyncTime: null,
    syncHistory: []
  });
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  if (message.action === 'authenticateCanvas') {
    authenticateCanvas(message.token)
      .then(result => sendResponse({ success: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indicates async response
  }
  
  if (message.action === 'authenticateGoogle') {
    authenticateGoogle()
      .then(result => sendResponse({ success: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indicates async response
  }
  
  if (message.action === 'syncAssignments') {
    syncAssignmentsToCalendar()
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indicates async response
  }
});

// Canvas authentication function
async function authenticateCanvas(token) {
  try {
    // Validate the token by making a test API call
    const response = await fetch('https://your-canvas-instance.instructure.com/api/v1/users/self', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Canvas authentication failed: ${response.status}`);
    }
    
    // Store token if valid
    await chrome.storage.sync.set({
      canvasToken: token,
      isCanvasAuthenticated: true
    });
    
    return true;
  } catch (error) {
    console.error('Canvas authentication error:', error);
    return false;
  }
}

// Google authentication function
async function authenticateGoogle() {
  try {
    // Request Google OAuth token
    const token = await getGoogleAuthToken(true);
    if (!token) {
      throw new Error(chrome.runtime.lastError || 'Google authentication failed');
    }

    // Store authentication status and token
    await chrome.storage.sync.set({
      isGoogleAuthenticated: true,
      googleAuthToken: token
    });

    return true;
  } catch (error) {
    console.error('Google authentication error:', error);
    return false;
  }
}

// Helper to get Google OAuth token (for background API calls)
async function getGoogleAuthToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token);
      }
    });
  });
}

// Example: Use this helper in your sync function for background API calls
async function syncAssignmentsToCalendar() {
  try {
    const token = await getGoogleAuthToken(false); // non-interactive for background
    if (!token) throw new Error('No Google auth token available');

    // Example API call to Google Calendar
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await response.json();

    // ...process data as needed...

    return { message: 'Sync function not yet implemented', calendars: data };
  } catch (error) {
    console.error('Sync error:', error);
    return { message: 'Sync failed', error: error.toString() };
  }
}
