const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "database.json");

const defaultDB = {
  plugins: [],
  sudo: [],
  botfeatures: {
    alwaysOnline: false,
    autoType: false,
    autoRecord: false,
    autoViewStatus: false
  },
  antidelete: {},
  aliveMessage: {
    custom: false,
    message: ""
  },
  antilink: {},
  antiword: {},
  warnings: {},
  welcome: {},
  goodbye: {},
  afk: {},
  sticky: {},
  autoreact: {},
  wordgame: {}
};

function readDB() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(defaultDB, null, 2));
  }
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

function writeDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

async function installPlugin(url, name) {
  const db = readDB();
  if (!db.plugins) db.plugins = [];
  const exists = db.plugins.find(p => p.url === url);
  if (exists) return false;
  db.plugins.push({ name, url });
  writeDB(db);
  return true;
}

async function getPlugins() {
  const db = readDB();
  return db.plugins || [];
}

async function removePluginByName(name) {
  const db = readDB();
  if (!db.plugins) db.plugins = [];
  const index = db.plugins.findIndex(p => p.name === name);
  if (index === -1) return false;
  db.plugins.splice(index, 1);
  writeDB(db);
  return true;
}

function getSudoList() {
  const db = readDB();
  return db.sudo || [];
}

function setSudoList(list) {
  const db = readDB();
  db.sudo = list;
  writeDB(db);
}

function getBotFeatures() {
  const db = readDB();
  return db.botfeatures || {};
}

function setBotFeatures(features) {
  const db = readDB();
  db.botfeatures = { ...db.botfeatures, ...features };
  writeDB(db);
}

function getAntidelete() {
  const db = readDB();
  return db.antidelete || {};
}

function setAntidelete(data) {
  const db = readDB();
  db.antidelete = data;
  writeDB(db);
}

function getAliveMessage() {
  const db = readDB();
  return db.aliveMessage || { custom: false, message: "" };
}

function setAliveMessage(data) {
  const db = readDB();
  db.aliveMessage = data;
  writeDB(db);
}

function getAntilink() {
  const db = readDB();
  return db.antilink || {};
}

function setAntilink(groupId, data) {
  const db = readDB();
  if (!db.antilink) db.antilink = {};
  db.antilink[groupId] = data;
  writeDB(db);
}

function getAntiword() {
  const db = readDB();
  return db.antiword || {};
}

function setAntiword(groupId, data) {
  const db = readDB();
  if (!db.antiword) db.antiword = {};
  db.antiword[groupId] = data;
  writeDB(db);
}

function getWarnings() {
  const db = readDB();
  return db.warnings || {};
}

function addWarning(groupId, userId) {
  const db = readDB();
  if (!db.warnings) db.warnings = {};
  if (!db.warnings[groupId]) db.warnings[groupId] = {};
  if (!db.warnings[groupId][userId]) db.warnings[groupId][userId] = 0;
  db.warnings[groupId][userId]++;
  writeDB(db);
  return db.warnings[groupId][userId];
}

function clearWarnings(groupId, userId) {
  const db = readDB();
  if (!db.warnings) db.warnings = {};
  if (!db.warnings[groupId]) db.warnings[groupId] = {};
  if (db.warnings[groupId][userId]) {
    delete db.warnings[groupId][userId];
    writeDB(db);
  }
}

function getWelcome() {
  const db = readDB();
  return db.welcome || {};
}

function setWelcome(groupId, data) {
  const db = readDB();
  if (!db.welcome) db.welcome = {};
  db.welcome[groupId] = data;
  writeDB(db);
}

function getGoodbye() {
  const db = readDB();
  return db.goodbye || {};
}

function setGoodbye(groupId, data) {
  const db = readDB();
  if (!db.goodbye) db.goodbye = {};
  db.goodbye[groupId] = data;
  writeDB(db);
}

function getAfk() {
  const db = readDB();
  return db.afk || {};
}

function setAfk(userId, data) {
  const db = readDB();
  if (!db.afk) db.afk = {};
  db.afk[userId] = data;
  writeDB(db);
}

function removeAfk(userId) {
  const db = readDB();
  if (!db.afk) db.afk = {};
  if (db.afk[userId]) {
    delete db.afk[userId];
    writeDB(db);
    return true;
  }
  return false;
}

function getSticky() {
  const db = readDB();
  return db.sticky || {};
}

function setSticky(stickerId, data) {
  const db = readDB();
  if (!db.sticky) db.sticky = {};
  db.sticky[stickerId] = data;
  writeDB(db);
}

function removeSticky(stickerId) {
  const db = readDB();
  if (!db.sticky) db.sticky = {};
  if (db.sticky[stickerId]) {
    delete db.sticky[stickerId];
    writeDB(db);
    return true;
  }
  return false;
}

function getAutoReact() {
  const db = readDB();
  return db.autoreact || {};
}

function setAutoReact(chatId, data) {
  const db = readDB();
  if (!db.autoreact) db.autoreact = {};
  db.autoreact[chatId] = data;
  writeDB(db);
}

function removeAutoReact(chatId) {
  const db = readDB();
  if (!db.autoreact) db.autoreact = {};
  if (db.autoreact[chatId]) {
    delete db.autoreact[chatId];
    writeDB(db);
    return true;
  }
  return false;
}

function getWordGame() {
  const db = readDB();
  return db.wordgame || {};
}

function setWordGame(gameId, data) {
  const db = readDB();
  if (!db.wordgame) db.wordgame = {};
  db.wordgame[gameId] = data;
  writeDB(db);
}

function removeWordGame(gameId) {
  const db = readDB();
  if (!db.wordgame) db.wordgame = {};
  if (db.wordgame[gameId]) {
    delete db.wordgame[gameId];
    writeDB(db);
    return true;
  }
  return false;
}

global.PluginDB = {
  installPlugin,
  getPlugins,
  removePluginByName,
  getSudoList,
  setSudoList,
  getBotFeatures,
  setBotFeatures,
  getAntidelete,
  setAntidelete,
  getAliveMessage,
  setAliveMessage,
  getAntilink,
  setAntilink,
  getAntiword,
  setAntiword,
  getWarnings,
  addWarning,
  clearWarnings,
  getWelcome,
  setWelcome,
  getGoodbye,
  setGoodbye,
  getAfk,
  setAfk,
  removeAfk,
  getSticky,
  setSticky,
  removeSticky,
  getAutoReact,
  setAutoReact,
  removeAutoReact,
  getWordGame,
  setWordGame,
  removeWordGame
};
