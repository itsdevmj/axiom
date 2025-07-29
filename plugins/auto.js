// const axios = require("axios");
// const { command, getBuffer, getJson, isYT } = require("../lib");
// const { fromBuffer } = require("file-type");

// // Instagram, Facebook, TikTok auto downloader
// const instagramRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[^\s]+/;
// const facebookRegex = /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[^\s]+/;
// const tiktokRegex = /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/[^\s]+/;

// command({ 
//     pattern: "socials", 
//     on: "text", 
//     fromMe: false, 
//     desc: "TT/FB/Insta", 
//     type: "auto" 
// }, async (message, match, m) => {
//     if (
//         !instagramRegex.test(match) &&
//         !facebookRegex.test(match) &&
//         !tiktokRegex.test(match)
//     )
//         return;

//     try {
//         if (instagramRegex.test(match)) {
//             let data = await getJson(
//                 `https://tshepang-yasuke-martin.hf.space/igdl?url=${match}`
//             );
//             for (const { link, contentType } of data) {
//                 let buffer = await getBuffer(link);
//                 if (contentType === "image/jpeg") {
//                     await message.client.sendMessage(
//                         message.jid,
//                         { image: buffer, caption: "*Instagram image*" },
//                         { quoted: m }
//                     );
//                 } else {
//                     await message.client.sendMessage(
//                         message.jid,
//                         { video: buffer, mimetype: "video/mp4" },
//                         { quoted: m }
//                     );
//                 }
//             }
//         } else if (facebookRegex.test(match)) {
//             let { data } = await axios.get(
//                 `https://tshepang-yasuke-martin.hf.space/fb?url=${match}`
//             );
//             let videoUrl = data.data["720p (HD)"] || data.data["360p (SD)"];
//             if (!videoUrl) return;
//             let buffer = await getBuffer(videoUrl);
//             await message.client.sendMessage(
//                 message.jid,
//                 { video: buffer, mimetype: "video/mp4" },
//                 { quoted: m }
//             );
//         } else {
//             if (match == "https://www.tiktok.com/tiktoklite") return message.reply("You tweaking twin, that's an app url");
//             const { data } = await axios.get(
//                 `https://tshepang-yasuke-martin.hf.space/tiktok?url=${match}`
//             );

//             if (data.status !== true) return;

//             for (const item of data.media) {
//                 if (
//                     item.type === "video" &&
//                     item.text.toLowerCase() === "download without watermark (hd)"
//                 ) {
//                     const videoBuffer = await getBuffer(item.href);
//                     await message.client.sendMessage(
//                         message.jid,
//                         { video: videoBuffer, caption: "tiktok video" },
//                         { quoted: m }
//                     );
//                 } else if (item.type === "image") {
//                     const imageBuffer = await getBuffer(item.href);
//                     await message.client.sendMessage(
//                         message.jid,
//                         { image: imageBuffer, caption: "tiktok image" },
//                         { quoted: m }
//                     );
//                 }
//             }
//         }
//     } catch (error) {
//         console.log("Error processing request:", error);
//     }
// });

// // YouTube auto downloader
// command({
//     pattern: "ytmp4",
//     on: "text",
//     fromMe: false,
//     type: "auto",
//     desc: "YT autodl"
// }, async (message, match, m) => {
//     if (!isYT(match)) return;
//     try {
//         let { url } = await getJson(`https://lordxdd-ytdlp.hf.space/ytv/?url=${match}&quality=720`);
//         if (url.length == 0) return;
//         let buff = await (await fetch(url)).arrayBuffer();
//         let final_buffer = Buffer.from(buff);
//         await message.client.sendMessage(message.jid, { video: final_buffer, mimetype: "video/mp4", caption: `_youtube_auto_dl_` }, { quoted: m });
//     } catch (e) {
//         console.log(e);
//     }
// });