const fs = require('fs');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');
const { TRANSCRIPTION_BUFFER_LENGTH, USERNAME_MAPPING, DISCORD_CHAR_LIMIT } = require('./config');
const logger = require('./logger');

// Global variable to store the current transcription file path
let transcriptionFilePath = null;

/**
 * Creates a new transcription file for a given guild
 * @param {string} guildId - The ID of the Discord guild
 * @returns {string} The path of the created transcription file
 */
function createTranscriptionFile(guildId) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `transcription_${guildId}_${timestamp}.txt`;
    transcriptionFilePath = path.join('./data', filename);
    fs.writeFileSync(transcriptionFilePath, '');
    return transcriptionFilePath;
}

/**
 * Appends a message to the current transcription file
 * @param {string} message - The message to append
 */
function appendToTranscriptionFile(message) {
    if (transcriptionFilePath) {
        fs.appendFileSync(transcriptionFilePath, message + '\n');
    } else {
        logger.error('Transcription file path not set');
    }
}

/**
 * Buffers transcriptions for processing
 * @param {Map} guildMap - The map containing guild data
 * @param {string} mapKey - The unique identifier for the guild
 * @param {Object} user - The Discord user object
 * @param {Object} transcription - The transcription object with text and timing info
 */
function bufferTranscription(guildMap, mapKey, user, transcription) {
    let val = guildMap.get(mapKey);
    if (!val.transcriptionBuffer) {
        val.transcriptionBuffer = [];
    }

    val.transcriptionBuffer.push({
        userId: user.id,
        username: user.username,
        ...transcription
    });

    // Schedule processing if not already scheduled
    if (!val.processingTimeout) {
        val.processingTimeout = setTimeout(() => processBufferedTranscriptions(guildMap, mapKey), TRANSCRIPTION_BUFFER_LENGTH * 1000);
    }
}

/**
 * Processes buffered transcriptions and sends them to the Discord channel
 * @param {Map} guildMap - The map containing guild data
 * @param {string} mapKey - The unique identifier for the guild
 */
async function processBufferedTranscriptions(guildMap, mapKey) {
    let val = guildMap.get(mapKey);
    val.processingTimeout = null;

    if (val.transcriptionBuffer.length === 0) return;

    // Sort transcriptions by start time
    val.transcriptionBuffer.sort((a, b) => a.startTime - b.startTime);

    let messages = [];
    let currentMessage = '';
    let currentUser = null;

    for (let transcription of val.transcriptionBuffer) {
        if (!transcription.text || transcription.text.trim().length === 0) {
            continue;
        }

        // Map username to display name if available
        const mappedName = USERNAME_MAPPING[transcription.username.toLowerCase()] || transcription.username;
        
        if (currentUser !== transcription.userId) {
            if (currentMessage) {
                messages.push(currentMessage);
                appendToTranscriptionFile(currentMessage);
                currentMessage = '';
            }
            currentUser = transcription.userId;
            currentMessage = `${mappedName}: ${transcription.text}`;
        } else {
            currentMessage += ` ${transcription.text}`;
        }

        // Split message if it exceeds Discord's character limit
        if (currentMessage.length > DISCORD_CHAR_LIMIT) {
            messages.push(currentMessage.slice(0, DISCORD_CHAR_LIMIT));
            appendToTranscriptionFile(currentMessage.slice(0, DISCORD_CHAR_LIMIT));
            currentMessage = `${mappedName}: ${currentMessage.slice(DISCORD_CHAR_LIMIT)}`;
        }
    }

    if (currentMessage) {
        messages.push(currentMessage);
        appendToTranscriptionFile(currentMessage);
    }

    // Send processed messages to Discord
    for (let message of messages) {
        await sendTranscription(val.text_Channel, message);
    }

    val.transcriptionBuffer = [];

    // Schedule next processing if there are still transcriptions in the buffer
    if (val.transcriptionBuffer.length > 0) {
        val.processingTimeout = setTimeout(() => processBufferedTranscriptions(guildMap, mapKey), TRANSCRIPTION_BUFFER_LENGTH * 1000);
    }
}

/**
 * Sends a transcription to the Discord channel
 * @param {Object} textChannel - The Discord text channel object
 * @param {string} message - The message to send
 */
async function sendTranscription(textChannel, message) {
    try {
        await textChannel.send(message);
    } catch (error) {
        logger.error('Error sending transcription to Discord:', error);
    }
}

/**
 * Sends the transcription file to the Discord channel and deletes it afterwards
 * @param {Object} textChannel - The Discord text channel object
 */
async function sendTranscriptionFile(textChannel) {
    try {
        if (transcriptionFilePath && fs.existsSync(transcriptionFilePath)) {
            const attachment = new AttachmentBuilder(transcriptionFilePath);
            await textChannel.send({ content: "Here's the transcription file:", files: [attachment] });
            
            // Delete the file after successful sending
            fs.unlink(transcriptionFilePath, (err) => {
                if (err) {
                    logger.error('Error deleting transcription file:', err);
                } else {
                    logger.info(`Transcription file deleted: ${transcriptionFilePath}`);
                }
            });
            
            // Reset the transcriptionFilePath
            transcriptionFilePath = null;
        } else {
            await textChannel.send("No transcription file available.");
        }
    } catch (error) {
        logger.error('Error sending transcription file:', error);
    }
}

/**
 * Splits a message into chunks of specified maximum length
 * @param {string} message - The message to split
 * @param {number} maxLength - The maximum length of each chunk
 * @returns {string[]} An array of message chunks
 */
function splitMessage(message, maxLength) {
    const chunks = [];
    let currentChunk = '';

    message.split(' ').forEach(word => {
        if ((currentChunk + ' ' + word).length <= maxLength) {
            currentChunk += (currentChunk ? ' ' : '') + word;
        } else {
            chunks.push(currentChunk);
            currentChunk = word;
        }
    });

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks;
}

module.exports = {
    createTranscriptionFile,
    bufferTranscription,
    processBufferedTranscriptions,
    splitMessage,
    sendTranscription,
    sendTranscriptionFile
};