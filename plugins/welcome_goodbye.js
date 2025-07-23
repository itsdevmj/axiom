const { command, isAdmin } = require('../lib/');
const { getBuffer } = require('../lib/functions');
const { getWelcome, setWelcome, getGoodbye, setGoodbye } = global.PluginDB;
const config = require('../config');

// Helper function to process message with prefixes
async function processMessage(message, text, user, groupMetadata) {
    if (!text) return null;

    const userName = user.notify || user.verifiedName || user.name || 'User';
    const userNumber = user.id.split('@')[0];
    const groupName = groupMetadata.subject || 'Group';
    const groupDesc = groupMetadata.desc || 'No description';
    const memberCount = groupMetadata.participants.length;
    const currentTime = new Date().toLocaleString();
    const currentDate = new Date().toLocaleDateString();

    return text
        .replace(/@user/gi, userName)
        .replace(/@name/gi, userName)
        .replace(/@number/gi, userNumber)
        .replace(/@group/gi, groupName)
        .replace(/@desc/gi, groupDesc)
        .replace(/@count/gi, memberCount.toString())
        .replace(/@members/gi, memberCount.toString())
        .replace(/@time/gi, currentTime)
        .replace(/@date/gi, currentDate)
        .replace(/@bot/gi, config.BOT_NAME || 'Bot')
        .replace(/@owner/gi, config.OWNER_NAME || 'Owner');
}

// WELCOME COMMANDS

// Set welcome message
command({
    pattern: 'welcome ?(.*)',
    fromMe: false,
    desc: 'Configure welcome messages (on/off/text/image/video)',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('This command only works in groups');

    const isUserAdmin = await isAdmin(message.jid, message.participant, message.client);
    if (!isUserAdmin) return await message.reply('You are not an admin');

    // Extract arguments from message text
    let messageText = message.text || "";
    let prefix = message.prefix || ".";
    let args = messageText.replace(new RegExp(`^\\${prefix}welcome\\s*`, "i"), "").trim();

    const welcome = getWelcome();
    const groupSettings = welcome[message.jid] || {
        enabled: false,
        type: 'text',
        message: 'Welcome @user to @group!\n\nWe now have @count members.',
        imageUrl: '',
        videoUrl: ''
    };

    if (!args) {
        const status = groupSettings.enabled ? 'ENABLED' : 'DISABLED';
        return await message.reply(`*Welcome Configuration*\n\nStatus: ${status}\nType: ${groupSettings.type.toUpperCase()}\nMessage: ${groupSettings.message}\n\n*Available Commands:*\n• .welcome on - Enable welcome messages\n• .welcome off - Disable welcome messages\n• .welcome text <message> - Set text message\n• .welcome image <url> <message> - Set image message\n• .welcome video <url> <message> - Set video message\n• .setwelcome <message> - Quick set text message\n\n*Available Prefixes:*\n@user, @name, @number, @group, @desc, @count, @members, @time, @date, @bot, @owner`);
    }

    const parts = args.split(' ');
    const command = parts[0].toLowerCase();

    switch (command) {
        case 'on':
            setWelcome(message.jid, { ...groupSettings, enabled: true });
            await message.reply('*Welcome messages enabled*');
            break;
        case 'off':
            setWelcome(message.jid, { ...groupSettings, enabled: false });
            await message.reply('*Welcome messages disabled*');
            break;
        case 'text':
            const textMessage = parts.slice(1).join(' ');
            if (!textMessage) return await message.reply('Please provide a welcome message\nExample: .welcome text Welcome @user to @group!');
            setWelcome(message.jid, {
                ...groupSettings,
                enabled: true,
                type: 'text',
                message: textMessage
            });
            await message.reply(`*Welcome text message set*\n\nMessage: ${textMessage}`);
            break;
        case 'image':
            const imageArgs = parts.slice(1);
            if (imageArgs.length < 2) return await message.reply('Please provide image URL and message\nExample: .welcome image https://example.com/image.jpg Welcome @user!');
            const imageUrl = imageArgs[0];
            const imageMessage = imageArgs.slice(1).join(' ');
            setWelcome(message.jid, {
                ...groupSettings,
                enabled: true,
                type: 'image',
                imageUrl: imageUrl,
                message: imageMessage
            });
            await message.reply(`*Welcome image message set*\n\nImage: ${imageUrl}\nMessage: ${imageMessage}`);
            break;
        case 'video':
            const videoArgs = parts.slice(1);
            if (videoArgs.length < 2) return await message.reply('Please provide video URL and message\nExample: .welcome video https://example.com/video.mp4 Welcome @user!');
            const videoUrl = videoArgs[0];
            const videoMessage = videoArgs.slice(1).join(' ');
            setWelcome(message.jid, {
                ...groupSettings,
                enabled: true,
                type: 'video',
                videoUrl: videoUrl,
                message: videoMessage
            });
            await message.reply(`*Welcome video message set*\n\nVideo: ${videoUrl}\nMessage: ${videoMessage}`);
            break;
        default:
            await message.reply('Invalid option. Use: on/off/text/image/video');
    }
});

// Quick set welcome message
command({
    pattern: 'setwelcome ?(.*)',
    fromMe: false,
    desc: 'Quick set welcome text message',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('This command only works in groups');

    const isUserAdmin = await isAdmin(message.jid, message.participant, message.client);
    if (!isUserAdmin) return await message.reply('You are not an admin');

    // Extract message from text
    let messageText = message.text || "";
    let prefix = message.prefix || ".";
    let welcomeMessage = messageText.replace(new RegExp(`^\\${prefix}setwelcome\\s*`, "i"), "").trim();

    if (!welcomeMessage) {
        return await message.reply('Please provide a welcome message\nExample: .setwelcome Welcome @user to @group! We now have @count members.\n\n*Available Prefixes:*\n@user, @name, @number, @group, @desc, @count, @members, @time, @date, @bot, @owner');
    }

    const welcome = getWelcome();
    const groupSettings = welcome[message.jid] || {};

    setWelcome(message.jid, {
        ...groupSettings,
        enabled: true,
        type: 'text',
        message: welcomeMessage
    });

    await message.reply(`*Welcome message set successfully*\n\nMessage: ${welcomeMessage}`);
});

// GOODBYE COMMANDS

// Set goodbye message
command({
    pattern: 'goodbye ?(.*)',
    fromMe: false,
    desc: 'Configure goodbye messages (on/off/text/image/video)',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('This command only works in groups');

    const isUserAdmin = await isAdmin(message.jid, message.participant, message.client);
    if (!isUserAdmin) return await message.reply('You are not an admin');

    // Extract arguments from message text
    let messageText = message.text || "";
    let prefix = message.prefix || ".";
    let args = messageText.replace(new RegExp(`^\\${prefix}goodbye\\s*`, "i"), "").trim();

    const goodbye = getGoodbye();
    const groupSettings = goodbye[message.jid] || {
        enabled: false,
        type: 'text',
        message: 'Goodbye @user!\n\nWe now have @count members.',
        imageUrl: '',
        videoUrl: ''
    };

    if (!args) {
        const status = groupSettings.enabled ? 'ENABLED' : 'DISABLED';
        return await message.reply(`*Goodbye Configuration*\n\nStatus: ${status}\nType: ${groupSettings.type.toUpperCase()}\nMessage: ${groupSettings.message}\n\n*Available Commands:*\n• .goodbye on - Enable goodbye messages\n• .goodbye off - Disable goodbye messages\n• .goodbye text <message> - Set text message\n• .goodbye image <url> <message> - Set image message\n• .goodbye video <url> <message> - Set video message\n• .setgoodbye <message> - Quick set text message\n\n*Available Prefixes:*\n@user, @name, @number, @group, @desc, @count, @members, @time, @date, @bot, @owner`);
    }

    const parts = args.split(' ');
    const command = parts[0].toLowerCase();

    switch (command) {
        case 'on':
            setGoodbye(message.jid, { ...groupSettings, enabled: true });
            await message.reply('*Goodbye messages enabled*');
            break;
        case 'off':
            setGoodbye(message.jid, { ...groupSettings, enabled: false });
            await message.reply('*Goodbye messages disabled*');
            break;
        case 'text':
            const textMessage = parts.slice(1).join(' ');
            if (!textMessage) return await message.reply('Please provide a goodbye message\nExample: .goodbye text Goodbye @user from @group!');
            setGoodbye(message.jid, {
                ...groupSettings,
                enabled: true,
                type: 'text',
                message: textMessage
            });
            await message.reply(`*Goodbye text message set*\n\nMessage: ${textMessage}`);
            break;
        case 'image':
            const imageArgs = parts.slice(1);
            if (imageArgs.length < 2) return await message.reply('Please provide image URL and message\nExample: .goodbye image https://example.com/image.jpg Goodbye @user!');
            const imageUrl = imageArgs[0];
            const imageMessage = imageArgs.slice(1).join(' ');
            setGoodbye(message.jid, {
                ...groupSettings,
                enabled: true,
                type: 'image',
                imageUrl: imageUrl,
                message: imageMessage
            });
            await message.reply(`*Goodbye image message set*\n\nImage: ${imageUrl}\nMessage: ${imageMessage}`);
            break;
        case 'video':
            const videoArgs = parts.slice(1);
            if (videoArgs.length < 2) return await message.reply('Please provide video URL and message\nExample: .goodbye video https://example.com/video.mp4 Goodbye @user!');
            const videoUrl = videoArgs[0];
            const videoMessage = videoArgs.slice(1).join(' ');
            setGoodbye(message.jid, {
                ...groupSettings,
                enabled: true,
                type: 'video',
                videoUrl: videoUrl,
                message: videoMessage
            });
            await message.reply(`*Goodbye video message set*\n\nVideo: ${videoUrl}\nMessage: ${videoMessage}`);
            break;
        default:
            await message.reply('Invalid option. Use: on/off/text/image/video');
    }
});

// Quick set goodbye message idk
command({
    pattern: 'setgoodbye ?(.*)',
    fromMe: false,
    desc: 'Quick set goodbye text message',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('This command only works in groups');

    const isUserAdmin = await isAdmin(message.jid, message.participant, message.client);
    if (!isUserAdmin) return await message.reply('You are not an admin');

    // Extract message from text
    let messageText = message.text || "";
    let prefix = message.prefix || ".";
    let goodbyeMessage = messageText.replace(new RegExp(`^\\${prefix}setgoodbye\\s*`, "i"), "").trim();

    if (!goodbyeMessage) {
        return await message.reply('Please provide a goodbye message\nExample: .setgoodbye Goodbye @user from @group! We now have @count members.\n\n*Available Prefixes:*\n@user, @name, @number, @group, @desc, @count, @members, @time, @date, @bot, @owner');
    }

    const goodbye = getGoodbye();
    const groupSettings = goodbye[message.jid] || {};

    setGoodbye(message.jid, {
        ...groupSettings,
        enabled: true,
        type: 'text',
        message: goodbyeMessage
    });

    await message.reply(`*Goodbye message set successfully*\n\nMessage: ${goodbyeMessage}`);
});