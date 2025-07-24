/* simplicity and good health 🧘 by Tshepang */

const {
    downloadContentFromMessage,
    getContentType,
    downloadMediaMessage,
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const logger = pino({ level: "silent" });


const fs = require("fs");
const fetch = require("node-fetch");
const { fromBuffer } = require("file-type");
const { parsedJid } = require("./functions")
const path = require("path");

const {
    writeExifImg,
    writeExifVid,
    imageToWebp,
    videoToWebp,
} = require("./sticker");

async function serialize(msg, conn) {
    conn.logger = {
        ...conn.logger,
        info() {
            console.log();
        },
        error() {
            console.log();
        },
        warn() {
            console.log();
        },
    };


    if (msg.key) {
        msg.id = msg.key.id;
        msg.isSelf = msg.key.fromMe;
        msg.from = msg.key.remoteJid;
        const { isGroup } = require("./functions");
        msg.isGroup = isGroup(msg.from);
        
        // Enhanced sender detection for LID groups
        if (msg.isGroup) {
            // For LID groups, participant might be in different format
            msg.sender = msg.key.participant || msg.key.remoteJid;
            msg.participant = msg.key.participant;
            
            // If participant is undefined, try to extract from message
            if (!msg.participant && msg.message && msg.message.messageContextInfo) {
                msg.participant = msg.message.messageContextInfo.deviceListMetadata?.senderKeyHash;
            }
        } else {
            msg.sender = msg.isSelf ? conn.user.id : msg.from;
        }
    }

    try { 
        // Enhanced sudo detection for LID groups
        let user = null;
        
        if (msg.sender) {
            // Try to extract user number from different formats
            if (msg.sender.includes('@')) {
                user = msg.sender.split("@")[0];
                // Handle LID format like "number:device@lid" 
                if (user.includes(':')) {
                    user = user.split(':')[0];
                }
            } else {
                user = msg.sender;
            }
        }
        
        // Fallback to participant if sender extraction failed
        if (!user && msg.participant) {
            user = msg.participant.split("@")[0];
            if (user.includes(':')) {
                user = user.split(':')[0];
            }
        }
        
        const sudoCheck = user ? global.config.SUDO.some(num => num.includes(user) || user.includes(num)) : false;
        msg.sudo = sudoCheck || msg.key.fromMe;
        
    } catch (error) {
        msg.sudo = msg.key.fromMe || false;
    }

    if (msg.message) {
        msg.type = getContentType(msg.message);

        if (msg.type === "ephemeralMessage") {
            msg.message = msg.message[msg.type].message;
            const tipe = Object.keys(msg.message)[0];
            msg.type = tipe;

            if (tipe === "viewOnceMessage") {
                msg.message = msg.message[msg.type].message;
                msg.type = getContentType(msg.message);
            }
        }

        if (msg.type === "viewOnceMessage") {
            msg.message = msg.message[msg.type].message;
            msg.type = getContentType(msg.message);
        }

        try {
            msg.mentions = msg.message[msg.type]?.contextInfo?.mentionedJid || [];
        } catch {
            msg.mentions = false;
        }

        try {
            const quoted = msg.message[msg.type]?.contextInfo;
            if (quoted?.quotedMessage) {
                let type;

                if (quoted.quotedMessage["ephemeralMessage"]) {
                    type = Object.keys(quoted.quotedMessage.ephemeralMessage.message)[0];
                    msg.quoted = {
                        type: type === "viewOnceMessage" ? "view_once" : "ephemeral",
                        stanzaId: quoted.stanzaId,
                        sender: quoted.participant,
                        message: type === "viewOnceMessage"
                            ? quoted.quotedMessage.ephemeralMessage.message.viewOnceMessage.message
                            : quoted.quotedMessage.ephemeralMessage.message,
                    };
                } else if (quoted.quotedMessage["viewOnceMessage"]) {
                    msg.quoted = {
                        type: "view_once",
                        stanzaId: quoted.stanzaId,
                        sender: quoted.participant,
                        message: quoted.quotedMessage.viewOnceMessage.message,
                    };
                } else {
                    msg.quoted = {
                        type: "normal",
                        stanzaId: quoted.stanzaId,
                        sender: quoted.participant,
                        message: quoted.quotedMessage,
                    };
                }

                msg.quoted.isSelf = msg.quoted.sender === conn.user.id;
                msg.quoted.client = msg.quoted.stanzaId.length == 21 || 22 ? "BOT" : "USER";
                msg.quoted.mtype = Object.keys(msg.quoted.message)[0];
                msg.quoted.text =
                    msg.quoted.message[msg.quoted.mtype]?.text ||
                    msg.quoted.message[msg.quoted.mtype]?.description ||
                    msg.quoted.message[msg.quoted.mtype]?.caption ||
                    (msg.quoted.mtype === "templateButtonReplyMessage" &&
                        msg.quoted.message[msg.quoted.mtype].hydratedTemplate
                            ?.hydratedContentText) ||
                    msg.quoted.message[msg.quoted.mtype] ||
                    "";

                msg.quoted.key = {
                    id: msg.quoted.stanzaId,
                    fromMe: msg.quoted.isSelf,
                    remoteJid: msg.from,
                };

                msg.quoted.download = async () => {
                    try {
                        const bx = await downloadMediaMessage(msg.quoted, "buffer", { reuploadRequest: conn.updateMediaMessage });
                        return bx; // this is the buffer content
                    } catch (e) {
                        return `Reply to an audio, image or video. Feature does not apply to text`;
                    }
                };
            }
        } catch (e) {
            console.log(e);
            msg.quoted = null;
        }

        try {
            msg.body =
                msg.message.conversation ||
                msg.message[msg.type]?.text ||
                msg.message[msg.type]?.caption ||
                (msg.type === "listResponseMessage" &&
                    msg.message[msg.type].singleSelectReply.selectedRowId) ||
                (msg.type === "buttonsResponseMessage" &&
                    msg.message[msg.type].selectedButtonId) ||
                (msg.type === "templateButtonReplyMessage" &&
                    msg.message[msg.type].selectedId) ||
                false;
        } catch {
            msg.body = false;
        }

        msg.download = async () => {
            try {
                const bx = await downloadMediaMessage(msg?.quoted || msg, "buffer", { reuploadRequest: conn.updateMediaMessage });
                return bx; // this is the buffer content
            } catch (e) {
                return `Reply to an audio, image or video. Feature does not apply to text`;
            }
        };

        conn.client = msg;
        conn.ctx = conn;

        conn.getFile = async (PATH, returnAsFilename) => {
            let res, filename;
            let data = Buffer.isBuffer(PATH)
                ? PATH
                : /^data:.*?\/.*?;base64,/i.test(PATH)
                    ? Buffer.from(PATH.split`,`, "base64")
                    : /^https?:\/\//.test(PATH)
                        ? await (res = await fetch(PATH)).buffer()
                        : fs.existsSync(PATH)
                            ? ((filename = PATH), fs.readFileSync(PATH))
                            : typeof PATH === "string"
                                ? PATH
                                : Buffer.alloc(0);

            if (!Buffer.isBuffer(data)) throw new TypeError("Result is not a buffer");

            let type = (await fromBuffer(data)) || {
                mime: "application/octet-stream",
                ext: ".bin",
            };

            if (data && returnAsFilename && !filename) {
                filename = path.join(__dirname, "../" + new Date() * 1 + "." + type.ext);
                await fs.promises.writeFile(filename, data);
            }

            return { res, filename, ...type, data };
        };

        conn.IAS = async (jid, buff, options = {}, q = {}) => {
            let buffer;
            if (options && (options.packname || options.author)) {
                buffer = await writeExifImg(buff, options);
            } else {
                buffer = await imageToWebp(buff);
            }
            await conn.sendMessage(
                jid,
                { sticker: buffer }, { ...q }
            );
        };

        conn.VAS = async (jid, buff, options = {}, q = {}) => {
            let buffer;
            if (options && (options.packname || options.author)) {
                buffer = await writeExifVid(buff, options);
            } else {
                buffer = await videoToWebp(buff);
            }
            await conn.sendMessage(
                jid,
                { sticker: buffer }, { ...q }
            );
        };
    }

    return msg;
}

module.exports = {
    serialize,
};
