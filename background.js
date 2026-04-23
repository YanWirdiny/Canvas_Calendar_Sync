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
    return true;
  }

  if (message.action === 'signOut') {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      const clearStorage = () =>
        chrome.storage.sync.set({
          isGoogleAuthenticated: false,
          googleAuthToken: '',
          isCanvasAuthenticated: false,
          canvasToken: ''
        }).then(() => sendResponse({ success: true }));

      if (token) {
        chrome.identity.removeCachedAuthToken({ token }, clearStorage);
      } else {
        clearStorage();
      }
    });
    return true;
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
    console.log('Starting sync of assignments to Google Tasks...');
    const assignments = await fetchCanvasAssignments();

    for (const assignment of assignments) {
      // Create a task for each assignment
      const taskDetails = {
        title: assignment.name || 'Untitled Assignment',
        notes: assignment.description || 'No description provided.',
        due: assignment.due_at || null // Use due_at if available, otherwise leave it null
      };

      console.log('Creating task for assignment:', taskDetails);
      await createGoogleTask(taskDetails);
    }

    console.log('All assignments synced successfully as tasks!');
  } catch (error) {
    console.error('Error syncing assignments to Google Tasks:', error);
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

// Function to create a Google Task
async function createGoogleTask(taskDetails) {
  try {
    // Get the Google OAuth token
    const token = await getGoogleAuthToken(false); // Use non-interactive mode for background calls
    if (!token) throw new Error('No Google auth token available');

    // Make the API call to create the task
    const response = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(taskDetails)
    });

    if (!response.ok) {
      throw new Error(`Failed to create task: ${response.status}`);
    }

    const task = await response.json();
    console.log('Task created successfully:', task);
    return task;
  } catch (error) {
    console.error('Error creating Google Task:', error);
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

    // Fetch all active courses (handle pagination)
    let courses = [];
    let nextPage = `https://${canvasDomain}/api/v1/courses?enrollment_state=active&include[]=term&include[]=total_students`;
    while (nextPage) {
      const response = await fetch(nextPage, {
        headers: {
          'Authorization': `Bearer ${canvasToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch courses: ${response.status}`);
      }

      const pageCourses = await response.json();
      courses = courses.concat(pageCourses);

      // Check for the "next" link in the response headers
      const linkHeader = response.headers.get('Link');
      nextPage = null;
      if (linkHeader) {
        const links = linkHeader.split(',');
        for (const link of links) {
          const [url, rel] = link.split(';');
          if (rel.includes('next')) {
            nextPage = url.trim().replace(/<|>/g, ''); // Extract the URL
          }
        }
      }
    }

    console.log('All active courses fetched from Canvas:', courses);

    // Filter out courses with access_restricted_by_date set to true
    const activeCourses = courses.filter(course => !course.access_restricted_by_date);
    console.log('Active courses (not restricted by date):', activeCourses);

    // Fetch assignments for each active course
    const assignments = [];
    for (const course of activeCourses) {
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
