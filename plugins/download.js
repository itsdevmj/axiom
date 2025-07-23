const { command, ytdl, getBuffer, metaData, reply, shazam } = require("../lib");
const axios = require("axios");
const acrcloud = require("acrcloud");
const fs = require("fs-extra");

let tx;

// Song downloader
command({
    pattern: "song",
    fromMe: false,
    desc: "Download songs",
    type: "download"
}, async (message, match, m) => {
    if (!match) return message.reply("_i need a query_");
    try {
        let { title, url } = await (await axios(`https://tshepang-yasuke-martin.hf.space/yts?q=${match}`)).data[0];
        let buff = await ytdl(url);
        if (!Buffer.isBuffer(buff)) return; /*idk what to log so this will do for now*/
        buff = await metaData(title, buff);

        return await message.client.sendMessage(message.jid, { audio: buff, mimetype: "audio/mpeg" }, { quoted: m });
    } catch (e) {
        await console.log(e);
    }
});

// Music finder
command({ 
    pattern: "find", 
    fromMe: false, 
    desc: "Music finder", 
    type: "download" 
}, async (message, match, m) => {
    let { msg, status, mime } = await reply(m, "audio&video");
    if (status == 0) return message.reply(msg);

    let buff = await m.download();
    try {
        const acr = new acrcloud({
            host: "identify-eu-west-1.acrcloud.com",
            access_key: "df8c1cffbfa4295dd40188b63d363112",
            access_secret: "d5mygczEZkPlBDRpFjwySUexQM26jix0gCmih389"
        });

        let res = await acr.identify(buff);
        let platform;
        let finder;

        try {
            finder = res.metadata.music[0].album?.name;
            platform = "acrcloud";
        } catch {
            let metadata = await shazam(buff);
            if (metadata == "Track not found.") {
                return message.reply("all attempts failed");
            }
            finder = metadata.title;
            platform = "shazam";
        }

        const { title, url, duration } = await (await axios(`https://tshepang-yasuke-martin.hf.space/yts?q=${finder}`)).data[0];
        let im = await getBuffer("https://files.catbox.moe/nr8x0o.jpg");
        tx = title;
        let text = `
╭━━〘 𝑀𝑈𝑆𝐼𝐶 𝐹𝐼𝑁𝐷𝐸𝑅 〙
┃ 
┠ title: ${title}
┠ url: ${url}
┠ duration: ${duration}
┠ platform: ${platform}
┃ 
╰━━━━━━━━━━━──⊷`;

        await message.client.sendMessage(message.jid, {
            text: text,
            contextInfo: {
                externalAdReply: {
                    title: `𝐓𝐒𝐇𝐄𝐏𝐀𝐍𝐆 𝐌𝐀𝐑𝐓𝐈𝐍 𝐌𝐀𝐒𝐈𝐀`,
                    mediaType: 1,
                    previewType: 0,
                    renderLargerThumbnail: true,
                    thumbnail: im
                }
            }
        }, { quoted: m });

    } catch (e) {
        message.reply(e);
    }
});

// Get music from find command
command({ 
    on: "text", 
    fromMe: false ,
    dontAddCommandList: true
}, async (message, match, m) => {
    if (match == "get" && m.quoted.text.includes("url")) {
        try {
            let final = m.quoted.text.split("┠ ")[2];
            final = final.replace("url:", "");
            let ur_l = final;
            let data = await ytdl(ur_l);
            data = await metaData(tx, data);
            await message.client.sendMessage(message.jid, {
                audio: data,
                mimetype: "audio/mpeg"
            }, { quoted: m });
        } catch (e) {
            return e;
        }
    }
});