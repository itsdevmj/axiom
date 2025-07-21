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

const autoViewStatusDbPath = path.join(__dirname, 'resources/database/autoviewstatus.json');
function readAutoViewStatus() {
  if (!fs.existsSync(autoViewStatusDbPath)) {
    fs.writeFileSync(autoViewStatusDbPath, JSON.stringify({ enabled: false }, null, 2));
  }
  return JSON.parse(fs.readFileSync(autoViewStatusDbPath, 'utf8'));
}

const botFeaturesPath = path.join(__dirname, 'resources/database/botfeatures.json');
function readBotFeatures() {
  if (!fs.existsSync(botFeaturesPath)) {
    fs.writeFileSync(botFeaturesPath, JSON.stringify({
      alwaysOnline: false,
      autoType: false,
      autoRecord: false,
      autoViewStatus: false
    }, null, 2));
  }
  return JSON.parse(fs.readFileSync(botFeaturesPath, 'utf8'));
}

global.cache = {
    groups: new NodeCache({ stdTTL: 400, checkperiod: 320, useClones: false }), /*stdTTL == Standard Time-To-Live , the rest should make sense homieðŸ¦¦*/
    messages: new NodeCache({ stdTTL: 60, checkperiod: 80, useClones: false }),
};

if (!fs.existsSync("./resources/auth/creds.json")) {
    MakeSession(global.config.SESSION_ID, "./resources/auth/creds.json").then(() =>
        console.log("version : " + require("./package.json").version)
    );
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
                    await conn.sendMessage(conn.user.id, { text: `Iris connected` });
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
            
            // Log what type of message was deleted
            if (msg.from === 'status@broadcast' || msg.sender === 'status@broadcast') {
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
            let activeSettings = null;
            let sudoUserWithAntiDelete = null;

            for (const sudoNumber of global.config.SUDO) {
                const sudoJid = sudoNumber + '@s.whatsapp.net';
                const userSettings = global.antiDeleteDB.getUserSettings(sudoJid);
                
                if (userSettings.enabled) {
                    activeSettings = userSettings;
                    sudoUserWithAntiDelete = sudoJid;
                    break; // Use the first enabled sudo user's settings
                }
            }

            if (!activeSettings) {
                console.log('Anti-delete not enabled for any sudo user');
                return;
            }

            // console.log('Anti-delete enabled for sudo user:', sudoUserWithAntiDelete);
            // console.log('Settings:', activeSettings);

            const mode = activeSettings.mode;

            // Create deleted message info
            const deletedTime = new Date().toLocaleString();
            const originalTime = new Date(timestamp).toLocaleString();

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

                // Create the forwarded message format that looks like WhatsApp forwarded messages
                const forwardedMessage = {
                    text: messageText || 'Media message',
                    contextInfo: {
                        isForwarded: true,
                        forwardingScore: 1,
                        forwardedNewsletterMessageInfo: {
                            // newsletterJid: "120363144038483540@newsletter",
                            // newsletterName: "deletedMessage",
                            serverMessageId: 1
                        },
                        quotedMessage: {
                            conversation: `${senderNumber}\n${messageText || 'Media message'}`
                        },
                        participant: msg.sender,
                        remoteJid: msg.from,
                        mentionedJid: [],
                        externalAdReply: {
                            title: 'Deleted Mesaage',
                            body: messageText || 'Media message',
                            mediaType: 1,
                            // sourceUrl: "https://wa.me/" + msg.sender.split('@')[0],
                            // thumbnailUrl: "https://i.imgur.com/4F8MT6p.png",
                            renderLargerThumbnail: false,
                            showAdAttribution: false,
                            previewType: "NONE"
                        }
                    }
                };

                // Send the forwarded-style message
                await client.sendMessage(targetJid, forwardedMessage);

                // Then try to restore the actual media if it's a media message
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

                        // If we have the media buffer, send it properly
                        if (mediaBuffer && Buffer.isBuffer(mediaBuffer)) {
                            const restorationNote = `\n\n_🔄 Restored by Anti-Delete_`;
                            let mediaOptions = {};

                            switch (messageType) {
                                case 'imageMessage':
                                    mediaOptions = {
                                        image: mediaBuffer,
                                        caption: (mediaCaption || '') + restorationNote
                                    };
                                    break;

                                case 'videoMessage':
                                    mediaOptions = {
                                        video: mediaBuffer,
                                        caption: (mediaCaption || '') + restorationNote
                                    };
                                    break;

                                case 'audioMessage':
                                    const isVoiceNote = rawMessage.message.audioMessage?.ptt;
                                    mediaOptions = {
                                        audio: mediaBuffer,
                                        mimetype: rawMessage.message.audioMessage?.mimetype || 'audio/ogg; codecs=opus',
                                        ptt: isVoiceNote
                                    };
                                    break;

                                case 'documentMessage':
                                    mediaOptions = {
                                        document: mediaBuffer,
                                        mimetype: rawMessage.message.documentMessage?.mimetype || 'application/octet-stream',
                                        fileName: rawMessage.message.documentMessage?.fileName || 'document',
                                        caption: (mediaCaption || '') + restorationNote
                                    };
                                    break;

                                case 'stickerMessage':
                                    mediaOptions = {
                                        sticker: mediaBuffer
                                    };
                                    break;

                                default:
                                    // console.log('Unsupported media type for buffer restoration:', messageType);
                                    throw new Error('Unsupported media type');
                            }

                            await client.sendMessage(targetJid, mediaOptions);
                            // console.log('Successfully restored media using buffer, type:', messageType);

                            // Send context message for media without captions
                            if (messageType === 'stickerMessage') {
                                await client.sendMessage(targetJid, {
                                    text: `_🔄 Sticker restored by Anti-Delete_`
                                });
                            } else if (messageType === 'audioMessage') {
                                const isVoiceNote = rawMessage.message.audioMessage?.ptt;
                                await client.sendMessage(targetJid, {
                                    text: `_🔄 ${isVoiceNote ? 'Voice note' : 'Audio'} restored by Anti-Delete_`
                                });
                            }

                        } else {
                            // Fallback: Media buffer not available, send detailed info instead
                            console.log('No media buffer available, sending detailed media info');

                            let mediaInfo = `_📎 Media content could not be restored_\n\n`;
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
                            text: `_❌ Could not restore media content_\n_Media Type: ${messageType}_\n_This media may have expired or been corrupted_`
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

        // Also listen for message deletions via different event
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

                // --- Bot features logic ---
                const features = readBotFeatures();
                const jid = msg.key && msg.key.remoteJid;
                if (jid && !jid.endsWith("@broadcast")) {
                  if (features.alwaysOnline) {
                    try {
                      await conn.sendPresenceUpdate("available", jid);
                    } catch (e) {}
                  } else if (features.autoType) {
                    try {
                      await conn.sendPresenceUpdate("composing", jid);
                      setTimeout(() => {
                        conn.sendPresenceUpdate("paused", jid);
                      }, 3000);
                    } catch (e) {}
                  } else if (features.autoRecord) {
                    try {
                      await conn.sendPresenceUpdate("recording", jid);
                      setTimeout(() => {
                        conn.sendPresenceUpdate("paused", jid);
                      }, 3000);
                    } catch (e) {}
                  }
                }
                // --- End bot features logic ---

                // --- Auto-view status logic ---
                let autoViewStatusEnabled = features.autoViewStatus || global.config.AUTO_VIEW_STATUS;
                if (msg.key && msg.key.remoteJid === 'status@broadcast' && autoViewStatusEnabled) {
                  try {
                    await conn.readMessages([msg.key]);
                  } catch (e) {}
                }
                // --- End auto-view status logic ---

                // Store message for anti-delete tracking
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
                    if (command.fromMe && !msg.sudo) return;

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
    Iris();
    p();
} catch (error) {
    console.error("Fatal error in startup:", error);
}
