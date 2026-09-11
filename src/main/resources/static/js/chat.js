(function () {
    requireSession();

    const meLabel = document.getElementById('meLabel');
    const logoutBtn = document.getElementById('logoutBtn');
    const userList = document.getElementById('userList');
    const threadEmpty = document.getElementById('threadEmpty');
    const threadActive = document.getElementById('threadActive');
    const threadTitle = document.getElementById('threadTitle');
    const messageList = document.getElementById('messageList');
    const composerForm = document.getElementById('composerForm');
    const composerInput = document.getElementById('composerInput');
    const backBtn = document.getElementById('backBtn');
    const connectionNote = document.getElementById('connectionNote');

    const me = getUsername();
    meLabel.textContent = me;
    logoutBtn.addEventListener('click', logout);

    let currentPeer = null;
    const renderedIds = new Set();
    const unread = new Set();
    let stompClient = null;

    // ---------- People list ----------

    function initials(name) {
        return (name || '?').trim().charAt(0).toUpperCase();
    }

    function renderUserList(users) {
        userList.innerHTML = '';

        if (users.length === 0) {
            const note = document.createElement('li');
            note.className = 'empty-list-note';
            note.textContent = 'No one else has joined yet.';
            userList.appendChild(note);
            return;
        }

        users.forEach((user) => {
            const li = document.createElement('li');

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'user-item';
            btn.dataset.username = user.username;
            if (user.username === currentPeer) btn.classList.add('active');

            const avatar = document.createElement('span');
            avatar.className = 'avatar';
            avatar.textContent = initials(user.displayName || user.username);

            const name = document.createElement('span');
            name.className = 'user-item-name';
            name.textContent = user.displayName || user.username;

            btn.appendChild(avatar);
            btn.appendChild(name);

            if (unread.has(user.username)) {
                const dot = document.createElement('span');
                dot.className = 'unread-dot';
                btn.appendChild(dot);
            }

            btn.addEventListener('click', () => openConversation(user.username, user.displayName || user.username));

            li.appendChild(btn);
            userList.appendChild(li);
        });
    }

    async function loadUsers() {
        const users = await apiFetch('/users');
        renderUserList(users);
    }

    // ---------- Conversation ----------

    async function openConversation(username, label) {
        currentPeer = username;
        unread.delete(username);

        document.querySelectorAll('.user-item').forEach((el) => {
            el.classList.toggle('active', el.dataset.username === username);
        });
        document.querySelectorAll('.unread-dot').forEach((dot) => {
            if (dot.closest('.user-item').dataset.username === username) dot.remove();
        });

        threadEmpty.style.display = 'none';
        threadActive.style.display = 'flex';
        threadTitle.textContent = label;
        document.body.classList.add('chat-open');

        messageList.innerHTML = '';
        renderedIds.clear();

        try {
            const page = await apiFetch(`/messages/${encodeURIComponent(username)}?page=0&size=50`);
            const chronological = page.content.slice().reverse();
            chronological.forEach(upsertMessage);
            scrollToBottom();
        } catch (err) {
            messageList.textContent = err.message || 'Could not load this conversation.';
        }

        composerInput.focus();
    }

    backBtn.addEventListener('click', () => {
        document.body.classList.remove('chat-open');
    });

    function scrollToBottom() {
        messageList.scrollTop = messageList.scrollHeight;
    }

    function formatTime(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function belongsToOpenThread(message) {
        return currentPeer !== null &&
            (message.senderUsername === currentPeer || message.receiverUsername === currentPeer);
    }

    // ---------- Message rendering ----------

    function buildBubble(message) {
        const mine = message.senderUsername === me;

        const row = document.createElement('div');
        row.className = 'bubble-row ' + (mine ? 'mine' : 'theirs');
        row.id = 'msg-' + message.id;
        row.dataset.id = message.id;

        const bubble = document.createElement('div');
        bubble.className = 'bubble';

        const content = document.createElement('div');
        content.className = 'bubble-content';
        content.textContent = message.content;

        const meta = document.createElement('div');
        meta.className = 'bubble-meta';
        const timeSpan = document.createElement('span');
        timeSpan.textContent = formatTime(message.sentAt);
        meta.appendChild(timeSpan);
        if (message.edited) {
            const editedSpan = document.createElement('span');
            editedSpan.textContent = 'edited';
            editedSpan.style.fontStyle = 'italic';
            meta.appendChild(editedSpan);
        }

        const actions = document.createElement('div');
        actions.className = 'bubble-actions';

        if (mine) {
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'icon-btn';
            editBtn.title = 'Edit message';
            editBtn.textContent = '✎';
            editBtn.addEventListener('click', () => startEdit(row, message));
            actions.appendChild(editBtn);
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'icon-btn danger';
        deleteBtn.title = 'Delete from my profile';
        deleteBtn.textContent = '🗑';
        deleteBtn.addEventListener('click', () => deleteMessage(message.id));
        actions.appendChild(deleteBtn);

        bubble.appendChild(actions);
        bubble.appendChild(content);
        bubble.appendChild(meta);
        row.appendChild(bubble);
        return row;
    }

    /** Creates or updates a message bubble by id - safe to call for both new and already-rendered messages. */
    function upsertMessage(message) {
        if (!belongsToOpenThread(message) && currentPeer !== null) {
            // Message is for a different conversation than the one currently open.
            const other = message.senderUsername === me ? message.receiverUsername : message.senderUsername;
            if (other !== currentPeer) {
                flagUnread(other);
                return;
            }
        }

        const existing = document.getElementById('msg-' + message.id);
        const fresh = buildBubble(message);

        if (existing) {
            existing.replaceWith(fresh);
        } else {
            messageList.appendChild(fresh);
            scrollToBottom();
        }
        renderedIds.add(message.id);
    }

    function removeMessageEl(id) {
        const el = document.getElementById('msg-' + id);
        if (el) el.remove();
        renderedIds.delete(Number(id));
    }

    function flagUnread(username) {
        unread.add(username);
        const item = document.querySelector(`.user-item[data-username="${CSS.escape(username)}"]`);
        if (item && !item.querySelector('.unread-dot')) {
            const dot = document.createElement('span');
            dot.className = 'unread-dot';
            item.appendChild(dot);
        }
    }

    // ---------- Edit / delete ----------

    function startEdit(row, message) {
        const bubble = row.querySelector('.bubble');
        const content = bubble.querySelector('.bubble-content');
        const original = content.textContent;

        const editRow = document.createElement('div');
        editRow.className = 'edit-row';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = original;

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'icon-btn';
        saveBtn.textContent = '✓';
        saveBtn.title = 'Save';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'icon-btn';
        cancelBtn.textContent = '✕';
        cancelBtn.title = 'Cancel';

        editRow.appendChild(input);
        editRow.appendChild(saveBtn);
        editRow.appendChild(cancelBtn);

        content.style.display = 'none';
        bubble.appendChild(editRow);
        input.focus();
        input.select();

        function close() {
            editRow.remove();
            content.style.display = '';
        }

        cancelBtn.addEventListener('click', close);

        async function save() {
            const newContent = input.value.trim();
            if (!newContent || newContent === original) {
                close();
                return;
            }
            try {
                const updated = await apiFetch(`/messages/${message.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ content: newContent }),
                });
                upsertMessage(updated);
            } catch (err) {
                alert(err.message || 'Could not save the edit.');
                close();
            }
        }

        saveBtn.addEventListener('click', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); save(); }
            if (e.key === 'Escape') close();
        });
    }

    async function deleteMessage(id) {
        if (!confirm('Remove this message from your view? The other person will still see it.')) return;
        try {
            await apiFetch(`/messages/${id}`, { method: 'DELETE' });
            removeMessageEl(id);
        } catch (err) {
            alert(err.message || 'Could not delete this message.');
        }
    }

    // ---------- Sending ----------

    composerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const content = composerInput.value.trim();
        if (!content || !currentPeer) return;

        composerInput.value = '';
        composerInput.style.height = 'auto';

        const payload = { receiverUsername: currentPeer, content };

        if (stompClient && stompClient.connected) {
            stompClient.send('/app/chat.send', {}, JSON.stringify(payload));
        } else {
            try {
                const created = await apiFetch('/messages', { method: 'POST', body: JSON.stringify(payload) });
                upsertMessage(created);
            } catch (err) {
                alert(err.message || 'Could not send that message.');
            }
        }
    });

    composerInput.addEventListener('input', () => {
        composerInput.style.height = 'auto';
        composerInput.style.height = Math.min(composerInput.scrollHeight, 120) + 'px';
    });

    // ---------- Real-time (WebSocket / STOMP) ----------

    function setConnectionNote(text) {
        connectionNote.textContent = text;
    }

    function connectRealtime() {
        const socket = new WebSocket(wsUrl());
        stompClient = Stomp.over(socket);
        stompClient.debug = null; // silence verbose frame logging

        stompClient.connect(
            {},
            () => {
                setConnectionNote('Live');

                stompClient.subscribe('/user/queue/messages', (frame) => {
                    upsertMessage(JSON.parse(frame.body));
                });

                stompClient.subscribe('/user/queue/messages.updated', (frame) => {
                    upsertMessage(JSON.parse(frame.body));
                });

                stompClient.subscribe('/user/queue/messages.deleted', (frame) => {
                    removeMessageEl(frame.body);
                });

                stompClient.subscribe('/user/queue/errors', (frame) => {
                    alert(frame.body);
                });
            },
            () => {
                setConnectionNote('Reconnecting…');
                setTimeout(connectRealtime, 3000);
            }
        );
    }

    // ---------- Boot ----------

    loadUsers().catch((err) => {
        userList.innerHTML = '';
        const note = document.createElement('li');
        note.className = 'empty-list-note';
        note.textContent = err.message || 'Could not load people to message.';
        userList.appendChild(note);
    });

    connectRealtime();
})();