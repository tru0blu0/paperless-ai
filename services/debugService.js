// service to debug the paperless-ngx api routes
const env = require('dotenv').config();
const axios = require('axios');
const config = require('../config/config'); // Import config
const paperless_api = config.paperless.apiUrl; // Access API URL from config
const paperless_token = config.paperless.apiToken; // Access API token from config

const axiosInstance = axios.create({ // Use axios.create for consistent headers
    baseURL: paperless_api,
    headers: {
        'Authorization': `Token ${paperless_token}`,
        'Content-Type': 'application/json'
    }
});

const getDocuments = async () => {
    try {
        const response = await axiosInstance.get('/documents/'); // Use axiosInstance
        return response.data;
    }
    catch (error) {
        console.error('Error fetching documents:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data)); // Stringify data for better logging
        }
        return { error: error.message }; // Return a structured error object
    }
}

const getTags = async () => {
    try {
        const response = await axiosInstance.get('/tags/'); // Use axiosInstance
        return response.data;
    }
    catch (error) {
        console.error('Error fetching tags:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data));
        }
        return { error: error.message }; // Return a structured error object
    }
}

const getCorrespondents = async () => {
    try {
        const response = await axiosInstance.get('/correspondents/'); // Use axiosInstance
        return response.data;
    }
    catch (error) {
        console.error('Error fetching correspondents:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data));
        }
        return { error: error.message }; // Return a structured error object
    }
}

module.exports = { getDocuments, getTags, getCorrespondents };
