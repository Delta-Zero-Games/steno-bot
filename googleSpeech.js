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
 * @param {Buffer} buffer - The audio buffer to transcribe
 * @returns {string|null} The transcribed text, or null if transcription failed
 */
async function transcribe_gspeech(buffer) {
    try {
        logger.debug('Transcribing with Google Speech-to-Text');

        // Convert the audio buffer to a base64 encoded string
        const audioBytes = buffer.toString('base64');

        // Configure the request
        const audio = {
            content: audioBytes,
        };
        const config = {
            encoding: 'LINEAR16',
            sampleRateHertz: SAMPLE_RATE,
            languageCode: 'en-US',
            // You can add additional configuration options here, such as:
            // enableAutomaticPunctuation: true,
            // model: 'video',
            // useEnhanced: true,
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
        return transcription;
    } catch (error) {
        logger.error('Error during Google Speech API transcription:', error);
        return null;
    }
}

module.exports = {
    transcribe_gspeech
};