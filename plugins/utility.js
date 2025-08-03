const { command, isAdmin, isPrivate } = require('../lib/');
const { getAutoReact, setAutoReact, removeAutoReact, getSticky, setSticky, removeSticky, getAntidelete, setAntidelete } = global.PluginDB;

// Helper function to validate emoji
function isValidEmoji(emoji) {
    // Basic emoji validation - checks if it's a single emoji character
    const emojiRegex = /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])+$/;
    return emojiRegex.test(emoji) && emoji.length <= 4;
}

// Helper function to get random emoji from array
function getRandomEmoji(emojiArray) {
    return emojiArray[Math.floor(Math.random() * emojiArray.length)];
}

// Manual react command - React to a specific message
command({
    pattern: 'react ?(.*)',
    fromMe: false,
    desc: 'React to a message (reply to message with emoji)',
    type: 'utility'
}, async (message, match) => {
    // Extract emoji from message text
    let messageText = message.text || "";
    let prefix = message.prefix || ".";
    let emoji = messageText.replace(new RegExp(`^\\${prefix}react\\s*`, "i"), "").trim();

    // Check if replying to a message
    if (!message.quoted) {
        return await message.reply('Please reply to a message to react to it\n\nExample:\n*Reply to a message:* .react ❤️\n*Reply to a message:* .react 👍\n*Reply to a message:* .react 😂');
    }

    if (!emoji) {
        return await message.reply('Please provide an emoji to react with\n\nExample:\n.react ❤️\n.react 👍\n.react 😂\n.react 🔥');
    }

    // Validate emoji
    if (!isValidEmoji(emoji)) {
        return await message.reply('Please provide a valid emoji\n\nExamples of valid emojis:\n❤️ 👍 😂 🔥 ⭐ 💯 👏 🎉');
    }

    try {
        // React to the replied message
        await message.client.sendMessage(message.jid, {
            react: {
                text: emoji,
                key: message.quoted.key
            }
        });

    } catch (error) {
        console.log('Error reacting to message:', error);
        await message.reply('Failed to react to message. Please try again.');
    }
});

// Predefined templates for easy setup
const reactionTemplates = {
    basic: {
        name: 'Basic Reactions',
        description: 'Simple positive reactions',
        settings: {
            enabled: true,
            mode: 'random',
            emojis: ['👍', '❤️', '😊'],
            probability: 0.15,
            keywords: {
                'thanks': '🙏',
                'good': '👍',
                'love': '❤️'
            }
        }
    },
    fun: {
        name: 'Fun & Energetic',
        description: 'Lively reactions for active groups',
        settings: {
            enabled: true,
            mode: 'both',
            emojis: ['🔥', '🎉', '😂', '💯', '⭐'],
            probability: 0.25,
            keywords: {
                'funny': '😂',
                'amazing': '🔥',
                'perfect': '💯',
                'party': '🎉',
                'awesome': '⭐'
            }
        }
    },
    professional: {
        name: 'Professional',
        description: 'Minimal reactions for work groups',
        settings: {
            enabled: true,
            mode: 'keyword',
            emojis: ['👍', '✅'],
            probability: 0.1,
            keywords: {
                'done': '✅',
                'completed': '✅',
                'approved': '👍',
                'confirmed': '✅'
            }
        }
    },
    supportive: {
        name: 'Supportive',
        description: 'Encouraging and caring reactions',
        settings: {
            enabled: true,
            mode: 'both',
            emojis: ['❤️', '🤗', '👏', '🙏', '💪'],
            probability: 0.2,
            keywords: {
                'help': '🤗',
                'support': '💪',
                'thanks': '🙏',
                'great': '👏',
                'well done': '👏'
            }
        }
    }
};

// Simplified auto react configuration command
command({
    pattern: 'autoreact ?(.*)',
    fromMe: false,
    desc: 'Configure auto reactions with easy templates',
    type: 'utility'
}, async (message, match) => {
    // Check if user is admin in groups
    if (message.isGroup) {
        const isUserAdmin = await isAdmin(message.jid, message.participant, message.client);
        if (!isUserAdmin) return await message.reply('You are not an admin');
    }

    // Extract arguments from message text
    let messageText = message.text || "";
    let prefix = message.prefix || ".";
    let args = messageText.replace(new RegExp(`^\\${prefix}autoreact\\s*`, "i"), "").trim();

    const autoReact = getAutoReact();
    const chatSettings = autoReact[message.jid] || {
        enabled: false,
        mode: 'random',
        emojis: ['❤️', '👍', '😂'],
        probability: 0.15,
        keywords: {}
    };

    if (!args) {
        const status = chatSettings.enabled ? 'ON' : 'OFF';
        const templateNames = Object.keys(reactionTemplates).map(key =>
            `• ${key} - ${reactionTemplates[key].name}`
        ).join('\n');

        return await message.reply(`*Auto React System*\n\nCurrent Status: ${status}\n\n*Easy Setup Templates:*\n${templateNames}\n\n*Quick Commands:*\n• .autoreact basic - Set up basic reactions\n• .autoreact fun - Set up fun reactions\n• .autoreact professional - Set up work-friendly reactions\n• .autoreact supportive - Set up caring reactions\n• .autoreact on - Enable current settings\n• .autoreact off - Disable auto reactions\n• .autoreact status - Show current settings\n\n*Example:*\nJust type: .autoreact fun\nThat's it! Bot will automatically react to messages with fun emojis.`);
    }

    const command = args.toLowerCase();

    // Handle template selection
    if (reactionTemplates[command]) {
        const template = reactionTemplates[command];
        setAutoReact(message.jid, template.settings);

        const emojiList = template.settings.emojis.join(' ');
        const keywordCount = Object.keys(template.settings.keywords).length;

        await message.reply(`*${template.name} Template Applied*\n\n${template.description}\n\nEmojis: ${emojiList}\nKeywords: ${keywordCount} smart reactions\nChance: ${(template.settings.probability * 100)}% per message\n\nAuto reactions are now ACTIVE!\n\nTry sending messages and watch the bot react automatically.`);
        return;
    }

    switch (command) {
        case 'on':
            setAutoReact(message.jid, { ...chatSettings, enabled: true });
            await message.reply('*Auto reactions turned ON*\n\nBot will now react to messages automatically.');
            break;

        case 'off':
            setAutoReact(message.jid, { ...chatSettings, enabled: false });
            await message.reply('*Auto reactions turned OFF*\n\nBot will stop reacting automatically.');
            break;

        case 'status':
            const status = chatSettings.enabled ? 'ON' : 'OFF';
            const emojiList = chatSettings.emojis.join(' ');
            const keywordList = Object.entries(chatSettings.keywords)
                .map(([word, emoji]) => `${word} → ${emoji}`)
                .join('\n') || 'None';

            await message.reply(`*Current Auto React Settings*\n\nStatus: ${status}\nReaction Chance: ${(chatSettings.probability * 100)}%\n\nRandom Emojis:\n${emojiList}\n\nSmart Keywords:\n${keywordList}\n\nTo change settings, use a template:\n.autoreact basic\n.autoreact fun\n.autoreact professional\n.autoreact supportive`);
            break;

        default:
            await message.reply(`*Unknown template: ${command}*\n\nAvailable templates:\n• basic - Simple positive reactions\n• fun - Energetic and lively\n• professional - Work-friendly\n• supportive - Caring and encouraging\n\nExample: .autoreact fun`);
    }
});

// Remove keyword reaction
command({
    pattern: 'removekeyword ?(.*)',
    fromMe: false,
    desc: 'Remove keyword reaction',
    type: 'utility'
}, async (message, match) => {
    // Check if user is admin in groups
    if (message.isGroup) {
        const isUserAdmin = await isAdmin(message.jid, message.participant, message.client);
        if (!isUserAdmin) return await message.reply('You are not an admin');
    }

    // Extract keyword from message text
    let messageText = message.text || "";
    let prefix = message.prefix || ".";
    let keyword = messageText.replace(new RegExp(`^\\${prefix}removekeyword\\s*`, "i"), "").trim().toLowerCase();

    if (!keyword) {
        return await message.reply('Please provide a keyword to remove\nExample: .removekeyword hello');
    }

    const autoReact = getAutoReact();
    const chatSettings = autoReact[message.jid];

    if (!chatSettings || !chatSettings.keywords[keyword]) {
        return await message.reply('This keyword is not configured for auto reactions');
    }

    const removedEmoji = chatSettings.keywords[keyword];
    delete chatSettings.keywords[keyword];
    setAutoReact(message.jid, chatSettings);

    await message.reply(`*Keyword reaction removed*\n\nKeyword: ${keyword}\nEmoji: ${removedEmoji}`);
});

// Clear all auto reactions (owner only)
command({
    pattern: 'clearautoreact',
    fromMe: true,
    desc: 'Clear all auto reaction settings (Owner only)',
    type: 'utility'
}, async (message, match) => {
    const autoReact = getAutoReact();
    const chatCount = Object.keys(autoReact).length;

    if (chatCount === 0) {
        return await message.reply('No auto reaction settings to clear');
    }

    // Clear all auto reaction settings
    Object.keys(autoReact).forEach(chatId => {
        removeAutoReact(chatId);
    });

    await message.reply(`*All auto reaction settings cleared*\n\nRemoved settings from ${chatCount} chats`);
});

// AUTO-REACTION HANDLER (Text message handler)
command({
    on: 'text',
    fromMe: false,
    dontAddCommandList: true
}, async (message, match, m) => {
    if (!message.text) return;

    try {
        const autoReact = getAutoReact();
        const chatSettings = autoReact[message.jid];

        if (!chatSettings || !chatSettings.enabled) return;

        const messageText = message.text.toLowerCase();
        let shouldReact = false;
        let reactionEmoji = null;

        // Check keyword reactions first
        if (chatSettings.mode === 'keyword' || chatSettings.mode === 'both') {
            for (const [keyword, emoji] of Object.entries(chatSettings.keywords)) {
                if (messageText.includes(keyword)) {
                    shouldReact = true;
                    reactionEmoji = emoji;
                    break;
                }
            }
        }

        // Check random reactions if no keyword match or if mode allows random
        if (!shouldReact && (chatSettings.mode === 'random' || chatSettings.mode === 'both')) {
            if (Math.random() < chatSettings.probability) {
                shouldReact = true;
                reactionEmoji = getRandomEmoji(chatSettings.emojis);
            }
        }

        // React to the message
        if (shouldReact && reactionEmoji) {
            await message.client.sendMessage(message.jid, {
                react: {
                    text: reactionEmoji,
                    key: message.key
                }
            });
        }

    } catch (error) {
        console.log('Error in auto reaction handler:', error);
    }
});

// Quick react commands for common emojis
const quickReacts = [
    { pattern: 'love', emoji: '❤️', desc: 'React with love emoji' },
    { pattern: 'like', emoji: '👍', desc: 'React with thumbs up' },
    { pattern: 'laugh', emoji: '😂', desc: 'React with laughing emoji' },
    { pattern: 'fire', emoji: '🔥', desc: 'React with fire emoji' },
    { pattern: 'star', emoji: '⭐', desc: 'React with star emoji' },
    { pattern: 'clap', emoji: '👏', desc: 'React with clapping emoji' },
    { pattern: 'party', emoji: '🎉', desc: 'React with party emoji' },
    { pattern: 'perfect', emoji: '💯', desc: 'React with 100 emoji' }
];

// Create quick react commands
quickReacts.forEach(({ pattern, emoji, desc }) => {
    command({
        pattern: pattern,
        fromMe: false,
        desc: desc,
        type: 'utility'
    }, async (message, match) => {
        if (!message.reply_message) {
            return await message.reply(`Please reply to a message to react with ${emoji}`);
        }

        try {
            await message.client.sendMessage(message.jid, {
                react: {
                    text: emoji,
                    key: message.reply_message.key
                }
            });
        } catch (error) {
            console.log(`Error reacting with ${emoji}:`, error);
            await message.reply('Failed to react to message');
        }
    });
});

// STICKY COMMANDS

// Helper function to get sticker ID from message
function getStickerInfo(message) {
    if (!message.message || !message.message.stickerMessage) return null;

    const stickerMessage = message.message.stickerMessage;
    const fileSha256 = stickerMessage.fileSha256;

    if (fileSha256) {
        return Buffer.from(fileSha256).toString('hex');
    }

    return null;
}

// Helper function to execute command
async function executeCommand(message, commandText) {
    try {
        // Create a fake message object to simulate command execution
        const fakeMessage = {
            ...message,
            text: commandText,
            body: commandText
        };

        // Import the command events to execute the command
        const { commands } = require('../lib/events');

        // Find matching command
        for (const cmd of commands) {
            if (cmd.pattern && cmd.pattern.test(commandText)) {
                try {
                    const match = commandText.replace(cmd.pattern, "").trim();
                    await cmd.function(message, match, message);
                    return true;
                } catch (error) {
                    console.log('Error executing sticky command:', error);
                    return false;
                }
            }
        }

        return false;
    } catch (error) {
        console.log('Error in executeCommand:', error);
        return false;
    }
}

// Set sticky command for a sticker
command({
    pattern: 'sticky ?(.*)',
    fromMe: false,
    desc: 'Assign command to sticker (reply to sticker with command)',
    type: 'utility'
}, async (message, match) => {
    // Check if user is admin in groups
    if (message.isGroup) {
        const isUserAdmin = await isAdmin(message.jid, message.participant, message.client);
        if (!isUserAdmin) return await message.reply('You are not an admin');
    }

    // Extract command from message text
    let messageText = message.text || "";
    let prefix = message.prefix || ".";
    let commandText = messageText.replace(new RegExp(`^\\${prefix}sticky\\s*`, "i"), "").trim();

    // Check if replying to a sticker
    if (!message.reply_message || !message.reply_message.message || !message.reply_message.message.stickerMessage) {
        return await message.reply('Please reply to a sticker with the command you want to assign\n\nExample:\n*Reply to a sticker:* .sticky alive\n*Reply to a sticker:* .sticky menu\n*Reply to a sticker:* .sticky ping');
    }

    if (!commandText) {
        return await message.reply('Please provide a command to assign to this sticker\n\nExample:\n.sticky alive\n.sticky menu\n.sticky ping');
    }

    // Get sticker ID
    const stickerId = getStickerInfo(message.reply_message);
    if (!stickerId) {
        return await message.reply('Could not identify sticker. Please try again.');
    }

    // Add prefix to command if not present
    if (!commandText.startsWith(prefix)) {
        commandText = prefix + commandText;
    }

    // Store sticky command
    const stickyData = {
        command: commandText,
        createdBy: message.participant,
        createdByName: message.pushName || 'User',
        timestamp: Date.now(),
        groupId: message.isGroup ? message.jid : null,
        usageCount: 0
    };

    setSticky(stickerId, stickyData);

    await message.reply(`*Sticky Command Set Successfully*\n\nSticker assigned to command: ${commandText}\nCreated by: ${stickyData.createdByName}\nScope: ${message.isGroup ? 'This Group Only' : 'Global'}`);
});

// Remove sticky command from sticker
command({
    pattern: 'unsticky',
    fromMe: false,
    desc: 'Remove command from sticker (reply to sticker)',
    type: 'utility'
}, async (message, match) => {
    // Check if user is admin in groups
    if (message.isGroup) {
        const isUserAdmin = await isAdmin(message.jid, message.participant, message.client);
        if (!isUserAdmin) return await message.reply('You are not an admin');
    }

    // Check if replying to a sticker
    if (!message.reply_message || !message.reply_message.message || !message.reply_message.message.stickerMessage) {
        return await message.reply('Please reply to a sticker to remove its assigned command');
    }

    // Get sticker ID
    const stickerId = getStickerInfo(message.reply_message);
    if (!stickerId) {
        return await message.reply('Could not identify sticker. Please try again.');
    }

    // Check if sticky command exists
    const stickyCommands = getSticky();
    const stickyData = stickyCommands[stickerId];

    if (!stickyData) {
        return await message.reply('This sticker does not have any assigned command');
    }

    // Remove sticky command
    const removed = removeSticky(stickerId);

    if (removed) {
        await message.reply(`*Sticky Command Removed*\n\nRemoved command: ${stickyData.command}\nUsage count: ${stickyData.usageCount}`);
    } else {
        await message.reply('Failed to remove sticky command');
    }
});

// List all sticky commands
command({
    pattern: 'stickylist',
    fromMe: false,
    desc: 'Show all sticky commands',
    type: 'utility'
}, async (message, match) => {
    const stickyCommands = getSticky();
    const stickyList = Object.entries(stickyCommands);

    if (stickyList.length === 0) {
        return await message.reply('No sticky commands configured');
    }

    // Filter by group if in group
    const relevantStickies = stickyList.filter(([stickerId, data]) => {
        if (message.isGroup) {
            return !data.groupId || data.groupId === message.jid;
        }
        return true;
    });

    if (relevantStickies.length === 0) {
        return await message.reply('No sticky commands configured for this chat');
    }

    let stickyMessage = '*Sticky Commands List*\n\n';

    relevantStickies.forEach(([stickerId, data], index) => {
        const createdDate = new Date(data.timestamp).toLocaleDateString();
        const scope = data.groupId ? 'Group Only' : 'Global';

        stickyMessage += `${index + 1}. Command: ${data.command}\n`;
        stickyMessage += `   Created by: ${data.createdByName}\n`;
        stickyMessage += `   Created: ${createdDate}\n`;
        stickyMessage += `   Usage: ${data.usageCount} times\n`;
        stickyMessage += `   Scope: ${scope}\n`;
        stickyMessage += `   Sticker ID: ${stickerId.substring(0, 8)}...\n\n`;
    });

    stickyMessage += `Total: ${relevantStickies.length} sticky commands`;

    await message.reply(stickyMessage);
});

// Get info about specific sticker command
command({
    pattern: 'stickyinfo',
    fromMe: false,
    desc: 'Get info about sticker command (reply to sticker)',
    type: 'utility'
}, async (message, match) => {
    // Check if replying to a sticker
    if (!message.reply_message || !message.reply_message.message || !message.reply_message.message.stickerMessage) {
        return await message.reply('Please reply to a sticker to get its command info');
    }

    // Get sticker ID
    const stickerId = getStickerInfo(message.reply_message);
    if (!stickerId) {
        return await message.reply('Could not identify sticker. Please try again.');
    }

    // Get sticky command info
    const stickyCommands = getSticky();
    const stickyData = stickyCommands[stickerId];

    if (!stickyData) {
        return await message.reply('This sticker does not have any assigned command');
    }

    const createdDate = new Date(stickyData.timestamp).toLocaleString();
    const scope = stickyData.groupId ? 'Group Only' : 'Global';

    const infoMessage = `*Sticky Command Info*\n\nCommand: ${stickyData.command}\nCreated by: ${stickyData.createdByName}\nCreated: ${createdDate}\nUsage count: ${stickyData.usageCount}\nScope: ${scope}\nSticker ID: ${stickerId}`;

    await message.reply(infoMessage);
});

// Clear all sticky commands (owner only)
command({
    pattern: 'clearsticky',
    fromMe: true,
    desc: 'Clear all sticky commands (Owner only)',
    type: 'utility'
}, async (message, match) => {
    const stickyCommands = getSticky();
    const stickyCount = Object.keys(stickyCommands).length;

    if (stickyCount === 0) {
        return await message.reply('No sticky commands to clear');
    }

    // Clear all sticky commands
    Object.keys(stickyCommands).forEach(stickerId => {
        removeSticky(stickerId);
    });

    await message.reply(`*All Sticky Commands Cleared*\n\nRemoved ${stickyCount} sticky commands`);
});

// AUTO-STICKY EXECUTION (Sticker message handler)
command({
    on: 'sticker',
    fromMe: false
}, async (message, match, m) => {
    try {
        // Get sticker ID
        const stickerId = getStickerInfo(m);
        if (!stickerId) return;

        // Check if this sticker has an assigned command
        const stickyCommands = getSticky();
        const stickyData = stickyCommands[stickerId];

        if (!stickyData) return;

        // Check scope - if it's group-specific, only work in that group
        if (stickyData.groupId && stickyData.groupId !== message.jid) return;

        // Increment usage counter
        stickyData.usageCount = (stickyData.usageCount || 0) + 1;
        setSticky(stickerId, stickyData);

        // Execute the assigned command
        console.log(`Executing sticky command: ${stickyData.command} for sticker: ${stickerId.substring(0, 8)}`);

        const success = await executeCommand(message, stickyData.command);

        if (!success) {
            console.log(`Failed to execute sticky command: ${stickyData.command}`);
        }

    } catch (error) {
        console.log('Error in sticky command execution:', error);
    }
});

// Test sticky command execution
command({
    pattern: 'teststicky',
    fromMe: false,
    desc: 'Test sticky command execution (reply to sticker)',
    type: 'utility'
}, async (message, match) => {
    // Check if user is admin in groups
    if (message.isGroup) {
        const isUserAdmin = await isAdmin(message.jid, message.participant, message.client);
        if (!isUserAdmin) return await message.reply('You are not an admin');
    }

    // Check if replying to a sticker
    if (!message.reply_message || !message.reply_message.message || !message.reply_message.message.stickerMessage) {
        return await message.reply('Please reply to a sticker to test its command');
    }

    // Get sticker ID
    const stickerId = getStickerInfo(message.reply_message);
    if (!stickerId) {
        return await message.reply('Could not identify sticker. Please try again.');
    }

    // Get sticky command
    const stickyCommands = getSticky();
    const stickyData = stickyCommands[stickerId];

    if (!stickyData) {
        return await message.reply('This sticker does not have any assigned command');
    }

    await message.reply(`*Testing Sticky Command*\n\nCommand: ${stickyData.command}\nExecuting now...`);

    // Execute the command
    const success = await executeCommand(message, stickyData.command);

    if (success) {
        await message.reply('*Test completed successfully*');
    } else {
        await message.reply('*Test failed* - Command could not be executed');
    }
});

// ANTIDELETE SYSTEM

// Database functions
function readAntiDeleteDB() {
    return getAntidelete();
}

function writeAntiDeleteDB(data) {
    setAntidelete(data);
}

function getGlobalSettings() {
    const db = readAntiDeleteDB();
    return db.global || {
        enabled: false,
        mode: 'dm', // 'dm', 'jid', 'restore'
        targetJid: null,
        includeStatus: false // New option for status messages
    };
}

function setGlobalSettings(settings) {
    const db = readAntiDeleteDB();
    db.global = { ...getGlobalSettings(), ...settings };
    // Clear old user-specific settings to avoid confusion
    db.users = {};
    writeAntiDeleteDB(db);
}

// Legacy function for backward compatibility
function getUserSettings(userId) {
    return getGlobalSettings();
}

function setUserSettings(userId, settings) {
    setGlobalSettings(settings);
}

function getGroupSettings(groupId) {
    const db = readAntiDeleteDB();
    if (!db.groups) db.groups = {};
    return db.groups[groupId] || {
        enabled: false,
        mode: 'dm',
        targetJid: null,
        enabledBy: null
    };
}

function setGroupSettings(groupId, settings) {
    const db = readAntiDeleteDB();
    if (!db.groups) db.groups = {};
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
• \`.delete status on\` - Enable anti-delete for status messages
• \`.delete status off\` - Disable anti-delete for status messages

*Current Status:*`;

        const userSettings = getUserSettings(userId);
        let statusText = helpText;
        statusText += `\n• Anti-Delete: ${userSettings.enabled ? 'ON' : 'OFF'}`;
        statusText += `\n• Status Messages: ${userSettings.includeStatus ? 'ON' : 'OFF'}`;
        if (userSettings.enabled) {
            if (userSettings.mode === 'dm') {
                statusText += `\n• Mode: All deleted messages → Your DM`;
            } else if (userSettings.mode === 'restore') {
                statusText += `\n• Mode: All deleted messages → Restored in original chat`;
            } else if (userSettings.mode === 'jid') {
                statusText += `\n• Mode: All deleted messages → ${userSettings.targetJid?.split('@')[0] || 'Custom number'}`;
            }
        }

        return await message.reply(statusText);
    }

    const arg = match.trim().toLowerCase();

    switch (arg) {
        case 'dm':
        case 'private':
            setUserSettings(userId, { enabled: true, mode: 'dm' });
            await message.reply('_Anti-delete enabled globally - ALL deleted messages (groups & private) will be sent to your DM_');
            break;

        case 'here':
        case 'restore':
            setUserSettings(userId, { enabled: true, mode: 'restore' });
            await message.reply('_Anti-delete enabled globally - ALL deleted messages will be restored where they were deleted_');
            break;

        case 'off':
        case 'disable':
            setUserSettings(userId, { enabled: false });
            if (isGroup) {
                setGroupSettings(groupId, { enabled: false });
            }
            await message.reply('_Anti-delete disabled_');
            break;

        case 'status':
            await message.reply('_Please specify: .delete status on or .delete status off_');
            break;

        default:
            // Handle status on/off
            if (arg.startsWith('status ')) {
                const statusArg = arg.replace('status ', '').trim();
                const currentSettings = getUserSettings(userId);

                if (statusArg === 'on') {
                    setUserSettings(userId, { ...currentSettings, includeStatus: true });
                    await message.reply('_Anti-delete for status messages enabled_');
                } else if (statusArg === 'off') {
                    setUserSettings(userId, { ...currentSettings, includeStatus: false });
                    await message.reply('_Anti-delete for status messages disabled_');
                } else {
                    await message.reply('_Invalid status option. Use: .delete status on or .delete status off_');
                }
                break;
            }
            // Check if it's a phone number or JID
            const phoneRegex = /^\d{10,15}$/;
            const jidRegex = /^\d+@s\.whatsapp\.net$/;

            if (phoneRegex.test(arg)) {
                // It's a phone number
                const targetJid = arg + '@s.whatsapp.net';
                setUserSettings(userId, { enabled: true, mode: 'jid', targetJid });
                await message.reply(`_Anti-delete enabled - deleted messages will be sent to ${arg}_`);
            } else if (jidRegex.test(arg)) {
                // It's already a JID
                setUserSettings(userId, { enabled: true, mode: 'jid', targetJid: arg });
                await message.reply(`_Anti-delete enabled - deleted messages will be sent to ${arg.split('@')[0]}_`);
            } else {
                await message.reply('_Invalid option. Use: dm, here, off, or a phone number_');
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

// Tag command - Tag users with replied message
command({
    pattern: "tag ?(.*)",
    fromMe: isPrivate, // true: only from sudo numbers, false: from everyone, isPrivate: private mode
    desc: "Tag users with replied message",
    type: "group"
}, async (message, match) => {
    if (!message.isGroup) return message.reply("This command is for groups only!");
    if (!message.quoted) return message.reply("Reply to a message to tag!");

    try {
        const groupMetadata = await message.client.groupMetadata(message.jid);
        const participants = groupMetadata.participants.map(u => u.id);
        const quotedMessage = message.quoted;

        await message.client.sendMessage(message.jid, {
            text: quotedMessage.text || "",
            mentions: participants
        });
    } catch (error) {
        console.error("Tag Error:", error);
        return message.reply("Failed to tag members!");
    }
});