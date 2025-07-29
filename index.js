const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore, DisconnectReason } = require("@whiskeysockets/baileys");
const path = require("path");
const fs = require("fs");
const pino = require("pino");
const logger = pino({ level: "silent" });
const { MakeSession } = require("./lib/session");
const { Message } = require("./lib/Messages");
const { serialize, parsedJid } = require("./lib");
const events = require("./lib/events");
const express = require("express");
const app = express();
const port = global.config.PORT;
const NodeCache = require('node-cache');
const EV = require("events");
EV.setMaxListeners(0);
const simpleGit = require('simple-git');
const git = simpleGit();

global.cache = {
    groups: new NodeCache({ stdTTL: 400, checkperiod: 320, useClones: false }), /*stdTTL == Standard Time-To-Live , the rest should make sense homieðŸ¦¦*/
    messages: new NodeCache({ stdTTL: 60, checkperiod: 80, useClones: false }),
};

// Helper functions for welcome/goodbye messages
async function processWelcomeGoodbyeMessage(text, participant, groupMetadata) {
    if (!text) return null;

    const userName = 'User'; // Default name since we don't have user info in participant update
    const userNumber = participant.split('@')[0];
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
        .replace(/@bot/gi, global.config.BOT_NAME || 'Bot')
        .replace(/@owner/gi, global.config.OWNER_NAME || 'Owner');
}

async function handleWelcomeMessage(conn, groupId, participant, groupMetadata, settings) {
    try {
        const { getBuffer } = require("./lib/functions");
        const processedText = await processWelcomeGoodbyeMessage(settings.message, participant, groupMetadata);
        if (!processedText) return;

        if (settings.type === 'image' && settings.imageUrl) {
            const imageBuffer = await getBuffer(settings.imageUrl);
            await conn.sendMessage(groupId, {
                image: imageBuffer,
                caption: processedText,
                mentions: [participant]
            });
        } else if (settings.type === 'video' && settings.videoUrl) {
            const videoBuffer = await getBuffer(settings.videoUrl);
            await conn.sendMessage(groupId, {
                video: videoBuffer,
                caption: processedText,
                mentions: [participant]
            });
        } else {
            // Text message
            await conn.sendMessage(groupId, {
                text: processedText,
                mentions: [participant]
            });
        }
    } catch (error) {
        console.log('Error in handleWelcomeMessage:', error);
        // Fallback to text message
        try {
            const processedText = await processWelcomeGoodbyeMessage(settings.message, participant, groupMetadata);
            if (processedText) {
                await conn.sendMessage(groupId, {
                    text: processedText,
                    mentions: [participant]
                });
            }
        } catch (fallbackError) {
            console.log('Error in welcome message fallback:', fallbackError);
        }
    }
}

async function handleGoodbyeMessage(conn, groupId, participant, groupMetadata, settings) {
    try {
        const { getBuffer } = require("./lib/functions");
        const processedText = await processWelcomeGoodbyeMessage(settings.message, participant, groupMetadata);
        if (!processedText) return;

        if (settings.type === 'image' && settings.imageUrl) {
            const imageBuffer = await getBuffer(settings.imageUrl);
            await conn.sendMessage(groupId, {
                image: imageBuffer,
                caption: processedText,
                mentions: [participant]
            });
        } else if (settings.type === 'video' && settings.videoUrl) {
            const videoBuffer = await getBuffer(settings.videoUrl);
            await conn.sendMessage(groupId, {
                video: videoBuffer,
                caption: processedText,
                mentions: [participant]
            });
        } else {
            // Text message
            await conn.sendMessage(groupId, {
                text: processedText,
                mentions: [participant]
            });
        }
    } catch (error) {
        console.log('Error in handleGoodbyeMessage:', error);
        // Fallback to text message
        try {
            const processedText = await processWelcomeGoodbyeMessage(settings.message, participant, groupMetadata);
            if (processedText) {
                await conn.sendMessage(groupId, {
                    text: processedText,
                    mentions: [participant]
                });
            }
        } catch (fallbackError) {
            console.log('Error in goodbye message fallback:', fallbackError);
        }
    }
}

if (!fs.existsSync("./resources/auth/creds.json")) {
    MakeSession(global.config.SESSION_ID, "./resources/auth/creds.json").then(() => {
        console.log("version : " + require("./package.json").version);
        console.log("Session created successfully, starting connection...");
        // Start the bot after session is created
        setTimeout(() => {
            Iris();
        }, 2000); // Give 2 seconds for session files to be properly written
    }).catch((error) => {
        console.error("Failed to create session:", error);
        process.exit(1);
    });
} else {
    // Session already exists, start the bot immediately
    Iris();
}

try {
    fs.readdirSync(__dirname + "/resources/database/").forEach((db) => {
        if (path.extname(db).toLowerCase() == ".js") {
            require(__dirname + "/resources/database/" + db);
        }
    });
} catch (error) {
    console.error("Error loading databases:", error);
}

const p = async () => {
    try {
        fs.readdirSync("./plugins").forEach((plugin) => {
            if (path.extname(plugin).toLowerCase() == ".js") {
                require("./plugins/" + plugin);
            }
        });
    } catch (error) {
        console.error("Error loading plugins:", error);
    }
};

async function Iris() {
    try {
        console.log(`Syncing database`);
        const { state, saveCreds } = await useMultiFileAuthState(`./resources/auth/`);

        let conn = makeWASocket({
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS('Desktop'),
            downloadHistory: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            getMessage: false,
            emitOwnEvents: false,
            generateHighQualityLinkPreview: true,
            defaultQueryTimeoutMs: undefined,
            cachedGroupMetadata: async (jid) => {
                const cachedData = global.cache.groups.get(jid);
                if (cachedData) return cachedData;
                const metadata = await conn.groupMetadata(jid);
                global.cache.groups.set(jid, metadata);
                return metadata;
            }
        });

        conn.ev.on("call", async (c) => {
            try {
                if (global.config.CALL_REJECT === true) {
                    c = c.map((c) => c)[0];
                    let { status, from, id } = c;
                    if (status == "offer") {
                        await conn.rejectCall(id, from);
                        return conn.sendMessage(from, { text: "_NUMBER UNDER ARTIFICIAL INTELLIGENCE, NO ðŸ“ž_" });
                    }
                }
            } catch (error) {
                console.error("Error handling call event:", error);
            }
        });

        conn.ev.on("connection.update", async (s) => {
            try {
                const { connection, lastDisconnect } = s;
                if (connection === "open") {
                    console.log("Connecting to WhatsApp...");
                    console.log("Connected");
                    await delay(5000);
                    const pkg = require("./package.json");
                    const botName = global.config.BOT_NAME || pkg.name;
                    const version = pkg.version;
                    const owner = global.config.OWNER_NAME || global.config.AUTHOR;
                    const workType = global.config.WORK_TYPE;
                    const { getBotFeatures } = global.PluginDB;
                    const botFeatures = getBotFeatures();
                    const featuresList = Object.entries(botFeatures)
                        .map(([key, value]) => `${key}: ${value ? 'Enabled' : 'Disabled'}`)
                        .join("\n");
                    let updateMsg = '';
                    try {
                        await git.fetch();
                        const status = await git.status();
                        if (status.behind > 0) {
                            updateMsg = `\nUpdate available: Your bot is ${status.behind} commit(s) behind the remote.`;
                        }
                    } catch (e) {
                    }
                    const infoMsg =
                        `${botName} is now connected.\n` +
                        `Version: ${version}\n` +
                        `Owner: ${owner}\n` +
                        `Mode: ${workType}\n` +
                        `\nFeatures:\n${featuresList}` +
                        (updateMsg ? `\n\n${updateMsg}` : '');
                    await conn.sendMessage(conn.user.id, { text: infoMsg });
                }
                if (connection === "close") {
                    if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                        console.log("Reconnecting...");
                        await delay(300);
                        Iris();
                    } else {
                        console.log("Connection closed");
                        await delay(3000);
                        process.exit(0);
                    }
                }
            } catch (error) {
                console.error("Error in connection update:", error);
            }
        });

        conn.ev.on("creds.update", saveCreds);

        // Anti-delete message detection and storage
        const messageStore = new Map();

        // Store messages for anti-delete tracking
        function storeMessage(messageId, messageData, rawMessage) {
            messageStore.set(messageId, {
                message: messageData,
                rawMessage: rawMessage,
                timestamp: Date.now()
            });

            // Clean up old messages (older than 24 hours)
            setTimeout(() => {
                messageStore.delete(messageId);
            }, 24 * 60 * 60 * 1000);
        }

        // Function to handle deleted messages
        async function handleDeletedMessage(client, deletedMessageKey) {
            const storedMessage = messageStore.get(deletedMessageKey.id);
            if (!storedMessage) {
                console.log('No stored message found for deleted message:', deletedMessageKey.id);
                return;
            }

            const { message: msg, timestamp, rawMessage } = storedMessage;

            // Check if it's a status message
            const isStatusMessage = msg.from === 'status@broadcast' || msg.sender === 'status@broadcast';
            
            // Log what type of message was deleted
            if (isStatusMessage) {
                console.log('Detected status update deletion');
            } else {
                console.log('Detected regular message deletion');
            }

            // Get anti-delete settings - check if ANY sudo user has anti-delete enabled
            if (!global.antiDeleteDB) {
                console.log('Anti-delete database not available');
                return;
            }

            // Check all sudo users to see if any have anti-delete enabled
            // Get current sudo list from database to ensure we have the latest
            const currentSudoList = global.PluginDB ? global.PluginDB.getSudoList() : global.config.SUDO;
            let activeSettings = null;
            let sudoUserWithAntiDelete = null;

            // First, check if any sudo user has anti-delete enabled
            let hasAnyEnabledSettings = false;
            let fallbackSettings = null;

            for (const sudoNumber of currentSudoList) {
                const sudoJid = sudoNumber + '@s.whatsapp.net';
                let userSettings = global.antiDeleteDB.getUserSettings(sudoJid);

                // If no settings found, also check for device-specific JIDs (e.g., number:deviceId@s.whatsapp.net)
                if (!userSettings.enabled) {
                    const antiDeleteDB = global.antiDeleteDB.readAntiDeleteDB ? global.antiDeleteDB.readAntiDeleteDB() : global.PluginDB.getAntidelete();
                    if (antiDeleteDB.users) {
                        // Look for any JID that starts with the sudo number
                        for (const [jid, settings] of Object.entries(antiDeleteDB.users)) {
                            if (jid.startsWith(sudoNumber + ':') || jid.startsWith(sudoNumber + '@')) {
                                if (settings.enabled) {
                                    userSettings = settings;
                                    break;
                                }
                            }
                        }
                    }
                }

                if (userSettings.enabled) {
                    activeSettings = userSettings;
                    sudoUserWithAntiDelete = sudoJid;
                    hasAnyEnabledSettings = true;
                    break; // Use the first enabled sudo user's settings
                }
            }

            // If no current sudo user has anti-delete enabled, check if any previous sudo user had it enabled
            // and automatically enable it for the current sudo users
            if (!hasAnyEnabledSettings) {
                const antiDeleteDB = global.antiDeleteDB.readAntiDeleteDB ? global.antiDeleteDB.readAntiDeleteDB() : global.PluginDB.getAntidelete();
                if (antiDeleteDB.users) {
                    // Look for any previously enabled anti-delete settings
                    for (const [jid, settings] of Object.entries(antiDeleteDB.users)) {
                        if (settings.enabled) {
                            fallbackSettings = settings;
                            break;
                        }
                    }
                }

                // If we found previous settings, apply them to the first current sudo user
                if (fallbackSettings && currentSudoList.length > 0) {
                    const firstSudoJid = currentSudoList[0] + '@s.whatsapp.net';
                    global.antiDeleteDB.setUserSettings(firstSudoJid, fallbackSettings);
                    activeSettings = fallbackSettings;
                    sudoUserWithAntiDelete = firstSudoJid;
                    console.log(`Auto-enabled anti-delete for new sudo user: ${currentSudoList[0]}`);
                }
            }

            if (!activeSettings) {
                console.log('Anti-delete not enabled for any sudo user');
                return;
            }

            // Check if status messages should be processed
            if (isStatusMessage && !activeSettings.includeStatus) {
                console.log('Status message deletion ignored (status anti-delete disabled)');
                return;
            }

            // console.log('Anti-delete enabled for sudo user:', sudoUserWithAntiDelete);
            // console.log('Settings:', activeSettings);

            const mode = activeSettings.mode;

            // Determine message type and content
            const messageType = msg.type;
            let messageContent = msg.body || '';
            let mediaCaption = '';

            // Extract caption from media messages
            if (rawMessage.message) {
                const msgContent = rawMessage.message;
                if (msgContent.imageMessage?.caption) mediaCaption = msgContent.imageMessage.caption;
                else if (msgContent.videoMessage?.caption) mediaCaption = msgContent.videoMessage.caption;
                else if (msgContent.documentMessage?.caption) mediaCaption = msgContent.documentMessage.caption;
                else if (msgContent.audioMessage?.caption) mediaCaption = msgContent.audioMessage.caption;
            }

            // console.log('Sending deleted message notification, mode:', mode, 'type:', messageType);

            try {
                let targetJid;

                switch (mode) {
                    case 'dm':
                        // Send to the sudo user who has anti-delete enabled
                        targetJid = sudoUserWithAntiDelete;
                        break;
                    case 'jid':
                        // Send to custom JID specified by user
                        targetJid = activeSettings.targetJid;
                        break;
                    case 'restore':
                        // Send back to where the message was deleted from
                        targetJid = msg.from;
                        break;
                    default:
                        targetJid = sudoUserWithAntiDelete; // fallback to DM
                }

                if (!targetJid) {
                    console.log('No target JID available');
                    return;
                }

                // console.log('Sending deleted message to:', targetJid, 'Mode:', mode);

                // Create forwarded message style for deleted message
                const senderNumber = `+${msg.sender.split('@')[0]}`;
                const senderName = msg.pushName || 'Unknown';
                const messageText = messageContent || mediaCaption || '';

                // Check if it's a status message
                const isStatusMessage = msg.from === 'status@broadcast' || msg.sender === 'status@broadcast';

                // Check if it's a media message or text message
                const isMediaMessage = rawMessage.message && messageType !== 'conversation' && messageType !== 'extendedTextMessage';

                // Create appropriate title and body based on message source
                const messageTitle = isStatusMessage ? 'Deleted Status Update' : 'Deleted Message';
                const messageBody = isStatusMessage
                    ? `${senderName}`
                    : messageText || 'Deleted message';

                // Create conversation text for quoted message
                const conversationText = isStatusMessage
                    ? `Status Update\n${senderNumber}\n${messageText || 'Media status'}`
                    : `${senderNumber}\n${messageText || 'Deleted message'}`;

                // For text messages, send the forwarded text message
                if (!isMediaMessage) {
                    const forwardedMessage = {
                        text: messageText || (isStatusMessage ? 'Deleted status' : 'Deleted message'),
                        contextInfo: {
                            isForwarded: true,
                            forwardingScore: 1,
                            forwardedNewsletterMessageInfo: {
                                serverMessageId: 1
                            },
                            quotedMessage: {
                                conversation: conversationText
                            },
                            participant: msg.sender,
                            remoteJid: msg.from,
                            mentionedJid: [],
                            externalAdReply: {
                                title: messageTitle,
                                body: messageBody,
                                mediaType: 1,
                                renderLargerThumbnail: false,
                                showAdAttribution: false,
                                previewType: "NONE"
                            }
                        }
                    };
                    await client.sendMessage(targetJid, forwardedMessage);
                }

                // For media messages, try to restore the actual media with forwarded context
                if (rawMessage.message && messageType !== 'conversation' && messageType !== 'extendedTextMessage') {
                    try {
                        // console.log('Attempting to restore media, type:', messageType);

                        // Try to download the media first using the stored message
                        let mediaBuffer = null;
                        try {
                            if (msg.download && typeof msg.download === 'function') {
                                mediaBuffer = await msg.download();
                                // console.log('Successfully downloaded media buffer');
                            }
                        } catch (downloadError) {
                            // console.log('Could not download media buffer:', downloadError.message);
                        }

                        // If we have the media buffer, send it with forwarded message context
                        if (mediaBuffer && Buffer.isBuffer(mediaBuffer)) {
                            // Create forwarded message context for media
                            const forwardedContext = {
                                isForwarded: true,
                                forwardingScore: 1,
                                forwardedNewsletterMessageInfo: {
                                    serverMessageId: 1
                                },
                                quotedMessage: {
                                    conversation: conversationText
                                },
                                participant: msg.sender,
                                remoteJid: msg.from,
                                mentionedJid: [],
                                externalAdReply: {
                                    title: messageTitle,
                                    body: messageBody,
                                    mediaType: 1,
                                    renderLargerThumbnail: false,
                                    showAdAttribution: false,
                                    previewType: "NONE"
                                }
                            };

                            let mediaOptions = {};

                            switch (messageType) {
                                case 'imageMessage':
                                    mediaOptions = {
                                        image: mediaBuffer,
                                        caption: (mediaCaption || ''),
                                        contextInfo: forwardedContext
                                    };
                                    break;

                                case 'videoMessage':
                                    mediaOptions = {
                                        video: mediaBuffer,
                                        caption: (mediaCaption || ''),
                                        contextInfo: forwardedContext
                                    };
                                    break;

                                case 'audioMessage':
                                    const isVoiceNote = rawMessage.message.audioMessage?.ptt;
                                    mediaOptions = {
                                        audio: mediaBuffer,
                                        mimetype: rawMessage.message.audioMessage?.mimetype || 'audio/ogg; codecs=opus',
                                        ptt: isVoiceNote,
                                        contextInfo: forwardedContext
                                    };
                                    break;

                                case 'documentMessage':
                                    mediaOptions = {
                                        document: mediaBuffer,
                                        mimetype: rawMessage.message.documentMessage?.mimetype || 'application/octet-stream',
                                        fileName: rawMessage.message.documentMessage?.fileName || 'document',
                                        caption: (mediaCaption || ''),
                                        contextInfo: forwardedContext
                                    };
                                    break;

                                case 'stickerMessage':
                                    mediaOptions = {
                                        sticker: mediaBuffer,
                                        contextInfo: forwardedContext
                                    };
                                    break;

                                default:
                                    // console.log('Unsupported media type for buffer restoration:', messageType);
                                    throw new Error('Unsupported media type');
                            }

                            await client.sendMessage(targetJid, mediaOptions);
                            // console.log('Successfully restored media using buffer, type:', messageType);

                        } else {
                            // Fallback: Media buffer not available, send detailed info instead
                            console.log('No media buffer available, sending detailed media info');

                            let mediaInfo = `_Media content could not be restored_\n\n`;
                            mediaInfo += `*Media Type:* ${messageType.replace('Message', '')}\n`;

                            if (rawMessage.message) {
                                const msgContent = rawMessage.message;
                                const mediaData = msgContent[messageType];

                                if (mediaData) {
                                    if (mediaData.mimetype) mediaInfo += `*Format:* ${mediaData.mimetype}\n`;
                                    if (mediaData.fileName) mediaInfo += `*File Name:* ${mediaData.fileName}\n`;
                                    if (mediaData.fileLength) mediaInfo += `*Size:* ${(mediaData.fileLength / 1024 / 1024).toFixed(2)} MB\n`;
                                    if (mediaData.seconds) mediaInfo += `*Duration:* ${mediaData.seconds}s\n`;
                                    if (mediaData.width && mediaData.height) mediaInfo += `*Dimensions:* ${mediaData.width}x${mediaData.height}\n`;
                                }
                            }

                            mediaInfo += `\n_Media files expire quickly after deletion and cannot be recovered._`;

                            await client.sendMessage(targetJid, { text: mediaInfo });
                            // console.log('Sent media info instead of actual media');
                        }

                    } catch (mediaError) {
                        // console.error('Error restoring media:', mediaError);
                        await client.sendMessage(targetJid, {
                            text: `_ Could not restore media content_\n_Media Type: ${messageType}_\n_This media may have expired or been corrupted_`
                        });
                    }
                }

                // console.log(`Sent to ${mode}:`, targetJid);

            } catch (error) {
                console.error('Error handling deleted message:', error);
            }

            // Clean up stored message
            messageStore.delete(deletedMessageKey.id);
        }

        // Anti-delete message detection - try multiple event types
        conn.ev.on("messages.update", async (updates) => {
            try {
                for (const update of updates) {
                    // console.log('Message update received:', JSON.stringify(update, null, 2));

                    // Check for different types of message deletions
                    if (update.update.messageStubType === 68 || // Standard delete
                        update.update.messageStubType === 69 || // Delete for everyone
                        update.update.message === null ||       // Message set to null
                        update.update.messageStubType) {        // Any stub type

                        // console.log('Detected message deletion:', update.key.id);
                        await handleDeletedMessage(conn, update.key);
                    }
                }
            } catch (error) {
                console.error("Error handling message updates:", error);
            }
        });


        conn.ev.on("messages.delete", async (deletedMessages) => {
            try {
                console.log('Messages delete event:', deletedMessages);
                for (const key of deletedMessages.keys) {
                    console.log('Processing deleted message key:', key);
                    await handleDeletedMessage(conn, key);
                }
            } catch (error) {
                console.error("Error handling message deletions:", error);
            }
        });

        conn.ev.on("groups.update", async (events) => {
            for (const event of events) {
                try {
                    const metadata = await conn.groupMetadata(event.id);
                    global.cache.groups.set(event.id, metadata);
                } catch (err) {
                    console.error(`Failed to get group metadata for ${event.id}:`, err.message);
                    global.cache.groups.del(event.id); // Optional: clean it from cache
                }
            }
        });

        conn.ev.on("group-participants.update", async (event) => {
            try {
                const metadata = await conn.groupMetadata(event.id);
                global.cache.groups.set(event.id, metadata);


                console.log('Group participant update:', {
                    groupId: event.id,
                    action: event.action,
                    participants: event.participants
                });

                if (global.PluginDB) {
                    const { getWelcome, getGoodbye } = global.PluginDB;
                    const welcome = getWelcome();
                    const goodbye = getGoodbye();
                    const welcomeSettings = welcome[event.id];
                    const goodbyeSettings = goodbye[event.id];

                    if (event.action === 'add' && welcomeSettings && welcomeSettings.enabled) {
                        for (const participant of event.participants) {
                            try {
                                await handleWelcomeMessage(conn, event.id, participant, metadata, welcomeSettings);
                            } catch (e) {
                                console.log('Error sending welcome message:', e);
                            }
                        }
                    }


                    if (event.action === 'remove' && goodbyeSettings && goodbyeSettings.enabled) {
                        for (const participant of event.participants) {
                            try {
                                await handleGoodbyeMessage(conn, event.id, participant, metadata, goodbyeSettings);
                            } catch (e) {
                                console.log('Error sending goodbye message:', e);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error(`Failed to get group metadata for ${event.id}:`, err.message);
                global.cache.groups.del(event.id);
            }
        });

        conn.ev.on("messages.upsert", async (m) => {
            try {
                if (m.type !== "notify") return;

                let msg = await serialize(JSON.parse(JSON.stringify(m.messages[0])), conn);
                if (!msg) return;


                const features = global.PluginDB.getBotFeatures();
                const jid = msg.key && msg.key.remoteJid;
                if (jid && !jid.endsWith("@broadcast")) {
                    if (features.alwaysOnline) {
                        try {
                            await conn.sendPresenceUpdate("available", jid);
                        } catch (e) { }
                    } else if (features.autoType) {
                        try {
                            await conn.sendPresenceUpdate("composing", jid);
                            setTimeout(() => {
                                conn.sendPresenceUpdate("paused", jid);
                            }, 3000);
                        } catch (e) { }
                    } else if (features.autoRecord) {
                        try {
                            await conn.sendPresenceUpdate("recording", jid);
                            setTimeout(() => {
                                conn.sendPresenceUpdate("paused", jid);
                            }, 3000);
                        } catch (e) { }
                    }
                }


                let autoViewStatusEnabled = features.autoViewStatus || global.config.AUTO_VIEW_STATUS;
                if (msg.key && msg.key.remoteJid === 'status@broadcast' && autoViewStatusEnabled) {
                    try {
                        await conn.readMessages([msg.key]);
                    } catch (e) { }
                }

                if (msg.id) {
                    storeMessage(msg.id, msg, m.messages[0]);
                    // console.log('Stored message for anti-delete:', msg.id, 'from:', msg.sender, 'type:', msg.type);
                }

                let text_msg = msg.body;
                if (text_msg && global.config.LOGS) {
                    console.log(
                        `At : ${msg.isGroup ? (await conn.groupMetadata(msg.from)).subject : msg.from}\nFrom : ${msg.sender}\nMessage:${text_msg}\nSudo:${msg.sudo}`
                    );
                }

                events.commands.map(async (command) => {
                    if (global.config.WORK_TYPE === 'private') {
                        if (!msg.sudo) return;
                    } else {
                        if (command.fromMe && !msg.sudo) return;
                    }

                    let prefix = global.config.HANDLERS.trim();
                    let comman = text_msg;

                    if (command?.pattern instanceof RegExp && typeof comman === "string") {
                        try {
                            const regex = new RegExp(`^${command.pattern.source}`);
                            const cmd = msg.body.match(regex);
                            comman = cmd && cmd[0]?.startsWith(prefix) ? cmd[0] : false;
                        } catch (error) {
                            console.error("Error matching command pattern:", error);
                        }
                    }

                    msg.prefix = prefix;

                    try {
                        if (global.config.ALWAYS_ONLINE === true) {
                            conn.sendPresenceUpdate("available", msg.key.remoteJid);
                        } else {
                            conn.sendPresenceUpdate("unavailable", msg.key.remoteJid);
                        }
                    } catch (error) {
                        console.error("Error updating presence:", error);
                    }

                    let whats;
                    let match;
                    try {
                        switch (true) {
                            case command.pattern && command.pattern.test(comman):
                                match = text_msg.replace(new RegExp(command.pattern, "i"), "").trim();
                                whats = new Message(conn, msg);
                                command.function(whats, match, msg, conn);
                                break;
                            case text_msg && command.on === "text":
                                whats = new Message(conn, msg);
                                command.function(whats, text_msg, msg, conn, m);
                                break;
                            case command.on === "image" && msg.type === "imageMessage":
                            case command.on === "photo" && msg.type === "imageMessage":
                            case command.on === "sticker" && msg.type === "stickerMessage":
                            case command.on === "video" && msg.type === "videoMessage":
                                whats = new Message(conn, msg);
                                command.function(whats, text_msg, msg, conn, m);
                                break;
                        }
                    } catch (error) {
                        console.error(`Error executing command: ${error}`);
                    }
                });
            } catch (error) {
                console.error("Error processing message:", error);
            }
        });
    } catch (error) {
        console.error("Error in Iris function:", error);
    }
}

app.get("/", (req, res) => res.type("html").send(`<p2>Hello world</p2>`));

app.listen(port, () => console.log(`Server listening on http://localhost:${port}!`));

try {
    p(); // Load plugins
} catch (error) {
    console.error("Fatal error in startup:", error);
}
