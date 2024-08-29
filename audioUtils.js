const { createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { SAMPLE_RATE, MAX_AUDIO_DURATION } = require('./config');
const logger = require('./logger');

/**
 * Converts audio data to the format required by the speech recognition API
 * @param {Buffer} input - The input audio buffer
 * @param {number} startTime - The start time of the audio in milliseconds
 * @param {number} endTime - The end time of the audio in milliseconds
 * @returns {Array<Object>} An array of converted audio batches with timing information
 */
async function convert_audio(input, startTime, endTime) {
    try {
        // Convert input buffer to 16-bit integer array
        const data = new Int16Array(input);
        // Extract mono audio by taking every second sample
        const ndata = data.filter((el, idx) => idx % 2);
        // Calculate maximum number of samples per batch
        const MAX_SAMPLES = MAX_AUDIO_DURATION * SAMPLE_RATE;

        // Initialize array to store audio batches
        const batches = [];
        const batchDuration = MAX_AUDIO_DURATION;

        // Split audio into batches
        for (let i = 0; i < ndata.length; i += MAX_SAMPLES) {
            // Calculate start and end times for each batch
            const batchStartTime = startTime + (i / SAMPLE_RATE) * 1000;
            const batchEndTime = Math.min(batchStartTime + batchDuration * 1000, endTime);

            // Create batch object with audio data and timing information
            batches.push({
                audio: Buffer.from(ndata.slice(i, i + MAX_SAMPLES)),
                startTime: batchStartTime,
                endTime: batchEndTime
            });
        }

        return batches;
    } catch (e) {
        // Log error and re-throw for handling in the calling function
        logger.error('Error in convert_audio:', e);
        throw e;
    }
}

/**
 * Plays an audio file in the voice channel
 * @param {Object} connection - The voice connection object
 * @param {string} filename - The name of the audio file to play
 * @returns {Promise} A promise that resolves when the audio finishes playing
 */
function playAudio(connection, filename) {
    return new Promise((resolve) => {
        // Create an audio player
        const player = createAudioPlayer();
        // Create an audio resource from the specified file
        const resource = createAudioResource(`./sounds/${filename}`);
        
        // Subscribe the connection to the player
        connection.subscribe(player);
        // Start playing the audio
        player.play(resource);

        // Resolve the promise when the audio finishes playing
        player.on(AudioPlayerStatus.Idle, () => {
            resolve();
        });
    });
}

module.exports = {
    convert_audio,
    playAudio
};