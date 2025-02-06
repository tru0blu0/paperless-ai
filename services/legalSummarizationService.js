// services/legalSummarizationService.js
const config = require('../config/config');
const OpenAI = require('openai'); // Or your preferred method

class LegalSummarizationService {
    constructor() {
        this.model = config.legal.summarizationModel || 'gpt-3.5-turbo';
        this.client = new OpenAI({ apiKey: config.openai.apiKey });// Or your preferred method
    }

    async summarize(text) {
        try {
          const response = await this.client.chat.completions.create({
            model: this.model,
            messages: [
              {
                role: "system",
                content: "You are a helpful assistant skilled in summarizing legal documents. Create a concise abstractive summary."
              },
              {
                role: "user",
                content: text
              }
            ],
            temperature: 0.3,
          });
          return response.choices[0].message.content;
        } catch (error) {
            console.error('[ERROR] summarizing legal text:', error);
            return null;
        }
    }
}

module.exports = new LegalSummarizationService();
