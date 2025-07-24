const { command } = require("../lib");
const { getBuffer } = require("../lib/functions");
const config = require("../config");
const { getAliveMessage, setAliveMessage } = global.PluginDB;

// Custom uptime formatter function
function formatUptime(seconds) {
    seconds = Number(seconds);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const dDisplay = d > 0 ? d + (d == 1 ? " Day, " : " Days, ") : "";
    const hDisplay = h > 0 ? h + (h == 1 ? " Hour, " : " Hours, ") : "";
    const mDisplay = m > 0 ? m + (m == 1 ? " Minute, " : " Minutes, ") : "";
    const sDisplay = s > 0 ? s + (s == 1 ? " Second" : " Seconds") : "";

    return dDisplay + hDisplay + mDisplay + sDisplay;
}

command({
    pattern: "alive ?(.*)",
    fromMe: false,
    type: "misc",
    desc: "Bot status with customizable message and prefixes (@uptime, @image, @name, @owner)"
}, async (message, m, match) => {
    // Extract custom message from message text
    let messageText = message.text || "";
    let prefix = message.prefix || ".";
    let customMessage = messageText.replace(new RegExp(`^\\${prefix}alive\\s*`, "i"), "").trim();

    // If user provided a custom message, save it to database
    if (customMessage) {
        setAliveMessage({
            custom: true,
            message: customMessage
        });
    }

    // Load saved alive message or use default
    const savedAlive = getAliveMessage();
    let finalMessage = "";

    if (savedAlive.custom && savedAlive.message) {
        finalMessage = savedAlive.message;
    } else {
        // Default message
        let bb = formatUptime(process.uptime());
        return message.reply(`
Hello ${message.pushName} all systems are functional
uptime: ${bb}
`);
    }

    // Get uptime first if needed
    let bb = "";
    if (finalMessage.includes("@uptime")) {
        bb = formatUptime(process.uptime());
    }

    // Process the message and replace prefixes
    let responseText = finalMessage
        .replace(/@uptime/gi, bb)
        .replace(/@name/gi, message.pushName || "User")
        .replace(/@owner/gi, config.OWNER_NAME || "Owner")
        .replace(/@bot/gi, config.BOT_NAME || "Bot");

    // Handle @image prefix
    if (finalMessage.includes("@image")) {
        // Remove @image from the text
        responseText = responseText.replace(/@image/gi, "").trim();

        const defaultImageUrl = "https://i.imgur.com/your-bot-image.jpg";

        try {
            const imageBuffer = await getBuffer(defaultImageUrl);
            return await message.sendMessage(
                message.jid,
                {
                    image: imageBuffer,
                    caption: responseText || `Hello ${message.pushName}! 👋\nBot is alive and running! `
                },
                { quoted: message }
            );
        } catch (error) {
            // If image fails, send text only
            return message.reply(responseText || `Hello ${message.pushName}! Bot is alive and running!`);
        }
    }

    // Send the processed message
    return message.reply(responseText);
});

// Command to reset alive message to default
command({
    pattern: "setalive ?(.*)",
    fromMe: true,
    type: "misc",
    desc: "Set custom alive message or reset to default (use 'reset' to restore default)"
}, async (message, m, match) => {
    let messageText = message.text || "";
    let prefix = message.prefix || ".";
    let customMessage = messageText.replace(new RegExp(`^\\${prefix}setalive\\s*`, "i"), "").trim();

    if (!customMessage) {
        return message.reply("_Please provide a custom alive message or use 'reset' to restore default._\n\nExample:\n`.setalive Hello @name! @bot is online!`\n`.setalive reset`");
    }

    if (customMessage.toLowerCase() === "reset") {
        setAliveMessage({
            custom: false,
            message: ""
        });
        return message.reply("_Alive message has been reset to default!_");
    }

    setAliveMessage({
        custom: true,
        message: customMessage
    });

    return message.reply(`_Custom alive message set successfully!_\n\nYour message: ${customMessage}\n\n_Available prefixes: @name, @uptime, @owner, @bot, @image_`);
});