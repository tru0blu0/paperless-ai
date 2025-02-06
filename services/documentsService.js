// services/documentsService.js
const paperlessService = require('./paperlessService');

class DocumentsService {
    constructor() {
        this.tagCache = new Map();
        this.correspondentCache = new Map();
    }

    async getTagNames() {
        if (this.tagCache.size === 0) {
            try {
                const tags = await paperlessService.getTags();
                tags.forEach(tag => {
                    this.tagCache.set(tag.id, tag.name);
                });
            } catch (error) {
                console.error("Error fetching tags:", error);
                // Handle the error appropriately, e.g., re-throw or return a default value
                throw error; // Re-throwing allows the caller to handle the error
                // Or, return a default object: return {};
            }
        }
        return Object.fromEntries(this.tagCache);
    }

    async getCorrespondentNames() {
        if (this.correspondentCache.size === 0) {
            try {
                const correspondents = await paperlessService.listCorrespondentsNames();
                correspondents.forEach(corr => {
                    this.correspondentCache.set(corr.id, corr.name);
                });
            } catch (error) {
                console.error("Error fetching correspondents:", error);
                // Handle the error appropriately
                throw error; // Re-throwing allows the caller to handle the error
                // Or, return a default object: return {};
            }
        }
        return Object.fromEntries(this.correspondentCache);
    }

    async getDocumentsWithMetadata() {
        try {
            const [documents, tagNames, correspondentNames] = await Promise.all([
                paperlessService.getDocuments(),
                this.getTagNames(),
                this.getCorrespondentNames()
            ]);

            // Sort documents by created date (newest first)
            documents.sort((a, b) => new Date(b.created) - new Date(a.created));

            return {
                documents,
                tagNames,
                correspondentNames,
                paperlessUrl: process.env.PAPERLESS_API_URL.replace('/api', '').replace(/\/+$/, '') // Remove /api and trailing slashes
            };
        } catch (error) {
            console.error("Error getting documents with metadata:", error);
            // Handle the error appropriately, e.g., re-throw or return a default value
            return {
                documents: [],
                tagNames: {},
                correspondentNames: {},
                paperlessUrl: ''
            }; // Return default values to prevent the application from crashing
        }
    }
}

module.exports = new DocumentsService();
