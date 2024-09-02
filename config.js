const fs = require('fs');
// Load environment variables from .env file
// See Readme for more information on environment variable requirements
require('dotenv').config();

module.exports = {
    // Logging level: Controls the verbosity of log output
    // Options: 'error', 'warn', 'info', or 'debug'
    // Defaults to 'info' if not set in the environment
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',

    // Discord bot command prefix: Used to identify bot commands
    PREFIX: '!',

    // Available bot commands: Defines the text triggers for bot actions
    COMMANDS: {
        JOIN: '!start',   // Command to make the bot join a voice channel and start transcribing
        LEAVE: '!stop',   // Command to make the bot leave the voice channel and stop transcribing
        HELP: '!help',    // Command to display help information about the bot
        DRIVE: '!drive'   // Command to list files in a Google Drive folder
    },

    // Audio sample rate for voice recognition (in Hz)
    // Matches Discord's audio sample rate with opus codec
    SAMPLE_RATE: 48000,

    // Duration of silence (in milliseconds) before considering a speech segment complete
    // This helps in determining when a user has finished speaking
    SILENCE_DURATION: 1000, // 1 second is typically sufficient for natural speech patterns

    // Maximum duration (in seconds) for a single audio segment
    // Google speech-to-text API has a limit of 1 minute, but we split into smaller segments for better handling
    MAX_AUDIO_DURATION: 29, // 29 seconds allows for most continuous speech segments

    // Transcription buffer size (in seconds)
    // Determines the interval at which transcriptions are processed and sent
    // Should be longer than MAX_AUDIO_DURATION to ensure all speech is captured
    TRANSCRIPTION_BUFFER_LENGTH: 30,

    // Maximum number of characters in a single Discord message
    // Set below Discord's 2000 character limit to allow for some buffer
    DISCORD_CHAR_LIMIT: 1900,

    // Discord bot token: Used for bot authentication
    // Stored as an environment variable for security
    DISCORD_TOK: process.env.DISCORD_TOK,

    // Google Cloud project ID: Identifies the Google Cloud project for speech-to-text API
    // Stored as an environment variable
    GOOGLE_PROJECT_ID: process.env.GOOGLE_PROJECT_ID,

    // Path to Google Cloud credentials file
    // Stored as an environment variable for security
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,

    // Username mapping: Allows for custom display names in transcriptions
    // Loaded from a JSON file for easy updates without code changes
    USERNAME_MAPPING: JSON.parse(fs.readFileSync('username_mapping.json', 'utf8')),
    
    // Additional configuration variables can be added here as needed
};