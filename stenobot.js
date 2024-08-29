const fs = require('fs');
const { Client, IntentsBitField, AttachmentBuilder } = require('discord.js');
const { joinVoiceChannel, EndBehaviorType } = require('@discordjs/voice');
const { OpusEncoder } = require('@discordjs/opus');

const { 
    DISCORD_TOK, 
    LOG_LEVEL, 
    PREFIX, 
    COMMANDS, 
    SAMPLE_RATE, 
    SILENCE_DURATION, 
    MAX_AUDIO_DURATION,
    USERNAME_MAPPING
} = require('./config');
const logger = require('./logger');
const { 
    bufferTranscription, 
    processBufferedTranscriptions
} = require('./transcriptionUtils');
const { convert_audio, playAudio } = require('./audioUtils');
const { transcribe_gspeech } = require('./googleSpeech');

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

// Map to store guild-specific data
const guildMap = new Map();

// Create necessary directories
function necessary_dirs() {
    if (!fs.existsSync('./data/')) {
        fs.mkdirSync('./data/');
    }
}
necessary_dirs();

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
            selfMute: false,
        });

        guildMap.set(mapKey, {
            text_Channel,
            voice_Channel,
            voice_Connection,
            selected_lang: 'en',
            debug: false,
            transcriptions: [],
            processingQueue: false,
            discordClient // Add this to make discordClient available in transcriptionUtils
        });

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

            if (duration < 0.2) {
                logger.debug("Duration too short; skipping.");
                return;
            }

            try {
                let audio_batches = await convert_audio(buffer);
                let fullTranscription = '';

                for (let batch of audio_batches) {
                    let transcription = await transcribe_gspeech(batch);
                    if (transcription) {
                        fullTranscription += (fullTranscription ? ' ' : '') + transcription;
                    }
                }

                if (fullTranscription) {
                    bufferTranscription(guildMap, mapKey, user, fullTranscription, startTime);
                }
            } catch (e) {
                logger.error('Error during transcription:', e);
            }
        });
    });
}

function splitAudioBuffer(buffer, maxChunkSize) {
    const chunks = [];
    for (let i = 0; i < buffer.length; i += maxChunkSize) {
        chunks.push(buffer.slice(i, i + maxChunkSize));
    }
    return chunks;
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

module.exports = {
    discordClient,
    guildMap
};