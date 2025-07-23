const { command } = require("../lib");
const simpleGit = require("simple-git");
const git = simpleGit();
const { exec } = require("child_process");

command(
  {
    pattern: "update",
    fromMe: true,
    desc: "Check for updates from GitHub and update the bot, including new packages",
    type: "owner"
  },
  async (message) => {
    await message.reply("Checking for updates...");
    try {
      await git.fetch();
      const status = await git.status();
      if (status.behind > 0) {
        await message.reply("Update available. Pulling the latest changes...");
        const pullResult = await git.pull();
        if (pullResult.summary.changes || pullResult.summary.insertions || pullResult.summary.deletions) {
          await message.reply("Update pulled. Installing new packages (if any)...");
          exec("npm install", (err, stdout, stderr) => {
            if (err) {
              return message.reply(`Update pulled, but failed to install packages: ${err.message}`);
            }
            if (stderr) {
              return message.reply(`Update pulled. npm install stderr: ${stderr}`);
            }
            message.reply("Update completed successfully. All packages are up to date.");
          });
        } else {
          await message.reply("Pull completed, but no changes were detected.");
        }
      } else {
        await message.reply("The bot is already up to date.");
      }
    } catch (err) {
      await message.reply(`An error occurred during the update process: ${err.message}`);
    }
  }
);
