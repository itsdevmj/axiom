const axios = require("axios");
const {
    jidDecode,
    delay
} = require("@whiskeysockets/baileys");
const fs = require("node-webpmux/io");
const {
    readFile,
    unlink
} = require("fs/promises");
const { createWriteStream, readFileSync } = require("fs");
const {
    fromBuffer
} = require("file-type");
const NodeID3 = require('node-id3');
const { spawn } = require("child_process");
const path = require("path");
const { tmpdir } = require("os");
const FSE = require("fs-extra");
const ffmpeg = require("fluent-ffmpeg");


async function getBuffer(url) {
    try {
        const res = await (await fetch(url, {
            method: "GET",
            headers: {
                DNT: "1",
                "Upgrade-Insecure-Requests": "1",
            },
        })).arrayBuffer();

        return Buffer.from(res);
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}


async function metaData(t, dls) {
    const { title, thumbnail } = await (await axios(`https://tshepang-yasuke-martin.hf.space/yts?q=${t}`)).data[0];
    let image = await getBuffer(thumbnail);

    dls = await toAudio(dls);

    const tags = {
        title: title,
        artist: 'Tshepang Masia',
        album: 'iris-md',
        year: '2025',
        APIC: {
            mime: 'image/jpeg',
            type: 3,
            description: 'Super picture',
            imageBuffer: image,
        }
    };

    const taggedBuffer = NodeID3.write(tags, dls);
    return Buffer.from(taggedBuffer);
}




const decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
        const decode = jidDecode(jid) || {};
        return decode.user && decode.server
            ? `${decode.user}@${decode.server}` : jid;
    } else {
        return jid;
    }
};
const toAudio = async (buffer) => {
    let { options } = await ffmpeg(buffer, ["-vn", "-ac", "2", "-b:a", "128k", "-ar", "44100", "-f", "mp3"]);
    return options;
};
async function FiletypeFromUrl(url) {
    const buffer = await getBuffer(url);
    const out = await fromBuffer(buffer);
    let type
    if (out) {
        type = out.mime.split('/')[0]
    }
    return {
        type,
        buffer
    }
};
function extractUrlFromMessage(message) {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const match = urlRegex.exec(message);
    return match ? match[0] : null;
}
module.exports = {
    FiletypeFromUrl,
    getBuffer,
    toAudio,
    metaData,
    extractUrlFromMessage,
    decodeJid,
    isAdmin: async (jid, user, client) => {
        const groupMetadata = await client.groupMetadata(jid);
        const groupAdmins = groupMetadata.participants
            .filter((participant) => participant.admin !== null)
            .map((participant) => participant.id);

        console.log('=== ADMIN CHECK DEBUG ===');
        console.log('Group Admins (full IDs):', groupAdmins);
        console.log('User to check (full ID):', user);
        console.log('Bot user ID:', client.user?.id);
        console.log('Bot LID:', client.user?.lid);

        // Check direct match first (for LID format)
        if (groupAdmins.includes(user)) {
            console.log('Direct match found!');
            console.log('=== END DEBUG ===');
            return true;
        }

        // Extract just the phone number part for comparison
        const extractNumber = (id) => {
            if (!id) return null;
            // Handle both :number@domain and regular formats
            return id.split('@')[0].split(':')[0];
        };

        // Check if this is the bot by comparing base numbers
        const userBaseNumber = extractNumber(user);
        const botBaseNumber = extractNumber(client.user?.id);
        const isBotUser = userBaseNumber === botBaseNumber;

        console.log('User base number:', userBaseNumber);
        console.log('Bot base number:', botBaseNumber);
        console.log('Is bot user?:', isBotUser);

        // Check if user is bot and bot's LID is admin
        if (isBotUser && client.user?.lid && groupAdmins.includes(client.user.lid)) {
            console.log('Bot LID direct match found!');
            console.log('=== END DEBUG ===');
            return true;
        }

        // For bot, use LID if available, otherwise use regular ID
        let userToCheck = user;
        if (isBotUser && client.user?.lid) {
            userToCheck = client.user.lid;
            console.log('Using bot LID for comparison:', userToCheck);
        }

        const userNumber = extractNumber(userToCheck);
        const adminNumbers = groupAdmins.map(extractNumber);

        console.log('User number:', userNumber);
        console.log('Admin numbers:', adminNumbers);
        console.log('Is admin?:', adminNumbers.includes(userNumber));
        console.log('=== END DEBUG ===');

        return adminNumbers.includes(userNumber);
    },
    parseJid(text = "") {
        return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(
            (v) => v[1] + "@s.whatsapp.net"
        );
    },
    parsedJid(text = "") {
        return [...text.matchAll(/([0-9]{5,16}|0)/g)].map(
            (v) => v[1] + "@s.whatsapp.net"
        );
    },
    getJson: async function getJson(url, options) {
        try {
            options ? options : {};
            const res = await axios({
                method: "GET",
                url: url,
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36",
                },
                ...options,
            });
            return res.data;
        } catch (err) {
            return err;
        }
    },
    isInsta: (url) => {
        /(?:(?:http|https):\/\/)?(?:www.)?(?:instagram.com|instagr.am|instagr.com)\/(\w+)/gim.test(
            url
        );
    },
    isUrl: (isUrl = (url) => {
        return new RegExp(
            /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/,
            "gi"
        ).test(url);
    }),
    isYT: function isYT(url) {
        const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/;
        return youtubeRegex.test(url);
    },
    getUrl: (getUrl = (url) => {
        return url.match(
            new RegExp(
                /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/,
                "gi"
            )
        );
    }),
    uptime: async (seconds) => {
        seconds = Number(seconds);
        var d = Math.floor(seconds / (3600 * 24));
        var h = Math.floor((seconds % (3600 * 24)) / 3600);
        var m = Math.floor((seconds % 3600) / 60);
        var s = Math.floor(seconds % 60);
        var dDisplay = d > 0 ? d + (d == 1 ? " D, " : " D, ") : "";
        var hDisplay = h > 0 ? h + (h == 1 ? " H, " : " H, ") : "";
        var mDisplay = m > 0 ? m + (m == 1 ? " M, " : " M, ") : "";
        var sDisplay = s > 0 ? s + (s == 1 ? " S" : " S") : "";
        return dDisplay + hDisplay + mDisplay + sDisplay;
    },
    formatBytes: (bytes, decimals = 2) => {
        if (!+bytes) return "0 Bytes";

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ["Bytes",
            "KB",
            "MB",
            "GB",
            "TB",
            "PB",
            "EB",
            "ZB",
            "YB"];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    },
    sleep: delay,
    clockString: (duration) => {
        (seconds = Math.floor((duration / 1000) % 60)),
            (minutes = Math.floor((duration / (1000 * 60)) % 60)),
            (hours = Math.floor((duration / (1000 * 60 * 60)) % 24));

        hours = hours < 10 ? "0" + hours : hours;
        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        return hours + ":" + minutes + ":" + seconds;
    },
    runtime: () => {
        const duration = process.uptime();
        const seconds = Math.floor(duration % 60);
        const minutes = Math.floor((duration / 60) % 60);
        const hours = Math.floor((duration / (60 * 60)) % 24);

        const formattedTime = `${hours.toString().padStart(2, "0")}:${minutes
            .toString()
            .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

        return formattedTime;
    },

    Bitly: async (url) => {
        return new Promise((resolve, reject) => {
            const BitlyClient = require("bitly").BitlyClient;
            const bitly = new BitlyClient("6e7f70590d87253af9359ed38ef81b1e26af70fd");
            bitly
                .shorten(url)
                .then((a) => {
                    resolve(a);
                })
                .catch((A) => reject(A));
            return;
        });
    },
    isNumber: function isNumber() {
        const int = parseInt(this);
        return typeof int === "number" && !isNaN(int);
    },
    getRandom: function getRandom() {
        if (Array.isArray(this) || this instanceof String)
            return this[Math.floor(Math.random() * this.length)];
        return Math.floor(Math.random() * this);
    },
    isGroup: function isGroup(jid) {
        return jid.endsWith("@g.us") || jid.endsWith("@lid");
    }
};
