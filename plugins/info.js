const { command, commands } = require('../lib/');
const os = require('os');
const Config = require('../config');

const styles = [
    { bullet: '◦', border: '═', header: '〘', footer: '〙' },
    { bullet: '→', border: '─', header: '《', footer: '》' },
    { bullet: '•', border: '=', header: '[', footer: ']' },
    { bullet: '»', border: '─', header: '{', footer: '}' }
];
let styleIndex = 0;

command({
    pattern: 'menu',
    fromMe: false,
    dontAddCommandList: true,
    desc: 'List commands',
    type: 'info'
}, async (message) => {
    const currentStyle = styles[styleIndex];
    styleIndex = (styleIndex + 1) % styles.length;

    const categories = {};

    commands.forEach(cmd => {
        if (!cmd.dontAddCommandList) {
            if (!categories[cmd.type]) {
                categories[cmd.type] = [];
            }
            let commandName;
            if (cmd.pattern instanceof RegExp) {
                commandName = cmd.pattern.toString().split(/\W+/)[1];
            } else if (typeof cmd.pattern === 'string') {
                commandName = cmd.pattern.split('|')[0].trim();
            } else {
                commandName = 'unknown';
            }
            categories[cmd.type].push({ name: commandName, desc: cmd.desc || 'No description' });
        }
    });

    const totalMemory = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2);
    const freeMemory = (os.freemem() / (1024 * 1024 * 1024)).toFixed(2);
    const usedMemory = (totalMemory - freeMemory).toFixed(2);

    const formatUptime = (seconds) => {
        const pad = (s) => (s < 10 ? '0' + s : s);
        const hours = pad(Math.floor(seconds / 3600));
        const minutes = pad(Math.floor((seconds % 3600) / 60));
        const secs = pad(seconds % 60);
        return `${hours}:${minutes}:${secs}`;
    };

    const uptime = formatUptime(Math.floor(process.uptime()));

    let response = `╭${currentStyle.border.repeat(3)}${currentStyle.header} ${global.config.BOT_NAME} ${currentStyle.footer}${currentStyle.border.repeat(2)}◆➤
┃◦╭──────────────
┃◦│ Owner :  ${global.config.OWNER_NAME}
┃◦│ User : ${message.pushName}
┃◦│ Plugins : ${commands.length}
┃◦│ Runtime : ${uptime}
┃◦│ Platform : ${os.platform()}
┃◦│ Total RAM : ${totalMemory} GB
┃◦│ Node Version : ${process.version}
┃◦│
┃◦│  ⣾⣽⣻⢿⡿⣟⣯⣷⣾⣽⣻⢿⡿⣟⣯⣷
┃◦│
┃◦╰───────────────
╰${currentStyle.border.repeat(15)}◆➤\n\n`;

    for (const [type, cmds] of Object.entries(categories)) {
        response += `╭${currentStyle.border.repeat(4)}${currentStyle.header} ${type.toUpperCase()} ${currentStyle.footer}${currentStyle.border.repeat(2)}◆➤
│◦╭─────────────────`;

        cmds.forEach(cmd => {
            response += `\n│◦│ ${currentStyle.bullet} ${cmd.name}`;
        });

        response += `\n┃◦╰─────────────────
╰${currentStyle.border.repeat(15)}◆➤\n\n`;
    }
    await message.reply(response.trim());
});


command({
    pattern: 'list',
    fromMe: false,
    desc: 'List all commands with descriptions',
    type: 'info'
}, async (message) => {
    const categories = {};

    // Group commands by category
    commands.forEach(cmd => {
        if (!cmd.dontAddCommandList) {
            if (!categories[cmd.type]) {
                categories[cmd.type] = [];
            }

            let commandName;
            if (cmd.pattern instanceof RegExp) {
                commandName = cmd.pattern.toString().split(/\W+/)[1];
            } else if (typeof cmd.pattern === 'string') {
                commandName = cmd.pattern.split('|')[0].trim();
            } else {
                commandName = 'unknown';
            }

            categories[cmd.type].push({
                name: commandName,
                desc: cmd.desc || 'No description available'
            });
        }
    });

    let response = `*COMMAND REFERENCE*\n\n`;

    // Sort categories for better organization
    const sortedCategories = Object.entries(categories).sort(([a], [b]) => a.localeCompare(b));

    for (const [type, cmds] of sortedCategories) {
        response += `*${type.toUpperCase()} COMMANDS*\n`;
        response += `${'-'.repeat(30)}\n`;

        // Sort commands alphabetically within each category
        const sortedCmds = cmds.sort((a, b) => a.name.localeCompare(b.name));

        sortedCmds.forEach(cmd => {
            response += `${cmd.name.padEnd(12)} : ${cmd.desc}\n`;
        });

        response += `\n`;
    }

    const totalCommands = Object.values(categories).reduce((total, cmds) => total + cmds.length, 0);
    response += `Summary: ${totalCommands} commands across ${Object.keys(categories).length} categories\n`;
    response += `Use .menu for system overview`;

    await message.reply(response.trim());
});