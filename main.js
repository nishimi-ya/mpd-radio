import express from 'express';
import mpdapi from 'mpd-api';
import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

// Define __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = 3080;

// MPD configuration
const config = {
  host: '127.0.0.1',
  port: 6600,
};

// Last.fm API
const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const LASTFM_API_URL = 'http://ws.audioscrobbler.com/2.0/';

// Serve static files (e.g., fallback image)
app.use('/src', express.static(path.join(__dirname, 'src')));

// MPD HTTP stream URL (replace with your actual MPD stream URL)
const MPD_STREAM_URL = 'https://mpd.nishimiya.my.id'; // Example URL, replace with your actual stream URL

// Maintain a single MPD client connection
let mpdClient;

mpdapi.connect(config)
  .then(client => {
    mpdClient = client;
  })
  .catch(err => {
    console.error('Failed to connect to MPD:', err);
  });

// Fetch current song info from MPD
async function getCurrentSong() {
  if (!mpdClient) return { title: 'Error', album: '', artist: '', albumCoverUrl: './src/fallback.png', isPlaying: false };

  try {
    const status = await mpdClient.api.status.get();
    const currentSong = await mpdClient.api.status.currentsong();

    const isPlaying = status.state === 'play'; // Check if MPD is currently playing
    const songInfo = {
      title: currentSong?.title || 'Unknown Title',
      album: currentSong?.album || 'Unknown Album',
      artist: currentSong?.artist || 'Unknown Artist',
      isPlaying, // Include playing status
    };

    const albumCoverUrl = await getAlbumCover(songInfo.artist, songInfo.album);
    songInfo.albumCoverUrl = albumCoverUrl || './src/fallback.png';

    return songInfo;
  } catch (error) {
    console.error('Error fetching current song from MPD:', error);
    return { title: 'Error', album: '', artist: '', albumCoverUrl: './src/fallback.png', isPlaying: false };
  }
}

// Fetch songs from the current queue (up to 10 next songs)
async function getNextQueue() {
  if (!mpdClient) return ["Error: MPD client not available"];

  try {
    const queue = await mpdClient.api.queue.info(); // Fetch all songs in the current queue

    if (!queue || queue.length === 0) {
      return ["No songs in queue"];
    }

    const currentSong = await mpdClient.api.status.currentsong();
    if (!currentSong) {
      return ["No song playing"];
    }

    // Get the index of the current song in the queue
    const currentSongIndex = queue.findIndex((song) => song.title === currentSong.title);

    // If the current song is not found, skip the queue processing
    if (currentSongIndex === -1) {
      return ["Error: Current song not found in queue"];
    }

    // Slice the next 10 songs from the queue, starting from the current song's position
    const nextQueue = queue.slice(currentSongIndex + 1, currentSongIndex + 11);

    // Format and return the next 10 songs
    return nextQueue.map((song) => {
      const artist = song.artist || "Unknown Artist";
      const title = song.title || "Unknown Title";
      return `${artist} - ${title}`;
    });
  } catch (error) {
    console.error("Error fetching queue:", error);
    return ["Error loading queue"];
  }
}

// Fetch album cover from Last.fm
async function getAlbumCover(artist, album) {
  try {
    const response = await axios.get(LASTFM_API_URL, {
      params: {
        method: 'album.getinfo',
        artist,
        album,
        api_key: LASTFM_API_KEY,
        format: 'json',
      },
    });

    const albumInfo = response.data.album;
    if (albumInfo && albumInfo.image && albumInfo.image.length > 3) {
      return albumInfo.image[3]['#text']; // Large image
    }
    return '';
  } catch (error) {
    console.error('Error fetching album cover from Last.fm:', error);
    return '';
  }
}

// API endpoint for current song
app.get('/current-song', async (req, res) => {
  const songInfo = await getCurrentSong();
  res.json(songInfo);
});

// API endpoint for upcoming queue
app.get('/queue', async (req, res) => {
  const queue = await getNextQueue();
  res.json(queue);
});

// API endpoint for the audio stream URL
app.get('/audio-stream', (req, res) => {
  res.json({ streamUrl: MPD_STREAM_URL });
});

// Serve the frontend HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
