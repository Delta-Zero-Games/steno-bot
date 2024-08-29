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
    SILENCE_DURATION
} = require('./config');
const logger = require('./logger');
const { 
    createTranscriptionFile, 
    bufferTranscription, 
    sendTranscriptionFile
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
                    await sendTranscriptionFile(val.text_Channel);
                    guildMap.delete(mapKey);
                    await msg.reply("Disconnected.");
                } else {
                    await msg.reply("Cannot leave because not connected.");
                }
                break;
            case COMMANDS.HELP:
                await msg.reply(getHelpString());
                break;
            // Remove the SAVE case as it's no longer needed
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

        // Create a new text file for transcriptions
        const transcriptionFilePath = createTranscriptionFile(mapKey);

        guildMap.set(mapKey, {
            text_Channel,
            voice_Channel,
            voice_Connection,
            selected_lang: 'en',
            debug: false,
            transcriptionFile: transcriptionFilePath,
            transcriptionBuffer: [],
            processingTimeout: null,
            discordClient
        });

        await playAudio(voice_Connection, 'join_sound.mp3');

        speak_impl(voice_Connection, mapKey);
        voice_Connection.on('disconnect', async (e) => {
            if (e) logger.error('Disconnect error:', e);
            await sendTranscriptionFile(text_Channel, transcriptionFilePath);
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
    const activeStreams = new Map();

    receiver.speaking.on('start', async (userId) => {
        if (activeStreams.has(userId)) {
            logger.debug(`Already processing stream for user ${userId}`);
            return;
        }

        const user = discordClient.users.cache.get(userId);
        const startTime = Date.now();
        const audioStream = receiver.subscribe(userId, {
            end: {
                behavior: EndBehaviorType.AfterSilence,
                duration: SILENCE_DURATION,
            },
        });

        activeStreams.set(userId, audioStream);

        const encoder = new OpusEncoder(SAMPLE_RATE, 2); // stereo audio
        let buffer = [];
        audioStream.on("data", chunk => {
            buffer.push(encoder.decode(chunk));
        });
        audioStream.once("end", async () => {
            activeStreams.delete(userId);
            const endTime = Date.now();
            buffer = Buffer.concat(buffer);
            const duration = buffer.length / SAMPLE_RATE / 4; // 16-bit audio, 2 channels, 2 bytes per channel
            logger.debug("Audio duration:", duration);

            if (duration < 0.3) {
                logger.debug("Duration too short; skipping.");
                return;
            }

            try {
                let audio_batches = await convert_audio(buffer, startTime, endTime);
                logger.debug(`Number of audio batches: ${audio_batches.length}`);
                for (let batch of audio_batches) {
                    let transcription = await transcribe_gspeech(batch);
                    if (transcription) {
                        bufferTranscription(guildMap, mapKey, user, transcription);
                    }
                }
            } catch (e) {
                logger.error('Error during transcription:', e);
            }
        });
    });
}

module.exports = {
    discordClient,
    guildMap
};