// Options page functionality
document.addEventListener('DOMContentLoaded', async () => {
  // Auth guard: send unauthenticated users back to login
  const { isGoogleAuthenticated } = await chrome.storage.sync.get('isGoogleAuthenticated');
  if (!isGoogleAuthenticated) {
    window.location.href = chrome.runtime.getURL('auth.html');
    return;
  }

  // Get DOM elements
  const canvasDomainInput = document.getElementById('canvas-domain');
  const calendarSelect = document.getElementById('calendar-select');
  const syncFrequencySelect = document.getElementById('sync-frequency');
  const includeCompletedCheckbox = document.getElementById('include-completed');
  const overwriteExistingCheckbox = document.getElementById('overwrite-existing');
  const saveOptionsBtn = document.getElementById('save-options-btn');
  const resetOptionsBtn = document.getElementById('reset-options-btn');
  const signOutBtn = document.getElementById('sign-out-btn');
  const statusMessage = document.getElementById('status-message');

  // Fetch calendars from Google
  try {
    const calendars = await chrome.runtime.sendMessage({ action: 'fetchGoogleCalendars' });
    calendars.forEach((calendar) => {
      const option = document.createElement('option');
      option.value = calendar.id;
      option.textContent = calendar.summary;
      calendarSelect.appendChild(option);
    });

    // Load the saved calendar ID
    const { selectedCalendarId } = await chrome.storage.sync.get('selectedCalendarId');
    calendarSelect.value = selectedCalendarId || 'primary';
  } catch (error) {
    console.error('Error loading calendars:', error);
  }

  // Load current options
  loadOptions();

  // Add event listeners
  saveOptionsBtn.addEventListener('click', saveOptions);
  resetOptionsBtn.addEventListener('click', resetOptions);
  signOutBtn.addEventListener('click', async () => {
    try { await chrome.runtime.sendMessage({ action: 'signOut' }); } catch { /* ignore */ }
    window.location.href = chrome.runtime.getURL('auth.html');
  });

  // Load options from storage
  async function loadOptions() {
    try {
      const options = await chrome.storage.sync.get({
        canvasDomain: '',
        selectedCalendarId: 'primary',
        syncFrequency: 'daily',
        includeCompleted: false,
        overwriteExisting: false
      });

      // Populate form fields
      canvasDomainInput.value = options.canvasDomain;
      calendarSelect.value = options.selectedCalendarId;
      syncFrequencySelect.value = options.syncFrequency;
      includeCompletedCheckbox.checked = options.includeCompleted;
      overwriteExistingCheckbox.checked = options.overwriteExisting;
    } catch (error) {
      console.error('Error loading options:', error);
      showStatus('Error loading options', 'error');
    }
  }

  // Save options to storage
  async function saveOptions() {
    try {
      // Validate Canvas domain
      const domain = canvasDomainInput.value.trim();
      if (domain && !isValidDomain(domain)) {
        showStatus('Please enter a valid Canvas domain (e.g., yourschool.instructure.com)', 'error');
        return;
      }

      // Save options
      await chrome.storage.sync.set({
        canvasDomain: domain,
        selectedCalendarId: calendarSelect.value,
        syncFrequency: syncFrequencySelect.value,
        includeCompleted: includeCompletedCheckbox.checked,
        overwriteExisting: overwriteExistingCheckbox.checked
      });

      showStatus('Options saved successfully!', 'success');
      
      // If Canvas domain changed, clear authentication
      if (domain) {
        const currentAuth = await chrome.storage.sync.get(['canvasDomain', 'isCanvasAuthenticated']);
        if (currentAuth.canvasDomain !== domain && currentAuth.isCanvasAuthenticated) {
          await chrome.storage.sync.set({
            isCanvasAuthenticated: false,
            canvasToken: ''
          });
          showStatus('Canvas domain changed. Please re-authenticate Canvas in the popup.', 'success');
        }
      }
    } catch (error) {
      console.error('Error saving options:', error);
      showStatus('Error saving options', 'error');
    }
  }

  // Reset options to defaults
  async function resetOptions() {
    if (confirm('Are you sure you want to reset all options to defaults?')) {
      try {
        await chrome.storage.sync.set({
          canvasDomain: '',
          selectedCalendarId: 'primary',
          syncFrequency: 'daily',
          includeCompleted: false,
          overwriteExisting: false
        });

        // Reload the form
        loadOptions();
        showStatus('Options reset to defaults', 'success');
      } catch (error) {
        console.error('Error resetting options:', error);
        showStatus('Error resetting options', 'error');
      }
    }
  }

  // Show status message
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.classList.remove('hidden');

    // Hide after 3 seconds
    setTimeout(() => {
      statusMessage.classList.add('hidden');
    }, 3000);
  }

  // Validate domain format
  function isValidDomain(domain) {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_.]*[a-zA-Z0-9]$/;
    return domainRegex.test(domain) && !domain.startsWith('http');
  }
});