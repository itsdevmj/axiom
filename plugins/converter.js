const { command, reply, toAudio, metaData, getBuffer, ytdl } = require("../lib");
const axios = require("axios");
const FormData = require("form-data");
const { fromBuffer } = require("file-type");
const fetch = require("node-fetch");
const fs = require('fs');

// Random user agents for requests
const userAgentList = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
    'Mozilla/4.0 (compatible; MSIE 9.0; Windows NT 6.1)',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Safari/537.36 Edg/87.0.664.75',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.18363',
];

const randomUserAgent = userAgentList[Math.floor(Math.random() * userAgentList.length)];

// URL converter - Convert media to URL
command({
    pattern: "url",
    fromMe: false,
    desc: "Img/Vid - Url",
    type: "converter"
}, async (message, match, m) => {
    let { status, msg } = await reply(m, "all");
    if (status == 0) return message.reply(msg);
    let bb = await m.download();
    const { ext } = await fromBuffer(bb);
    const formData = new FormData();
    formData.append("fileToUpload", bb, `file.${ext}`);
    formData.append("reqtype", "fileupload");
    const response = await axios.post("https://catbox.moe/user/api.php", formData, {
        headers: {
            ...formData.getHeaders(),
            "User-Agent": randomUserAgent,
        },
    });

    await message.reply(response.data.trim());
});

// Sticker converter - Convert image/video to sticker
command({
    pattern: "sticker",
    fromMe: false,
    desc: "Img/Vid - Sticker",
    type: "converter"
}, async (message, match, m) => {
    let { msg, status, mime } = await reply(m, "image&video");
    if (status == 0) return message.reply(msg);
    let res;

    if (mime == "imageMessage") {
        res = "image";
    } else {
        res = "video";
    }

    let bb = await m.download();

    switch (res) {
        case "image":
            return message.client.IAS(message.jid, bb, { packname: (m?.pushName || "anonymous"), author: "Iris-md" }, { quoted: m });
            break;

        case "video":
            return message.client.VAS(message.jid, bb, { packname: (m?.pushName || "anonymous"), author: "Iris-md" }, { quoted: m });
            break;
    }
});

// MP3 converter - Convert video to audio
command({
    pattern: "mp3",
    fromMe: false,
    desc: "Video - Audio",
    type: "converter"
}, async (message, match, m) => {
    let pt = true;

    if (!match) {
        pt = false;
    }
    let { msg, status, mime } = await reply(m, "video");
    if (status == 0) return message.reply(msg);
    let buffer = await m.download();
    let res = await toAudio(buffer, "mp3");
    return message.client.sendMessage(message.jid, { audio: res, mimetype: "audio/mpeg", ptt: pt }, { quoted: m });
});

// TTS converter - Text to speech
const apiUrl = 'https://api.elevenlabs.io/v1/text-to-speech/ErXwobaYiN019PkySvjV/stream';
const apiKey = '527cdd000ff0fca268a9d8eaf5d218a8';

command({
    pattern: "tts",
    fromMe: true,
    desc: "Text - VN",
    type: "converter"
}, async (message, match, m) => {
    if (match.length > 80 || !match) return message.send(message.jid, "i need something short/i need a query", { quoted: m });
    
    const requestBody = {
        model_id: 'eleven_multilingual_v2',
        text: match,
    };

    const { data } = await axios.post(apiUrl, requestBody, {
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        responseType: 'arraybuffer',
    });

    await fs.writeFileSync('temp.mp3', data);

    let bb = await fs.readFileSync("temp.mp3");

    await message.client.sendMessage(message.jid, { audio: bb, mimetype: "audio/mp4", waveform: [20, 60, 70, 54, 69, 80, 39], ptt: true }, { quoted: m });

    await fs.unlinkSync("temp.mp3");
});