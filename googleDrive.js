const { google } = require('googleapis');
const fs = require('fs');
const { GOOGLE_APPLICATION_CREDENTIALS } = require('./config');
const logger = require('./logger');

// Load the service account key JSON file.
const serviceAccount = JSON.parse(fs.readFileSync(GOOGLE_APPLICATION_CREDENTIALS));

// Create a new JWT client using the service account
const jwtClient = new google.auth.JWT(
  serviceAccount.client_email,
  null,
  serviceAccount.private_key,
  ['https://www.googleapis.com/auth/drive.readonly']
);

// Create a Drive client
const drive = google.drive({ version: 'v3', auth: jwtClient });

async function getFolderContents(folderId) {
  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents`,
      fields: 'files(id, name, mimeType, webViewLink)',
    });
    return res.data.files;
  } catch (error) {
    logger.error('Error fetching folder contents:', error);
    return [];
  }
}

async function formatFileSystem(folderId, indent = '') {
  const contents = await getFolderContents(folderId);
  let output = '';

  for (const item of contents) {
    if (item.mimeType === 'application/vnd.google-apps.folder') {
      output += `${indent}📁 [${item.name}](${item.webViewLink})\n`;
      output += await formatFileSystem(item.id, indent + '  ');
    } else {
      output += `${indent}📄 [${item.name}](${item.webViewLink})\n`;
    }
  }

  return output;
}

module.exports = {
  formatFileSystem,
};