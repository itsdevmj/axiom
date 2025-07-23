const { command, isAdmin } = require('../lib/');
const { getAutoReact, setAutoReact, removeAutoReact } = global.PluginDB;

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
    if (!message.reply_message) {
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
                key: message.reply_message.key
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
    fromMe: false
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