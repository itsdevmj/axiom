const { getBuffer, isYT } = require("./functions");
const axios = require("axios");

// YouTube search function using scraping (more reliable)
async function ytSearch(query) {
    try {
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = response.data;

        // Extract video data from YouTube search results
        const videoRegex = /"videoId":"([^"]+)".*?"title":{"runs":\[{"text":"([^"]+)"}.*?"ownerText":{"runs":\[{"text":"([^"]+)"/g;
        const results = [];
        let match;

        while ((match = videoRegex.exec(html)) !== null && results.length < 5) {
            const videoId = match[1];
            const title = match[2].replace(/\\u0026/g, '&').replace(/\\"/g, '"');
            const channel = match[3] || 'Unknown';

            results.push({
                title: title,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                videoId: videoId,
                thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                channel: channel,
                description: ''
            });
        }

        // If regex fails, try simpler approach
        if (results.length === 0) {
            const simpleRegex = /"videoId":"([^"]+)"/g;
            const titleRegex = /"title":{"runs":\[{"text":"([^"]+)"/g;

            const videoIds = [];
            const titles = [];

            let videoMatch;
            while ((videoMatch = simpleRegex.exec(html)) !== null && videoIds.length < 5) {
                videoIds.push(videoMatch[1]);
            }

            let titleMatch;
            while ((titleMatch = titleRegex.exec(html)) !== null && titles.length < 5) {
                titles.push(titleMatch[1].replace(/\\u0026/g, '&').replace(/\\"/g, '"'));
            }

            for (let i = 0; i < Math.min(videoIds.length, titles.length); i++) {
                results.push({
                    title: titles[i],
                    url: `https://www.youtube.com/watch?v=${videoIds[i]}`,
                    videoId: videoIds[i],
                    thumbnail: `https://img.youtube.com/vi/${videoIds[i]}/mqdefault.jpg`,
                    channel: 'Unknown',
                    description: ''
                });
            }
        }

        return results;
    } catch (error) {
        console.error('YouTube search failed:', error);
        return [];
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
        console.log('Making API request to:', `https://api-ij32.onrender.com/download?url=${url}`);
        const { data } = await axios.get(`https://api-ij32.onrender.com/download?url=${url}`);
        console.log('Raw API response:', JSON.stringify(data, null, 2));

        if (!data || !data.title) {
            return { error: "Failed to get video info" };
        }

        const result = {
            title: data.title,
            youtube_url: data.youtube_url,
            key: data.key
        };

        console.log('Available fields in API response:', Object.keys(data));
        console.log('audio object:', data.audio);
        console.log('video object:', data.video);

        // Extract URLs from the new API structure
        const audioUrl = data.audio && data.audio['320'] ? data.audio['320'] : null;
        const videoUrl = data.video && data.video['720'] ? data.video['720'] : null;

        console.log('Extracted audioUrl:', audioUrl);
        console.log('Extracted videoUrl:', videoUrl);

        if (type === 'audio' && audioUrl) {
            // Download audio
            const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' });
            result.buffer = Buffer.from(audioResponse.data);
            result.type = 'audio';
            result.url = audioUrl;
        } else if (type === 'video' && videoUrl) {
            // Download video
            const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
            result.buffer = Buffer.from(videoResponse.data);
            result.type = 'video';
            result.url = videoUrl;
        } else {
            // Just return info without downloading (for document method)
            result.audio_url = audioUrl;
            result.video_url = videoUrl;
            result.type = 'info';
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
