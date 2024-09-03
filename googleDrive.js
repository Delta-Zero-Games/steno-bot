const { google } = require('googleapis');
const fs = require('fs');
const { GOOGLE_APPLICATION_CREDENTIALS } = require('./config');
const logger = require('./logger');

// Load the drive structure JSON file
const driveStructure = require('./drive_structure.json');

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

async function getFolderContents(folderId, foldersOnly = false) {
    try {
      let query = `'${folderId}' in parents and trashed = false`;
      if (foldersOnly) {
        query += " and mimeType = 'application/vnd.google-apps.folder'";
      }
      
      const res = await drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, webViewLink)',
      });
      
      return res.data.files.filter(file => !driveStructure.ignore.includes(file.id));
    } catch (error) {
      logger.error('Error fetching folder contents:', error);
      return [];
    }
  }
  
  async function formatFileSystem(folderId, foldersOnly = false, indent = '') {
    const contents = await getFolderContents(folderId, foldersOnly);
    let output = '';
  
    for (const item of contents) {
      const formattedLink = item.webViewLink ? `[${item.name}](<${item.webViewLink}>)` : item.name;
      if (item.mimeType === 'application/vnd.google-apps.folder') {
        output += `${indent}📁 ${formattedLink}\n`;
        // Recursively get contents of subfolders
        const subfolderContents = await formatFileSystem(item.id, foldersOnly, indent + '  ');
        output += subfolderContents;
      } else if (!foldersOnly) {
        output += `${indent}📄 ${formattedLink}\n`;
      }
    }
  
    return output;
  }
  
  function getDriveFolderOptions() {
    return [
      { name: 'ALL', id: driveStructure.top_folder_id },
      ...driveStructure.folders
    ];
  }
  
  module.exports = {
    formatFileSystem,
    getDriveFolderOptions
  };