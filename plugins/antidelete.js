const { command } = require('../lib/');
const fs = require('fs');
const path = require('path');

// Database path for anti-delete settings
const antiDeleteDbPath = path.join(__dirname, '../resources/database/antidelete.json');

// Initialize database if it doesn't exist
if (!fs.existsSync(antiDeleteDbPath)) {
    fs.writeFileSync(antiDeleteDbPath, JSON.stringify({
        users: {},
        groups: {}
    }, null, 2));
}

// Database functions
function readAntiDeleteDB() {
    return JSON.parse(fs.readFileSync(antiDeleteDbPath, 'utf8'));
}

function writeAntiDeleteDB(data) {
    fs.writeFileSync(antiDeleteDbPath, JSON.stringify(data, null, 2));
}

function getUserSettings(userId) {
    const db = readAntiDeleteDB();
    return db.users[userId] || {
        enabled: false,
        mode: 'dm', // 'dm', 'jid', 'restore'
        targetJid: null
    };
}

function setUserSettings(userId, settings) {
    const db = readAntiDeleteDB();
    db.users[userId] = { ...getUserSettings(userId), ...settings };
    writeAntiDeleteDB(db);
}

function getGroupSettings(groupId) {
    const db = readAntiDeleteDB();
    return db.groups[groupId] || {
        enabled: false,
        mode: 'dm',
        targetJid: null,
        enabledBy: null
    };
}

function setGroupSettings(groupId, settings) {
    const db = readAntiDeleteDB();
    db.groups[groupId] = { ...getGroupSettings(groupId), ...settings };
    writeAntiDeleteDB(db);
}

// Simplified anti-delete command
command({
    pattern: 'delete',
    fromMe: true,
    desc: 'Simple anti-delete control',
    type: 'utility'
}, async (message, match) => {
    const userId = message.participant;
    const isGroup = message.isGroup;
    const groupId = isGroup ? message.jid : null;

    if (!match || !match.trim()) {
        const helpText = `*Anti-Delete Control (Global)*

*Usage Examples:*
• \`.delete dm\` - Send ALL deleted messages to your private DM
• \`.delete here\` - Restore ALL deleted messages where they were deleted
• \`.delete off\` - Disable anti-delete completely
• \`.delete <number>\` - Send ALL deleted messages to specific number

*Current Status:*`;

        const userSettings = getUserSettings(userId);
        let statusText = helpText;
        statusText += `\n• Anti-Delete: ${userSettings.enabled ? 'ON' : 'OFF'}`;
        if (userSettings.enabled) {
            if (userSettings.mode === 'dm') {
                statusText += ` (All deleted messages → Your DM)`;
            } else if (userSettings.mode === 'restore') {
                statusText += ` (All deleted messages → Restored in original chat)`;
            } else if (userSettings.mode === 'jid') {
                statusText += ` (All deleted messages → ${userSettings.targetJid?.split('@')[0] || 'Custom number'})`;
            }
        }

        return await message.reply(statusText);
    }

    const arg = match.trim().toLowerCase();

    switch (arg) {
        case 'dm':
        case 'private':
            setUserSettings(userId, { enabled: true, mode: 'dm' });
            await message.reply('_✅ Anti-delete enabled globally - ALL deleted messages (groups & private) will be sent to your DM_');
            break;

        case 'here':
        case 'restore':
            setUserSettings(userId, { enabled: true, mode: 'restore' });
            await message.reply('_✅ Anti-delete enabled globally - ALL deleted messages will be restored where they were deleted_');
            break;

        case 'off':
        case 'disable':
            setUserSettings(userId, { enabled: false });
            if (isGroup) {
                setGroupSettings(groupId, { enabled: false });
            }
            await message.reply('_❌ Anti-delete disabled_');
            break;

        default:
            // Check if it's a phone number or JID
            const phoneRegex = /^\d{10,15}$/;
            const jidRegex = /^\d+@s\.whatsapp\.net$/;

            if (phoneRegex.test(arg)) {
                // It's a phone number
                const targetJid = arg + '@s.whatsapp.net';
                setUserSettings(userId, { enabled: true, mode: 'jid', targetJid });
                await message.reply(`_✅ Anti-delete enabled - deleted messages will be sent to ${arg}_`);
            } else if (jidRegex.test(arg)) {
                // It's already a JID
                setUserSettings(userId, { enabled: true, mode: 'jid', targetJid: arg });
                await message.reply(`_✅ Anti-delete enabled - deleted messages will be sent to ${arg.split('@')[0]}_`);
            } else {
                await message.reply('_❌ Invalid option. Use: dm, here, off, or a phone number_');
            }
            break;
    }
});

// Export database functions for use in main bot
global.antiDeleteDB = {
    getUserSettings,
    getGroupSettings,
    setUserSettings,
    setGroupSettings
};