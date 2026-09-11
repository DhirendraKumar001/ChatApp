(function () {
    if (getToken()) {
        window.location.replace('chat.html');
        return;
    }

    const form = document.getElementById('loginForm');
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
        submitBtn.textContent = 'Signing in…';

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        try {
            const auth = await apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password }),
            });
            setSession(auth.token, auth.username);
            window.location.replace('chat.html');
        } catch (err) {
            showError(err.message || 'Could not sign in. Check your username and password.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign in';
        }
    });
})();