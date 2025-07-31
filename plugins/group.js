const { command, isAdmin } = require('../lib/');
const { getBuffer } = require('../lib/functions');
const { getWelcome, setWelcome, getGoodbye, setGoodbye, getAntilink, setAntilink, getAntiword, setAntiword, addWarning, clearWarnings, getWarnings } = global.PluginDB;
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

// Quick set goodbye message
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

// GROUP MANAGEMENT COMMANDS

// Add user to group
command({
    pattern: 'add',
    fromMe: false,
    desc: 'Add user to group',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    if (!match) return await message.reply('_Please provide a phone number_\nExample: `.add 1234567890`');

    const isBotAdmin = await isAdmin(message.jid, message.client.user.id, message.client);
    if (!isBotAdmin) return await message.reply('_Bot is not admin_');

    const isUserAdmin = await isAdmin(message.jid, message.user, message.client);
    if (!isUserAdmin) return await message.reply('_You are not an admin_');

    try {
        const number = match.replace(/[^0-9]/g, '');
        const jid = number + '@s.whatsapp.net';

        await message.add([jid]);
        await message.reply(`_ Added ${number} to the group_`);
    } catch (error) {
        await message.reply(`_ Failed to add user: ${error.message}_`);
    }
});

// Remove user from group
command({
    pattern: 'kick',
    fromMe: false,
    desc: 'Remove user from group',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    const isBotAdmin = await isAdmin(message.jid, message.client.user.id, message.client);
    if (!isBotAdmin) return await message.reply('_Bot is not admin_');

    const isUserAdmin = await isAdmin(message.jid, message.user, message.client);
    if (!isUserAdmin) return await message.reply('_You are not an admin_');

    let targetJid;

    if (message.reply_message) {
        targetJid = message.reply_message.jid;
    } else if (match) {
        const number = match.replace(/[^0-9]/g, '');
        targetJid = number + '@s.whatsapp.net';
    } else {
        return await message.reply('_Reply to a message or provide a phone number_\nExample: `.kick 1234567890`');
    }

    try {
        await message.kick([targetJid]);
        await message.reply(`_ Removed user from the group_`);
    } catch (error) {
        await message.reply(`_ Failed to remove user: ${error.message}_`);
    }
});

// Promote user to admin
command({
    pattern: 'promote',
    fromMe: false,
    desc: 'Promote user to admin',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    const isBotAdmin = await isAdmin(message.jid, message.client.user.id, message.client);
    if (!isBotAdmin) return await message.reply('_Bot is not admin_');

    const isUserAdmin = await isAdmin(message.jid, message.user, message.client);
    if (!isUserAdmin) return await message.reply('_You are not an admin_');

    let targetJid;

    if (message.reply_message) {
        targetJid = message.reply_message.jid;
    } else if (match) {
        const number = match.replace(/[^0-9]/g, '');
        targetJid = number + '@s.whatsapp.net';
    } else {
        return await message.reply('_Reply to a message or provide a phone number_\nExample: `.promote 1234567890`');
    }

    try {
        await message.promote([targetJid]);
        await message.reply(`_ Promoted user to admin_`);
    } catch (error) {
        await message.reply(`_ Failed to promote user: ${error.message}_`);
    }
});

// Demote admin to member
command({
    pattern: 'demote',
    fromMe: false,
    desc: 'Demote admin to member',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    const isBotAdmin = await isAdmin(message.jid, message.client.user.id, message.client);
    if (!isBotAdmin) return await message.reply('_Bot is not admin_');

    const isUserAdmin = await isAdmin(message.jid, message.user, message.client);
    if (!isUserAdmin) return await message.reply('_You are not an admin_');

    let targetJid;

    if (message.reply_message) {
        targetJid = message.reply_message.jid;
    } else if (match) {
        const number = match.replace(/[^0-9]/g, '');
        targetJid = number + '@s.whatsapp.net';
    } else {
        return await message.reply('_Reply to a message or provide a phone number_\nExample: `.demote 1234567890`');
    }

    try {
        await message.demote([targetJid]);
        await message.reply(`_ Demoted user to member_`);
    } catch (error) {
        await message.reply(`_ Failed to demote user: ${error.message}_`);
    }
});

// Mute group (only admins can send messages)
command({
    pattern: 'mute',
    fromMe: false,
    desc: 'Mute group (only admins can send messages)',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    const isBotAdmin = await isAdmin(message.jid, message.client.user.id, message.client);
    if (!isBotAdmin) return await message.reply('_Bot is not admin_');

    const isUserAdmin = await isAdmin(message.jid, message.user, message.client);
    if (!isUserAdmin) return await message.reply('_You are not an admin_');

    try {
        await message.client.groupSettingUpdate(message.jid, 'announcement');
        await message.reply('_ Group muted - Only admins can send messages_');
    } catch (error) {
        await message.reply(`_ Failed to mute group: ${error.message}_`);
    }
});

// Unmute group (everyone can send messages)
command({
    pattern: 'unmute',
    fromMe: false,
    desc: 'Unmute group (everyone can send messages)',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    const isBotAdmin = await isAdmin(message.jid, message.client.user.id, message.client);
    if (!isBotAdmin) return await message.reply('_Bot is not admin_');

    const isUserAdmin = await isAdmin(message.jid, message.user, message.client);
    if (!isUserAdmin) return await message.reply('_You are not an admin_');

    try {
        await message.client.groupSettingUpdate(message.jid, 'not_announcement');
        await message.reply('_ Group unmuted - Everyone can send messages_');
    } catch (error) {
        await message.reply(`_ Failed to unmute group: ${error.message}_`);
    }
});

// Lock group settings (only admins can edit group info)
command({
    pattern: 'lock',
    fromMe: false,
    desc: 'Lock group settings (only admins can edit)',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    const isBotAdmin = await isAdmin(message.jid, message.client.user.id, message.client);
    if (!isBotAdmin) return await message.reply('_Bot is not admin_');

    const isUserAdmin = await isAdmin(message.jid, message.user, message.client);
    if (!isUserAdmin) return await message.reply('_You are not an admin_');

    try {
        await message.client.groupSettingUpdate(message.jid, 'locked');
        await message.reply('_🔒 Group settings locked - Only admins can edit group info_');
    } catch (error) {
        await message.reply(`_ Failed to lock group: ${error.message}_`);
    }
});

// Unlock group settings (everyone can edit group info)
command({
    pattern: 'unlock',
    fromMe: false,
    desc: 'Unlock group settings (everyone can edit)',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    const isBotAdmin = await isAdmin(message.jid, message.client.user.id, message.client);
    if (!isBotAdmin) return await message.reply('_Bot is not admin_');

    const isUserAdmin = await isAdmin(message.jid, message.user, message.client);
    if (!isUserAdmin) return await message.reply('_You are not an admin_');
    try {
        await message.client.groupSettingUpdate(message.jid, 'unlocked');
        await message.reply('_Group settings unlocked - Everyone can edit group info_');
    } catch (error) {
        await message.reply(`_ Failed to unlock group: ${error.message}_`);
    }
});

// Get group info
command({
    pattern: 'ginfo',
    fromMe: false,
    desc: 'Get group information',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    try {
        const groupMetadata = await message.client.groupMetadata(message.jid);

        let groupInfo = `*Group Information*\n\n`;
        groupInfo += `*Name:* ${groupMetadata.subject}\n`;
        groupInfo += `*Description:* ${groupMetadata.desc || 'No description'}\n`;
        groupInfo += `*Created:* ${new Date(groupMetadata.creation * 1000).toDateString()}\n`;
        groupInfo += `*Total Members:* ${groupMetadata.participants.length}\n`;
        groupInfo += `*Group ID:* ${groupMetadata.id}\n`;

        const admins = groupMetadata.participants.filter(p => p.admin).length;
        groupInfo += `*Admins:* ${admins}\n`;
        groupInfo += `*Members:* ${groupMetadata.participants.length - admins}\n`;

        // Group settings
        groupInfo += `*Settings:*\n`;
        groupInfo += `• Messages: ${groupMetadata.announce ? 'Admins only' : 'Everyone'}\n`;
        groupInfo += `• Edit info: ${groupMetadata.restrict ? 'Admins only' : 'Everyone'}\n`;

        await message.reply(groupInfo);
    } catch (error) {
        await message.reply(`_ Failed to get group info: ${error.message}_`);
    }
});

// List group admins
command({
    pattern: 'admins',
    fromMe: false,
    desc: 'List group admins',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    try {
        const groupMetadata = await message.client.groupMetadata(message.jid);
        const admins = groupMetadata.participants.filter(p => p.admin);

        if (admins.length === 0) {
            return await message.reply('_No admins found in this group_');
        }

        let adminList = `*Group Admins (${admins.length})*\n\n`;

        for (let i = 0; i < admins.length; i++) {
            const admin = admins[i];
            const number = admin.id.split('@')[0];
            adminList += `${i + 1}. +${number}\n`;
        }

        await message.reply(adminList);
    } catch (error) {
        await message.reply(`_ Failed to get admin list: ${error.message}_`);
    }
});

// Tag all members
command({
    pattern: 'tagall',
    fromMe: false,
    desc: 'Tag all group members',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    try {
        const groupMetadata = await message.client.groupMetadata(message.jid);
        const participants = groupMetadata.participants.map(p => p.id);

        const customMessage = match || '';

        let tagMessage = `*${customMessage}*\n\n`;
        participants.forEach((participant, index) => {
            const number = participant.split('@')[0];
            tagMessage += `${index + 1}. @${number}\n`;
        });

        await message.client.sendMessage(message.jid, {
            text: tagMessage,
            mentions: participants
        });
    } catch (error) {
        await message.reply(`_ Failed to tag all: ${error.message}_`);
    }
});

// Leave group
command({
    pattern: 'leave',
    fromMe: false,
    desc: 'Leave the group',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    try {
        await message.reply('_Goodbye! Leaving the group..._');
        await message.client.groupLeave(message.jid);
    } catch (error) {
        await message.reply(`_ Failed to leave group: ${error.message}_`);
    }
});

// Change group subject/name
command({
    pattern: 'setname',
    fromMe: false,
    desc: 'Change group name',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    if (!match) return await message.reply('_Please provide a new group name_\nExample: `.setname My New Group`');

    const isBotAdmin = await isAdmin(message.jid, message.client.user.id, message.client);
    if (!isBotAdmin) return await message.reply('_Bot is not admin_');

    const isUserAdmin = await isAdmin(message.jid, message.user, message.client);
    if (!isUserAdmin) return await message.reply('_You are not an admin_');

    try {
        await message.client.groupUpdateSubject(message.jid, match);
        await message.reply(`_ Group name changed to: ${match}_`);
    } catch (error) {
        await message.reply(`_ Failed to change group name: ${error.message}_`);
    }
});

// Change group description
command({
    pattern: 'setdesc',
    fromMe: false,
    desc: 'Change group description',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    if (!match) return await message.reply('_Please provide a new group description_\nExample: `.setdesc Welcome to our group!`');

    const isBotAdmin = await isAdmin(message.jid, message.client.user.id, message.client);
    if (!isBotAdmin) return await message.reply('_Bot is not admin_');

    const isUserAdmin = await isAdmin(message.jid, message.user, message.client);
    if (!isUserAdmin) return await message.reply('_You are not an admin_');

    try {
        await message.client.groupUpdateDescription(message.jid, match);
        await message.reply(`_ Group description updated_`);
    } catch (error) {
        await message.reply(`_ Failed to change group description: ${error.message}_`);
    }
});

// Get group invite link
command({
    pattern: 'invite',
    fromMe: false,
    desc: 'Get group invite link',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    const isBotAdmin = await isAdmin(message.jid, message.client.user.id, message.client);
    if (!isBotAdmin) return await message.reply('_Bot is not admin_');

    const isUserAdmin = await isAdmin(message.jid, message.user, message.client);
    if (!isUserAdmin) return await message.reply('_You are not an admin_');

    try {
        const inviteCode = await message.client.groupInviteCode(message.jid);
        const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

        await message.reply(`*🔗 Group Invite Link*\n\n${inviteLink}`);
    } catch (error) {
        await message.reply(`_ Failed to get invite link: ${error.message}_`);
    }
});

// Revoke group invite link
command({
    pattern: 'revoke',
    fromMe: false,
    desc: 'Revoke group invite link',
    type: 'group'
}, async (message, match) => {
    if (!message.isGroup) return await message.reply('_This command only works in groups_');

    const isBotAdmin = await isAdmin(message.jid, message.client.user.id, message.client);
    if (!isBotAdmin) return await message.reply('_Bot is not admin_');

    const isUserAdmin = await isAdmin(message.jid, message.user, message.client);
    if (!isUserAdmin) return await message.reply('_You are not an admin_');

    try {
        await message.client.groupRevokeInvite(message.jid);
        await message.reply('_ Group invite link revoked - Old links are now invalid_');
    } catch (error) {
        await message.reply(`_ Failed to revoke invite link: ${error.message}_`);
    }
});

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


// Helper function to check if user is admin (more reliable)
async function isGroupAdmin(groupJid, userJid, client) {
    try {
        const groupMetadata = await client.groupMetadata(groupJid);
        const groupAdmins = groupMetadata.participants
            .filter((participant) => participant.admin !== null)
            .map((participant) => participant.id);

        // Direct match
        if (groupAdmins.includes(userJid)) {
            return true;
        }

        // Extract phone number for comparison (handle different formats)
        const extractNumber = (id) => {
            if (!id) return null;
            return id.split('@')[0].split(':')[0];
        };

        const userNumber = extractNumber(userJid);
        const adminNumbers = groupAdmins.map(extractNumber);

        return adminNumbers.includes(userNumber);
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

// Helper function to perform actions with warning system
async function performAction(message, action, reason) {
    const isBotAdmin = await isAdmin(message.jid, message.client.user.id, message.client);
    if (!isBotAdmin) {
        return;
    }

    // Check if the user is an admin - admins should not be affected by moderation actions
    const isUserAdmin = await isGroupAdmin(message.jid, message.participant || message.user, message.client);
    if (isUserAdmin) {
        return; // Skip moderation for admins
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
    fromMe: false,
    dontAddCommandList: true
}, async (message, match, m) => {
    if (!message.isGroup) return;
    if (!message.text) return;

    // IMPORTANT: Skip ALL moderation for group admins
    const isUserAdmin = await isGroupAdmin(message.jid, message.participant || message.user, message.client);
    if (isUserAdmin) return; // Admins are completely exempt from moderation

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