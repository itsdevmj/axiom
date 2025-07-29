const { command } = require('../lib');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { getDevice } = require("@whiskeysockets/baileys");
const fs = require('fs');
const path = require('path');
const sudoPath = path.join(__dirname, '../resources/database/sudo.json');
const configEnvPath = path.join(__dirname, '../config.env');
const { getSudoList, setSudoList } = global.PluginDB;

// Function to update environment file
function updateEnvFile(key, value) {
    try {
        let envContent = '';
        
        // Read existing config.env if it exists
        if (fs.existsSync(configEnvPath)) {
            envContent = fs.readFileSync(configEnvPath, 'utf8');
        }
        
        // Split into lines
        let lines = envContent.split('\n');
        let keyFound = false;
        
        // Update existing key or add new one
        lines = lines.map(line => {
            if (line.startsWith(`${key}=`)) {
                keyFound = true;
                return `${key}=${value}`;
            }
            return line;
        });
        
        // If key wasn't found, add it
        if (!keyFound) {
            lines.push(`${key}=${value}`);
        }
        
        // Remove empty lines at the end and write back
        while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
            lines.pop();
        }
        
        fs.writeFileSync(configEnvPath, lines.join('\n') + '\n');
        return true;
    } catch (error) {
        console.error('Error updating env file:', error);
        return false;
    }
}

function loadSudoList() {
    if (fs.existsSync(sudoPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(sudoPath, 'utf8'));
            if (Array.isArray(data)) return data;
        } catch (e) { }
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

// Save command - forwards messages to sudo users
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

// Sudo management commands
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

// Ping command - Check bot response time and system info
command({
    pattern: "ping",
    fromMe: false,
    desc: "Check bot response time and system information",
    type: "user"
}, async (message) => {
    const startTime = Date.now();

    // Send initial ping message
    const pingMessage = await message.reply("*Pinging...*");

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Get system information
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    // Format uptime
    const formatUptime = (seconds) => {
        const days = Math.floor(seconds / (24 * 60 * 60));
        const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
        const minutes = Math.floor((seconds % (60 * 60)) / 60);
        const secs = Math.floor(seconds % 60);

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m ${secs}s`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    };

    // Format memory usage
    const formatBytes = (bytes) => {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };

    // Get ping status
    const getPingStatus = (time) => {
        if (time < 100) return "EXCELLENT";
        if (time < 300) return "GOOD";
        if (time < 500) return "FAIR";
        return "POOR";
    };

    // Get current timestamp
    const currentTime = new Date().toLocaleString();

    // Build response message
    const pingResponse = `*System Status Report*

*Response Analysis*
Response Time: ${responseTime}ms
Performance: ${getPingStatus(responseTime)}

*System Uptime*
Bot Runtime: ${formatUptime(uptime)}

*Memory Utilization*
Heap Used: ${formatBytes(memoryUsage.heapUsed)}
Heap Total: ${formatBytes(memoryUsage.heapTotal)}
Resident Set Size: ${formatBytes(memoryUsage.rss)}

*Bot Configuration*
Name: ${global.config.BOT_NAME || 'Axiom'}
Owner: ${global.config.OWNER_NAME || 'Owner'}
Version: 2.0.0

*Report Generated*
${currentTime}

${responseTime < 200 ? 'Status: All systems operational' : 'Status: System under load'}`;

    // Edit the original ping message with detailed response
    try {
        await message.client.sendMessage(message.jid, {
            text: pingResponse,
            edit: pingMessage.key
        });
    } catch (error) {
        // If edit fails, send new message
        await message.reply(pingResponse);
    }
});

// View once decryptor
command({
    pattern: "vv",
    fromMe: true,
    desc: "Decrypt view once messages",
    type: "user"
}, async (message, match) => {
    try {
        // Check if user replied to a message
        if (!message.reply_message) {
            return await message.reply('_Reply to a view once message to decrypt it_\nExample: Reply to view once photo/video and type `.vv`');
        }

        const quotedMessage = message.reply_message;

        // Debug: Log the message structure
        // console.log('Quoted message structure:', JSON.stringify(quotedMessage, null, 2));

        // Check for different view once message structures
        let viewOnceMessage = null;
        let mediaType = null;
        let isViewOnce = false;

        // Method 1: Check for viewOnceMessageV2 (newer format)
        if (quotedMessage.message?.viewOnceMessageV2?.message) {
            viewOnceMessage = quotedMessage.message.viewOnceMessageV2.message;
            isViewOnce = true;
            console.log('Found viewOnceMessageV2');
        }
        // Method 2: Check for viewOnceMessage (older format)  
        else if (quotedMessage.message?.viewOnceMessage?.message) {
            viewOnceMessage = quotedMessage.message.viewOnceMessage.message;
            isViewOnce = true;
            console.log('Found viewOnceMessage');
        }
        // Method 3: Direct viewOnce property
        else if (quotedMessage.viewOnceMessage) {
            viewOnceMessage = quotedMessage.viewOnceMessage;
            isViewOnce = true;
            console.log('Found direct viewOnceMessage');
        }
        // Method 4: Check if message has viewOnce flag
        else if (quotedMessage.message && (quotedMessage.message.imageMessage?.viewOnce || quotedMessage.message.videoMessage?.viewOnce)) {
            viewOnceMessage = quotedMessage.message;
            isViewOnce = true;
            console.log('Found viewOnce flag in message');
        }
        // Method 5: Check for ephemeralMessage containing viewOnce
        else if (quotedMessage.message?.ephemeralMessage?.message?.viewOnceMessageV2) {
            viewOnceMessage = quotedMessage.message.ephemeralMessage.message.viewOnceMessageV2.message;
            isViewOnce = true;
            console.log('Found ephemeral viewOnceMessageV2');
        }

        if (!isViewOnce || !viewOnceMessage) {
            // Debug info for troubleshooting
            const messageKeys = quotedMessage.message ? Object.keys(quotedMessage.message) : [];
            console.log('Available message keys:', messageKeys);

            return await message.reply(`_This is not a view once message_\nPlease reply to a view once photo or video\n\nDebug: Message keys found: ${messageKeys.join(', ')}`);
        }

        // Determine media type and download
        let buffer;
        let caption = '';

        if (viewOnceMessage.imageMessage) {
            mediaType = "image";
            try {
                buffer = await downloadMediaMessage(quotedMessage, 'buffer', { reuploadRequest: message.client.updateMediaMessage });
                // Check multiple locations for caption
                caption = viewOnceMessage.imageMessage.caption ||
                    quotedMessage.caption ||
                    quotedMessage.message?.imageMessage?.caption ||
                    '';
            } catch (downloadError) {
                console.log('Image download error:', downloadError);
                // Try alternative download method
                buffer = await quotedMessage.download();
                caption = viewOnceMessage.imageMessage.caption ||
                    quotedMessage.caption ||
                    quotedMessage.message?.imageMessage?.caption ||
                    '';
            }
        } else if (viewOnceMessage.videoMessage) {
            mediaType = "video";
            try {
                buffer = await downloadMediaMessage(quotedMessage, 'buffer', { reuploadRequest: message.client.updateMediaMessage });
                // Check multiple locations for caption
                caption = viewOnceMessage.videoMessage.caption ||
                    quotedMessage.caption ||
                    quotedMessage.message?.videoMessage?.caption ||
                    '';
            } catch (downloadError) {
                console.log('Video download error:', downloadError);
                // Try alternative download method
                buffer = await quotedMessage.download();
                caption = viewOnceMessage.videoMessage.caption ||
                    quotedMessage.caption ||
                    quotedMessage.message?.videoMessage?.caption ||
                    '';
            }
        } else {
            const availableTypes = Object.keys(viewOnceMessage);
            return await message.reply(`_Unsupported view once message type_\nOnly images and videos are supported\n\nDebug: Found types: ${availableTypes.join(', ')}`);
        }

        if (!buffer) {
            return await message.reply('_Failed to download view once media_\nThe media might be expired or corrupted');
        }

        // Send the decrypted media
        const decryptedCaption = caption ? `${caption}` : '';

        if (mediaType === "image") {
            await message.client.sendMessage(message.jid, {
                image: buffer,
                caption: decryptedCaption
            });
        } else if (mediaType === "video") {
            await message.client.sendMessage(message.jid, {
                video: buffer,
                caption: decryptedCaption
            });
        }

        console.log(`View once ${mediaType} decrypted successfully`);

    } catch (error) {
        console.log('View once decrypt error:', error);
        await message.reply(`_Failed to decrypt view once message_\nError: ${error.message}\n\nMake sure you replied to a valid view once photo or video`);
    }
});

// Device detection
command({
    pattern: "user",
    fromMe: true,
    desc: "Device detection",
    type: "user"
}, async (message, match, m) => {
    let bb = await getDevice(message.reply_message.key.id);

    const name = {
        "ios": "*_IPHONE_*",
        "android": "*_ANDROID_*",
        "web": "*_DESKTOP_*"
    };

    bb = name[bb];

    return message.client.sendMessage(message.jid, {
        text: `
_USER-DEVICE_: ${bb}
`}, { quoted: m });
});

// AFK system
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
    fromMe: false,
    dontAddCommandList: true
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

// Bot features management
const { getBotFeatures, setBotFeatures } = global.PluginDB;

function readFeatures() {
    return getBotFeatures();
}

function writeFeatures(newSettings) {
    setBotFeatures(newSettings);
}

function featureCommand({ pattern, key, desc }) {
    command({
        pattern,
        fromMe: true,
        desc,
        type: 'user'
    }, async (message, match) => {
        const arg = match.trim().toLowerCase();
        if (arg === 'on') {
            writeFeatures({ [key]: true });
            await message.reply(`_${desc} enabled!_`);
        } else if (arg === 'off') {
            writeFeatures({ [key]: false });
            await message.reply(`_${desc} disabled!_`);
        } else {
            const features = readFeatures();
            await message.reply(`_${desc} is currently: ${features[key] ? 'ON' : 'OFF'}_\nUse .${pattern} on/off to change.`);
        }
    });
}

command(
    {
        pattern: "mode",
        fromMe: true,
        desc: "Change bot work mode (public/private)",
        type: "user"
    },
    async (message, match) => {
        const mode = match ? match.toLowerCase().trim() : '';

        if (!mode) {
            const currentMode = global.config.WORK_TYPE;
            const prefix = global.config.HANDLERS;
            return await message.reply(`*Current Mode:* ${currentMode}\n\n*Usage:*\n• \`${prefix}mode public\` - Anyone can use the bot\n• \`${prefix}mode private\` - Only sudo users can use the bot`);
        }

        if (mode !== 'public' && mode !== 'private') {
            const prefix = global.config.HANDLERS;
            return await message.reply(`*Invalid mode!*\n\nUse:\n• \`${prefix}mode public\` - Anyone can use the bot\n• \`${prefix}mode private\` - Only sudo users can use the bot`);
        }

        global.config.WORK_TYPE = mode;
        
        const envUpdated = updateEnvFile('WORK_TYPE', mode);
        
        const modeDescription = mode === 'private'
            ? "Only sudo users can use the bot"
            : "Anyone can use the bot";

        const persistenceStatus = envUpdated 
            ? "Setting saved" 
            : "Setting applied temporarily (restart may reset)";

        await message.reply(`*Mode changed to:* ${mode}\n*Description:* ${modeDescription}\n*Status:* ${persistenceStatus}`);
    }
);

featureCommand({ pattern: 'online', key: 'alwaysOnline', desc: 'Always Online' });
featureCommand({ pattern: 'type', key: 'autoType', desc: 'Auto Type' });
featureCommand({ pattern: 'record', key: 'autoRecord', desc: 'Auto Record' });
featureCommand({ pattern: 'status', key: 'autoViewStatus', desc: 'Auto View Status' });