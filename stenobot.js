const fs = require('fs');
const { OpusEncoder } = require('@discordjs/opus');
const { Client, IntentsBitField, AttachmentBuilder } = require('discord.js');
const { joinVoiceChannel, EndBehaviorType, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const gspeech = require('@google-cloud/speech');
require('dotenv').config();

// Constants
/**
 * LOG_LEVEL: Determines the verbosity of logging. Options are:
 * - 'error': Only log errors
 * - 'warn': Log warnings and errors
 * - 'info': Log general information, warnings, and errors
 * - 'debug': Log everything, including debug information
 */
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

/**
 * PREFIX: The character used to trigger bot commands
 */
const PREFIX = '!';

/**
 * COMMANDS: Object containing all available bot commands
 */
const COMMANDS = {
    JOIN: PREFIX + 'start',
    LEAVE: PREFIX + 'end',
    HELP: PREFIX + 'help',
    SAVE: PREFIX + 'save'
};

/**
 * SAMPLE_RATE: The audio sample rate used for voice recognition (in Hz)
 */
const SAMPLE_RATE = 48000;

/**
 * SILENCE_DURATION: The duration of silence (in ms) before considering a speech segment complete
 */
const SILENCE_DURATION = 1000;

/**
 * MAX_AUDIO_DURATION: The maximum duration (in seconds) for a single audio segment
 */
const MAX_AUDIO_DURATION = 30;

/**
 * BUFFER_DURATION: The duration (in ms) for which transcriptions are buffered before processing
 */
const BUFFER_DURATION = 5000;

// Load the username mapping
const USERNAME_MAPPING = JSON.parse(fs.readFileSync('username_mapping.json', 'utf8'));

/**
 * Creates a timestamp string for the current date and time
 * @returns {string} Formatted timestamp string
 */
function getCurrentDateString() {
    return (new Date()).toISOString() + ' ::';
}

// Create a simple logger
const logger = {
    error: (...args) => console.error(getCurrentDateString(), ...args),
    warn: (...args) => {
        if (['warn', 'info', 'debug'].includes(LOG_LEVEL)) console.warn(getCurrentDateString(), ...args);
    },
    info: (...args) => {
        if (['info', 'debug'].includes(LOG_LEVEL)) console.log(getCurrentDateString(), ...args);
    },
    debug: (...args) => {
        if (LOG_LEVEL === 'debug') console.log(getCurrentDateString(), ...args);
    }
};

/**
 * Creates necessary directories for the bot's operation
 */
function necessary_dirs() {
    if (!fs.existsSync('./data/')){
        fs.mkdirSync('./data/');
    }
}
necessary_dirs();

/**
 * Utility function to create a delay
 * @param {number} ms - The number of milliseconds to sleep
 * @returns {Promise} A promise that resolves after the specified time
 */
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Converts audio data to the format required by the speech recognition API
 * @param {Buffer} input - The input audio buffer
 * @returns {Buffer} The converted audio buffer
 */
async function convert_audio(input) {
    try {
        const data = new Int16Array(input);
        const ndata = data.filter((el, idx) => idx % 2);
        return Buffer.from(ndata);
    } catch (e) {
        logger.error('Error in convert_audio:', e);
        throw e;
    }
}

/**
 * Loads configuration from environment variables
 * @returns {string} The Discord token
 */
function loadConfig() {
    const DISCORD_TOK = process.env.DISCORD_TOK;
    if (!DISCORD_TOK) throw new Error('Invalid or missing DISCORD_TOK');
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error('Missing Google Speech-to-Text API key file path');
    return DISCORD_TOK;
}

const DISCORD_TOK = loadConfig();

// Set up Discord client
const myIntents = new IntentsBitField();
myIntents.add(
    IntentsBitField.Flags.GuildPresences,
    IntentsBitField.Flags.GuildVoiceStates,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessageTyping
);

const discordClient = new Client({ intents: myIntents });
if (LOG_LEVEL === 'debug') discordClient.on('debug', logger.debug);

discordClient.on('ready', () => {
    logger.info(`Logged in as ${discordClient.user.tag}!`);
});

discordClient.login(DISCORD_TOK);

const guildMap = new Map();

/**
 * Handles incoming Discord messages and bot commands
 */
discordClient.on('messageCreate', async (msg) => {
    try {
        if (!('guild' in msg) || !msg.guild) return;

        const mapKey = msg.guild.id;
        const command = msg.content.trim().toLowerCase();

        switch(command) {
            case COMMANDS.JOIN:
                if (!msg.member.voice.channel) {
                    await msg.reply('Error: please join a voice channel first.');
                } else if (!guildMap.has(mapKey)) {
                    await connect(msg, mapKey);
                } else {
                    await msg.reply('Already connected.');
                }
                break;
                case COMMANDS.LEAVE:
                    if (guildMap.has(mapKey)) {
                        let val = guildMap.get(mapKey);
                        if (val.voice_Connection) {
                            // Play the leave sound before disconnecting
                            await playAudio(val.voice_Connection, 'leave_sound.mp3');
                            await val.voice_Connection.destroy();
                        }
                        guildMap.delete(mapKey);
                        await msg.reply("Disconnected.");
                    } else {
                        await msg.reply("Cannot leave because not connected.");
                    }
                    break;
            case COMMANDS.HELP:
                await msg.reply(getHelpString());
                break;
            case COMMANDS.SAVE:
                await saveTranscriptions(msg, mapKey);
                break;
        }
    } catch (e) {
        logger.error('Error in messageCreate event handler:', e);
        await msg.reply('Error#180: Something went wrong, try again or contact Bryan if this keeps happening.');
    }
});

/**
 * Generates the help message for the bot
 * @returns {string} The formatted help message
 */
function getHelpString() {
    return "Oh, hello there! I'm Elinda Nade, your friendly neighborhood stenographer.\n" +
           "I'm here to turn your voice chatter into text splatter!\n" +
           "Just hop into a voice channel and type '!start'\n" +
           "I'll then do my thing in the channel the command was used in.\n\n" +
           "**COMMANDS:** (or as I like to call them, 'Elinda's Magic Words')\n```" +
           PREFIX + "start - Unleash the Elinda! I'll start eavesdropping... I mean, transcribing.\n" +
           PREFIX + "end - Send me back to my digital hammock. I need my beauty sleep, you know.\n" +
           PREFIX + "save - Preserve my masterpiece as a text file, but use it before end.\n" +
           PREFIX + "help - You're looking at it, smartypants! Did you think this message appeared by magic?\n```" +
           "Remember, I'm just a bot. If I mess up, blame Bryan. Or sunspots. Yeah, that's more likely, let's go with sunspots.";
}

/**
 * Plays an audio file in the voice channel
 * @param {Object} connection - The voice connection object
 * @param {string} filename - The name of the audio file to play
 * @returns {Promise} A promise that resolves when the audio finishes playing
 */
function playAudio(connection, filename) {
    return new Promise((resolve) => {
        const player = createAudioPlayer();
        const resource = createAudioResource(`./sounds/${filename}`);
        
        connection.subscribe(player);
        player.play(resource);

        player.on(AudioPlayerStatus.Idle, () => {
            resolve();
        });
    });
}

/**
 * Connects the bot to a voice channel and sets up voice recognition
 * @param {Object} msg - The Discord message object
 * @param {string} mapKey - The unique identifier for the guild
 */
async function connect(msg, mapKey) {
    try {
        let voice_Channel = await discordClient.channels.fetch(msg.member.voice.channel.id);
        if (!voice_Channel) return msg.reply("Error: The voice channel does not exist!");
        let text_Channel = await discordClient.channels.fetch(msg.channel.id);
        if (!text_Channel) return msg.reply("Error: The text channel does not exist!");

        const voice_Connection = joinVoiceChannel({
            channelId: voice_Channel.id,
            guildId: voice_Channel.guild.id,
            adapterCreator: voice_Channel.guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false,  // Changed to false so the bot can play audio
        });

        guildMap.set(mapKey, {
            text_Channel,
            voice_Channel,
            voice_Connection,
            selected_lang: 'en',
            debug: false,
            transcriptions: [],
            processingQueue: false
        });

        // Play the join sound
        await playAudio(voice_Connection, 'join_sound.mp3');

        speak_impl(voice_Connection, mapKey);
        voice_Connection.on('disconnect', async (e) => {
            if (e) logger.error('Disconnect error:', e);
            guildMap.delete(mapKey);
        });

        await text_Channel.send('Oh great. I found them. I found my crackers! Ready when you are.');
        await text_Channel.send({ files: ['./data/miss_elinda_nade.gif'] });
    } catch (e) {
        logger.error('Error in connect:', e);
        await msg.reply('Error: unable to join your voice channel.');
        throw e;
    }
}

/**
 * Implements the speech recognition functionality
 * @param {Object} voice_Connection - The Discord voice connection object
 * @param {string} mapKey - The unique identifier for the guild
 */
function speak_impl(voice_Connection, mapKey) {
    const receiver = voice_Connection.receiver;
    let userBuffers = new Map();

    receiver.speaking.on('start', async (userId) => {
        const user = discordClient.users.cache.get(userId);
        const startTime = Date.now();
        const audioStream = receiver.subscribe(userId, {
            end: {
                behavior: EndBehaviorType.AfterSilence,
                duration: SILENCE_DURATION,
            },
        });

        const encoder = new OpusEncoder(SAMPLE_RATE, 2);
        let buffer = [];
        audioStream.on("data", chunk => {
            buffer.push(encoder.decode(chunk));
        });
        audioStream.once("end", async () => {
            buffer = Buffer.concat(buffer);
            const duration = buffer.length / SAMPLE_RATE / 4;
            logger.debug("Audio duration:", duration);

            if (duration < 0.5 || duration > MAX_AUDIO_DURATION) {
                if (duration <= 0.5) {
                    logger.debug("Duration too short; skipping.");
                    return;
                } else {
                    logger.info("Duration too long; truncating.");
                    buffer = buffer.slice(0, MAX_AUDIO_DURATION * SAMPLE_RATE * 4);
                }
            }

            try {
                let new_buffer = await convert_audio(buffer);
                let transcription = await transcribe_gspeech(new_buffer);
                if (transcription != null) {
                    bufferTranscription(mapKey, user, transcription, startTime);
                }
            } catch (e) {
                logger.error('Error during transcription:', e);
            }
        });
    });
}

/**
 * Buffers transcriptions for processing
 * @param {string} mapKey - The unique identifier for the guild
 * @param {Object} user - The Discord user object
 * @param {string} transcription - The transcribed text
 * @param {number} startTime - The start time of the transcription
 */
function bufferTranscription(mapKey, user, transcription, startTime) {
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
        val.processingTimeout = setTimeout(() => processBufferedTranscriptions(mapKey), BUFFER_DURATION);
    }
}

/**
 * Processes buffered transcriptions and sends them to the Discord channel
 * @param {string} mapKey - The unique identifier for the guild
 */
async function processBufferedTranscriptions(mapKey) {
    let val = guildMap.get(mapKey);
    val.processingTimeout = null;

    for (let [userId, userBuffer] of val.userBuffers) {
        if (userBuffer.length === 0) continue;

        userBuffer.sort((a, b) => a.startTime - b.startTime);

        let fullTranscription = '';
        let lastProcessedIndex = -1;

        for (let i = 0; i < userBuffer.length; i++) {
            const { transcription, startTime } = userBuffer[i];
            
            if (i === 0 || startTime - userBuffer[i-1].startTime > BUFFER_DURATION) {
                // Start of a new message
                if (fullTranscription) {
                    await sendTranscription(mapKey, userId, fullTranscription);
                    fullTranscription = '';
                }
                fullTranscription = transcription;
            } else {
                // Continuation of the current message
                fullTranscription += ' ' + transcription;
            }
            
            lastProcessedIndex = i;
        }

        if (fullTranscription) {
            await sendTranscription(mapKey, userId, fullTranscription);
        }

        // Remove processed items from the buffer
        val.userBuffers.set(userId, userBuffer.slice(lastProcessedIndex + 1));
    }

    // Schedule next processing if there are still items in any buffer
    if ([...val.userBuffers.values()].some(buffer => buffer.length > 0)) {
        val.processingTimeout = setTimeout(() => processBufferedTranscriptions(mapKey), BUFFER_DURATION);
    }
}

/**
 * Sends a transcription to the Discord channel
 * @param {string} mapKey - The unique identifier for the guild
 * @param {string} userId - The Discord user ID
 * @param {string} transcription - The transcribed text
 */
async function sendTranscription(mapKey, userId, transcription) {
    let val = guildMap.get(mapKey);
    const user = await discordClient.users.fetch(userId);
    const mappedName = USERNAME_MAPPING[user.username.toLowerCase()] || user.username;
    const message = `${mappedName}: ${transcription}`;
    val.transcriptions.push(message);
    await val.text_Channel.send(message);
}

/**
 * Saves the transcriptions to a file and sends it to the Discord channel
 * @param {Object} msg - The Discord message object
 * @param {string} mapKey - The unique identifier for the guild
 */
async function saveTranscriptions(msg, mapKey) {
    try {
        if (!guildMap.has(mapKey)) {
            return msg.reply("No transcriptions available. Start voice recognition first.");
        }

        let val = guildMap.get(mapKey);
        if (val.transcriptions.length === 0) {
            return msg.reply("No transcriptions available to save.");
        }

        const filename = `transcription_${Date.now()}.txt`;
        const content = val.transcriptions.join('\n');

        fs.writeFileSync(filename, content);

        const attachment = new AttachmentBuilder(filename, { name: filename });
        await msg.reply({ content: "Here are your transcriptions:", files: [attachment] });

        // Clear transcriptions after saving
        val.transcriptions = [];

        // Delete the file after sending
        fs.unlinkSync(filename);

    } catch (e) {
        logger.error('Error saving transcriptions:', e);
        await msg.reply('Error: Unable to save transcriptions.');
    }
}

/**
 * Initializes the Google Speech-to-Text client
 */
const gspeechclient = new gspeech.SpeechClient({
    projectId: process.env.GOOGLE_PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

/**
 * Transcribes audio using Google Speech-to-Text API
 * @param {Buffer} buffer - The audio buffer to transcribe
 * @returns {string|null} The transcribed text, or null if transcription failed
 */
async function transcribe_gspeech(buffer) {
    try {
        logger.debug('Transcribing with Google Speech-to-Text');
        const bytes = buffer.toString('base64');
        const audio = { content: bytes };
        const config = {
            encoding: 'LINEAR16',
            sampleRateHertz: SAMPLE_RATE,
            languageCode: 'en-US',
        };
        const request = { audio, config };

        const [response] = await gspeechclient.recognize(request);
        const transcription = response.results
            .map(result => result.alternatives[0].transcript)
            .join('\n');
        logger.debug(`Transcription result: ${transcription}`);
        return transcription;
    } catch (e) {
        logger.error('Error during Google Speech API transcription:', e);
        return null;
    }
}
