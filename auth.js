document.addEventListener('DOMContentLoaded', async () => {
    const { isGoogleAuthenticated } = await chrome.storage.sync.get('isGoogleAuthenticated');
    if (isGoogleAuthenticated) {
        window.location.href = 'options.html';
        return;
    }

    const signInBtn = document.getElementById('sign-in-btn');
    const errorMsg = document.getElementById('error-msg');
    const btnLabel = signInBtn.querySelector('span');
    const originalLabel = btnLabel.textContent;

    signInBtn.addEventListener('click', async () => {
        signInBtn.disabled = true;
        btnLabel.textContent = 'Signing in…';
        errorMsg.classList.add('hidden');

        try {
            const response = await chrome.runtime.sendMessage({ action: 'authenticateGoogle' });
            if (response && response.success) {
                window.location.href = 'options.html';
            } else {
                showError(response?.error || 'Sign-in failed. Please try again.');
                signInBtn.disabled = false;
                btnLabel.textContent = originalLabel;
            }
        } catch {
            showError('Something went wrong. Please try again.');
            signInBtn.disabled = false;
            btnLabel.textContent = originalLabel;
        }
    });

    function showError(msg) {
        errorMsg.textContent = msg;
        errorMsg.classList.remove('hidden');
    }
});
