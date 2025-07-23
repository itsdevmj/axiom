const { command } = require('../lib');
const { getBotFeatures, setBotFeatures } = global.PluginDB;

function readFeatures() {
  return getBotFeatures();
}

function writeFeatures(newSettings) {
  setBotFeatures(newSettings);
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