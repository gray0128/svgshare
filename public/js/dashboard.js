// Dashboard Logic

const state = {
    user: null,
    files: []
};

async function init() {
    // 1. Check Auth
    try {
        const res = await fetch('/auth/me');
        if (!res.ok) {
            window.location.href = '/';
            return;
        }
        state.user = await res.json();

        // Check Status
        if (state.user.status === 'locked') {
            renderLocked();
            return;
        }

        // Render Header User Info (includes Logout & Admin Link)
        renderUser();
        renderStorage();

        if (state.user.status === 'pending') {
            renderPending();
            return;
        }

        loadFiles();
    } catch (e) {
        console.error(e);
        window.location.href = '/';
    }

    // 2. Setup Upload
    setupUpload();
}

function renderUser() {
    const container = document.getElementById('userInfo');
    const isAdmin = state.user.role === 'admin';

    container.innerHTML = `
        <div class="user-menu-container">
            <span style="font-size: 0.9rem;">${state.user.username}</span>
            <img src="${state.user.avatar_url}" class="avatar" alt="${state.user.username}">
            
            <div class="user-menu-dropdown">
                ${isAdmin ? `
                <a href="/admin.html" class="user-menu-item highlight">
                    <span class="material-symbols-outlined" style="font-size:18px">admin_panel_settings</span>
                    Admin Dashboard
                </a>
                ` : ''}
                <button onclick="location.href='/auth/logout'" class="user-menu-item danger">
                    <span class="material-symbols-outlined" style="font-size:18px">logout</span>
                    Logout
                </button>
            </div>
        </div>
    `;
}

function renderStorage() {
    const widget = document.getElementById('storageWidget');
    if (!widget) return;

    // Limits and Usage are in bytes. Convert to MB.
    const usedBytes = state.user.storage_usage || 0;
    const limitBytes = state.user.storage_limit || 104857600;

    const usedMB = (usedBytes / (1024 * 1024)).toFixed(1);
    const limitMB = (limitBytes / (1024 * 1024)).toFixed(0);

    const percent = Math.min(100, Math.max(0, (usedBytes / limitBytes) * 100));

    document.getElementById('storageText').innerText = `${usedMB} MB / ${limitMB} MB`;
    document.getElementById('storageBar').style.width = `${percent}%`;

    // Color warnings
    const bar = document.getElementById('storageBar');
    if (percent > 90) bar.style.background = '#ff4444';
    else if (percent > 70) bar.style.background = 'orange';
    else bar.style.background = 'var(--accent)';

    widget.style.display = 'block';
}

function renderLocked() {
    renderUser(); // Show user info so they can logout
    const main = document.querySelector('.main-content');
    main.innerHTML = `
        <div style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted); text-align: center;">
            <span class="material-symbols-outlined" style="font-size: 64px; color: var(--accent); margin-bottom: 20px;">lock</span>
            <h1 style="color: var(--text-main); margin-bottom: 10px;">Account Locked</h1>
            <p>Your account has been locked by an administrator.</p>
        </div>
    `;
}

function renderPending() {
    const main = document.querySelector('.main-content');
    main.innerHTML = `
        <div style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted); text-align: center;">
            <span class="material-symbols-outlined" style="font-size: 64px; color: orange; margin-bottom: 20px;">pending</span>
            <h1 style="color: var(--text-main); margin-bottom: 10px;">Awaiting Approval</h1>
            <p>Your account is pending administrator approval.</p>
            <p style="margin-top: 10px;">Please contact support or wait for review.</p>
        </div>
    `;
    // Disable Upload Area if visible (it's wiped by innerHTML above, but just in case)
}

function setupUpload() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    dropZone.onclick = () => fileInput.click();

    dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    };

    dropZone.ondragleave = () => {
        dropZone.classList.remove('dragover');
    };

    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    };

    fileInput.onchange = () => {
        handleFiles(fileInput.files);
    };
}

async function handleFiles(files) {
    if (!files.length) return;
    const file = files[0];

    if (file.type !== 'image/svg+xml' && !file.name.endsWith('.svg')) {
        alert('Only SVG files are allowed.');
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        alert('File size exceeds 2MB limit.');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    // Optimistic UI could go here
    const dropZone = document.getElementById('dropZone');
    const originalText = dropZone.innerHTML;
    dropZone.innerHTML = '<p>Uploading...</p>';

    try {
        const res = await fetch('/api/files', {
            method: 'POST',
            body: formData
        });

        if (!res.ok) throw new Error(await res.text());

        // Refresh list
        await loadFiles();
    } catch (e) {
        alert('Upload failed: ' + e.message);
    } finally {
        dropZone.innerHTML = originalText;
    }
}

// Ensure loadFiles is globally accessible for the refresh button
window.loadFiles = async function () {
    try {
        const res = await fetch('/api/files');
        if (!res.ok) throw new Error('Failed to fetch files');
        state.files = await res.json();
        renderFiles();
    } catch (e) {
        console.error(e);
    }
};

function renderFiles() {
    const grid = document.getElementById('fileGrid');
    grid.innerHTML = '';

    state.files.forEach(file => {
        const card = document.createElement('div');
        card.className = 'file-card';

        const isShared = file.share_enabled;
        const shareUrl = isShared ? `${window.location.origin}/s/${file.share_id}` : '';

        // Format size & date
        const sizeStr = (file.size / 1024).toFixed(1) + ' KB';
        const dimsStr = (file.width && file.height) ? `${file.width} x ${file.height}` : 'N/A';
        const dateStr = new Date(file.created_at).toLocaleString();

        card.innerHTML = `
            <div class="preview" onclick="openPreview(${file.id}, '${file.filename}')">
                <img src="/api/files/${file.id}/content?v=${new Date(file.updated_at || file.created_at).getTime()}" loading="lazy" alt="${file.filename}">
            </div>
            <div class="meta">
                <div class="meta-header">
                    <div class="filename" title="${file.filename}">${file.filename}</div>
                    <div class="card-actions">
                         <button class="btn-icon" onclick="triggerUpdateFile(${file.id}, event)" title="Update Content">
                            <span class="material-symbols-outlined">upload_file</span>
                        </button>
                         <button class="btn-icon" onclick="renameFile(${file.id}, '${file.filename}', event)" title="Rename">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                        <button class="btn-icon" onclick="toggleShare(${file.id}, ${isShared}, event)" title="${isShared ? 'Disable Sharing' : 'Enable Sharing'}">
                            <span class="material-symbols-outlined" style="color: ${isShared ? 'var(--primary-color)' : 'inherit'}; font-size: 24px;">
                                ${isShared ? 'toggle_on' : 'toggle_off'}
                            </span>
                        </button>
                        ${isShared ? `<button class="btn-icon" onclick="copyLink('${shareUrl}', event)" title="Copy Link"><span class="material-symbols-outlined">link</span></button>` : ''}
                        <button class="btn-icon" onclick="deleteFile(${file.id}, event)" title="Delete"><span class="material-symbols-outlined">delete</span></button>
                    </div>
                </div>
                
                <div class="meta-extra">
                   <div style="display:flex; justify-content:space-between;"><span>Size:</span> <span>${sizeStr}</span></div>
                   <div style="display:flex; justify-content:space-between;"><span>Dims:</span> <span>${dimsStr}</span></div>
                   <div style="display:flex; justify-content:space-between;"><span>Uploaded:</span> <span>${dateStr}</span></div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

window.triggerUpdateFile = (id, e) => {
    e.stopPropagation();

    // Create hidden input if it doesn't exist
    let input = document.getElementById('update-file-input');
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.id = 'update-file-input';
        input.accept = '.svg';
        input.style.display = 'none';
        document.body.appendChild(input);
    }

    // Reset value
    input.value = '';

    // Set handler
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        if (file.type !== 'image/svg+xml' && !file.name.endsWith('.svg')) {
            alert('Only SVG files are allowed.');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            alert('File size exceeds 2MB limit.');
            return;
        }

        if (!confirm(`Overwrite content with "${file.name}"? This cannot be undone.`)) {
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        // Optimistic UI could be added here (e.g. spinner on the button)

        try {
            const res = await fetch(`/api/files/${id}/content`, {
                method: 'PUT',
                body: formData
            });

            if (!res.ok) throw new Error(await res.text());

            // Refresh list to show new size/dims and update preview image
            await loadFiles();
        } catch (e) {
            alert('Update failed: ' + e.message);
        }
    };

    input.click();
};

window.renameFile = async (id, oldName, e) => {
    e.stopPropagation();
    const newName = prompt('Enter new filename:', oldName);
    if (!newName || newName === oldName) return;

    // Simple verification for extension
    let finalName = newName;
    if (!finalName.toLowerCase().endsWith('.svg')) {
        finalName += '.svg';
    }

    try {
        const res = await fetch(`/api/files/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: finalName })
        });
        if (!res.ok) throw new Error('Rename failed');
        loadFiles();
    } catch (e) { alert(e.message); }
};

window.deleteFile = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure?')) return;
    try {
        await fetch(`/api/files/${id}`, { method: 'DELETE' });
        loadFiles();
    } catch (e) { alert(e.message); }
};

window.toggleShare = async (id, currentStatus, e) => {
    e.stopPropagation();
    try {
        await fetch(`/api/files/${id}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enable: !currentStatus })
        });
        loadFiles();
    } catch (e) { alert(e.message); }
};

window.copyLink = (url, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    // Brief scale-up animation as feedback
    const btn = e.currentTarget;
    btn.style.transform = 'scale(1.3)';
    setTimeout(() => btn.style.transform = '', 200);
};

window.openPreview = (id, filename) => {
    // Open a modal or new window with the viewer
    // For simplicity, let's just open in a new tab for now, or use a simple modal overlay
    const url = `/api/files/${id}/content`;

    // Create a modal overlay with svg-viewer
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.9); z-index: 1000; display: flex;
        flex-direction: column;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding: 10px 20px; display: flex; justify-content: space-between; color: white;';
    header.innerHTML = `<span>${filename}</span> <button onclick="this.closest('div').parentElement.remove()" style="color:white; font-size: 1.5rem;">&times;</button>`;

    // Viewer
    const viewer = document.createElement('svg-viewer');
    viewer.style.flex = '1';

    modal.appendChild(header);
    modal.appendChild(viewer);
    document.body.appendChild(modal);

    // Trigger load
    setTimeout(() => viewer.setAttribute('src', url), 10);
};

init();
