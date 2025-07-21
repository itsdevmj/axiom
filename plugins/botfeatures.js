const { command } = require('../lib');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../resources/database/botfeatures.json');

function readFeatures() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({
      alwaysOnline: false,
      autoType: false,
      autoRecord: false,
      autoViewStatus: false
    }, null, 2));
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function writeFeatures(newSettings) {
  const current = readFeatures();
  fs.writeFileSync(dbPath, JSON.stringify({ ...current, ...newSettings }, null, 2));
}

function featureCommand({ pattern, key, desc }) {
  command({
    pattern,
    fromMe: true,
    desc,
    type: 'user'
  }, async (message, match) => {
    const arg = match.trim().toLowerCase();
    if (arg === 'on') {
      writeFeatures({ [key]: true });
      await message.reply(`_${desc} enabled!_`);
    } else if (arg === 'off') {
      writeFeatures({ [key]: false });
      await message.reply(`_${desc} disabled!_`);
    } else {
      const features = readFeatures();
      await message.reply(`_${desc} is currently: ${features[key] ? 'ON' : 'OFF'}_\nUse .${pattern} on/off to change.`);
    }
  });
}

featureCommand({ pattern: 'online', key: 'alwaysOnline', desc: 'Always Online' });
featureCommand({ pattern: 'type', key: 'autoType', desc: 'Auto Type' });
featureCommand({ pattern: 'record', key: 'autoRecord', desc: 'Auto Record' });
featureCommand({ pattern: 'status', key: 'autoViewStatus', desc: 'Auto View Status' }); 