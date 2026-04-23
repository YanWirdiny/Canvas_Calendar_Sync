document.addEventListener('DOMContentLoaded', async () => {
    // Auth guard: redirect to login page if not signed in with Google
    const { isGoogleAuthenticated } = await chrome.storage.sync.get('isGoogleAuthenticated');
    if (!isGoogleAuthenticated) {
        chrome.tabs.create({ url: chrome.runtime.getURL('auth.html') });
        window.close();
        return;
    }

    const canvasStatus = document.getElementById('canvas-status');
    const canvasTokenInput = document.getElementById('canvas-token');
    const authCanvasBtn = document.getElementById('auth-canvas-btn');
    const syncNowBtn = document.getElementById('sync-now-btn');
    const lastSyncTime = document.getElementById('last-sync-time');
    const openOptionsBtn = document.getElementById('open-options-btn');
    const signOutBtn = document.getElementById('sign-out-btn');

    loadState();

    authCanvasBtn.addEventListener('click', handleCanvasAuth);
    syncNowBtn.addEventListener('click', handleSync);
    openOptionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
    signOutBtn.addEventListener('click', handleSignOut);

    async function loadState() {
        const data = await chrome.storage.sync.get([
            'isCanvasAuthenticated',
            'lastSyncTime'
        ]);

        updateCanvasStatus(data.isCanvasAuthenticated);
        syncNowBtn.disabled = !data.isCanvasAuthenticated;

        if (data.lastSyncTime) {
            lastSyncTime.textContent = new Date(data.lastSyncTime).toLocaleString();
        }
    }

    async function handleCanvasAuth() {
        const token = canvasTokenInput.value.trim();
        if (!token) {
            updateCanvasStatus(false, 'Please enter a valid API token');
            return;
        }

        authCanvasBtn.disabled = true;
        authCanvasBtn.textContent = 'Authenticating…';

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'authenticateCanvas',
                token
            });

            if (response.success) {
                updateCanvasStatus(true);
                canvasTokenInput.value = '';
                syncNowBtn.disabled = false;
            } else {
                updateCanvasStatus(false, response.error || 'Authentication failed');
            }
        } catch (error) {
            updateCanvasStatus(false, error.message);
        } finally {
            authCanvasBtn.disabled = false;
            authCanvasBtn.textContent = 'Authenticate';
        }
    }

    async function handleSync() {
        syncNowBtn.disabled = true;
        syncNowBtn.textContent = 'Syncing…';

        try {
            const response = await chrome.runtime.sendMessage({ action: 'syncAssignments' });
            if (response.success) {
                const now = new Date().toISOString();
                lastSyncTime.textContent = new Date(now).toLocaleString();
                await chrome.storage.sync.set({ lastSyncTime: now });
            }
        } catch (error) {
            console.error('Sync error:', error);
        } finally {
            syncNowBtn.disabled = false;
            syncNowBtn.textContent = 'Sync Now';
        }
    }

    async function handleSignOut() {
        signOutBtn.disabled = true;
        signOutBtn.textContent = 'Signing out…';

        try {
            await chrome.runtime.sendMessage({ action: 'signOut' });
        } catch {
            // Ignore — storage is cleared regardless
        }

        chrome.tabs.create({ url: chrome.runtime.getURL('auth.html') });
        window.close();
    }

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
});
