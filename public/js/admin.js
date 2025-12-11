// Admin Dashboard Logic

const state = {
    page: 1,
    limit: 20,
    total: 0,
    users: [],
    filters: {
        role: '',
        status: '',
        search: ''
    }
};

async function init() {
    // Auth Check
    const res = await fetch('/auth/me');
    if (!res.ok) {
        window.location.href = '/';
        return;
    }
    const user = await res.json();
    if (user.role !== 'admin') {
        alert('Access Denied');
        window.location.href = '/dashboard';
        return;
    }

    // Bind Events
    document.getElementById('searchInput').oninput = debounce((e) => {
        state.filters.search = e.target.value;
        state.page = 1;
        loadUsers();
    }, 500);

    document.getElementById('roleFilter').onchange = (e) => {
        state.filters.role = e.target.value;
        state.page = 1;
        loadUsers();
    };

    document.getElementById('statusFilter').onchange = (e) => {
        state.filters.status = e.target.value;
        state.page = 1;
        loadUsers();
    };

    document.getElementById('prevPage').onclick = () => {
        if (state.page > 1) {
            state.page--;
            loadUsers();
        }
    };

    document.getElementById('nextPage').onclick = () => {
        // simple check, ideally check total pages
        if (state.users.length === state.limit) {
            state.page++;
            loadUsers();
        }
    };

    loadUsers();
}

async function loadUsers() {
    const params = new URLSearchParams({
        page: state.page,
        limit: state.limit,
        ...state.filters
    });

    try {
        const res = await fetch(`/api/admin/users?${params}`);
        if (!res.ok) throw new Error('Failed to load users');
        const data = await res.json();
        state.users = data.users;
        state.total = data.total;
        renderTable();
        updatePagination();
    } catch (e) {
        console.error(e);
        alert(e.message);
    }
}

function renderTable() {
    const tbody = document.getElementById('userTableBody');
    tbody.innerHTML = '';

    state.users.forEach(user => {
        const tr = document.createElement('tr');

        const usedMB = ((user.total_storage_used || 0) / (1024 * 1024)).toFixed(1);
        const limitMB = ((user.storage_limit || 104857600) / (1024 * 1024)).toFixed(0);
        const percent = Math.min(100, ((user.total_storage_used || 0) / (user.storage_limit || 104857600)) * 100).toFixed(0);

        tr.innerHTML = `
            <td style="display:flex; gap: 10px; align-items: center;">
                <img src="${user.avatar_url}" style="width: 24px; height: 24px; border-radius: 50%;">
                <span>${user.username}</span>
                <span style="color: var(--text-muted); font-size: 0.75em;">(${user.github_id})</span>
            </td>
            <td>${user.role}</td>
            <td><span class="status-badge status-${user.status}">${user.status}</span></td>
            <td style="font-size: 0.8rem;">
                <div>${usedMB} / ${limitMB} MB</div>
                <div style="width: 100px; height: 4px; background: #333; margin-top: 4px; border-radius: 2px;">
                    <div style="width: ${percent}%; height: 100%; background: ${percent > 90 ? 'red' : 'var(--accent)'}; border-radius: 2px;"></div>
                </div>
            </td>
            <td>${new Date(user.created_at).toLocaleDateString()}</td>
            <td>
                ${getActionButtons(user)}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getActionButtons(user) {
    let btns = '';
    // Common actions (Quota)
    btns = `<button class="action-btn" onclick="updateQuota(${user.id}, ${user.storage_limit || 104857600})">Quota</button>` + btns;

    if (user.role === 'admin') return btns; // No status actions on admins

    if (user.status === 'pending') {
        btns += `<button class="action-btn" onclick="updateStatus(${user.id}, 'active')">Approve</button>`;
    }

    if (user.status === 'active') {
        btns += `<button class="action-btn" onclick="updateStatus(${user.id}, 'locked')">Lock</button>`;
    }

    if (user.status === 'locked') {
        btns += `<button class="action-btn" onclick="updateStatus(${user.id}, 'active')">Unlock</button>`;
    }

    return btns;
}

window.updateStatus = async (id, status) => {
    if (!confirm(`Set user status to ${status}?`)) return;
    try {
        const res = await fetch(`/api/admin/users/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (!res.ok) throw new Error(await res.text());
        loadUsers();
    } catch (e) {
        alert(e.message);
    }
};

window.updateQuota = async (id, currentBytes) => {
    const currentMB = Math.round(currentBytes / (1024 * 1024));
    const newMBStr = prompt(`Set storage limit (MB):`, currentMB);
    if (newMBStr === null) return;

    const newMB = parseInt(newMBStr);
    if (isNaN(newMB) || newMB < 0) {
        alert('Invalid number');
        return;
    }

    const newBytes = newMB * 1024 * 1024;

    try {
        const res = await fetch(`/api/admin/users/${id}/quota`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: newBytes })
        });
        if (!res.ok) throw new Error(await res.text());
        loadUsers();
    } catch (e) {
        alert(e.message);
    }
};

function updatePagination() {
    document.getElementById('pageInfo').innerText = `Page ${state.page} (Total: ${state.total})`;
    document.getElementById('prevPage').disabled = state.page === 1;
    document.getElementById('nextPage').disabled = (state.page * state.limit) >= state.total;
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

init();
