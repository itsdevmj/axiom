// Quick test to debug admin detection
const { isAdmin } = require('./lib/functions');

// Test function to check admin detection
async function testAdminDetection(groupJid, userJid, client) {
    console.log('Testing admin detection...');
    console.log('Group:', groupJid);
    console.log('User:', userJid);
    
    try {
        const groupMetadata = await client.groupMetadata(groupJid);
        console.log('Group participants:', groupMetadata.participants.length);
        
        const allAdmins = groupMetadata.participants
            .filter((participant) => participant.admin !== null)
            .map((participant) => participant.id);
        
        console.log('All admins:', allAdmins);
        
        const isUserAdmin = await isAdmin(groupJid, userJid, client);
        console.log('Is user admin?', isUserAdmin);
        
        return isUserAdmin;
    } catch (error) {
        console.error('Error:', error);
        return false;
    }
}

module.exports = { testAdminDetection };