// aiServiceFactory.js
const config = require('../config/config');
const openaiService = require('./openaiService');
const ollamaService = require('./ollamaService');
const customService = require('./customService');
const legalNerService = require('./legalNerService'); // Import new service

class AIServiceFactory {
    static getService(provider) {
        const aiProvider = provider || config.aiProvider;

        switch (aiProvider) {
            case 'ollama':
                return ollamaService;
            case 'openai':
                return openaiService;
            case 'custom':
                return customService;
            default:
                console.warn(`[WARNING] AI Provider "${aiProvider}" not supported, defaulting to OpenAI.`);
                return openaiService;
        }
    }

  static async enrichAnalysis(analysis, content) {
    if (config.limitFunctions?.activateLegalNER === 'yes') {
      try {
        const nerEntities = await legalNerService.recognizeEntities(content);
        analysis.legalEntities = nerEntities; // Add to existing analysis
        console.log("[DEBUG] Adding NER Entities to document");
      } catch (error) {
        console.error("[ERROR] Error running legal NER:", error);
      }
    }
    return analysis;
  }
}

module.exports = AIServiceFactory;
