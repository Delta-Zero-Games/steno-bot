const { createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { SAMPLE_RATE, MAX_AUDIO_DURATION } = require('./config');
const logger = require('./logger');

/**
 * Converts audio data to the format required by the speech recognition API
 * @param {Buffer} input - The input audio buffer
 * @returns {Buffer[]} An array of converted audio buffers
 */
async function convert_audio(input, startTime, endTime) {
    try {
        const data = new Int16Array(input);
        const ndata = data.filter((el, idx) => idx % 2);
        const MAX_SAMPLES = MAX_AUDIO_DURATION * SAMPLE_RATE;

        // Split the audio into batches if it exceeds the maximum duration
        const batches = [];
        const batchDuration = MAX_AUDIO_DURATION;

        for (let i = 0; i < ndata.length; i += MAX_SAMPLES) {
            const batchStartTime = startTime + (i / SAMPLE_RATE) * 1000;
            const batchEndTime = Math.min(batchStartTime + batchDuration * 1000, endTime);

            batches.push({
                audio: Buffer.from(ndata.slice(i, i + MAX_SAMPLES)),
                startTime: batchStartTime,
                endTime: batchEndTime
            });
        }

        return batches;
    } catch (e) {
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
        // Create an audio resource from the file
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