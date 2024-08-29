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
   - [Bot Commands](#bot-commands)
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
- Support for multiple guilds simultaneously

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

To run the bot:

```
node stenobot.js
```

### Log Levels

The bot supports four log levels, providing different amounts of information:

- `error`: Only logs error messages.
- `warn`: Logs warnings and errors.
- `info`: Logs general information, warnings, and errors (default).
- `debug`: Logs everything, including detailed debug information.

Set the log level in the `.env` file or as an environment variable when starting the bot:

```
LOG_LEVEL=debug node stenobot.js
```

### Bot Commands

- `!start`: Start the bot and join the user's current voice channel
- `!stop`: Stop the bot and leave the voice channel
- `!help`: Display help information

## Customization

### Audio Sounds

To update the join and leave audio sounds:

1. Prepare two audio files in MP3 format.
2. Name them `join_sound.mp3` and `leave_sound.mp3`.
3. Place these files in the `sounds` directory in the project root.

### Username Mapping

To update the username mapping:

1. Edit the `username_mapping.json` file in the project root.
2. Map Discord usernames to desired display names:

```json
{
  "discord_username1": "Display Name 1",
  "discord_username2": "Display Name 2"
}
```

## Google Speech-to-Text Setup

1. Create a Google Cloud project.
2. Enable the Speech-to-Text API for your project.
3. Create a service account and download the JSON key file.
4. Set the path to this file in your `.env` under `GOOGLE_APPLICATION_CREDENTIALS`.
5. Ensure your Google Cloud project ID is set in `.env` under `GOOGLE_PROJECT_ID`.

For detailed instructions, visit the [Google Cloud Speech-to-Text documentation](https://cloud.google.com/speech-to-text/docs/quickstart-client-libraries).

## Constants and Environment Variables

- `LOG_LEVEL`: Sets the verbosity of logging.
- `PREFIX`: The command prefix for the bot (default: '!').
- `SAMPLE_RATE`: Audio sample rate for voice recognition (48000 Hz).
- `SILENCE_DURATION`: Duration of silence before considering a speech segment complete (1000 ms).
- `MAX_AUDIO_DURATION`: Maximum duration for a single audio segment (29 seconds).
- `TRANSCRIPTION_BUFFER_LENGTH`: Duration for which transcriptions are buffered before processing (30 seconds).
- `DISCORD_CHAR_LIMIT`: Maximum number of characters in a single Discord message (1900).

These can be adjusted in the `config.js` file if needed.

## Future Additions

- AI-powered meeting summarization
- Multi-language support
- Real-time translation
- Integration with project management tools
- Custom wake word
- Adjust Discord's 48000Hz stereo audio to 16000Hz mono audio to decrease token usage
- Convert to v2 of Google's speech-to-text API

## Troubleshooting

- Verify that your Discord bot token and Google Cloud credentials are correct.
- Check console logs for error messages.
- Ensure all required dependencies are installed.
- Verify that audio files are in the correct format and location.
- Set `LOG_LEVEL` to 'debug' for more detailed output.

For further assistance, please open an issue on the GitHub repository.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.