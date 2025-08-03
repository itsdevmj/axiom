const { getBuffer, isYT } = require("./functions");
const axios = require("axios");

// YouTube search function
async function ytSearch(query) {
    try {
        const { data } = await axios.get(`https://www.googleapis.com/youtube/v3/search`, {
            params: {
                part: 'snippet',
                q: query,
                type: 'video',
                maxResults: 10,
                key: 'AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY' // You might want to use your own API key
            }
        });

        return data.items.map(item => ({
            title: item.snippet.title,
            url: `https://www.youtube.com/watch?v=${item.videoId}`,
            videoId: item.videoId,
            thumbnail: item.snippet.thumbnails.medium.url,
            channel: item.snippet.channelTitle,
            description: item.snippet.description
        }));
    } catch (error) {
        // Fallback search method using scraping
        try {
            const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            const response = await axios.get(searchUrl);
            const html = response.data;

            // Simple regex to extract video data (basic fallback)
            const videoRegex = /"videoId":"([^"]+)".*?"title":{"runs":\[{"text":"([^"]+)"/g;
            const results = [];
            let match;

            while ((match = videoRegex.exec(html)) !== null && results.length < 5) {
                results.push({
                    title: match[2],
                    url: `https://www.youtube.com/watch?v=${match[1]}`,
                    videoId: match[1],
                    thumbnail: `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`,
                    channel: 'Unknown',
                    description: ''
                });
            }

            return results;
        } catch (fallbackError) {
            console.error('YouTube search failed:', fallbackError);
            return [];
        }
    }
}

// YouTube download function using the new API
async function ytdl(input, type = 'audio') {
    try {
        let url = input;

        // If input is a search query, search first
        if (!isYT(input)) {
            if (type === 'search') {
                return await ytSearch(input);
            }

            const searchResults = await ytSearch(input);
            if (searchResults.length === 0) {
                return { error: "No results found" };
            }
            url = searchResults[0].url;
        }

        // Download using the new API
        const { data } = await axios.get(`https://api-ij32.onrender.com/download?url=${url}`);

        if (!data || !data.title) {
            return { error: "Failed to get video info" };
        }

        const result = {
            title: data.title,
            youtube_url: data.youtube_url,
            key: data.key
        };

        if (type === 'audio' && data.audio320) {
            // Download audio
            const audioResponse = await axios.get(data.audio320, { responseType: 'arraybuffer' });
            result.buffer = Buffer.from(audioResponse.data);
            result.type = 'audio';
            result.url = data.audio320;
        } else if (type === 'video' && data.video720) {
            // Download video
            const videoResponse = await axios.get(data.video720, { responseType: 'arraybuffer' });
            result.buffer = Buffer.from(videoResponse.data);
            result.type = 'video';
            result.url = data.video720;
        } else {
            // Just return info without downloading
            result.audio_url = data.audio320;
            result.video_url = data.video720;
        }

        return result;

    } catch (error) {
        console.error('YouTube download error:', error);
        return { error: error.message || "Download failed" };
    }
}

// Legacy function for backward compatibility
async function ytdlLegacy(res) {
    if (!isYT(res)) return "i only work with urls";

    try {
        const result = await ytdl(res, 'audio');
        return result.buffer || result.error;
    } catch (e) {
        return e;
    }
}

module.exports = {
    ytdl,
    ytSearch
};
