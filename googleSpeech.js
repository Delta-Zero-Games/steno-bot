const speech = require('@google-cloud/speech');
const { GOOGLE_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS, SAMPLE_RATE } = require('./config');
const logger = require('./logger');

/**
 * Initialize the Google Speech-to-Text client
 * This uses the credentials set in your environment variables
 */
const speechClient = new speech.SpeechClient({
    projectId: GOOGLE_PROJECT_ID,
    keyFilename: GOOGLE_APPLICATION_CREDENTIALS,
});

/**
 * Transcribes audio using Google Speech-to-Text API
 * @param {Object} audioData - Object containing audio buffer and timing information
 * @param {Buffer} audioData.audio - The audio buffer to transcribe
 * @param {number} audioData.startTime - The start time of the audio segment
 * @param {number} audioData.endTime - The end time of the audio segment
 * @returns {Object|null} Object containing transcribed text and timing info, or null if transcription failed
 */
async function transcribe_gspeech(audioData) {
    try {
        logger.debug('Transcribing with Google Speech-to-Text');

        if (audioData.audio.length === 0) {
            logger.warn('Empty audio data received');
            return null;
        }

        // Convert the audio buffer to a base64 encoded string
        const audioBytes = audioData.audio.toString('base64');

        // Configure the request
        const audio = {
            content: audioBytes,
        };
        const config = {
            encoding: 'LINEAR16',
            sampleRateHertz: SAMPLE_RATE,
            languageCode: 'en-US',
            audioChannelCount: 1,
            // You can add additional configuration options here, such as:
            enableAutomaticPunctuation: true,
            // model: 'video',
            useEnhanced: true,
        };
        const request = {
            audio: audio,
            config: config,
        };

        // Detects speech in the audio file
        const [response] = await speechClient.recognize(request);

        // Extract the transcription from the response
        const transcription = response.results
            .map(result => result.alternatives[0].transcript)
            .join('\n');

        logger.debug(`Transcription result: ${transcription}`);

        // Return an object with the transcription and timing information
        return {
            text: transcription,
            startTime: audioData.startTime,
            endTime: audioData.endTime
        };
    } catch (error) {
        logger.error('Error during Google Speech API transcription:', error);
        return null;
    }
}

module.exports = {
    transcribe_gspeech
};