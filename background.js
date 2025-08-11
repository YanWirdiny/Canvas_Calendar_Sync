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

  if (message.action === 'fetchGoogleCalendars') {
    fetchGoogleCalendars()
      .then((calendars) => sendResponse(calendars))
      .catch((error) => sendResponse({ error: error.message }));
    return true; // Indicates async response
  }
});

// Canvas authentication function
async function authenticateCanvas(token) {
  try {
    // Get the Canvas domain from storage
    const { canvasDomain } = await chrome.storage.sync.get('canvasDomain');
    console.log('Canvas Domain:', canvasDomain);
    if (!canvasDomain) {
      throw new Error('Canvas domain is not set. Please configure it in the options page.');
    }

    // Validate the token by making a test API call
    const response = await fetch(`https://${canvasDomain}/api/v1/users/self`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('API Response Status:', response.status);
    console.log('API Response Body:', await response.text());

    if (!response.ok) {
      throw new Error(`Canvas authentication failed: ${response.status}`);
    }

    // Store token if valid
    await chrome.storage.sync.set({
      canvasToken: token,
      isCanvasAuthenticated: true
    });

    return true; // Authentication successful
  } catch (error) {
    console.error('Canvas authentication error:', error);

    // Clear previous authentication data
    await chrome.storage.sync.set({
      canvasToken: '',
      isCanvasAuthenticated: false
    });

    return false; // Authentication failed
  }
}

// Google authentication function
async function authenticateGoogle() {
  console.log('authenticateGoogle function called');
  try {
    const token = await getGoogleAuthToken(true); // Interactive mode
    if (!token) {
      throw new Error(chrome.runtime.lastError || 'Google authentication failed');
    }

    console.log('Google OAuth token:', token);

    // Save the token in storage
    await chrome.storage.sync.set({
      isGoogleAuthenticated: true,
      googleAuthToken: token
    });

    console.log('Google authentication successful');
    return true;
  } catch (error) {
    console.error('Google authentication error:', error);
    return false;
  }
}

// Helper to get Google OAuth token (for background API calls)
async function getGoogleAuthToken(interactive = false) {
  console.log('getGoogleAuthToken called with interactive:', interactive);
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        console.error('Error getting auth token:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError || 'Failed to get auth token');
      } else {
        console.log('Google OAuth token retrieved:', token);
        resolve(token);
      }
    });
  });
}

// Example: Use this helper in your sync function for background API calls
async function syncAssignmentsToCalendar() {
  try {
    console.log('Starting sync of assignments to Google Calendar...');
    const assignments = await fetchCanvasAssignments();

    if (assignments.length === 0) {
      console.log('No assignments found in Canvas.');
      return { message: 'No assignments to sync' }; // Return a message indicating no assignments
    }

    for (const assignment of assignments) {
      const eventDetails = {
        summary: assignment.name,
        description: assignment.description || 'No description provided.',
        start: {
          dateTime: assignment.due_at, // Ensure this is in ISO 8601 format
          timeZone: 'America/New_York' // Adjust as needed
        },
        end: {
          dateTime: assignment.due_at, // Example: Use the same time for start and end
          timeZone: 'America/New_York'
        }
      };

      await createGoogleCalendarEvent(eventDetails);
    }

    console.log('All assignments synced successfully!');
    return { message: 'Sync completed successfully' };
  } catch (error) {
    console.error('Error syncing assignments to Google Calendar:', error);
    return { message: 'Sync failed', error: error.toString() };
  }
}

// Function to create a Google Calendar event
async function createGoogleCalendarEvent(eventDetails) {
  try {
    // Get the Google OAuth token
    const token = await getGoogleAuthToken(false); // Use non-interactive mode for background calls
    if (!token) throw new Error('No Google auth token available');

    // Get the selected calendar ID from storage
    const { selectedCalendarId } = await chrome.storage.sync.get('selectedCalendarId');
    const calendarId = selectedCalendarId || 'primary'; // Default to primary calendar if none is selected

    // Make the API call to create the event
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventDetails)
    });

    if (!response.ok) {
      throw new Error(`Failed to create event: ${response.status}`);
    }

    const event = await response.json();
    console.log('Event created successfully:', event);
    return event;
  } catch (error) {
    console.error('Error creating Google Calendar event:', error);
    throw error;
  }
}

// Function to fetch assignments from Canvas
async function fetchCanvasAssignments() {
  try {
    // Get Canvas domain and token from storage
    const { canvasDomain, canvasToken } = await chrome.storage.sync.get(['canvasDomain', 'canvasToken']);
    if (!canvasDomain || !canvasToken) {
      throw new Error('Canvas domain or token is missing');
    }

    // Fetch the list of courses
    const coursesResponse = await fetch(`https://${canvasDomain}/api/v1/courses`, {
      headers: {
        'Authorization': `Bearer ${canvasToken}`
      }
    });

    if (!coursesResponse.ok) {
      throw new Error(`Failed to fetch courses: ${coursesResponse.status}`);
    }

    const courses = await coursesResponse.json();
    console.log('Courses fetched from Canvas:', courses);

    // Fetch assignments for each course
    const assignments = [];
    for (const course of courses) {
      try {
        const assignmentsResponse = await fetch(`https://${canvasDomain}/api/v1/courses/${course.id}/assignments`, {
          headers: {
            'Authorization': `Bearer ${canvasToken}`
          }
        });

        if (assignmentsResponse.ok) {
          const courseAssignments = await assignmentsResponse.json();
          console.log(`Assignments for course ${course.id}:`, courseAssignments);
          assignments.push(...courseAssignments);
        } else {
          console.warn(`Failed to fetch assignments for course ${course.id}: ${assignmentsResponse.status}`);
        }
      } catch (error) {
        console.error(`Error fetching assignments for course ${course.id}:`, error);
      }
    }

    console.log('All assignments fetched from Canvas:', assignments);
    return assignments;
  } catch (error) {
    console.error('Error fetching Canvas assignments:', error);
    throw error;
  }
}

// Function to fetch Google Calendars
async function fetchGoogleCalendars() {
  try {
    // Get the Google OAuth token
    const token = await getGoogleAuthToken(false); // Use non-interactive mode for background calls
    if (!token) throw new Error('No Google auth token available');

    // Fetch the list of calendars
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch calendars: ${response.status}`);
    }

    const data = await response.json();
    console.log('Google Calendars:', data.items);
    return data.items; // List of calendars
  } catch (error) {
    console.error('Error fetching Google Calendars:', error);
    throw error;
  }
}
