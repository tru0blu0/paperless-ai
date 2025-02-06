const axios = require('axios');
const OpenAI = require('openai');
const config = require('../config/config');
const os = require('os'); // Import the 'os' module

class ManualService {
    constructor() {
        this.aiProvider = config.aiProvider; // Store the AI provider
        if (this.aiProvider === 'custom') {
            this.openai = new OpenAI({
                apiKey: config.custom.apiKey,
                baseURL: config.custom.apiUrl // Use baseURL for custom API
            });
        } else {
            this.openai = new OpenAI({ apiKey: config.openai.apiKey });
            this.ollama = axios.create({
                timeout: 300000 // 5 minutes timeout
            });
        }
    }

    async analyzeDocument(content, existingTags, provider) {
        try {
            // Use the provider passed in, or default to the configured AI provider
            const effectiveProvider = provider || this.aiProvider;

            switch (effectiveProvider) {
                case 'openai':
                    return await this._analyzeOpenAI(content, existingTags);
                case 'ollama':
                    return await this._analyzeOllama(content, existingTags);
                case 'custom':
                    return await this._analyzeCustom(content, existingTags);
                default:
                    throw new Error(`Invalid provider: ${effectiveProvider}`);
            }
        } catch (error) {
            console.error('Error analyzing document:', error);
            return { tags: [], correspondent: null }; // Return a default object in case of error
        }
    }

    async _analyzeOpenAI(content, existingTags) {
        try {
            const existingTagsList = existingTags.map(tag => tag.name).join(', ');
            const systemPrompt = process.env.SYSTEM_PROMPT;

            const response = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL,
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: content
                    }
                ],
                temperature: 0.3,
            });

            let jsonContent = response.choices[0].message.content;
            jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

            const parsedResponse = this._parseResponse(jsonContent); // Use _parseResponse

            if (!Array.isArray(parsedResponse.tags) || typeof parsedResponse.correspondent !== 'string') {
                throw new Error('Invalid response structure');
            }

            return parsedResponse;
        } catch (error) {
            console.error('Failed to analyze document with OpenAI:', error);
            return { tags: [], correspondent: null }; // Return a default object in case of error
        }
    }

    async _analyzeCustom(content, existingTags) {
        try {
            const existingTagsList = existingTags.map(tag => tag.name).join(', ');
            const systemPrompt = process.env.SYSTEM_PROMPT;

            const response = await this.openai.chat.completions.create({
                model: config.custom.model,
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: content
                    }
                ],
                temperature: 0.3,
            });

            let jsonContent = response.choices[0].message.content;
            jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

            const parsedResponse = this._parseResponse(jsonContent); // Use _parseResponse

            if (!Array.isArray(parsedResponse.tags) || typeof parsedResponse.correspondent !== 'string') {
                throw new Error('Invalid response structure');
            }

            return parsedResponse;
        } catch (error) {
            console.error('Failed to analyze document with Custom OpenAI:', error); // More specific log
            return { tags: [], correspondent: null }; // Return a default object in case of error
        }
    }

    async _analyzeOllama(content, existingTags) {
        try {
            const prompt = process.env.SYSTEM_PROMPT;
            const getAvailableMemory = async () => {
                const totalMemory = os.totalmem();
                const freeMemory = os.freemem();
                const totalMemoryMB = (totalMemory / (1024 * 1024)).toFixed(0);
                const freeMemoryMB = (freeMemory / (1024 * 1024)).toFixed(0);
                return { totalMemoryMB, freeMemoryMB };
            };
            const calculateNumCtx = (promptTokenCount, expectedResponseTokens) => {
                const totalTokenUsage = promptTokenCount + expectedResponseTokens;
                const maxCtxLimit = config.ollama.maxCtx || 128000; // Use config or default

                const numCtx = Math.min(totalTokenUsage, maxCtxLimit);

                console.log('Prompt Token Count:', promptTokenCount);
                console.log('Expected Response Tokens:', expectedResponseTokens);
                console.log('Dynamic calculated num_ctx:', numCtx);

                return numCtx;
            };

            const calculatePromptTokenCount = (prompt) => {
                return Math.ceil(prompt.length / 4);
            };

            const { freeMemoryMB } = await getAvailableMemory();
            const expectedResponseTokens = config.ollama.expectedResponseTokens || 1024; // Use config or default
            const promptTokenCount = calculatePromptTokenCount(prompt);
            const numCtx = calculateNumCtx(promptTokenCount, expectedResponseTokens);

            const ollamaOptions = {
                temperature: config.ollama.temperature || 0.7,
                top_p: config.ollama.top_p || 0.9,
                repeat_penalty: config.ollama.repeat_penalty || 1.1,
                top_k: config.ollama.top_k || 7,
                num_predict: config.ollama.num_predict || 256,
                num_ctx: numCtx
            };

            const requestBody = {
                model: config.ollama.model,
                prompt: prompt,
                stream: false,
                options: ollamaOptions
            };

            console.debug("Ollama Request Body:", JSON.stringify(requestBody, null, 2)); // Log request for debugging

            const response = await this.ollama.post(`${config.ollama.apiUrl}/api/generate`, requestBody);

            if (!response.data || !response.data.response) {
                console.error('Unexpected Ollama response format:', response);
                throw new Error('Invalid response from Ollama API');
            }

            return this._parseResponse(response.data.response);
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                console.error('Timeout during Ollama request:', error);
                throw new Error('The analysis took too long. Please try again.');
            }
            console.error('Error analyzing document with Ollama:', error);
            throw error;  // Re-throw the error after logging
        }
    }

    _parseResponse(response) {
        try {
            // Find JSON in response using regex
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                //console.warn('No JSON found in response:', response);
                return { tags: [], correspondent: null };
            }

            let jsonStr = jsonMatch[0];
            console.log('Extracted JSON String:', jsonStr);

            try {
                // Attempt to parse the JSON
                const result = JSON.parse(jsonStr);

                // Validate and return the result
                return {
                    tags: Array.isArray(result.tags) ? result.tags : [],
                    correspondent: result.correspondent || null,
                    title: result.title || null,
                    document_date: result.document_date || null,
                    language: result.language || null
                };

            } catch (errorx) {
                console.warn('Error parsing JSON from response:', errorx.message);
                console.warn('Attempting to sanitize the JSON...');

                // Optionally sanitize the JSON here
                jsonStr = jsonStr
                    .replace(/,\s*}/g, '}') // Remove trailing commas before closing braces
                    .replace(/,\s*]/g, ']') // Remove trailing commas before closing brackets
                    .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":'); // Ensure property names are quoted

                try {
                    const sanitizedResult = JSON.parse(jsonStr);
                    return {
                        tags: Array.isArray(sanitizedResult.tags) ? sanitizedResult.tags : [],
                        correspondent: sanitizedResult.correspondent || null,
                        title: sanitizedResult.title || null,
                        document_date: sanitizedResult.document_date || null,
                        language: sanitizedResult.language || null
                    };
                } catch (finalError) {
                    console.error('Final JSON parsing failed after sanitization.\nThis happens when the JSON structure is too complex or invalid.\nThat indicates an issue with the generated JSON string by Ollama.\nSwitch to OpenAI for better results or fine tune your prompt.');
                    //console.error('Sanitized JSON String:', jsonStr);
                    return { tags: [], correspondent: null };
                }
            }
        } catch (error) {
            console.error('Error parsing Ollama response:', error.message);
            console.error('Raw response:', response);
            return { tags: [], correspondent: null };
        }
    }
}

module.exports = ManualService;
