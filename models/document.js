// models/document.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { get } = require('http');

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database with WAL mode for better performance
const db = new Database(path.join(dataDir, 'documents.db'), {
    //verbose: console.log
});
db.pragma('journal_mode = WAL');

// Create tables
const createTableMain = db.prepare(`
  CREATE TABLE IF NOT EXISTS processed_documents (
    id INTEGER PRIMARY KEY,
    document_id INTEGER UNIQUE,
    title TEXT,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
createTableMain.run();

const createTableMetrics = db.prepare(`
  CREATE TABLE IF NOT EXISTS openai_metrics (
    id INTEGER PRIMARY KEY,
    document_id INTEGER,
    promptTokens INTEGER,
    completionTokens INTEGER,
    totalTokens INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
createTableMetrics.run();

const createTableHistory = db.prepare(`
  CREATE TABLE IF NOT EXISTS history_documents (
    id INTEGER PRIMARY KEY,
    document_id INTEGER,
    tags TEXT,
    title TEXT,
    correspondent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
createTableHistory.run();

const createOriginalDocuments = db.prepare(`
  CREATE TABLE IF NOT EXISTS original_documents (
    id INTEGER PRIMARY KEY,
    document_id INTEGER,
    title TEXT,
    tags TEXT,
    correspondent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
createOriginalDocuments.run();

const userTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    password TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
userTable.run();

// Prepare statements for better performance
const insertDocument = db.prepare(`
  INSERT INTO processed_documents (document_id, title) 
  VALUES (?, ?)
  ON CONFLICT(document_id) DO UPDATE SET
    last_updated = CURRENT_TIMESTAMP
  WHERE document_id = ?
`);

const findDocument = db.prepare(
    'SELECT * FROM processed_documents WHERE document_id = ?'
);

const insertMetrics = db.prepare(`
  INSERT INTO openai_metrics (document_id, promptTokens, completionTokens, totalTokens)
  VALUES (?, ?, ?, ?)
`);

const insertOriginal = db.prepare(`
  INSERT INTO original_documents (document_id, title, tags, correspondent)
  VALUES (?, ?, ?, ?)
`);

const insertHistory = db.prepare(`
  INSERT INTO history_documents (document_id, tags, title, correspondent)
  VALUES (?, ?, ?, ?)
`);

const insertUser = db.prepare(`
  INSERT INTO users (username, password)
  VALUES (?, ?)
`);

// Add these prepared statements with your other ones at the top
const getHistoryDocumentsCount = db.prepare(`
  SELECT COUNT(*) as count FROM history_documents
`);

const getPaginatedHistoryDocuments = db.prepare(`
  SELECT * FROM history_documents 
  ORDER BY created_at DESC
  LIMIT ? OFFSET ?
`);

const safeRun = (stmt, params, description) => {
  try {
    return stmt.run(params);
  } catch (error) {
    console.error(`[ERROR] Running ${description}:`, error);
    return { changes: 0, lastInsertRowid: null }; // Return a default object
  }
};

const safeGet = (stmt, param, description) => {
  try {
    return stmt.get(param);
  } catch (error) {
    console.error(`[ERROR] Getting ${description}:`, error);
    return undefined; // Return undefined or a default value
  }
};

const safeAll = (stmt, description) => {
  try {
    return stmt.all();
  } catch (error) {
    console.error(`[ERROR] Getting all ${description}:`, error);
    return [];
  }
};

module.exports = {
    async addProcessedDocument(documentId, title) {
        try {
            // With unique constraint on document_id, update if already exists
            const result = safeRun(insertDocument, [documentId, title, documentId], `insertDocument for documentId ${documentId}`);
            if (result.changes > 0) {
                console.log(`[DEBUG] Document ${title} ${result.lastInsertRowid ? 'added to' : 'updated in'} processed_documents`);
                return true;
            }
            return false;
        } catch (error) {
            // Log error but don't throw
            console.error('[ERROR] adding document:', error);
            return false;
        }
    },

    async addOpenAIMetrics(documentId, promptTokens, completionTokens, totalTokens) {
        try {
            const result = safeRun(insertMetrics, [documentId, promptTokens, completionTokens, totalTokens], `insertMetrics for documentId ${documentId}`);
            if (result.changes > 0) {
                console.log(`[DEBUG] Metrics added for document ${documentId}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('[ERROR] adding metrics:', error);
            return false;
        }
    },

    async getMetrics() {
        try {
            return safeAll(db.prepare('SELECT * FROM openai_metrics'), 'all metrics');
        } catch (error) {
            console.error('[ERROR] getting metrics:', error);
            return [];
        }
    },

    async getProcessedDocuments() {
        try {
            return safeAll(db.prepare('SELECT * FROM processed_documents'), 'all processed documents');
        } catch (error) {
            console.error('[ERROR] getting processed documents:', error);
            return [];
        }
    },

    async getProcessedDocumentsCount() {
        try {
            const result = safeGet(db.prepare('SELECT COUNT(*) as count FROM processed_documents'), null, 'processed documents count');
            return result ? result.count : 0;
        } catch (error) {
            console.error('[ERROR] getting processed documents count:', error);
            return 0;
        }
    },

    async isDocumentProcessed(documentId) {
        try {
            const row = safeGet(findDocument, documentId, `document with ID ${documentId}`);
            return !!row;
        } catch (error) {
            console.error('[ERROR] checking document:', error);
            // Return true to prevent double processing
            return true;
        }
    },

    async saveOriginalData(documentId, tags, correspondent, title) {
        try {
            const tagsString = JSON.stringify(tags);
            const result = safeRun(db.prepare(`
                INSERT INTO original_documents (document_id, title, tags, correspondent)
                VALUES (?, ?, ?, ?)
            `), [documentId, title, tagsString, correspondent], `saveOriginalData for documentId ${documentId}`);
            if (result.changes > 0) {
                console.log(`[DEBUG] Original data for document ${title} saved`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('[ERROR] saving original data:', error);
            return false;
        }
    },

    async addToHistory(documentId, tagIds, title, correspondent) {
        try {
            const tagIdsString = JSON.stringify(tagIds);
            const result = safeRun(db.prepare(`
                INSERT INTO history_documents (document_id, tags, title, correspondent)
                VALUES (?, ?, ?, ?)
            `), [documentId, tagIdsString, title, correspondent], `addToHistory for documentId ${documentId}`);
            if (result.changes > 0) {
                console.log(`[DEBUG] Document ${title} added to history`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('[ERROR] adding to history:', error);
            return false;
        }
    },

    async getHistory(id) {
        if (id) {
            try {
                return safeGet(db.prepare('SELECT * FROM history_documents WHERE document_id = ?'), id, `history for documentId ${id}`);
            } catch (error) {
                console.error('[ERROR] getting history for id:', id, error);
                return [];
            }
        } else {
            try {
                return safeAll(db.prepare('SELECT * FROM history_documents'), 'all history');
            } catch (error) {
                console.error('[ERROR] getting history:', error);
                return [];
            }
        }
    },

    async getOriginalData(id) {
        if (id) {
            try {
                return safeGet(db.prepare('SELECT * FROM original_documents WHERE document_id = ?'), id, `original data for documentId ${id}`);
            } catch (error) {
                console.error('[ERROR] getting original data for id:', id, error);
                return [];
            }
        } else {
            try {
                return safeAll(db.prepare('SELECT * FROM original_documents'), 'all original data');
            } catch (error) {
                console.error('[ERROR] getting original data:', error);
                return [];
            }
        }
    },

    async getAllOriginalData() {
        try {
            return safeAll(db.prepare('SELECT * FROM original_documents'), 'all original data');
        } catch (error) {
            console.error('[ERROR] getting original data:', error);
            return [];
        }
    },

    async getAllHistory() {
        try {
            return safeAll(db.prepare('SELECT * FROM history_documents'), 'all history');
        } catch (error) {
            console.error('[ERROR] getting history:', error);
            return [];
        }
    },

    async getHistoryDocumentsCount() {
        try {
            const result = safeGet(getHistoryDocumentsCount, null, 'history documents count');
            return result ? result.count : 0;
        } catch (error) {
            console.error('[ERROR] getting history documents count:', error);
            return 0;
        }
    },

    async getPaginatedHistory(limit, offset) {
        try {
            return getPaginatedHistoryDocuments.all(limit, offset);
        } catch (error) {
            console.error('[ERROR] getting paginated history:', error);
            return [];
        }
    },

    async deleteAllDocuments() {
        try {
            safeRun(db.prepare('DELETE FROM processed_documents'), [], 'deleteAll processed documents');
            console.log('[DEBUG] All processed_documents deleted');
            safeRun(db.prepare('DELETE FROM history_documents'), [], 'deleteAll history documents');
            console.log('[DEBUG] All history_documents deleted');
            safeRun(db.prepare('DELETE FROM original_documents'), [], 'deleteAll original documents');
            console.log('[DEBUG] All original_documents deleted');
            return true;
        } catch (error) {
            console.error('[ERROR] deleting documents:', error);
            return false;
        }
    },

    async deleteDocumentsIdList(idList) {
        try {
            console.log('[DEBUG] Received idList:', idList);

            const ids = Array.isArray(idList) ? idList : (idList?.ids || []);

            if (!Array.isArray(ids) || ids.length === 0) {
                console.error('[ERROR] Invalid input: must provide an array of ids');
                return false;
            }

            // Convert string IDs to integers and filter out NaN values
            const numericIds = ids.map(id => parseInt(id, 10)).filter(Number.isInteger);

            if (numericIds.length === 0) {
                console.warn('[WARNING] No valid integer IDs provided, skipping delete operation.');
                return false;
            }

            const placeholders = numericIds.map(() => '?').join(', ');
            const query = `DELETE FROM processed_documents WHERE document_id IN (${placeholders})`;
            const query2 = `DELETE FROM history_documents WHERE document_id IN (${placeholders})`;
            const query3 = `DELETE FROM original_documents WHERE document_id IN (${placeholders})`;
            console.log('[DEBUG] Executing SQL query:', query);
            console.log('[DEBUG] Executing SQL query:', query2);
            console.log('[DEBUG] Executing SQL query:', query3);
            console.log('[DEBUG] With parameters:', numericIds);

            const stmt = db.prepare(query);
            const stmt2 = db.prepare(query2);
            const stmt3 = db.prepare(query3);
            safeRun(stmt, numericIds, "deleteDocumentsIdList -> deleting from processed_documents")
            safeRun(stmt2, numericIds, "deleteDocumentsIdList -> deleting from history_documents")
            safeRun(stmt3, numericIds, "deleteDocumentsIdList -> deleting from original_documents")

            console.log(`[DEBUG] Documents with IDs ${numericIds.join(', ')} deleted`);
            return true;
        } catch (error) {
            console.error('[ERROR] deleting documents:', error);
            return false;
        }
    },

    async addUser(username, password) {
        try {
            const result = safeRun(insertUser, [username, password], `addUser with username ${username}`);
            if (result.changes > 0) {
                console.log(`[DEBUG] User ${username} added`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('[ERROR] adding user:', error);
            return false;
        }
    },

    async getUser(username) {
        try {
            return safeGet(db.prepare('SELECT * FROM users WHERE username = ?'), username, `user with username ${username}`);
        } catch (error) {
            console.error('[ERROR] getting user:', error);
            return [];
        }
    },

    async getUsers() {
        try {
            return safeAll(db.prepare('SELECT * FROM users'), 'all users');
        } catch (error) {
            console.error('[ERROR] getting users:', error);
            return [];
        }
    },

    // Utility method to close the database connection
    closeDatabase() {
        return new Promise((resolve, reject) => {
            try {
                db.close();
                console.log('[DEBUG] Database closed successfully');
                resolve();
            } catch (error) {
                console.error('[ERROR] closing database:', error);
                reject(error);
            }
        });
    }
};
