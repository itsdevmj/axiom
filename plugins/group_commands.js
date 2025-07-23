const { command, isAdmin } = require('../lib/');

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
        await message.reply(`_✅ Added ${number} to the group_`);
    } catch (error) {
        await message.reply(`_❌ Failed to add user: ${error.message}_`);
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
        await message.reply(`_✅ Removed user from the group_`);
    } catch (error) {
        await message.reply(`_❌ Failed to remove user: ${error.message}_`);
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

    console.log('=== PROMOTE DEBUG ===');
    console.log('Reply message:', message.reply_message);
    console.log('Match (phone number):', match);

    if (message.reply_message) {
        targetJid = message.reply_message.jid;
        console.log('Using reply message jid:', targetJid);
    } else if (match) {
        const number = match.replace(/[^0-9]/g, '');
        targetJid = number + '@s.whatsapp.net';
        console.log('Using phone number:', number, '-> JID:', targetJid);
    } else {
        return await message.reply('_Reply to a message or provide a phone number_\nExample: `.promote 1234567890`');
    }

    console.log('Final Target JID:', targetJid);
    console.log('Group JID:', message.jid);

    try {
        await message.promote([targetJid]);
        await message.reply(`_✅ Promoted user to admin_`);
    } catch (error) {
        console.log('Promote error:', error);
        await message.reply(`_❌ Failed to promote user: ${error.message}_`);
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
        await message.reply(`_✅ Demoted user to member_`);
    } catch (error) {
        await message.reply(`_❌ Failed to demote user: ${error.message}_`);
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
        await message.reply('_✅ Group muted - Only admins can send messages_');
    } catch (error) {
        await message.reply(`_❌ Failed to mute group: ${error.message}_`);
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
        await message.reply('_✅ Group unmuted - Everyone can send messages_');
    } catch (error) {
        await message.reply(`_❌ Failed to unmute group: ${error.message}_`);
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
        await message.reply(`_❌ Failed to lock group: ${error.message}_`);
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
        await message.reply('_🔓 Group settings unlocked - Everyone can edit group info_');
    } catch (error) {
        await message.reply(`_❌ Failed to unlock group: ${error.message}_`);
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

        let groupInfo = `*📋 Group Information*\n\n`;
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
        await message.reply(`_❌ Failed to get group info: ${error.message}_`);
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

        let adminList = `*👑 Group Admins (${admins.length})*\n\n`;

        for (let i = 0; i < admins.length; i++) {
            const admin = admins[i];
            const number = admin.id.split('@')[0];
            adminList += `${i + 1}. +${number}\n`;
        }

        await message.reply(adminList);
    } catch (error) {
        await message.reply(`_❌ Failed to get admin list: ${error.message}_`);
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

        const customMessage = match || 'Group Announcement';

        let tagMessage = `*📢 ${customMessage}*\n\n`;
        participants.forEach((participant, index) => {
            const number = participant.split('@')[0];
            tagMessage += `${index + 1}. @${number}\n`;
        });

        await message.client.sendMessage(message.jid, {
            text: tagMessage,
            mentions: participants
        });
    } catch (error) {
        await message.reply(`_❌ Failed to tag all: ${error.message}_`);
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
        await message.reply('_👋 Goodbye! Leaving the group..._');
        await message.client.groupLeave(message.jid);
    } catch (error) {
        await message.reply(`_❌ Failed to leave group: ${error.message}_`);
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
        await message.reply(`_✅ Group name changed to: ${match}_`);
    } catch (error) {
        await message.reply(`_❌ Failed to change group name: ${error.message}_`);
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
        await message.reply(`_✅ Group description updated_`);
    } catch (error) {
        await message.reply(`_❌ Failed to change group description: ${error.message}_`);
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
        await message.reply(`_❌ Failed to get invite link: ${error.message}_`);
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
        await message.reply('_✅ Group invite link revoked - Old links are now invalid_');
    } catch (error) {
        await message.reply(`_❌ Failed to revoke invite link: ${error.message}_`);
    }
});