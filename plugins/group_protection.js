const { command, isAdmin } = require('../lib/');
const { getAntilink, setAntilink, getAntiword, setAntiword, addWarning, clearWarnings, getWarnings } = global.PluginDB;

// Helper function to detect links
function containsLink(text) {
    const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/gi;
    return linkRegex.test(text);
}

// Helper function to check for banned words
function containsBannedWords(text, bannedWords) {
    if (!bannedWords || bannedWords.length === 0) return false;
    const lowerText = text.toLowerCase();
    return bannedWords.some(word => lowerText.includes(word.toLowerCase()));
}

// Helper function to perform actions with warning system
async function performAction(message, action, reason) {
    const isBotAdmin = await isAdmin(message.jid, message.client.user.id, message.client);
    if (!isBotAdmin) {
        return;
    }

    // Always delete the message first
    await message.delete(message.key);

    switch (action) {
        case 'warn':
            const warningCount = addWarning(message.jid, message.participant);
            
            if (warningCount >= 3) {
                // Kick after 3 warnings
                await message.kick([message.participant]);
                clearWarnings(message.jid, message.participant);
                await message.send(message.jid, `*User Removed*\n${reason}\n\nUser @${message.participant.split('@')[0]} has been removed after 3 warnings.`, {
                    mentions: [message.participant]
                });
            } else {
                // Send warning without quoting
                const remainingWarnings = 3 - warningCount;
                await message.send(message.jid, `*Warning ${warningCount}/3*\n${reason}\n\n@${message.participant.split('@')[0]} - ${remainingWarnings} warning(s) remaining before removal.`, {
                    mentions: [message.participant]
                });
            }
            break;
        case 'delete':
            // Silent delete - no message sent
            break;
        case 'kick':
            await message.kick([message.participant]);
            await message.send(message.jid, `*User Removed*\n${reason}\n\nUser @${message.participant.split('@')[0]} has been removed from the group.`, {
                mentions: [message.participant]
            });
            break;
        default:
            await message.send(message.jid, `*Violation Detected*\n${reason}`, {
                mentions: [message.participant]
            });
    }
}

// ANTILINK COMMANDS

// Set antilink configuration
command({
    pattern: 'antilink ?(.*)',
    fromMe: false,
    desc: 'Configure antilink protection (on/off/warn/delete/kick)',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    const isUserAdmin = await isAdmin(message.jid, message.participant, message.client);
    if (!isUserAdmin) return await message.reply('_You are not an admin_');

    // Extract arguments from message text
    let messageText = message.text || "";
    let prefix = message.prefix || ".";
    let args = messageText.replace(new RegExp(`^\\${prefix}antilink\\s*`, "i"), "").trim().toLowerCase();



    const antilink = getAntilink();
    const groupSettings = antilink[message.jid] || { enabled: false, action: 'warn' };

    if (!args) {
        const status = groupSettings.enabled ? 'ENABLED' : 'DISABLED';
        return await message.reply(`*Antilink Configuration*\n\nStatus: ${status}\nAction: ${groupSettings.action.toUpperCase()}\n\n*Available Commands:*\n• .antilink on - Enable with warn action\n• .antilink off - Disable protection\n• .antilink warn - Set warn action (3 warnings then kick)\n• .antilink delete - Set silent delete action\n• .antilink kick - Set immediate kick action`);
    }

    switch (args) {
        case 'on':
            setAntilink(message.jid, { enabled: true, action: 'warn' });
            await message.reply('*Antilink protection enabled* with warn action (3 warnings then kick)');
            break;
        case 'off':
            setAntilink(message.jid, { enabled: false, action: 'warn' });
            await message.reply('*Antilink protection disabled*');
            break;
        case 'warn':
        case 'delete':
        case 'kick':
            setAntilink(message.jid, { enabled: true, action: args });
            await message.reply(`*Antilink action set to:* ${args.toUpperCase()}`);
            break;
        default:
            await message.reply('Invalid option. Use: on/off/warn/delete/kick');
    }
});

// ANTIWORD COMMANDS

// Set antiword configuration
command({
    pattern: 'antiword ?(.*)',
    fromMe: false,
    desc: 'Configure antiword protection',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    const isUserAdmin = await isAdmin(message.jid, message.participant, message.client);
    if (!isUserAdmin) return await message.reply('_You are not an admin_');

    // Extract arguments from message text
    let messageText = message.text || "";
    let prefix = message.prefix || ".";
    let args = messageText.replace(new RegExp(`^\\${prefix}antiword\\s*`, "i"), "").trim().toLowerCase();

    const antiword = getAntiword();
    const groupSettings = antiword[message.jid] || { enabled: false, action: 'warn', words: [] };

    if (!args) {
        const status = groupSettings.enabled ? 'ENABLED' : 'DISABLED';
        const wordCount = groupSettings.words ? groupSettings.words.length : 0;
        return await message.reply(`*Antiword Configuration*\n\nStatus: ${status}\nAction: ${groupSettings.action.toUpperCase()}\nBanned Words: ${wordCount}\n\n*Available Commands:*\n• .antiword on - Enable protection\n• .antiword off - Disable protection\n• .antiword warn - Set warn action (3 warnings then kick)\n• .antiword delete - Set silent delete action\n• .antiword kick - Set immediate kick action\n• .addword <word> - Add banned word\n• .removeword <word> - Remove word\n• .listwords - Show banned words`);
    }

    const commandArg = args.toLowerCase();
    switch (commandArg) {
        case 'on':
            setAntiword(message.jid, { ...groupSettings, enabled: true });
            await message.reply('*Antiword protection enabled*');
            break;
        case 'off':
            setAntiword(message.jid, { ...groupSettings, enabled: false });
            await message.reply('*Antiword protection disabled*');
            break;
        case 'warn':
        case 'delete':
        case 'kick':
            setAntiword(message.jid, { ...groupSettings, enabled: true, action: commandArg });
            await message.reply(`*Antiword action set to:* ${commandArg.toUpperCase()}`);
            break;
        default:
            await message.reply('Invalid option. Use: on/off/warn/delete/kick');
    }
});

// Add banned word
command({
    pattern: 'addword ?(.*)',
    fromMe: false,
    desc: 'Add word to banned list',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    const isUserAdmin = await isAdmin(message.jid, message.participant, message.client);
    if (!isUserAdmin) return await message.reply('_You are not an admin_');

    // Extract word from message text
    let messageText = message.text || "";
    let prefix = message.prefix || ".";
    let word = messageText.replace(new RegExp(`^\\${prefix}addword\\s*`, "i"), "").trim().toLowerCase();

    if (!word) return await message.reply('_Please provide a word to ban_\nExample: `.addword badword`');
    const antiword = getAntiword();
    const groupSettings = antiword[message.jid] || { enabled: false, action: 'warn', words: [] };

    if (groupSettings.words.includes(word)) {
        return await message.reply('_This word is already banned_');
    }

    groupSettings.words.push(word);
    setAntiword(message.jid, groupSettings);
    await message.reply(`*Word added to ban list:* ${word}\n\nTotal banned words: ${groupSettings.words.length}`);
});

// Remove banned word
command({
    pattern: 'removeword ?(.*)',
    fromMe: false,
    desc: 'Remove word from banned list',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    const isUserAdmin = await isAdmin(message.jid, message.participant, message.client);
    if (!isUserAdmin) return await message.reply('_You are not an admin_');

    // Extract word from message text
    let messageText = message.text || "";
    let prefix = message.prefix || ".";
    let word = messageText.replace(new RegExp(`^\\${prefix}removeword\\s*`, "i"), "").trim().toLowerCase();

    if (!word) return await message.reply('_Please provide a word to remove_\nExample: `.removeword badword`');
    const antiword = getAntiword();
    const groupSettings = antiword[message.jid] || { enabled: false, action: 'warn', words: [] };

    const index = groupSettings.words.indexOf(word);
    if (index === -1) {
        return await message.reply('_This word is not in the ban list_');
    }

    groupSettings.words.splice(index, 1);
    setAntiword(message.jid, groupSettings);
    await message.reply(`*Word removed from ban list:* ${word}\n\nTotal banned words: ${groupSettings.words.length}`);
});

// List banned words
command({
    pattern: 'listwords',
    fromMe: false,
    desc: 'Show all banned words',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    const isUserAdmin = await isAdmin(message.jid, message.participant, message.client);
    if (!isUserAdmin) return await message.reply('_You are not an admin_');

    const antiword = getAntiword();
    const groupSettings = antiword[message.jid] || { enabled: false, action: 'warn', words: [] };

    if (groupSettings.words.length === 0) {
        return await message.reply('_No banned words configured_');
    }

    const wordList = groupSettings.words.map((word, index) => `${index + 1}. ${word}`).join('\n');
    await message.reply(`*Banned Words List*\n\n${wordList}\n\nTotal: ${groupSettings.words.length} words`);
});

// AUTO-MODERATION (Text message handler)
command({
    on: 'text',
    fromMe: false
}, async (message, match, m) => {
    if (!message.isGroup) return;
    if (!message.text) return;

    // Skip if user is admin
    const isUserAdmin = await isAdmin(message.jid, message.participant, message.client);
    if (isUserAdmin) return;

    const messageText = message.text;

    // Check antilink
    const antilink = getAntilink();
    const antilinkSettings = antilink[message.jid];
    if (antilinkSettings && antilinkSettings.enabled && containsLink(messageText)) {
        await performAction(message, antilinkSettings.action, 'Links are not allowed in this group!');
        return;
    }

    // Check antiword
    const antiword = getAntiword();
    const antiwordSettings = antiword[message.jid];
    if (antiwordSettings && antiwordSettings.enabled && antiwordSettings.words) {
        if (containsBannedWords(messageText, antiwordSettings.words)) {
            await performAction(message, antiwordSettings.action, 'Your message contains banned words!');
            return;
        }
    }
});