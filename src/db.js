export class D1Helper {
    constructor(db) {
        this.db = db;
    }

    // User Operations
    async getUserByGithubId(githubId) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE github_id = ?');
        return await stmt.bind(githubId).first();
    }

    async createUser(githubId, username, avatarUrl) {
        const stmt = this.db.prepare(
            'INSERT INTO users (github_id, username, avatar_url) VALUES (?, ?, ?) RETURNING *'
        );
        return await stmt.bind(githubId, username, avatarUrl).first();
    }

    async getUserById(id) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
        return await stmt.bind(id).first();
    }

    // File Operations
    async createFile(userId, filename, size, r2Key, width, height) {
        const stmt = this.db.prepare(
            'INSERT INTO files (user_id, filename, size, r2_key, width, height) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
        );
        return await stmt.bind(userId, filename, size, r2Key, width, height).first();
    }

    async getFilesByUserId(userId) {
        // Include share status in the file list
        const stmt = this.db.prepare(`
      SELECT f.*, s.is_enabled as share_enabled, s.share_id, s.visit_count
      FROM files f
      LEFT JOIN shares s ON f.id = s.file_id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `);
        const result = await stmt.bind(userId).all();
        return result.results || [];
    }

    async getFileById(id) {
        const stmt = this.db.prepare('SELECT * FROM files WHERE id = ?');
        return await stmt.bind(id).first();
    }

    async deleteFile(id) {
        const stmt = this.db.prepare('DELETE FROM files WHERE id = ?');
        return await stmt.bind(id).run();
    }

    async updateFilename(id, newName) {
        const stmt = this.db.prepare('UPDATE files SET filename = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        return await stmt.bind(newName, id).run();
    }

    // Share Operations
    async createShare(fileId, shareId) {
        const stmt = this.db.prepare(
            'INSERT INTO shares (file_id, share_id, is_enabled) VALUES (?, ?, 1) RETURNING *'
        );
        return await stmt.bind(fileId, shareId).first();
    }

    async getShareByFileId(fileId) {
        const stmt = this.db.prepare('SELECT * FROM shares WHERE file_id = ?');
        return await stmt.bind(fileId).first();
    }

    async toggleShare(fileId, isEnabled) {
        const stmt = this.db.prepare(
            'UPDATE shares SET is_enabled = ? WHERE file_id = ? RETURNING *'
        );
        return await stmt.bind(isEnabled ? 1 : 0, fileId).first();
    }

    async getShareByShareId(shareId) {
        // Join with files to get file info
        const stmt = this.db.prepare(`
      SELECT s.*, f.filename, f.r2_key, f.user_id
      FROM shares s
      JOIN files f ON s.file_id = f.id
      WHERE s.share_id = ? AND s.is_enabled = 1
    `);
        return await stmt.bind(shareId).first();
    }

    async incrementVisitCount(shareId) {
        const stmt = this.db.prepare(
            'UPDATE shares SET visit_count = visit_count + 1 WHERE share_id = ?'
        );
        return ctx.waitUntil(stmt.bind(shareId).run());
    }
}
