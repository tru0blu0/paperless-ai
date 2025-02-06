const express = require('express');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs').promises;
const config = require('./config/config');
const paperlessService = require('./services/paperlessService');
const AIServiceFactory = require('./services/aiServiceFactory');
const documentModel = require('./models/document');
const setupService = require('./services/setupService');
const setupRoutes = require('./routes/setup');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const Logger = require('./services/loggerService');

const setupRoutes = require('./routes/setup');
    const summaryRoutes = require('./routes/summary'); // Import summary routes
    const cors = require('cors');
    app.use('/', setupRoutes);
    app.use('/', summaryRoutes); // Use summary routes

const htmlLogger = new Logger({
    logFile: 'logs.html',
    format: 'html',
    timestamp: true,
    maxFileSize: 1024 * 1024 * 10
});

const txtLogger = new Logger({
    logFile: 'logs.txt',
    format: 'txt',
    timestamp: true,
    maxFileSize: 1024 * 1024 * 10
});

const app = express();
let runningTask = false;

const corsOptions = {
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'x-api-key',
        'Access-Control-Allow-Private-Network'
    ],
    credentials: false
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Access-Control-Allow-Private-Network');
    res.header('Access-Control-Allow-Private-Network', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Layout middleware
app.use((req, res, next) => {
    const originalRender = res.render;
    res.render = function (view, locals = {}) {
        originalRender.call(this, view, locals, (err, html) => {
            if (err) return next(err);
            originalRender.call(this, 'layout', { content: html, ...locals });
        });
    };
    next();
});

// Initialize data directory
async function initializeDataDirectory() {
    const dataDir = path.join(process.cwd(), 'data');
    try {
        await fs.access(dataDir);
        console.log('[INFO] Data directory already exists.');
    } catch {
        console.log('[INFO] Creating data directory...');
        await fs.mkdir(dataDir, { recursive: true });
    }
}

// Document processing functions
async function processDocument(doc, existingTags, existingCorrespondentList, ownUserId) {
    try {
        const isProcessed = await documentModel.isDocumentProcessed(doc.id);
        if (isProcessed) {
            console.log(`[DEBUG] Document ${doc.id} already processed, skipping.`);
            return null;
        }

        //Check if the Document can be edited
        const documentEditable = await paperlessService.getPermissionOfDocument(doc.id);
        if (!documentEditable) {
            console.log(`[DEBUG] Document ${doc.id} is not editable by Paper-AI User, skipping analysis`);
            return null;
        } else {
            console.log(`[DEBUG] Document ${doc.id} has edit rights for AI User - processing`);
        }

        let [content, originalData] = await Promise.all([
            paperlessService.getDocumentContent(doc.id),
            paperlessService.getDocument(doc.id)
        ]);

        if (!content || !content.length >= 10) {
            console.log(`[DEBUG] Document ${doc.id} has no content, skipping analysis`);
            return null;
        }

        if (content.length > 50000) {
            console.warn(`[WARNING] Document ${doc.id} content exceeds 50000 characters. Truncating content.`);
            content = content.substring(0, 50000);
        }

        const aiService = AIServiceFactory.getService();
        const analysis = await aiService.analyzeDocument(content, existingTags, existingCorrespondentList, doc.id);
        console.log('Response from AI service:', analysis);

        if (analysis.error) {
            console.error(`[ERROR] Document analysis failed for document ID ${doc.id}: ${analysis.error}`);
            return null;
        }

        return { analysis, originalData };
    } catch (error) {
        console.error(`[ERROR] Processing document with ID ${doc.id} failed:`, error.message);
        return null; // Ensure consistent return in case of errors
    }
}

async function buildUpdateData(analysis, doc) {
    const updateData = {};

    // Only process tags if tagging is activated
    if (config.limitFunctions?.activateTagging !== 'no') {
        const { tagIds, errors } = await paperlessService.processTags(analysis.document.tags);
        if (errors.length > 0) {
            console.warn('[ERROR] Some tags could not be processed:', errors);
        }
        updateData.tags = tagIds;
    }

    // Only process title if title generation is activated
    if (config.limitFunctions?.activateTitle !== 'no') {
        updateData.title = analysis.document.title || doc.title;
    }

    // Add created date regardless of settings as it's a core field
    updateData.created = analysis.document.document_date || doc.created;

    // Only process document type if document type classification is activated
    if (config.limitFunctions?.activateDocumentType !== 'no' && analysis.document.document_type) {
        try {
            const documentType = await paperlessService.getOrCreateDocumentType(analysis.document.document_type);
            if (documentType) {
                updateData.document_type = documentType.id;
            }
        } catch (error) {
            console.error(`[ERROR] Error processing document type:`, error);
        }
    }

    // Only process correspondent if correspondent detection is activated
    if (config.limitFunctions?.activateCorrespondents !== 'no' && analysis.document.correspondent) {
        try {
            const correspondent = await paperlessService.getOrCreateCorrespondent(analysis.document.correspondent);
            if (correspondent) {
                updateData.correspondent = correspondent.id;
            }
        } catch (error) {
            console.error(`[ERROR] Error processing correspondent:`, error);
        }
    }

    // Always include language if provided as it's a core field
    if (analysis.document.language) {
        updateData.language = analysis.document.language;
    }

    return updateData;
}

async function saveDocumentChanges(docId, updateData, analysis, originalData) {
    try {
        const { tags: originalTags, correspondent: originalCorrespondent, title: originalTitle } = originalData;

        await Promise.all([
            documentModel.saveOriginalData(docId, originalTags, originalCorrespondent, originalTitle),
            paperlessService.updateDocument(docId, updateData),
            documentModel.addProcessedDocument(docId, updateData.title),
            documentModel.addOpenAIMetrics(
                docId,
                analysis.metrics.promptTokens,
                analysis.metrics.completionTokens,
                analysis.metrics.totalTokens
            ),
            documentModel.addToHistory(docId, updateData.tags, updateData.title, analysis.document.correspondent)
        ]);
    } catch (error) {
        console.error(`[ERROR] saving document changes for doc ID ${docId}:`, error);
    }
}

// Main scanning functions
async function scanInitial() {
    try {
        const isConfigured = await setupService.isConfigured();
        if (!isConfigured) {
            console.log('[ERROR] Setup not completed. Skipping document scan.');
            return;
        }

        let [existingTags, documents, ownUserId, existingCorrespondentList] = await Promise.all([
            paperlessService.getTags(),
            paperlessService.getAllDocuments(),
            paperlessService.getOwnUserID(),
            paperlessService.listCorrespondentsNames()
        ]);
        //get existing correspondent list
        existingCorrespondentList = existingCorrespondentList.map(correspondent => correspondent.name);

        for (const doc of documents) {
            try {
                const result = await processDocument(doc, existingTags, existingCorrespondentList, ownUserId);
                if (!result) continue;

                const { analysis, originalData } = result;
                const updateData = await buildUpdateData(analysis, doc);
                await saveDocumentChanges(doc.id, updateData, analysis, originalData);
            } catch (error) {
                console.error(`[ERROR] processing document ${doc.id}:`, error);
            }
        }
    } catch (error) {
        console.error('[ERROR] during initial document scan:', error);
    }
}

async function scanDocuments() {
    if (runningTask) {
        console.log('[DEBUG] Task already running');
        return;
    }

    runningTask = true;
    try {
        let [existingTags, documents, ownUserId, existingCorrespondentList] = await Promise.all([
            paperlessService.getTags(),
            paperlessService.getAllDocuments(),
            paperlessService.getOwnUserID(),
            paperlessService.listCorrespondentsNames()
        ]);

        //get existing correspondent list
        existingCorrespondentList = existingCorrespondentList.map(correspondent => correspondent.name);

        for (const doc of documents) {
            try {
                const result = await processDocument(doc, existingTags, existingCorrespondentList, ownUserId);
                if (!result) continue;

                const { analysis, originalData } = result;
                const updateData = await buildUpdateData(analysis, doc);
                await saveDocumentChanges(doc.id, updateData, analysis, originalData);
            } catch (error) {
                console.error(`[ERROR] processing document ${doc.id}:`, error);
            }
        }
    } catch (error) {
        console.error('[ERROR] during document scan:', error);
    } finally {
        runningTask = false;
        console.log('[INFO] Task completed');
    }
}

// Routes
app.use('/', setupRoutes);

app.get('/', async (req, res) => {
    try {
        res.redirect('/dashboard');
    } catch (error) {
        console.error('[ERROR] in root route:', error);
        res.status(500).send('Error processing request');
    }
});

app.get('/health', async (req, res) => {
    try {
        const isConfigured = await setupService.isConfigured();
        if (!isConfigured) {
            return res.status(503).json({
                status: 'not_configured',
                message: 'Application setup not completed'
            });
        }

        await documentModel.isDocumentProcessed(1);
        res.json({ status: 'healthy' });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({
            status: 'error',
            message: error.message
        });
    }
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start scanning
async function startScanning() {
    try {
        const isConfigured = await setupService.isConfigured();
        if (!isConfigured) {
            console.log('Setup not completed. Visit http://your-ip-or-host.com:3000/setup to complete setup.');
            return;
        }

        const userId = await paperlessService.getOwnUserID();
        if (!userId) {
            console.error('Failed to get own user ID. Abort scanning.');
            return;
        }

        console.log('Configured scan interval:', config.scanInterval);
        console.log(`Starting initial scan at ${new Date().toISOString()}`);
        await scanInitial();

        cron.schedule(config.scanInterval, async () => {
            console.log(`Starting scheduled scan at ${new Date().toISOString()}`);
            await scanDocuments();
        });
    } catch (error) {
        console.error('[ERROR] in startScanning:', error);
    }
}

//Error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  txtLogger.writeToFile(`[ERROR] Uncaught Exception: ${error.message}\n${error.stack}\n`);
  htmlLogger.writeToFile(`<div class="log-entry"><span class="timestamp">[${new Date().toISOString()}]</span> <span class="type type-error">[ERROR]</span> <span class="message">Uncaught Exception: ${error.message}</span></div>\n`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    txtLogger.writeToFile(`[ERROR] Unhandled Rejection: ${reason}\n`);
    htmlLogger.writeToFile(`<div class="log-entry"><span class="timestamp">[${new Date().toISOString()}]</span> <span class="type type-error">[ERROR]</span> <span class="message">Unhandled Rejection: ${reason}</div>\n`);
    process.exit(1);
});

async function gracefulShutdown(signal) {
    console.log(`[DEBUG] Received ${signal} signal. Starting graceful shutdown...`);
    try {
        console.log('[DEBUG] Closing database...');
        await documentModel.closeDatabase();
        console.log('[DEBUG] Database closed successfully');
        process.exit(0);
    } catch (error) {
        console.error(`[ERROR] during ${signal} shutdown:`, error);
        process.exit(1);
    }
}

// Handle both SIGTERM and SIGINT
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
async function startServer() {
    try {
        await initializeDataDirectory();
        app.listen(3000, () => {
            console.log('Server running on port 3000');
            startScanning();
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
