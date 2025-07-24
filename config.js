const fs = require('fs');
const toBool = (x) => x === 'true';

if (fs.existsSync('config.env')) {
  require('dotenv').config({
    path: './config.env'
  });
}

const initialSudo = process.env.SUDO ? process.env.SUDO.split(',') : [];

// Add your numbers as sudo users
global.config = {
  ANTILINK: process.env.ANTI_LINK === 'true' || false,
  ALWAYS_ONLINE: process.env.ALWAYS_ONLINE === 'true' || false,
  LOGS: process.env.LOGS === 'true' || true,
  ANTILINK_ACTION: process.env.ANTI_LINK || 'kick',
  SESSION_ID: process.env.SESSION_ID || '',
  PORT: process.env.PORT || 8000,
  HANDLERS: process.env.HANDLER || '.',
  BRANCH: 'master',
  PACKNAME: process.env.PACKNAME || '',
  AUTHOR: process.env.AUTHOR || 'masterj',
  SUDO: initialSudo,
  CALL_REJECT: process.env.CALL_REJECT === 'true' || false,
  OWNER_NAME: process.env.OWNER_NAME || 'masterj',
  BOT_NAME: process.env.BOT_NAME || 'axiom',
  WORK_TYPE: process.env.WORK_TYPE || 'public',
  AUTO_VIEW_STATUS: process.env.AUTO_VIEW_STATUS === 'true' || false,
};
