// services/chatService.js
const OpenAIService = require('./openaiService');
const PaperlessService = require('./paperlessService');
const config = require('../config/config');
const fs = require('fs');
const path = require('path');
const os = require('os');
const stream = require('stream');
const { promisify } = require('util');
const pipeline = promisify(stream.pipeline);

class ChatService {
    constructor() {
        this.chats = new Map(); // Stores chat histories: documentId -> messages[]
        this.tempDir = path.join(os.tmpdir(), 'paperless-chat');

        // Create temporary directory if it doesn't exist
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Downloads the original file from Paperless
     * @param {string} documentId - The ID of the document
     * @returns {Promise<{filePath: string, filename: string, mimeType: string}>}
     */
    async downloadDocument(documentId) {
        try {
            const document = await PaperlessService.getDocument(documentId);
            if (!document) {
                throw new Error(`Document with ID ${documentId} not found.`);
            }
            const tempFilePath = path.join(this.tempDir, `${documentId}_${document.original_filename}`);

            // Create download stream
            const response = await PaperlessService.client.get(`/documents/${documentId}/download/`, {
                responseType: 'stream'
            });

            // Save file temporarily
            await pipeline(
                response.data,
                fs.createWriteStream(tempFilePath)
            );

            return {
                filePath: tempFilePath,
                filename: document.original_filename,
                mimeType: document.mime_type
            };
        } catch (error) {
            console.error(`Error downloading document ${documentId}:`, error);
            throw error;
        }
    }

    /**
     * Initializes a new chat for a document
     * @param {string} documentId - The ID of the document
     */
    async initializeChat(documentId) {
        try {
            // Get document information
            const document = await PaperlessService.getDocument(documentId);
            if (!document) {
                throw new Error(`Document with ID ${documentId} not found.`);
            }
            let documentContent;

            try {
                documentContent = await PaperlessService.getDocumentContent(documentId);
            } catch (error) {
                console.warn('Could not get direct document content, trying file download...', error);
                const { filePath } = await this.downloadDocument(documentId);
                documentContent = await fs.promises.readFile(filePath, 'utf8');
            }

            // Create initial system prompt
            const messages = [
                {
                    role: "system",
                    content: `You are a helpful assistant for the document "${document.title}". 
                   Use the following document content as context for your responses. 
                   If you don't know something or it's not in the document, please say so honestly.
                   
                   Document content:
                   ${documentContent}`
                }
            ];

            this.chats.set(documentId, {
                messages,
                documentTitle: document.title
            });

            return {
                documentTitle: document.title,
                initialized: true
            };
        } catch (error) {
            console.error(`Error initializing chat for document ${documentId}:`, error);
            throw error;
        }
    }

    async sendMessageStream(documentId, userMessage, res) {
        try {
            if (!this.chats.has(documentId)) {
                await this.initializeChat(documentId);
            }

            const chatData = this.chats.get(documentId);
            chatData.messages.push({
                role: "user",
                content: userMessage
            });

            // Set headers for SSE
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            let apiUrl;
            let requestBody;
            let headers = {
                'Content-Type': 'application/json'
            };

            const aiProvider = process.env.AI_PROVIDER;

            switch (aiProvider) {
                case 'openai':
                    apiUrl = 'https://api.openai.com/v1/chat/completions';
                    headers['Authorization'] = `Bearer ${process.env.OPENAI_API_KEY}`;
                    requestBody = {
                        model: process.env.OPENAI_MODEL || 'gpt-4',
                        messages: chatData.messages,
                        stream: true
                    };
                    break;
                case 'ollama':
                    apiUrl = `${config.ollama.apiUrl}/api/chat`; // Use config for URL
                    requestBody = {
                        model: config.ollama.model, // Use config for model
                        messages: chatData.messages,
                        stream: true
                    };
                    break;
                case 'custom':
                    apiUrl = config.custom.apiUrl; // Use config for URL
                    headers['Authorization'] = `Bearer ${config.custom.apiKey}`; // Use config for API key
                    requestBody = {
                        model: config.custom.model, // Use config for model
                        messages: chatData.messages,
                        stream: true
                    };
                    break;
                default:
                    throw new Error(`AI Provider "${aiProvider}" not configured or supported.`);
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorBody = await response.text(); // Try to get error details
                console.error(`API request failed with status ${response.status}: ${errorBody}`);
                throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
            }

            let fullResponse = '';
            const reader = response.body.getReader();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = new TextDecoder().decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (!line.trim()) continue;

                        if (aiProvider === 'ollama') {
                            try {
                                // Remove any BOM or unexpected characters at the start
                                const cleanLine = line.replace(/^\uFEFF/, '').trim();
                                if (!cleanLine) continue;

                                const data = JSON.parse(cleanLine);
                                if (data.message?.content) {
                                    fullResponse += data.message.content;
                                    res.write(`data: ${JSON.stringify({ content: data.message.content })}\n\n`);
                                }
                            } catch (e) {
                                console.warn('Invalid JSON chunk:', line);
                                continue;
                            }
                        } else {
                            // OpenAI and Custom format
                            if (line.startsWith('data: ')) {
                                const data = line.slice(6);
                                if (data === '[DONE]') continue;

                                try {
                                    const parsed = JSON.parse(data);
                                    const content = parsed.choices?.[0]?.delta?.content;
                                    if (content) {
                                        fullResponse += content;
                                        res.write(`data: ${JSON.stringify({ content })}\n\n`);
                                    }
                                } catch (e) {
                                    console.warn('Invalid JSON in OpenAI response:', data);
                                    continue;
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error processing stream:', error);
                res.write(`data: ${JSON.stringify({ error: 'Error processing response' })}\n\n`);
            }

            // Add the complete response to chat history
            chatData.messages.push({
                role: "assistant",
                content: fullResponse
            });
            this.chats.set(documentId, chatData);

            // End the stream
            res.write('data: [DONE]\n\n');
            res.end();

        } catch (error) {
            console.error(`Error in sendMessageStream:`, error);
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
        }
    }

    getChatHistory(documentId) {
        const chatData = this.chats.get(documentId);
        return chatData ? chatData.messages : [];
    }

    chatExists(documentId) {
        return this.chats.has(documentId);
    }

    async cleanup() {
        try {
            for (const documentId of this.chats.keys()) {
                // await this.deleteChat(documentId); //If there is such method, use it.
            }
            if (fs.existsSync(this.tempDir)) {
                await fs.promises.rmdir(this.tempDir, { recursive: true });
            }
        } catch (error) {
            console.error('Error cleaning up ChatService:', error);
        }
    }
}

module.exports = new ChatService();
