# Discord Transcription Bot
## AKA stenoBOT AKA Elinda Nade

## Table of Contents
1. [Introduction](#introduction)
2. [Features](#features)
3. [Setup](#setup)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
   - [Configuration](#configuration)
4. [Usage](#usage)
   - [Running the Bot](#running-the-bot)
   - [Log Levels](#log-levels)
5. [Customization](#customization)
   - [Audio Sounds](#audio-sounds)
   - [Username Mapping](#username-mapping)
6. [Google Speech-to-Text Setup](#google-speech-to-text-setup)
7. [Constants and Environment Variables](#constants-and-environment-variables)
8. [Future Additions](#future-additions)
9. [Troubleshooting](#troubleshooting)
10. [License](#license)

## Introduction

This Discord bot is designed to join voice channels, transcribe conversations using Google's Speech-to-Text API, and provide text output in a designated text channel. It features custom join/leave sounds, username mapping, and configurable logging levels.

## Features

- Voice channel joining and leaving
- Real-time speech-to-text transcription
- Custom join and leave audio cues
- Username mapping for anonymized transcripts
- Configurable logging levels
- Transcription saving to text files
- Buffer system for improved transcription accuracy

## Setup

### Prerequisites

- Node.js (v14.0.0 or higher)
- npm (Node Package Manager)
- A Discord Bot Token
- Google Cloud account with Speech-to-Text API enabled

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/Delta-Zero-Games/steno-bot.git
   cd steno-bot
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up your `.env` file (see [Configuration](#configuration))

### Configuration

Create a `.env` file in the root directory with the following content:

```
DISCORD_TOK=your_discord_bot_token_here
GOOGLE_PROJECT_ID=your_google_project_id_here
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/google-credentials.json
LOG_LEVEL=info
```

## Usage

### Running the Bot

To run the bot with the default log level (as specified in your .env file):

```
node stenobot.js
```

To run the bot with a specific log level, you can set it as an environment variable when starting the bot:

```
LOG_LEVEL=debug node stenobot.js
```

This command will run the bot with the 'debug' log level, overriding the level set in the .env file.

### Log Levels

The bot supports four log levels, providing different amounts of information in the terminal:

1. `error`: Only logs error messages. Use this in production for minimal output.
   ```
   LOG_LEVEL=error node stenobot.js
   ```

2. `warn`: Logs warnings and errors. Good for general use in production.
   ```
   LOG_LEVEL=warn node stenobot.js
   ```

3. `info`: Logs general information, warnings, and errors. This is the default and is good for most situations.
   ```
   LOG_LEVEL=info node stenobot.js
   ```

4. `debug`: Logs everything, including detailed debug information. Use this for troubleshooting or development.
   ```
   LOG_LEVEL=debug node stenobot.js
   ```

Each log level includes all the levels above it. For example, 'warn' will show both warnings and errors.

### Bot Commands

- `!start`: Start the bot and join the user's current voice channel
- `!end`: Stop the bot and leave the voice channel
- `!save`: Save the current transcription to a text file
- `!help`: Display help information

## Customization

### Audio Sounds

To update the start and end audio sounds:

1. Prepare two audio files in MP3 format.
2. Name them `join_sound.mp3` and `leave_sound.mp3`.
3. Place these files in the `sounds` directory in the project root.

The bot will automatically use these files when joining or leaving a voice channel.

### Username Mapping

To update the username mapping:

1. Open the `username_mapping.json` file in the project root.
2. Edit the JSON object to map Discord usernames to desired display names:

```json
{
  "discord_username1": "Display Name 1",
  "discord_username2": "Display Name 2"
}
```

3. Save the file. The bot will use this mapping for all future transcriptions.

## Google Speech-to-Text Setup

1. Create a Google Cloud project.
2. Enable the Speech-to-Text API for your project.
3. Create a service account and download the JSON key file.
4. Set the path to this file in your `.env` under `GOOGLE_APPLICATION_CREDENTIALS`.
5. Ensure your Google Cloud project ID is set in `.env` under `GOOGLE_PROJECT_ID`.

For detailed instructions, visit the [Google Cloud Speech-to-Text documentation](https://cloud.google.com/speech-to-text/docs/quickstart-client-libraries).

## Constants and Environment Variables

- `LOG_LEVEL`: Sets the verbosity of logging. Options are 'error', 'warn', 'info', 'debug'.
- `PREFIX`: The command prefix for the bot (default: '!').
- `SAMPLE_RATE`: Audio sample rate for voice recognition (default: 48000 Hz).
- `SILENCE_DURATION`: Duration of silence before considering a speech segment complete (default: 1000 ms).
- `MAX_AUDIO_DURATION`: Maximum duration for a single audio segment (default: 30 seconds).
- `BUFFER_DURATION`: Duration for which transcriptions are buffered before processing (default: 5000 ms).

These can be adjusted in the code if needed, but the default values should work for most use cases.

## Future Additions

- AI-powered meeting summarization: Implement an AI model to generate concise, detailed meeting notes from the transcripts. This could include:
  - Key points extraction
  - Action item identification
  - Sentiment analysis
  - Participant contribution summary
- Multi-language support: Extend the bot to handle multiple languages in the same conversation.
- Real-time translation: Add capability to translate transcriptions in real-time for multi-lingual meetings.
- Integration with project management tools: Automatically create tasks or tickets based on action items identified in the transcript.
- Custom wake word: Allow the bot to start transcribing only after hearing a specific phrase.

## Troubleshooting

- If the bot isn't responding to commands, ensure your Discord bot token is correct in the `.env` file.
- For issues with transcription, check that your Google Cloud credentials are set up correctly and the Speech-to-Text API is enabled.
- If audio playback isn't working, verify that the sound files are in the correct format and location.
- For any persistent issues, check the console logs and adjust the `LOG_LEVEL` in `.env` to 'debug' for more detailed output.

For further assistance, please open an issue on the GitHub repository.

## License

This project is licensed under the MIT License. See the [LICENSE.md](LICENSE) file for details.