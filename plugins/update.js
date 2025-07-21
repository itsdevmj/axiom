const { command } = require("../lib");
const simpleGit = require("simple-git");
const git = simpleGit();

command(
  {
    pattern: "update",
    fromMe: true,
    desc: "Check for updates from GitHub and update the bot",
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
          await message.reply(`Update completed successfully.\nSummary: ${JSON.stringify(pullResult.summary, null, 2)}`);
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
