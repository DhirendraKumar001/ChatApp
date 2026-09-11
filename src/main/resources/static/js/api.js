/* Shared helpers for talking to the REST API and holding the session. */

const API_BASE = '/api';
const TOKEN_KEY = 'between_token';
const USERNAME_KEY = 'between_username';

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function getUsername() {
    return localStorage.getItem(USERNAME_KEY);
}

function setSession(token, username) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USERNAME_KEY, username);
}

function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
}

function requireSession() {
    if (!getToken()) {
        window.location.replace('login.html');
    }
}

function logout() {
    clearSession();
    window.location.replace('login.html');
}

/**
 * fetch wrapper that attaches the JWT, assumes/returns JSON, and redirects to
 * login if the server reports the session is no longer valid.
 */
async function apiFetch(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const token = getToken();
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }

    const res = await fetch(API_BASE + path, Object.assign({}, options, { headers }));

    if (res.status === 401) {
        clearSession();
        window.location.replace('login.html');
        throw new Error('Session expired');
    }

    if (!res.ok) {
        let message = 'Something went wrong. Please try again.';
        try {
            const body = await res.json();
            message = body.message || message;
        } catch (e) {
            /* response had no JSON body */
        }
        throw new Error(message);
    }

    if (res.status === 204) {
        return null;
    }
    return res.json();
}

function wsUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(getToken())}`;
}