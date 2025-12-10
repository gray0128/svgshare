export class R2Helper {
    constructor(bucket) {
        this.bucket = bucket;
    }

    getKey(userId, r2Key) {
        return `files/${userId}/${r2Key}.svg`;
    }

    async put(userId, r2Key, stream, options = {}) {
        const key = this.getKey(userId, r2Key);
        return await this.bucket.put(key, stream, options);
    }

    async get(userId, r2Key) {
        const key = this.getKey(userId, r2Key);
        return await this.bucket.get(key);
    }

    async delete(userId, r2Key) {
        const key = this.getKey(userId, r2Key);
        return await this.bucket.delete(key);
    }
}
