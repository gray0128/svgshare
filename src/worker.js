import { D1Helper } from './db.js';
import { R2Helper } from './r2.js';
import { AuthHelper, createSessionCookie, verifySession } from './auth.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        const db = new D1Helper(env.DB);
        const bucket = new R2Helper(env.BUCKET);
        const auth = new AuthHelper(env);

        // --- Static Assets (Public) ---
        // If it's not an API or Auth route, try serving assets
        if (!path.startsWith('/api/') && !path.startsWith('/auth/') && !path.startsWith('/raw/')) {
            // Serve index.html for root or share page
            if (path === '/' || path.startsWith('/s/')) {
                // For simple SPA routing, we serve index.html or specific templates
                // Here we let binding ASSETS handle it if possible, or serve index.html manually
                // But since we have `[assets] binding = "ASSETS"`, 
                // Cloudflare handles static files BEFORE worker code if configured in wrangler.toml? 
                // Actually, with `assets` binding, we serve them explicitly or let `env.ASSETS.fetch` handle it.

                // For share pages /s/:id, we need to serve share.html
                if (path.startsWith('/s/')) {
                    return await env.ASSETS.fetch(new URL('/share.html', request.url));
                }

                // For dashboard
                if (path === '/dashboard') {
                    return await env.ASSETS.fetch(new URL('/dashboard.html', request.url));
                }

                // Default fallback to assets
                return await env.ASSETS.fetch(request);
            }
            return await env.ASSETS.fetch(request);
        }

        // --- Auth Routes ---
        if (path === '/auth/login') {
            return auth.redirect();
        }

        if (path === '/auth/callback') {
            try {
                const githubUser = await auth.callback(request);
                if (githubUser instanceof Response) return githubUser; // Error response

                // Sync with DB
                let user = await db.getUserByGithubId(githubUser.id.toString());
                if (!user) {
                    user = await db.createUser(
                        githubUser.id.toString(),
                        githubUser.login,
                        githubUser.avatar_url
                    );
                }

                // Create Session
                const cookie = await createSessionCookie(user.id, env.JWT_SECRET);
                return new Response(null, {
                    status: 302,
                    headers: {
                        'Set-Cookie': cookie,
                        'Location': '/dashboard',
                    },
                });
            } catch (e) {
                return new Response('Auth Error: ' + e.message, { status: 500 });
            }
        }

        if (path === '/auth/me') {
            const userId = await verifySession(request);
            if (!userId) return new Response('Unauthorized', { status: 401 });
            const user = await db.getUserById(userId);
            return Response.json(user);
        }

        // --- Public Share Access ---
        if (path.startsWith('/raw/')) {
            const shareId = path.split('/raw/')[1];
            const share = await db.getShareByShareId(shareId);

            if (!share) return new Response('Not Found or Disabled', { status: 404 });

            // Inc visit count
            ctx.waitUntil(db.incrementVisitCount(shareId).then(() => { })); // Fix await usage in waitUntil

            const object = await bucket.get(share.user_id, share.r2_key);
            if (!object) return new Response('File Missing', { status: 404 });

            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set('etag', object.httpEtag);

            return new Response(object.body, {
                headers,
            });
        }

        // --- Protected API Routes ---
        const userId = await verifySession(request);
        if (!userId) {
            return new Response('Unauthorized', { status: 401 });
        }

        // LIST FILES
        if (path === '/api/files' && method === 'GET') {
            const files = await db.getFilesByUserId(userId);
            return Response.json(files);
        }

        // UPLOAD FILE
        if (path === '/api/files' && method === 'POST') {
            // Expect FormData
            const formData = await request.formData();
            const file = formData.get('file');

            if (!file || !(file instanceof File)) {
                return new Response('No file provided', { status: 400 });
            }

            if (!file.name.endsWith('.svg') || file.type !== 'image/svg+xml') {
                return new Response('Only SVG allowed', { status: 400 });
            }

            if (file.size > 1024 * 1024) {
                return new Response('File too large (>1MB)', { status: 400 });
            }

            // Generate R2 Key
            const r2Key = crypto.randomUUID();

            // Parse metadata (simplified, ideally parse SVG content)
            const text = await file.text();
            const widthMatch = text.match(/width="([^"]+)"/);
            const heightMatch = text.match(/height="([^"]+)"/);
            const width = widthMatch ? parseInt(widthMatch[1]) : 0;
            const height = heightMatch ? parseInt(heightMatch[1]) : 0;

            // Upload to R2 (Convert back to stream/buffer)
            await bucket.put(userId, r2Key, text, { // using text as body
                httpMetadata: { contentType: 'image/svg+xml' }
            });

            // Insert DB
            const newFile = await db.createFile(userId, file.name, file.size, r2Key, width, height);
            return Response.json(newFile);
        }

        // DELETE FILE
        if (path.startsWith('/api/files/') && method === 'DELETE') {
            const id = path.split('/api/files/')[1];
            const file = await db.getFileById(id);

            if (!file || file.user_id !== userId) {
                return new Response('Not Found', { status: 404 });
            }

            await bucket.delete(userId, file.r2_key);
            await db.deleteFile(id);

            return new Response('Deleted', { status: 200 });
        }

        // GET FILE CONTENT (Private Preview)
        if (path.startsWith('/api/files/') && path.endsWith('/content') && method === 'GET') {
            // /api/files/:id/content
            const id = path.split('/api/files/')[1].split('/')[0];
            const file = await db.getFileById(id);

            if (!file || file.user_id !== userId) {
                return new Response('Not Found', { status: 404 });
            }

            const object = await bucket.get(userId, file.r2_key);
            if (!object) return new Response('File Missing', { status: 404 });

            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set('etag', object.httpEtag);

            return new Response(object.body, { headers });
        }

        // PATCH FILE (Rename)
        if (path.startsWith('/api/files/') && method === 'PATCH') {
            const id = path.split('/api/files/')[1];
            const file = await db.getFileById(id);

            if (!file || file.user_id !== userId) {
                return new Response('Not Found', { status: 404 });
            }

            const { filename } = await request.json();
            if (filename) {
                await db.updateFilename(id, filename);
            }
            return new Response('Updated', { status: 200 });
        }

        // SHARE ACTIONS
        if (path.endsWith('/share') && method === 'POST') {
            // /api/files/:id/share
            const idParts = path.split('/'); // ["", "api", "files", "123", "share"]
            const id = idParts[3];

            const file = await db.getFileById(id);
            if (!file || file.user_id !== userId) {
                return new Response('Not Found', { status: 404 });
            }

            const body = await request.json().catch(() => ({}));
            const existingShare = await db.getShareByFileId(id);

            if (existingShare) {
                // Toggle
                const newState = (body.enable !== undefined) ? body.enable : !existingShare.is_enabled;
                const updated = await db.toggleShare(id, newState);
                return Response.json(updated);
            } else {
                // Create
                const shareId = crypto.randomUUID();
                const newShare = await db.createShare(id, shareId);
                return Response.json(newShare);
            }
        }

        // API INFO (Share Metadata for public page - technically public maybe?)
        // But usually share page logic is server-side rendered or client-side fetches public API
        if (path.startsWith('/api/s/')) {
            const shareId = path.split('/api/s/')[1];
            const share = await db.getShareByShareId(shareId);
            if (!share) return new Response('Not Found', { status: 404 });
            return Response.json(share);
        }

        return new Response('Not Found', { status: 404 });
    }
};
