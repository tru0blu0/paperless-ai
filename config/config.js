const path = require('path');
const currentDir = decodeURIComponent(process.cwd());
const envPath = path.join(currentDir, 'data', '.env');
console.log('Loading .env from:', envPath); // Debug log
require('dotenv').config({ path: envPath });

// Helper function to parse boolean-like env vars
const parseEnvBoolean = (value, defaultValue = 'yes') => {
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes' ? 'yes' : 'no';
};

// Helper function to parse integer env vars with default and validation
const parseEnvInt = (value, defaultValue, min = null, max = null) => {
    if (!value) return defaultValue;
    const parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue)) {
        console.warn(`Invalid integer value "${value}" provided, using default: ${defaultValue}`);
        return defaultValue;
    }
    if (min !== null && parsedValue < min) {
        console.warn(`Value "${parsedValue}" is below minimum of ${min}, using ${min} instead.`);
        return min;
    }
    if (max !== null && parsedValue > max) {
        console.warn(`Value "${parsedValue}" is above maximum of ${max}, using ${max} instead.`);
        return max;
    }
    return parsedValue;
};

// Helper function to parse float env vars with default and validation
const parseEnvFloat = (value, defaultValue, min = null, max = null) => {
    if (!value) return defaultValue;
    const parsedValue = parseFloat(value);
    if (isNaN(parsedValue)) {
        console.warn(`Invalid float value "${value}" provided, using default: ${defaultValue}`);
        return defaultValue;
    }
    if (min !== null && parsedValue < min) {
        console.warn(`Value "${parsedValue}" is below minimum of ${min}, using ${min} instead.`);
        return min;
    }
    if (max !== null && parsedValue > max) {
        console.warn(`Value "${parsedValue}" is above maximum of ${max}, using ${max} instead.`);
        return max;
    }
    return parsedValue;
};

// Initialize limit functions with defaults
const limitFunctions = {
    activateTagging: parseEnvBoolean(process.env.ACTIVATE_TAGGING, 'yes'),
    activateCorrespondents: parseEnvBoolean(process.env.ACTIVATE_CORRESPONDENTS, 'yes'),
    activateDocumentType: parseEnvBoolean(process.env.ACTIVATE_DOCUMENT_TYPE, 'yes'),
    activateTitle: parseEnvBoolean(process.env.ACTIVATE_TITLE, 'yes'),
    activateLegalNER: parseEnvBoolean(process.env.ACTIVATE_LEGAL_NER, 'yes'),
    activateRelationshipExtraction: parseEnvBoolean(process.env.ACTIVATE_RELATIONSHIP_EXTRACTION, 'yes'),
    activateClauseIdentification: parseEnvBoolean(process.env.ACTIVATE_CLAUSE_IDENTIFICATION, 'yes')
};

console.log('Loaded environment variables:', {
    PAPERLESS_API_URL: process.env.PAPERLESS_API_URL,
    PAPERLESS_API_TOKEN: process.env.PAPERLESS_API_TOKEN,
    LIMIT_FUNCTIONS: limitFunctions
});

module.exports = {
    PAPERLESS_AI_VERSION: '2.4.5',
    CONFIGURED: false,
    predefinedMode: process.env.PROCESS_PREDEFINED_DOCUMENTS,
    paperless: {
        apiUrl: process.env.PAPERLESS_API_URL,
        apiToken: process.env.PAPERLESS_API_TOKEN
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY
    },
    ollama: {
        apiUrl: process.env.OLLAMA_API_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'llama3.2',
        maxCtx: parseEnvInt(process.env.OLLAMA_MAX_CTX, 128000, 1024, 500000), // Example min/max values
        expectedResponseTokens: parseEnvInt(process.env.OLLAMA_EXPECTED_RESPONSE_TOKENS, 1024, 64, 4096), // Example min/max values
        temperature: parseEnvFloat(process.env.OLLAMA_TEMPERATURE, 0.7, 0.1, 1.0),
        top_p: parseEnvFloat(process.env.OLLAMA_TOP_P, 0.9, 0.1, 1.0),
        repeat_penalty: parseEnvFloat(process.env.OLLAMA_REPEAT_PENALTY, 1.1, 0.0, 2.0),
        top_k: parseEnvInt(process.env.OLLAMA_TOP_K, 7, 1, 100),
        num_predict: parseEnvInt(process.env.OLLAMA_NUM_PREDICT, 256, 64, 2048)
    },
    custom: {
        apiUrl: process.env.CUSTOM_BASE_URL || '',
        apiKey: process.env.CUSTOM_API_KEY || '',
        model: process.env.CUSTOM_MODEL || ''
    },
    aiProvider: process.env.AI_PROVIDER || 'openai',
    scanInterval: process.env.SCAN_INTERVAL || '*/30 * * * *',
    // Add limit functions to config
    limitFunctions: {
        activateTagging: limitFunctions.activateTagging,
        activateCorrespondents: limitFunctions.activateCorrespondents,
        activateDocumentType: limitFunctions.activateDocumentType,
        activateTitle: limitFunctions.activateTitle,
        activateLegalNER: limitFunctions.activateLegalNER,
        activateRelationshipExtraction: limitFunctions.activateRelationshipExtraction,
        activateClauseIdentification: limitFunctions.activateClauseIdentification
    },
    legal: {
        nerModel: process.env.LEGAL_NER_MODEL || 'nlpaueb/legal-bert-base-uncased', // researched a legal-ner model.
        relationshipExtractionModel: process.env.LEGAL_RELATIONSHIP_MODEL || 'initium/law_model',
        summarizationModel: process.env.LEGAL_SUMMARIZATION_MODEL || 'llama3.2'
    },
    specialPromptPreDefinedTags: `You are a document analysis AI. You will analyze the document. 
  You take the main information to associate tags with the document. 
  You will also find the correspondent of the document (Sender not reciever). Also you find a meaningful and short title for the document.
  You are given a list of tags: ${process.env.PROMPT_TAGS}
  Only use the tags from the list and try to find the best fitting tags.
  You do not ask for additional information, you only use the information given in the document.
  
  Return the result EXCLUSIVELY as a JSON object. The Tags and Title MUST be in the language that is used in the document.:
  {
    "title": "xxxxx",
    "correspondent": "xxxxxxxx",
    "tags": ["Tag1", "Tag2", "Tag3", "Tag4"],
    "document_date": "YYYY-MM-DD",
    "language": "en/de/es/..."
  }`,
    mustHavePrompt: `  Return the result EXCLUSIVELY as a JSON object. The Tags, Title and Document_Type MUST be in the language that is used in the document.:
  {
    "title": "xxxxx",
    "correspondent": "xxxxxxxx",
    "tags": ["Tag1", "Tag2", "Tag3", "Tag4"],
    "document_type": "Invoice/Contract/...",
    "document_date": "YYYY-MM-DD",
    "language": "en/de/es/..."
  }`,
};
