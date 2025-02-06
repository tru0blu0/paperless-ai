const config = require('../config/config');
const openaiService = require('./openaiService');
const ollamaService = require('./ollamaService');
const customService = require('./customService');

class AIServiceFactory {
    static getService(provider) {
        const aiProvider = provider || config.aiProvider; // Use provider arg or config

        switch (aiProvider) {
            case 'ollama':
                return ollamaService;
            case 'openai':
                return openaiService;
            case 'custom':
                return customService;
            default:
                console.warn(`[WARNING] AI Provider "${aiProvider}" not supported, defaulting to OpenAI.`);
                return openaiService; // Default to OpenAI
        }
    }
}

module.exports = AIServiceFactory;
