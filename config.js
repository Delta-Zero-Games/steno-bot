const fs = require('fs');
// Load environment variables from .env file
require('dotenv').config();

module.exports = {
    // Logging level: 'error', 'warn', 'info', or 'debug'
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',

    // Discord bot command prefix
    PREFIX: '!',

    // Available bot commands
    COMMANDS: {
        JOIN: '!start',
        LEAVE: '!end',
        HELP: '!help',
        SAVE: '!save'
    },

    // Audio sample rate for voice recognition (in Hz)
    SAMPLE_RATE: 48000,

    // Duration of silence (in ms) before considering a speech segment complete
    SILENCE_DURATION: 600,

    // Maximum duration (in seconds) for a single audio segment
    MAX_AUDIO_DURATION: 59, // google speech-to-text API has a limit of 1 minute

    // Duration (in ms) for which transcriptions are buffered before processing
    BUFFER_DURATION: 10000, // 10 seconds

    // Maximum number of characters in a single Discord message (can't exceed 2000)
    DISCORD_CHAR_LIMIT: 1900,

    // Discord bot token (from environment variable)
    DISCORD_TOK: process.env.DISCORD_TOK,

    // Google Cloud project ID (from environment variable)
    GOOGLE_PROJECT_ID: process.env.GOOGLE_PROJECT_ID,

    // Path to Google Cloud credentials file (from environment variable)
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,

    // Load the username mapping
    USERNAME_MAPPING: JSON.parse(fs.readFileSync('username_mapping.json', 'utf8')),
    
    // Add any other configuration variables here
};