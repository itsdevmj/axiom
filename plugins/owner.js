const { command } = require("../lib");
const simpleGit = require("simple-git");
const git = simpleGit();
const { exec } = require("child_process");
const util = require("util");
const axios = require("axios");

// Update bot command
command({
    pattern: "update",
    fromMe: true,
    desc: "Check for updates from GitHub and update the bot",
    type: "owner"
}, async (message, match) => {
    const defaultRepo = "https://github.com/itsdevmj/axiom.git";
    const repoUrl = match ? match.trim() : defaultRepo;

    await message.reply("Checking for updates");

    try {
        const remotes = await git.getRemotes(true);
        const originRemote = remotes.find(remote => remote.name === 'origin');

        if (!originRemote) {
            await git.addRemote('origin', repoUrl);
        } else if (originRemote.refs.fetch !== repoUrl) {
            await git.remote(['set-url', 'origin', repoUrl]);
        }
        await git.fetch('origin');
        const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
        const branch = currentBranch.trim() || 'master';
        const localCommit = await git.revparse(['HEAD']);
        const remoteCommit = await git.revparse([`origin/${branch}`]);

        if (localCommit === remoteCommit) {
            return await message.reply("Bot is already up to date.");
        }

        await message.reply("Update available Installing....");
        try {
            await git.stash();
        } catch (stashErr) {
        }
        await git.pull('origin', branch);
        const execPromise = util.promisify(exec);
        await execPromise('npm install --omit=dev');

        await message.reply("Update successful! Restarting bot...");
        setTimeout(() => {
            process.exit(0);
        }, 2000); 

    } catch (err) {
        console.error('Update error:', err);
        await message.reply("Update failed");
    }
});

// Eval command for code execution
command({
    pattern: 'eval',
    on: "text",
    fromMe: false,
    dontAddCommandList: true,
    desc: 'Runs a server code'
}, async (message, match, m, client) => {
    if (!match.startsWith("~")) return;
    //const m = message;
    try {
        let evaled = await eval(`(async()=> { ${match.replace("~", "")} }) ()`);
        if (typeof evaled !== "string") evaled = require("util").inspect(evaled);
        return await message.reply(evaled);
    } catch (err) {
        return await message.reply(util.format(err));
    }
});