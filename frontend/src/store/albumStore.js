/**
 * albumStore.js
 * Persists emotion-based albums to localStorage.
 * Each emotion has its own album of songs that were played for it.
 */

const STORAGE_KEY = "emotitune-albums";

const EMOTION_ALBUM_NAMES = {
  happy:    { name: "Happy Vibes",      emoji: "😊", color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  sad:      { name: "Rainy Days",       emoji: "😢", color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  angry:    { name: "Rage Mode",        emoji: "😠", color: "#f87171", bg: "rgba(248,113,113,0.1)" },
  fear:     { name: "Dark Hours",       emoji: "😨", color: "#c084fc", bg: "rgba(192,132,252,0.1)" },
  surprise: { name: "Plot Twist",       emoji: "😲", color: "#34d399", bg: "rgba(52,211,153,0.1)" },
  disgust:  { name: "Raw Energy",       emoji: "🤢", color: "#a3e635", bg: "rgba(163,230,53,0.1)" },
  neutral:  { name: "Chill Zone",       emoji: "😐", color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
};

export function getAlbums() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch { return {}; }
}

export function saveAlbums(albums) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(albums));
}

export function addSongToAlbum(emotion, song) {
  if (!song?.id) return;
  const albums = getAlbums();
  if (!albums[emotion]) albums[emotion] = [];
  // Avoid duplicates
  if (!albums[emotion].find(s => s.id === song.id)) {
    albums[emotion].unshift({ // newest first
      id: song.id,
      title: song.title,
      artist: song.artist,
      cover_url: song.cover_url,
      preview_url: song.preview_url,
      album: song.album,
      addedAt: Date.now(),
    });
  }
  saveAlbums(albums);
}

export function getAlbumForEmotion(emotion) {
  const albums = getAlbums();
  return albums[emotion] || [];
}

export function removeFromAlbum(emotion, songId) {
  const albums = getAlbums();
  if (albums[emotion]) {
    albums[emotion] = albums[emotion].filter(s => s.id !== songId);
    saveAlbums(albums);
  }
}

export function clearAlbum(emotion) {
  const albums = getAlbums();
  delete albums[emotion];
  saveAlbums(albums);
}

export { EMOTION_ALBUM_NAMES };
