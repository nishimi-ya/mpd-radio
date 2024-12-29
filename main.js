
const express = require('express');
const mpdapi = require('mpd-api');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

// Initialize Express app
const app = express();
const port = 3080; // Port for the backend server

// MPD connection configuration
const config = {
  host: '127.0.0.1', // MPD server address (localhost)
  port: 6600, // MPD server port
};

// Last.fm API endpoint and key
const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const LASTFM_API_URL = 'http://ws.audioscrobbler.com/2.0/';

// Serve static files (for fallback.png)
app.use('/src', express.static('./src'));

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
      songInfo.albumCoverUrl = albumCoverUrl || './src/fallback.png';

      await client.disconnect();

      return songInfo;
    } else {
      return { title: 'No song playing', album: '', artist: '', albumCoverUrl: './src/fallback.png' };
    }
  } catch (error) {
    console.error('Error fetching current song from MPD:', error);
    return { title: 'Error', album: '', artist: '', albumCoverUrl: './src/fallback.png' };
  }
}

// Fetch album cover from Last.fm
async function getAlbumCover(artist, album) {
  try {
    //    console.log(`Fetching album cover for Artist: ${artist}, Album: ${album}`);

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
      const coverUrl = albumInfo.image[3]['#text']; // Large image
      if (coverUrl) {
        return coverUrl;
      }
    }

    console.warn('No album cover found, using fallback image.');
    return '';
  } catch (error) {
    console.error('Error fetching album cover from Last.fm:', error);
    return '';
  }
}

// API endpoint to get current song info
app.get('/current-song', async (req, res) => {
  const songInfo = await getCurrentSong();
  res.json(songInfo); // Send song info as JSON
});

// Serve the root route with index.html file
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html'); // Serve frontend UI
});

// Start the server on the defined port
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
