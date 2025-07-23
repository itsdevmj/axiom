const { command, isAdmin } = require('../lib/');
const { getSticky, setSticky, removeSticky } = global.PluginDB;

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