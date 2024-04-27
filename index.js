require('dotenv').config();

// Imports
const express = require('express');
const OpenAI = require("openai");
const SpotifyWebApi = require('spotify-web-api-node');

// Setup express app
const app = express();
const port = 3030;

// Initialize OpenAI and Spotify API clients
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

var spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

// Initialize app
app.use(express.json()); // Middleware to parse JSON bodies

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

// Routes
app.post('/generate', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    await authenticateSpotify();

    try {
        console.log("Submitted prompt...")
        const gptResponse = await fetchGptResponse(prompt);
        console.log("Searching for tracks...")
        console.log(gptResponse)
        const trackDetails = await Promise.all(
            gptResponse.map(async (track) => {
                return await searchTracks(`track:"${track[0]}" artist:"${track[1]}"`);
            })
        );
        const playlist = trackDetails.filter(track => track !== null);
        console.log(`Returning playlist of length ${playlist.length}`)
        res.json(playlist);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


async function fetchGptResponse(prompt) {
    const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-2024-04-09",
        messages: [
            {
                "role": "system",
                "content": "You are a playlist genius. You are extremely talented at creating playlists from prompts, always generating something creative yet true to the original prompt you are given. However, you are only capable of responding in bracketed JavaScript arrays of arrays of formatted strings such as [\"God's Plan\", \"Drake\"] or [\"RIVER ROAD\", \"Jack Harlow\"]. Only ever give the first artist associated with a song, no features or secondary artist. You always create playlists that are perfectly influenced by the prompt you are given. Here is an example output:\n[[\"Song 1\", \"Artist\"],[\"Song 2\", \"Artist\"],[\"Song 3\", \"Artist\"]]"
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature: 1,
        max_tokens: 256,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
    });
    return JSON.parse(response.choices[0].message.content);
}

// This function should be called to authenticate and get the token
async function authenticateSpotify() {
    try {
        await spotifyApi.clientCredentialsGrant().then(
            function (data) {
                console.log("Authenticated with Spotify")
                // console.log('The access token expires in ' + data.body['expires_in']);
                // console.log('The access token is ' + data.body['access_token']);

                // Save the access token so that it's used in future calls
                spotifyApi.setAccessToken(data.body['access_token']);
            },
            function (err) {
                console.log('Something went wrong when retrieving an access token', err);
            }
        );
    } catch (error) {
        console.error('Spotify Authentication Error:', error);
    }
}


async function searchTracks(track) {
    const data = await spotifyApi.searchTracks(track);
    if (data.body.tracks.items.length > 0) {
        const topTrack = data.body.tracks.items[0];
        return {
            id: topTrack.id,
            name: topTrack.name,
            artist: topTrack.artists[0].name,
            artwork: topTrack.album.images[0].url
        };
    } else {
        console.log(data.body.tracks.items, track)
        return null;
    }
}

