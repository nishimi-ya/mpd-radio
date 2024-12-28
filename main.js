
const express = require('express');
const mpdapi = require('mpd-api');
const dotenv = require('dotenv');
const axios = require('axios'); // We use axios for HTTP requests

dotenv.config();

// Initialize Express app
const app = express();
const port = 3080;  // Port for the backend server

// MPD connection configuration
const config = {
  host: '127.0.0.1',  // MPD server address (localhost)
  port: 6600,  // MPD server port
};

// Last.fm API endpoint and key
const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const LASTFM_API_URL = 'http://ws.audioscrobbler.com/2.0/';

// Serve static files (your frontend)
app.use(express.static('public'));

// Function to fetch current song info from MPD
async function getCurrentSong() {
  try {
    const client = await mpdapi.connect(config);

    const status = await client.api.status.get();
    const currentSong = await client.api.status.currentsong();

    if (status.state === 'play' && currentSong) {
      const songInfo = {
        title: currentSong.title || 'Unknown Title',
        album: currentSong.album || 'Unknown Album',
        artist: currentSong.artist || 'Unknown Artist',
      };

      // Fetch album cover from Last.fm
      const albumCoverUrl = await getAlbumCover(songInfo.artist, songInfo.album);
      songInfo.albumCoverUrl = albumCoverUrl;

      await client.disconnect();

      return songInfo;
    } else {
      return { title: "No song playing", album: "", albumCoverUrl: "" };
    }
  } catch (error) {
    return { title: "Error", album: "", albumCoverUrl: "" };
  }
}

// Fetch album cover from Last.fm
async function getAlbumCover(artist, album) {
  try {
    const response = await axios.get(LASTFM_API_URL, {
      params: {
        method: 'album.getinfo',
        artist: artist,
        album: album,
        api_key: LASTFM_API_KEY,
        format: 'json',
      },
    });

    const albumInfo = response.data.album;
    if (albumInfo && albumInfo.image && albumInfo.image.length > 0) {
      return albumInfo.image[3]['#text'];  // Return the large image
    } else {
      return '';  // Return empty string if no cover found
    }
  } catch (error) {
    console.error('Error fetching album cover from Last.fm:', error);
    return '';  // Return empty if there's an error
  }
}

// API endpoint to get current song info
app.get('/current-song', async (req, res) => {
  const songInfo = await getCurrentSong();
  res.json(songInfo);  // Send song info as JSON
});

// Serve the root route with index.html file
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');  // Serve frontend UI
});

// Start the server on the defined port
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
