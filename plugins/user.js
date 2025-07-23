const { command } = require('../lib');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const sudoPath = path.join(__dirname, '../resources/database/sudo.json');
const { getSudoList, setSudoList } = global.PluginDB;

function loadSudoList() {
    if (fs.existsSync(sudoPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(sudoPath, 'utf8'));
            if (Array.isArray(data)) return data;
        } catch (e) {}
    }
    return global.config.SUDO || [];
}

function saveSudoList(list) {
    fs.writeFileSync(sudoPath, JSON.stringify(list, null, 2));
}

// On load, sync global.config.SUDO with DB
const persistedSudo = getSudoList();
global.config.SUDO = persistedSudo;

const validateNumber = (number) => {
    const cleaned = number.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
};

command({
    pattern: 'save',
    fromMe: false,
    desc: 'Save any message or media by replying to it - forwards to sudo users silently',
    type: 'user'
}, async (message, match) => {
    try {
        // Check if user replied to a message
        if (!message.reply_message) {
            return await message.reply('_Reply to a message or media to save it_\nExample: Reply to any message and type `.save`');
        }

        const sudoUsers = global.config.SUDO || [];

        if (sudoUsers.length === 0) {
            return await message.reply('_No sudo users configured_');
        }

        // Get the replied message
        const repliedMessage = message.reply_message;

        // Send to each sudo user
        let successCount = 0;
        for (const sudoNumber of sudoUsers) {
            try {
                const sudoJid = sudoNumber.includes('@') ? sudoNumber : `${sudoNumber}@s.whatsapp.net`;

                // Handle different message types - just forward raw content
                if (repliedMessage.image || repliedMessage.type === 'imageMessage') {
                    const imageBuffer = await downloadMediaMessage(message.reply_message, 'buffer', { reuploadRequest: message.client.updateMediaMessage });
                    const caption = repliedMessage.text || repliedMessage.caption || '';

                    await message.client.sendMessage(sudoJid, {
                        image: imageBuffer,
                        caption: caption
                    });

                } else if (repliedMessage.video || repliedMessage.type === 'videoMessage') {
                    const videoBuffer = await downloadMediaMessage(message.reply_message, 'buffer', { reuploadRequest: message.client.updateMediaMessage });
                    const caption = repliedMessage.text || repliedMessage.caption || '';

                    await message.client.sendMessage(sudoJid, {
                        video: videoBuffer,
                        caption: caption
                    });

                } else if (repliedMessage.audio || repliedMessage.type === 'audioMessage') {
                    const audioBuffer = await downloadMediaMessage(message.reply_message, 'buffer', { reuploadRequest: message.client.updateMediaMessage });

                    await message.client.sendMessage(sudoJid, {
                        audio: audioBuffer,
                        mimetype: 'audio/mp4'
                    });

                } else if (repliedMessage.document || repliedMessage.type === 'documentMessage') {
                    const documentBuffer = await downloadMediaMessage(message.reply_message, 'buffer', { reuploadRequest: message.client.updateMediaMessage });
                    const fileName = repliedMessage.document?.fileName || 'document';

                    await message.client.sendMessage(sudoJid, {
                        document: documentBuffer,
                        fileName: fileName
                    });

                } else if (repliedMessage.sticker || repliedMessage.type === 'stickerMessage') {
                    const stickerBuffer = await downloadMediaMessage(message.reply_message, 'buffer', { reuploadRequest: message.client.updateMediaMessage });

                    await message.client.sendMessage(sudoJid, {
                        sticker: stickerBuffer
                    });

                } else {
                    // Handle text messages
                    const messageText = repliedMessage.text || repliedMessage.caption || repliedMessage.body || '';

                    if (messageText) {
                        await message.client.sendMessage(sudoJid, {
                            text: messageText
                        });
                    }
                }

                successCount++;

            } catch (error) {
                console.log(`Failed to send to sudo ${sudoNumber}:`, error);
            }
        }

        // Silent operation - no confirmation message to avoid spam
        // Only log success for debugging
        console.log(`Save command: Successfully forwarded message to ${successCount}/${sudoUsers.length} sudo users`);

    } catch (error) {
        console.log('Save command error:', error);
        // Silent failure - no error message to user
    }
});


// Set profile picture
command({
    pattern: 'setpp',
    fromMe: true,
    desc: 'Set your profile picture',
    type: 'user'
}, async (message, match) => {
    try {
        let imageBuffer;

        if (message.reply_message && message.reply_message.image) {
            // Download image from replied message
            imageBuffer = await message.reply_message.download();
        } else if (message.type === 'imageMessage') {
            // Use current message image
            imageBuffer = await message.download();
        } else {
            return await message.reply('_Reply to an image or send an image with the command_\nExample: Send image with caption `.setpp`');
        }

        if (!imageBuffer) {
            return await message.reply('_Failed to get image data_');
        }

        await message.client.updateProfilePicture(message.participant, imageBuffer);
        await message.reply('_Profile picture updated successfully!_');

    } catch (error) {
        await message.reply(`_Failed to set profile picture: ${error.message}_`);
    }
});

// Set profile name
command({
    pattern: 'setname',
    fromMe: true,
    desc: 'Set your profile name',
    type: 'user'
}, async (message, match) => {
    if (!match) return await message.reply('_Please provide a name_\nExample: `.setname John Doe`');

    try {
        await message.client.updateProfileName(match);
        await message.reply(`_Profile name updated to: ${match}_`);
    } catch (error) {
        await message.reply(`_Failed to set profile name: ${error.message}_`);
    }
});

// Set profile status/about
command({
    pattern: 'setdesc',
    fromMe: true,
    desc: 'Set your profile status/about',
    type: 'user'
}, async (message, match) => {
    if (!match) return await message.reply('_Please provide a status message_\nExample: `.setdesc Living my best life!`');

    try {
        await message.client.updateProfileStatus(match);
        await message.reply(`_Profile status updated to: ${match}_`);
    } catch (error) {
        await message.reply(`_Failed to set profile status: ${error.message}_`);
    }
});

// Steal profile picture
command({
    pattern: 'steal',
    fromMe: true,
    desc: 'Steal someone\'s profile picture and set it as yours',
    type: 'user'
}, async (message, match) => {
    try {
        let targetJid;

        if (message.reply_message) {
            targetJid = message.reply_message.jid;
        } else if (match) {
            const number = match.replace(/[^0-9]/g, '');
            targetJid = number + '@s.whatsapp.net';
        } else {
            return await message.reply('_Reply to a message or provide a phone number_\nExample: `.steal 1234567890`');
        }

        console.log('Stealing PP from:', targetJid);

        // Get target's profile picture
        const ppUrl = await message.client.profilePictureUrl(targetJid, 'image');

        if (!ppUrl) {
            return await message.reply('_Target user has no profile picture or it\'s private_');
        }

        // Download the profile picture
        const { getBuffer } = require('../lib/functions');
        const imageBuffer = await getBuffer(ppUrl);

        if (!imageBuffer) {
            return await message.reply('_Failed to download profile picture_');
        }

        // Set it as user's profile picture
        await message.client.updateProfilePicture(message.participant, imageBuffer);

        const targetNumber = targetJid.split('@')[0];
        await message.reply(`_Successfully stole profile picture from +${targetNumber}!_`);

    } catch (error) {
        console.log('Steal PP error:', error);
        if (error.message.includes('404')) {
            await message.reply('_Target user has no profile picture or it\'s private_');
        } else {
            await message.reply(`_Failed to steal profile picture: ${error.message}_`);
        }
    }
});

// Get profile picture (view someone's PP)
command({
    pattern: 'pp',
    fromMe: true,
    desc: 'Get profile picture of user',
    type: 'user'
}, async (message, match) => {
    try {
        let targetJid;
        let targetName = 'User';

        if (message.reply_message) {
            targetJid = message.reply_message.jid;
            targetName = message.reply_message.pushName || 'User';
        } else if (match) {
            const number = match.replace(/[^0-9]/g, '');
            targetJid = number + '@s.whatsapp.net';
            targetName = `+${number}`;
        } else {
            targetJid = message.participant;
            targetName = message.pushName || 'You';
        }

        const ppUrl = await message.client.profilePictureUrl(targetJid, 'image');

        await message.client.sendMessage(message.jid, {
            image: { url: ppUrl },
            caption: `*Profile Picture*\n\n*User:* ${targetName}\n*Number:* +${targetJid.split('@')[0]}`
        });

    } catch (error) {
        await message.reply('_Profile picture not found or private_');
    }
});

// Remove profile picture
command({
    pattern: 'removepp',
    fromMe: true,
    desc: 'Remove your profile picture',
    type: 'user'
}, async (message, match) => {
    try {
        await message.client.removeProfilePicture(message.participant);
        await message.reply('_Profile picture removed successfully!_');
    } catch (error) {
        await message.reply(`_Failed to remove profile picture: ${error.message}_`);
    }
});

// Get profile info
command({
    pattern: 'profile',
    fromMe: true,
    desc: 'Get profile information',
    type: 'user'
}, async (message, match) => {
    try {
        let targetJid;

        if (message.reply_message) {
            targetJid = message.reply_message.jid;
        } else if (match) {
            const number = match.replace(/[^0-9]/g, '');
            targetJid = number + '@s.whatsapp.net';
        } else {
            targetJid = message.participant;
        }

        const number = targetJid.split('@')[0];

        // Try to get profile status
        let status = 'Not available';
        try {
            const statusResult = await message.client.fetchStatus(targetJid);
            status = statusResult.status || 'Not available';
        } catch (e) {
            // Status might be private
        }

        // Check if user is online (this might not work in all cases)
        let lastSeen = 'Unknown';
        try {
            const presence = await message.client.presenceSubscribe(targetJid);
            lastSeen = presence.presences[targetJid].lastSeen || 'Unknown';
            // This is limited and might not always work
        } catch (e) {
            // Ignore presence errors
        }

        let profileInfo = `*Profile Information*\n\n`;
        profileInfo += `*Number:* +${number}\n`;
        profileInfo += `*JID:* ${targetJid}\n`;
        profileInfo += `*Status:* ${status}\n`;

        // Try to get profile picture
        try {
            const ppUrl = await message.client.profilePictureUrl(targetJid, 'image');
            if (ppUrl) {
                await message.client.sendMessage(message.jid, {
                    image: { url: ppUrl },
                    caption: profileInfo
                });
                return;
            }
        } catch (e) {
            // No profile picture
        }

        profileInfo += `*Profile Picture:* Not available`;
        await message.reply(profileInfo);

    } catch (error) {
        await message.reply(`_Failed to get profile info: ${error.message}_`);
    }
});

// Block user
command({
    pattern: 'block',
    fromMe: true,
    desc: 'Block a user',
    type: 'user'
}, async (message, match) => {
    try {
        let targetJid;

        if (message.reply_message) {
            targetJid = message.reply_message.jid;
        } else if (match) {
            const number = match.replace(/[^0-9]/g, '');
            targetJid = number + '@s.whatsapp.net';
        } else {
            return await message.reply('_Reply to a message or provide a phone number_\nExample: `.block 1234567890`');
        }

        await message.client.updateBlockStatus(targetJid, 'block');
        const number = targetJid.split('@')[0];
        await message.reply(`_Blocked +${number}_`);

    } catch (error) {
        await message.reply(`_Failed to block user: ${error.message}_`);
    }
});

// Unblock user
command({
    pattern: 'unblock',
    fromMe: true,
    desc: 'Unblock a user',
    type: 'user'
}, async (message, match) => {
    try {
        let targetJid;

        if (message.reply_message) {
            targetJid = message.reply_message.jid;
        } else if (match) {
            const number = match.replace(/[^0-9]/g, '');
            targetJid = number + '@s.whatsapp.net';
        } else {
            return await message.reply('_Reply to a message or provide a phone number_\nExample: `.unblock 1234567890`');
        }

        await message.client.updateBlockStatus(targetJid, 'unblock');
        const number = targetJid.split('@')[0];
        await message.reply(`_Unblocked +${number}_`);

    } catch (error) {
        await message.reply(`_Failed to unblock user: ${error.message}_`);
    }
});

command({
    pattern: "setsudo",
    fromMe: true,
    desc: "Set sudo",
    type: "user"
}, async (message, match) => {
    if (!match) return await message.reply("_Please provide a number. Example: .setsudo 27828418477_");

    const number = match.trim()
    if (!validateNumber(number)) {
        return await message.reply("_Invalid WhatsApp number format. Example: 27828418477_");
    }

    const sudoList = global.config.SUDO || [];
    if (sudoList.includes(number)) {
        return await message.reply("_Number is already a sudo user._");
    }

    sudoList.push(number);
    global.config.SUDO = sudoList;
    setSudoList(sudoList);
    await message.reply(`_Added ${number} to sudo users._`);
});

command({
    pattern: "delsudo",
    fromMe: true,
    desc: "Remove sudo",
    type: "user"
}, async (message, match) => {
    if (!match) return await message.reply("_Please provide a number. Example: .delsudo 27828418477_");

    const number = match.trim();
    const sudoList = global.config.SUDO || [];
    const index = sudoList.indexOf(number);

    if (index === -1) {
        return await message.reply("_Number is not in sudo list._");
    }

    sudoList.splice(index, 1);
    global.config.SUDO = sudoList;
    setSudoList(sudoList);
    await message.reply(`_Removed ${number} from sudo users._`);
});

command({
    pattern: "getsudo",
    fromMe: true,
    desc: "List sudo users",
    type: "user"
}, async (message) => {
    const sudoList = getSudoList();
    if (sudoList.length === 0) {
        return await message.reply("_No sudo users configured._");
    }

    const formattedList = sudoList.map(num => `• ${num}`).join('\n');
    await message.reply(`*Sudo Users:*\n${formattedList}`);
});
