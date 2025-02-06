    // aiServiceFactory.js
const config = require('../config/config');
const openaiService = require('./openaiService');
const ollamaService = require('./ollamaService');
const customService = require('./customService');
const legalNerService = require('./legalNerService'); // Import new service
const relationshipExtractionService = require('./relationshipExtractionService');
const clauseIdentificationService = require('./clauseIdentificationService');

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
      if (config.limitFunctions?.activateRelationshipExtraction === 'yes' && analysis.legalEntities) {
        try {
          const relations = await relationshipExtractionService.extractRelationships(content, analysis.legalEntities);
          analysis.relationships = relations;
          console.log("[DEBUG] Adding relationships to document");
        } catch (error) {
          console.error("[ERROR] Error extracting relationships:", error);
        }
      }
        if (config.limitFunctions?.activateClauseIdentification === 'yes') {
            try {
                const clauses = await clauseIdentificationService.identifyClauses(content);
                analysis.clauses = clauses;
                console.log("[DEBUG] Adding identified clauses to document");
            } catch (error) {
                console.error("[ERROR] Error identifying clauses:", error);
            }
        }
    return analysis;
  }
}

module.exports = AIServiceFactory;
