const express = require('express');
const router = express.Router();
const legalSummarizationService = require('../services/legalSummarizationService');

router.post('/api/summarize', express.json(), async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required for summarization' });
    }
    const summary = await legalSummarizationService.summarize(content);
    if (!summary) {
      return res.status(500).json({ error: 'Failed to generate summary' });
    }
    res.json({ summary });
  } catch (error) {
    console.error('Error during summarization:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
