/*just incase you wanna make your own functions*/

const {
    command,
    commands
} = require("./events");
const { reply } = require("./reply");
const { ytdl } = require("./yt");
const { shazam } = require("./nth");
const {
    getBuffer,
    toAudio,
    metaData,
    decodeJid,
    parseJid,
    parsedJid,
    getJson,
    isIgUrl,
    isUrl,
    getUrl,
    uptime,
    formatBytes,
    sleep,
    clockString,
    runtime,
    Bitly,
    isNumber,
    getRandom,
    isAdmin,
    isYT,
    isGroup,
} = require("./functions");
const { serialize } = require("./serialize");
module.exports = {
    isPrivate: global.config.WORK_TYPE.toLowerCase() === "private",
    isAdmin,
    isGroup,
    serialize,
    command,
    commands,
    getBuffer,
    reply,
    toAudio,
    metaData,
    decodeJid,
    parseJid,
    parsedJid,
    getJson,
    isIgUrl,
    isUrl,
    getUrl,
    uptime,
    formatBytes,
    sleep,
    clockString,
    runtime, 
    Bitly,
    isNumber,
    getRandom,
    ytdl,
    isYT,
    shazam,
};
