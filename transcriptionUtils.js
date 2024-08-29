const { SILENCE_DURATION, BUFFER_DURATION, USERNAME_MAPPING, DISCORD_CHAR_LIMIT } = require('./config');
const logger = require('./logger');

/**
 * Buffers transcriptions for processing
 * @param {Map} guildMap - The map containing guild data
 * @param {string} mapKey - The unique identifier for the guild
 * @param {Object} user - The Discord user object
 * @param {string} transcription - The transcribed text
 * @param {number} startTime - The start time of the transcription
 */
function bufferTranscription(guildMap, mapKey, user, transcription, startTime) {
    let val = guildMap.get(mapKey);
    if (!val.userBuffers) {
        val.userBuffers = new Map();
    }

    if (!val.userBuffers.has(user.id)) {
        val.userBuffers.set(user.id, []);
    }

    let userBuffer = val.userBuffers.get(user.id);
    userBuffer.push({ transcription, startTime });

    // Schedule processing if not already scheduled
    if (!val.processingTimeout) {
        val.processingTimeout = setTimeout(() => processBufferedTranscriptions(guildMap, mapKey), BUFFER_DURATION);
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

    for (let [userId, userBuffer] of val.userBuffers) {
        if (userBuffer.length === 0) continue;

        userBuffer.sort((a, b) => a.startTime - b.startTime);

        let messages = [];
        let currentMessage = '';
        let lastTimestamp = userBuffer[0].startTime;

        for (let i = 0; i < userBuffer.length; i++) {
            const { transcription, startTime } = userBuffer[i];
            
            if (startTime - lastTimestamp > SILENCE_DURATION) {
                if (currentMessage) {
                    messages.push(currentMessage);
                    currentMessage = '';
                }
            }

            currentMessage += (currentMessage ? ' ' : '') + transcription;
            lastTimestamp = startTime;
        }

        if (currentMessage) {
            messages.push(currentMessage);
        }

        for (let message of messages) {
            await sendTranscription(guildMap, mapKey, userId, message);
        }

        // Clear the buffer after processing
        val.userBuffers.set(userId, []);
    }

    // Schedule next processing if there are still items in any buffer
    if ([...val.userBuffers.values()].some(buffer => buffer.length > 0)) {
        val.processingTimeout = setTimeout(() => processBufferedTranscriptions(guildMap, mapKey), BUFFER_DURATION);
    }
}

function isSimilarTranscription(newTranscription, lastTranscription) {
    if (!lastTranscription) return false;
    const similarity = stringSimilarity(newTranscription, lastTranscription);
    return similarity > 0.8; // 80% similarity threshold
}

function stringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    const longerLength = longer.length;
    if (longerLength === 0) {
        return 1.0;
    }
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

function editDistance(str1, str2) {
    str1 = str1.toLowerCase();
    str2 = str2.toLowerCase();
    const costs = new Array();
    for (let i = 0; i <= str1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= str2.length; j++) {
            if (i == 0)
                costs[j] = j;
            else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (str1.charAt(i - 1) != str2.charAt(j - 1))
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0)
            costs[str2.length] = lastValue;
    }
    return costs[str2.length];
}

/**
 * Sends a transcription to the Discord channel
 * @param {Map} guildMap - The map containing guild data
 * @param {string} mapKey - The unique identifier for the guild
 * @param {string} userId - The Discord user ID
 * @param {string} transcription - The transcribed text
 */
async function sendTranscription(guildMap, mapKey, userId, transcription) {
    let val = guildMap.get(mapKey);
    const user = await val.discordClient.users.fetch(userId);
    const mappedName = USERNAME_MAPPING[user.username.toLowerCase()] || user.username;
    
    const fullMessage = `${mappedName}: ${transcription}`;
    const chunks = splitMessage(fullMessage, DISCORD_CHAR_LIMIT);
    
    for (const chunk of chunks) {
        if (val.transcriptions.length === 0 || chunk !== val.transcriptions[val.transcriptions.length - 1]) {
            val.transcriptions.push(chunk);
            await val.text_Channel.send(chunk);
        }
    }
}

/**
 * Splits a message into chunks of 1800 characters or less
 * @param {string} message - The message to split
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
    bufferTranscription,
    processBufferedTranscriptions,
    splitMessage,
    sendTranscription
};