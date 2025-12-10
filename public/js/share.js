async function init() {
    // URL pattern: /s/:share_id
    const shareId = window.location.pathname.split('/s/')[1];
    if (!shareId) {
        document.body.innerHTML = '<h1>Invalid Link</h1>';
        return;
    }

    // 1. Fetch Metadata (Optional, if we want filename etc)
    // We can use /api/s/:share_id
    try {
        const infoRes = await fetch(`/api/s/${shareId}`);
        if (!infoRes.ok) throw new Error('File not found or private');
        const info = await infoRes.json();

        // Update Title
        document.getElementById('fileTitle').innerText = info.filename;
        document.title = `${info.filename} - SVGShare`;

        // Setup Download
        const downloadBtn = document.getElementById('downloadBtn');
        const rawUrl = `/raw/${shareId}`;
        downloadBtn.href = rawUrl;
        downloadBtn.setAttribute('download', info.filename); // Force filename

        // Setup Viewer
        const viewer = document.getElementById('mainViewer');
        viewer.setAttribute('src', rawUrl);

    } catch (e) {
        document.body.innerHTML = `<div style="padding:40px"><h1>Error</h1><p>${e.message}</p></div>`;
    }
}

init();
