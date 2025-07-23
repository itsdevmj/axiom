const { command } = require('../lib/');
const { getAfk, setAfk, removeAfk } = global.PluginDB;

// Helper function to format time duration
function formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''}, ${hours % 24} hour${(hours % 24) > 1 ? 's' : ''}`;
    } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''}, ${minutes % 60} minute${(minutes % 60) > 1 ? 's' : ''}`;
    } else if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? 's' : ''}, ${seconds % 60} second${(seconds % 60) > 1 ? 's' : ''}`;
    } else {
        return `${seconds} second${seconds > 1 ? 's' : ''}`;
    }
}

// Helper function to process AFK message with prefixes
function processAfkMessage(message, afkData, mentioner) {
    if (!message) return null;

    const userName = afkData.name || 'User';
    const afkTime = formatDuration(Date.now() - afkData.timestamp);
    const afkDate = new Date(afkData.timestamp).toLocaleString();
    const mentionerName = mentioner.pushName || 'Someone';

    return message
        .replace(/@user/gi, userName)
        .replace(/@name/gi, userName)
        .replace(/@time/gi, afkTime)
        .replace(/@date/gi, afkDate)
        .replace(/@mentioner/gi, mentionerName)
        .replace(/@reason/gi, afkData.reason || 'No reason provided');
}

// Set AFK status
command({
    pattern: 'afk ?(.*)',
    fromMe: false,
    desc: 'Set AFK status with optional reason',
    type: 'user'
}, async (message, match) => {
    // Extract reason from message text
    let messageText = message.text || "";
    let prefix = message.prefix || ".";
    let reason = messageText.replace(new RegExp(`^\\${prefix}afk\\s*`, "i"), "").trim();

    const userId = message.participant;
    const userName = message.pushName || 'User';
    const timestamp = Date.now();

    // Set AFK status
    setAfk(userId, {
        name: userName,
        reason: reason || 'No reason provided',
        timestamp: timestamp,
        mentions: 0
    });

    const afkMessage = reason
        ? `*AFK Status Set*\n\n${userName} is now AFK\nReason: ${reason}\nTime: ${new Date(timestamp).toLocaleString()}`
        : `*AFK Status Set*\n\n${userName} is now AFK\nTime: ${new Date(timestamp).toLocaleString()}`;

    await message.reply(afkMessage);
});

// Remove AFK status manually
command({
    pattern: 'unafk',
    fromMe: false,
    desc: 'Remove AFK status manually',
    type: 'user'
}, async (message, match) => {
    const userId = message.participant;
    const afkData = getAfk()[userId];

    if (!afkData) {
        return await message.reply('You are not currently AFK');
    }

    const afkDuration = formatDuration(Date.now() - afkData.timestamp);
    removeAfk(userId);

    await message.reply(`*Welcome Back!*\n\nYou were AFK for ${afkDuration}\nMentions received: ${afkData.mentions || 0}`);
});

// List all AFK users
command({
    pattern: 'afklist',
    fromMe: false,
    desc: 'Show all AFK users',
    type: 'user'
}, async (message, match) => {
    const afkUsers = getAfk();
    const afkList = Object.entries(afkUsers);

    if (afkList.length === 0) {
        return await message.reply('No users are currently AFK');
    }

    let afkMessage = '*Currently AFK Users*\n\n';

    afkList.forEach(([userId, data], index) => {
        const duration = formatDuration(Date.now() - data.timestamp);
        const userNumber = userId.split('@')[0];
        afkMessage += `${index + 1}. ${data.name} (+${userNumber})\n`;
        afkMessage += `   Reason: ${data.reason}\n`;
        afkMessage += `   Duration: ${duration}\n`;
        afkMessage += `   Mentions: ${data.mentions || 0}\n\n`;
    });

    await message.reply(afkMessage);
});

// Set custom AFK message template
command({
    pattern: 'setafkmsg ?(.*)',
    fromMe: true,
    desc: 'Set custom AFK response message (Owner only)',
    type: 'user'
}, async (message, match) => {
    // Extract custom message from text
    let messageText = message.text || "";
    let prefix = message.prefix || ".";
    let customMessage = messageText.replace(new RegExp(`^\\${prefix}setafkmsg\\s*`, "i"), "").trim();

    if (!customMessage) {
        return await message.reply('Please provide a custom AFK message\n\nExample: .setafkmsg @user is currently AFK since @time ago. Reason: @reason\n\n*Available Prefixes:*\n@user, @name - AFK user name\n@time - AFK duration\n@date - AFK start date\n@mentioner - Person who mentioned\n@reason - AFK reason');
    }

    // Store custom AFK message in global config or database
    global.customAfkMessage = customMessage;

    await message.reply(`*Custom AFK message set*\n\nMessage: ${customMessage}\n\n*Available Prefixes:*\n@user, @name, @time, @date, @mentioner, @reason`);
});

// AUTO-AFK RESPONSE (Text message handler)
command({
    on: 'text',
    fromMe: false
}, async (message, match, m) => {
    if (!message.text) return;

    const userId = message.participant;
    const afkUsers = getAfk();
    const currentAfk = afkUsers[userId];

    // Check if the sender is AFK and remove them from AFK
    if (currentAfk) {
        const afkDuration = formatDuration(Date.now() - currentAfk.timestamp);
        removeAfk(userId);

        await message.reply(`*Welcome Back ${currentAfk.name}!*\n\nYou were AFK for ${afkDuration}\nMentions received: ${currentAfk.mentions || 0}`);
        return;
    }

    // Check for mentions of AFK users
    if (message.mention && message.mention.length > 0) {
        for (const mentionedUser of message.mention) {
            const afkData = afkUsers[mentionedUser];

            if (afkData) {
                // Increment mention counter
                afkData.mentions = (afkData.mentions || 0) + 1;
                setAfk(mentionedUser, afkData);

                // Use custom message if set, otherwise use default
                const defaultMessage = `*${afkData.name} is currently AFK*\n\nReason: ${afkData.reason}\nAFK since: ${formatDuration(Date.now() - afkData.timestamp)} ago\nMentions: ${afkData.mentions}`;

                let responseMessage;
                if (global.customAfkMessage) {
                    responseMessage = processAfkMessage(global.customAfkMessage, afkData, message);
                } else {
                    responseMessage = defaultMessage;
                }

                await message.reply(responseMessage);
                break; // Only respond once per message even if multiple AFK users are mentioned
            }
        }
    }

    // Also check for @everyone or @all mentions in groups
    if (message.isGroup && (message.text.includes('@everyone') || message.text.includes('@all'))) {
        const afkUsersInGroup = Object.entries(afkUsers).filter(([userId, data]) => {
            // This is a simple check - in a real scenario you'd want to check group membership
            return true;
        });

        if (afkUsersInGroup.length > 0) {
            let groupAfkMessage = '*AFK Users in this group:*\n\n';

            afkUsersInGroup.slice(0, 5).forEach(([userId, data], index) => { // Limit to 5 users
                const duration = formatDuration(Date.now() - data.timestamp);
                groupAfkMessage += `${index + 1}. ${data.name} - AFK for ${duration}\n`;
                groupAfkMessage += `   Reason: ${data.reason}\n\n`;

                // Increment mention counter
                data.mentions = (data.mentions || 0) + 1;
                setAfk(userId, data);
            });

            if (afkUsersInGroup.length > 5) {
                groupAfkMessage += `... and ${afkUsersInGroup.length - 5} more AFK users`;
            }

            await message.reply(groupAfkMessage);
        }
    }
});

// Clean up old AFK entries (optional maintenance command)
command({
    pattern: 'cleanafk',
    fromMe: true,
    desc: 'Clean up AFK entries older than 7 days (Owner only)',
    type: 'user'
}, async (message, match) => {
    const afkUsers = getAfk();
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    Object.entries(afkUsers).forEach(([userId, data]) => {
        if (data.timestamp < sevenDaysAgo) {
            removeAfk(userId);
            cleanedCount++;
        }
    });

    await message.reply(`*AFK Cleanup Complete*\n\nRemoved ${cleanedCount} old AFK entries (older than 7 days)`);
});