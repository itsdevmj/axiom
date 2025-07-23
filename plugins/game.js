const { command } = require('../lib/');
const { getWordGame, setWordGame, removeWordGame } = global.PluginDB;

// Cache for API responses to avoid repeated calls
const wordCache = new Map();

// Function to validate if a word exists using Datamuse API
async function isValidWord(word) {
    const cleanWord = word.toLowerCase().trim();

    // Check cache first
    if (wordCache.has(cleanWord)) {
        return wordCache.get(cleanWord);
    }

    try {
        // Use Datamuse API to check if word exists
        // sp parameter checks spelling - if word exists, it returns the word
        const response = await fetch(`https://api.datamuse.com/words?sp=${cleanWord}&max=1`);
        const data = await response.json();

        // If API returns the exact word, it's valid
        const isValid = data.length > 0 && data[0].word.toLowerCase() === cleanWord;

        // Cache the result
        wordCache.set(cleanWord, isValid);

        return isValid;
    } catch (error) {
        console.log('Error validating word with Datamuse API:', error);

        // Fallback to basic validation if API fails
        // Check if word is at least 2 characters and contains only letters
        const isBasicValid = cleanWord.length >= 2 && /^[a-zA-Z]+$/.test(cleanWord);
        wordCache.set(cleanWord, isBasicValid);

        return isBasicValid;
    }
}

// Function to get word suggestions starting with a letter (for hints)
async function getWordSuggestions(letter, count = 5) {
    try {
        const response = await fetch(`https://api.datamuse.com/words?sp=${letter.toLowerCase()}*&max=${count}`);
        const data = await response.json();
        return data.map(item => item.word.toUpperCase());
    } catch (error) {
        console.log('Error getting word suggestions:', error);
        return [];
    }
}

// Helper functions
function generateGameId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 5);
}

// Get starting words for different difficulty levels
function getStartingWord(level) {
    const startingWords = {
        1: ['CAT', 'DOG', 'SUN', 'BOOK', 'GAME'],
        2: ['HOUSE', 'PHONE', 'MUSIC', 'HAPPY', 'LIGHT'],
        3: ['COMPUTER', 'RAINBOW', 'FREEDOM', 'JOURNEY', 'MYSTERY'],
        4: ['BEAUTIFUL', 'ADVENTURE', 'WONDERFUL', 'CHOCOLATE', 'BUTTERFLY'],
        5: ['EXTRAORDINARY', 'MAGNIFICENT', 'REVOLUTIONARY', 'SOPHISTICATED', 'TRANSFORMATION']
    };

    const words = startingWords[level] || startingWords[1];
    return words[Math.floor(Math.random() * words.length)];
}

// Calculate words required based on level
function getWordsRequired(level) {
    return Math.min(level, 5); // Max 5 words per turn
}

// Start Word Chain Game
command({
    pattern: 'wcg',
    fromMe: false,
    desc: 'Start Word Chain Game (minimum 2 players)',
    type: 'game'
}, async (message, match) => {
    const chatId = message.jid;
    const games = getWordGame();
    const existingGame = games[chatId];

    // Check if game already exists
    if (existingGame) {
        if (existingGame.status === 'active') {
            const activePlayersList = existingGame.activePlayers.map(p => p.name).join(', ');
            return await message.reply(`*Word Chain Game Already Active*\n\nMinimum Letters: ${existingGame.minLetters}\nActive Players: ${activePlayersList}\nCurrent Turn: ${existingGame.currentPlayer.name}\nNext Letter: ${existingGame.currentLetter || 'Starting...'}\n\nWait for your turn or use .wcg stop to end the game`);
        } else if (existingGame.status === 'waiting') {
            const timeLeft = Math.max(0, 60 - Math.floor((Date.now() - existingGame.waitStartTime) / 1000));
            return await message.reply(`*Word Chain Game Waiting for Players*\n\nPlayers: ${existingGame.players.length}/∞\nTime left: ${timeLeft}s\n\nType *join* to participate!\nMinimum 2 players required.`);
        }
    }

    // Create new game
    const gameId = generateGameId();
    const gameData = {
        id: gameId,
        chatId: chatId,
        status: 'waiting',
        creator: message.participant,
        creatorName: message.pushName || 'Player',
        players: [{
            id: message.participant,
            name: message.pushName || 'Player',
            eliminated: false
        }],
        activePlayers: [],
        wordsRequired: 1,
        minLetters: 3, // Start with 3-letter words
        currentPlayer: null,
        currentPlayerIndex: 0,
        currentLetter: null,
        usedWords: [],
        waitStartTime: Date.now(),
        lastActivity: Date.now(),
        turnStartTime: null,
        turnTimeLimit: 30000 // 30 seconds per turn
    };

    setWordGame(chatId, gameData);

    await message.reply(`*Word Chain Game Created*\n\n*Creator:* ${gameData.creatorName}\n*Players:* 1/∞\n*Waiting Time:* 60 seconds\n\n*Game Rules:*\n• Word chain elimination game\n• Each player provides words starting with the last letter\n• Word length increases progressively (3 letters, then 4, then 5, etc.)\n• Last player standing wins\n• Dictionary validation enabled\n• 30 seconds per turn\n\n*Waiting for players...*\n\nType *join* to participate!\nMinimum 2 players required.\n\nGame will auto-start in 60 seconds if enough players join.`);

    // Set waiting timer
    setTimeout(async () => {
        await checkWaitingTimeout(message, gameData);
    }, 60000);
});

// Check waiting timeout
async function checkWaitingTimeout(message, gameData) {
    const games = getWordGame();
    const currentGame = games[message.jid];

    if (!currentGame || currentGame.status !== 'waiting') {
        return; // Game already started or ended
    }

    if (currentGame.players.length < 2) {
        removeWordGame(message.jid);
        await message.reply('*Word Chain Game Cancelled*\n\nNot enough players joined within 60 seconds.\nMinimum 2 players required.');
        return;
    }

    // Auto-start the game
    await startGame(message, currentGame);
}

// Join game
command({
    pattern: 'join',
    fromMe: false,
    desc: 'Join active word game',
    type: 'game'
}, async (message, match) => {
    const chatId = message.jid;
    const games = getWordGame();
    const game = games[chatId];

    if (!game) {
        return await message.reply('No active word game found. Start one with .wcg');
    }

    if (game.status === 'active') {
        return await message.reply('Game already started! Wait for the next game.');
    }

    // Check if player already joined
    const existingPlayer = game.players.find(p => p.id === message.participant);
    if (existingPlayer) {
        return await message.reply('You are already in the game!');
    }

    // Add player to game
    game.players.push({
        id: message.participant,
        name: message.pushName || 'Player',
        eliminated: false
    });

    game.lastActivity = Date.now();
    setWordGame(chatId, game);

    const playerList = game.players.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
    const timeLeft = Math.max(0, 60 - Math.floor((Date.now() - game.waitStartTime) / 1000));

    await message.reply(`*${message.pushName || 'Player'} joined the game!*\n\n*Current Players (${game.players.length}):*\n${playerList}\n\nTime left: ${timeLeft}s\n${game.players.length >= 2 ? 'Game will start automatically when timer ends!' : 'Waiting for more players... (minimum 2)'}`);
});

// Start the game
async function startGame(message, game) {
    // Initialize active players (non-eliminated players)
    game.activePlayers = game.players.filter(p => !p.eliminated);
    game.status = 'active';
    game.currentPlayerIndex = 0;
    game.currentPlayer = game.activePlayers[0];
    game.minLetters = 3; // Start with 3-letter words
    game.currentLetter = null; // Will be set by first player

    setWordGame(message.jid, game);

    const playerList = game.activePlayers.map((p, i) => `${i + 1}. ${p.name}`).join('\n');

    await message.reply(`*Word Chain Game Started!*\n\n*Players:*\n${playerList}\n\n*@${game.currentPlayer.name}'s Turn*\nProvide your starting word (minimum ${game.minLetters} letters)\n\nTime limit: 30 seconds per turn`, {
        mentions: [game.currentPlayer.id]
    });

    // Start turn timer
    await startTurnTimer(message, game);
}

// Start turn timer
async function startTurnTimer(message, game) {
    game.turnStartTime = Date.now();
    setWordGame(message.jid, game);

    setTimeout(async () => {
        await checkTurnTimeout(message, game);
    }, game.turnTimeLimit);
}

// Check turn timeout
async function checkTurnTimeout(message, game) {
    const games = getWordGame();
    const currentGame = games[message.jid];

    if (!currentGame || currentGame.status !== 'active' ||
        currentGame.turnStartTime !== game.turnStartTime) {
        return; // Game ended or turn changed
    }

    // Eliminate current player for timeout
    const eliminatedPlayer = currentGame.currentPlayer;
    eliminatedPlayer.eliminated = true;
    currentGame.activePlayers = currentGame.activePlayers.filter(p => !p.eliminated);
    
    // Update the game state
    setWordGame(message.jid, currentGame);

    await message.reply(`*Time's Up!*\n\n@${eliminatedPlayer.name} has been eliminated for taking too long.\n\nRemaining players: ${currentGame.activePlayers.length}`, {
        mentions: [eliminatedPlayer.id]
    });

    // Check if game should end
    if (currentGame.activePlayers.length <= 1) {
        await endGame(message, currentGame);
        return;
    }

    // Move to next player
    await nextTurn(message, currentGame);
}

// Move to next turn
async function nextTurn(message, game) {
    // Move to next player
    game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.activePlayers.length;
    game.currentPlayer = game.activePlayers[game.currentPlayerIndex];

    // Check if we completed a full round (increase minimum letter count)
    if (game.currentPlayerIndex === 0) {
        game.minLetters++;
        await message.reply(`*Letter Count Increased!*\n\nMinimum letters required: ${game.minLetters}`);
    }

    setWordGame(message.jid, game);

    if (game.currentLetter) {
        await message.reply(`*@${game.currentPlayer.name}'s Turn*\n\nProvide a word starting with: *${game.currentLetter}*\nMinimum ${game.minLetters} letters\n\nTime limit: 30 seconds`, {
            mentions: [game.currentPlayer.id]
        });
    } else {
        await message.reply(`*@${game.currentPlayer.name}'s Turn*\n\nProvide your starting word (minimum ${game.minLetters} letters)\n\nTime limit: 30 seconds`, {
            mentions: [game.currentPlayer.id]
        });
    }

    // Start turn timer
    await startTurnTimer(message, game);
}

// End game
async function endGame(message, game) {
    let resultText = '*Word Chain Game Over!*\n\n';

    if (game.activePlayers.length === 1) {
        const winner = game.activePlayers[0];
        resultText += `*Winner: @${winner.name}*\n\nCongratulations! You are the last player standing!\n\nFinal Letter Count: ${game.minLetters}`;
        
        const eliminatedPlayers = game.players.filter(p => p.eliminated);
        if (eliminatedPlayers.length > 0) {
            resultText += `\n\n*Eliminated Players:*\n${eliminatedPlayers.map((p, i) => `${i + 1}. ${p.name}`).join('\n')}`;
        }

        resultText += '\n\nThanks for playing Word Chain Game!';
        
        await message.reply(resultText, {
            mentions: [winner.id]
        });
    } else {
        resultText += '*No Winner*\n\nAll players were eliminated.';
        
        const eliminatedPlayers = game.players.filter(p => p.eliminated);
        if (eliminatedPlayers.length > 0) {
            resultText += `\n\n*Eliminated Players:*\n${eliminatedPlayers.map((p, i) => `${i + 1}. ${p.name}`).join('\n')}`;
        }

        resultText += '\n\nThanks for playing Word Chain Game!';
        
        await message.reply(resultText);
    }

    // Remove game from database
    removeWordGame(message.jid);
}

// Stop game
command({
    pattern: 'wcg stop',
    fromMe: false,
    desc: 'Stop current word game',
    type: 'game'
}, async (message, match) => {
    const chatId = message.jid;
    const games = getWordGame();
    const game = games[chatId];

    if (!game) {
        return await message.reply('No active game found.');
    }

    // Only creator can stop the game
    if (game.creator !== message.participant) {
        return await message.reply('Only the game creator can stop the game.');
    }

    removeWordGame(chatId);
    await message.reply('*Word Chain Game stopped.*\n\nThanks for playing!');
});

// Game status
command({
    pattern: 'wcg status',
    fromMe: false,
    desc: 'Show current game status',
    type: 'game'
}, async (message, match) => {
    const chatId = message.jid;
    const games = getWordGame();
    const game = games[chatId];

    if (!game) {
        return await message.reply('No active game found.');
    }

    if (game.status === 'waiting') {
        const timeLeft = Math.max(0, 60 - Math.floor((Date.now() - game.waitStartTime) / 1000));
        const playerList = game.players.map((p, i) => `${i + 1}. ${p.name}`).join('\n');

        return await message.reply(`*Word Chain Game Status*\n\nStatus: WAITING FOR PLAYERS\nPlayers: ${game.players.length}\nTime left: ${timeLeft}s\n\n*Players:*\n${playerList}`);
    }

    const activePlayersList = game.activePlayers.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
    const eliminatedPlayersList = game.players.filter(p => p.eliminated).map((p, i) => `${i + 1}. ${p.name}`).join('\n') || 'None';

    await message.reply(`*Word Chain Game Status*\n\nStatus: ACTIVE\nMinimum Letters: ${game.minLetters}\nCurrent Turn: ${game.currentPlayer.name}\nNext Letter: ${game.currentLetter || 'Starting...'}\n\n*Active Players:*\n${activePlayersList}\n\n*Eliminated Players:*\n${eliminatedPlayersList}`);
});

// AUTO-ANSWER HANDLER (Text message handler)
command({
    on: 'text',
    fromMe: false,
    dontAddCommandList: true
}, async (message, match, m) => {
    if (!message.text) return;

    const chatId = message.jid;
    const games = getWordGame();
    const game = games[chatId];

    // Handle "join" text for joining games
    if (message.text.trim().toLowerCase() === 'join') {
        if (!game) {
            return; // No game to join, ignore silently
        }

        if (game.status === 'active') {
            return await message.reply('Game already started! Wait for the next game.');
        }

        // Check if player already joined
        const existingPlayer = game.players.find(p => p.id === message.participant);
        if (existingPlayer) {
            return await message.reply('You are already in the game!');
        }

        // Add player to game
        game.players.push({
            id: message.participant,
            name: message.pushName || 'Player',
            eliminated: false
        });

        game.lastActivity = Date.now();
        setWordGame(chatId, game);

        const playerList = game.players.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
        const timeLeft = Math.max(0, 60 - Math.floor((Date.now() - game.waitStartTime) / 1000));

        await message.reply(`*${message.pushName || 'Player'} joined the game!*\n\n*Current Players (${game.players.length}):*\n${playerList}\n\nTime left: ${timeLeft}s\n${game.players.length >= 2 ? 'Game will start automatically when timer ends!' : 'Waiting for more players... (minimum 2)'}`);
        return;
    }

    if (!game || game.status !== 'active') return;

    // Check if it's the current player's turn
    if (game.currentPlayer.id !== message.participant) return;

    const userInput = message.text.trim().toUpperCase();
    const words = userInput.split(/\s+/).filter(word => word.length > 0);

    // Check if user provided the correct number of words
    if (words.length !== game.wordsRequired) {
        await message.reply(`You need to provide exactly ${game.wordsRequired} word(s). You provided ${words.length}.`);
        return;
    }

    // Validate each word (async validation with API)
    let allValid = true;
    let invalidWords = [];
    let usedWords = [];
    let wrongStartWords = [];

    // Validate words silently for faster gameplay

    for (const word of words) {
        // Check if word meets minimum length requirement
        if (word.length < game.minLetters) {
            invalidWords.push(`${word} (too short - need ${game.minLetters}+ letters)`);
            allValid = false;
            continue;
        }

        // Check if word starts with correct letter (skip for first turn)
        if (game.currentLetter && !word.startsWith(game.currentLetter)) {
            wrongStartWords.push(word);
            allValid = false;
            continue;
        }

        // Check if word was already used
        if (game.usedWords.includes(word)) {
            usedWords.push(word);
            allValid = false;
            continue;
        }

        // Check if word is in dictionary (async API call)
        const isValid = await isValidWord(word);
        if (!isValid) {
            invalidWords.push(word);
            allValid = false;
            continue;
        }
    }

    if (!allValid) {
        let errorMessage = '*Invalid Answer!*\n\n';

        if (wrongStartWords.length > 0) {
            errorMessage += `Words not starting with '${game.currentLetter}': ${wrongStartWords.join(', ')}\n`;
        }
        if (invalidWords.length > 0) {
            errorMessage += `Invalid words (not in dictionary): ${invalidWords.join(', ')}\n`;
        }
        if (usedWords.length > 0) {
            errorMessage += `Already used words: ${usedWords.join(', ')}\n`;
        }

        if (game.currentLetter) {
            errorMessage += `\nTry again! Provide a word starting with: *${game.currentLetter}*\nMinimum ${game.minLetters} letters`;
        } else {
            errorMessage += `\nTry again! Provide your starting word (minimum ${game.minLetters} letters)`;
        }

        await message.reply(errorMessage, {
            mentions: [message.participant]
        });
        return;
    }

    // All words are valid, process the turn
    words.forEach(word => game.usedWords.push(word));

    // Set new current letter from the last word
    const lastWord = words[words.length - 1];
    game.currentLetter = lastWord.slice(-1);

    game.lastActivity = Date.now();
    setWordGame(chatId, game);

    await message.reply(`*Correct!*\n\n${game.currentPlayer.name} provided: ${words.join(', ')}\n\nNext letter: *${game.currentLetter}*`);

    // Move to next turn after a short delay
    setTimeout(async () => {
        await nextTurn(message, game);
    }, 2000);
});

// Clean up inactive games
command({
    pattern: 'wcg cleanup',
    fromMe: true,
    desc: 'Clean up inactive word games (Owner only)',
    type: 'game'
}, async (message, match) => {
    const games = getWordGame();
    const now = Date.now();
    const timeout = 10 * 60 * 1000; // 10 minutes
    let cleanedCount = 0;

    Object.entries(games).forEach(([chatId, game]) => {
        if (now - game.lastActivity > timeout) {
            removeWordGame(chatId);
            cleanedCount++;
        }
    });

    await message.reply(`*Word Game Cleanup Complete*\n\nRemoved ${cleanedCount} inactive games`);
});