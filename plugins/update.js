const { command } = require('../lib');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_URL = 'https://github.com/TSH3PH4NG/Iris-md.git';

function isGitRepo() {
  return fs.existsSync(path.join(__dirname, '../.git'));
}

function runGit(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: path.join(__dirname, '..') }, (err, stdout, stderr) => {
      if (err) return reject(stderr || stdout || err.message);
      resolve(stdout.trim());
    });
  });
}

command({
  pattern: 'update',
  fromMe: true,
  desc: 'Update bot from GitHub',
  type: 'user'
}, async (message) => {
  if (!isGitRepo()) {
    return await message.reply('_This bot is not running from a git repository. Update not possible._');
  }
  try {
    await message.reply('_Checking for updates..._');
    await runGit('git fetch origin');
    const local = await runGit('git rev-parse HEAD');
    const remote = await runGit('git rev-parse origin/master');
    if (local === remote) {
      return await message.reply('_Already up to date!_');
    }
    const log = await runGit('git log --pretty=format:"%h %s" --abbrev-commit ' + local + '..' + remote);
    await runGit('git pull origin master');
    let replyMsg = '_Bot updated successfully!_';
    if (log) {
      replyMsg += '\n*New commits:*\n' + log;
    }
    await message.reply(replyMsg);
  } catch (err) {
    await message.reply('_Update failed:_\n' + err);
  }
}); 