(function () {
    if (getToken()) {
        window.location.replace('chat.html');
        return;
    }

    const form = document.getElementById('registerForm');
    const errorEl = document.getElementById('formError');
    const submitBtn = document.getElementById('submitBtn');

    function showError(message) {
        errorEl.textContent = message;
        errorEl.classList.add('visible');
    }

    function hideError() {
        errorEl.classList.remove('visible');
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideError();
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account…';

        const displayName = document.getElementById('displayName').value.trim();
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        try {
            const auth = await apiFetch('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, email, password, displayName: displayName || username }),
            });
            setSession(auth.token, auth.username);
            window.location.replace('chat.html');
        } catch (err) {
            showError(err.message || 'Could not create your account.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create account';
        }
    });
})();