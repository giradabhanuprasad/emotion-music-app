/**
 * useContext.js
 * Collects user context — location, time of day, activity — to
 * personalize music recommendations beyond just emotion.
 */

import { useState, useEffect, useCallback } from "react";

// Time of day → activity mapping
function getTimeContext() {
  const hour = new Date().getHours();
  if (hour >= 5  && hour < 9)  return { activity: "morning",   label: "Morning Routine", emoji: "🌅" };
  if (hour >= 9  && hour < 12) return { activity: "working",   label: "Work Hours",       emoji: "💼" };
  if (hour >= 12 && hour < 14) return { activity: "lunch",     label: "Lunch Break",      emoji: "🍱" };
  if (hour >= 14 && hour < 17) return { activity: "afternoon", label: "Afternoon",        emoji: "☀️" };
  if (hour >= 17 && hour < 20) return { activity: "evening",   label: "Evening Wind-down",emoji: "🌆" };
  if (hour >= 20 && hour < 23) return { activity: "night",     label: "Night Time",       emoji: "🌙" };
  return { activity: "late_night", label: "Late Night",  emoji: "🌃" };
}

// Activity → music preference adjustments
export const ACTIVITY_MUSIC_HINTS = {
  morning:    { energy: 0.6, valence: 0.7, tempo: "moderate", desc: "Uplifting morning tracks" },
  working:    { energy: 0.5, valence: 0.6, tempo: "moderate", desc: "Focus-friendly music" },
  lunch:      { energy: 0.6, valence: 0.7, tempo: "upbeat",   desc: "Light & cheerful picks" },
  afternoon:  { energy: 0.7, valence: 0.6, tempo: "moderate", desc: "Energetic afternoon mix" },
  evening:    { energy: 0.4, valence: 0.5, tempo: "slow",     desc: "Relaxing evening tunes" },
  night:      { energy: 0.3, valence: 0.4, tempo: "slow",     desc: "Calm night-time music" },
  late_night: { energy: 0.2, valence: 0.3, tempo: "slow",     desc: "Late night ambient sounds" },
};

// Weather → emotion modifier
function weatherToMoodModifier(weatherCode) {
  if (!weatherCode) return null;
  if (weatherCode < 300) return { boost: "angry", label: "Thunderstorm ⛈️" };
  if (weatherCode < 500) return { boost: "sad",   label: "Drizzle 🌦️" };
  if (weatherCode < 600) return { boost: "sad",   label: "Rainy 🌧️" };
  if (weatherCode < 700) return { boost: "fear",  label: "Snowy ❄️" };
  if (weatherCode < 800) return { boost: "neutral",label: "Cloudy ☁️" };
  if (weatherCode === 800) return { boost: "happy", label: "Clear Sky ☀️" };
  return { boost: "neutral", label: "Partly Cloudy 🌤️" };
}

export function useUserContext() {
  const [location, setLocation] = useState(null);
  const [weather, setWeather] = useState(null);
  const [timeContext, setTimeContext] = useState(getTimeContext());
  const [locationError, setLocationError] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);

  // Update time context every minute
  useEffect(() => {
    const timer = setInterval(() => setTimeContext(getTimeContext()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchLocation = useCallback(async () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ latitude, longitude });

        // Fetch weather using Open-Meteo (free, no API key needed)
        setLoadingWeather(true);
        try {
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
          );
          const data = await res.json();
          const code = data?.current_weather?.weathercode ?? null;
          const temp = data?.current_weather?.temperature ?? null;
          setWeather({
            code,
            temp,
            modifier: weatherToMoodModifier(code),
            windspeed: data?.current_weather?.windspeed,
          });
        } catch {
          setWeather(null);
        } finally {
          setLoadingWeather(false);
        }
      },
      () => setLocationError("Location access denied")
    );
  }, []);

  // Combined context score — blends all signals
  const getContextualEmotionWeights = useCallback((cameraEmotion, voiceEmotion) => {
    const weights = {};
    const emotions = ["angry", "disgust", "fear", "happy", "sad", "surprise", "neutral"];
    emotions.forEach(e => weights[e] = 0);

    // Camera gets 50% weight
    if (cameraEmotion) weights[cameraEmotion] = (weights[cameraEmotion] || 0) + 0.50;

    // Voice gets 30% weight
    if (voiceEmotion) weights[voiceEmotion] = (weights[voiceEmotion] || 0) + 0.30;

    // Weather modifier gets 10% weight
    if (weather?.modifier?.boost) {
      const w = weather.modifier.boost;
      weights[w] = (weights[w] || 0) + 0.10;
    }

    // Time/activity gets 10% — boost calm emotions at night, energetic in morning
    const activity = timeContext.activity;
    if (["night", "late_night"].includes(activity)) {
      weights["neutral"] = (weights["neutral"] || 0) + 0.10;
    } else if (["morning", "working"].includes(activity)) {
      weights["happy"] = (weights["happy"] || 0) + 0.10;
    } else {
      weights["happy"] = (weights["happy"] || 0) + 0.05;
      weights["neutral"] = (weights["neutral"] || 0) + 0.05;
    }

    // Return dominant blended emotion
    const dominant = Object.entries(weights).sort((a, b) => b[1] - a[1])[0][0];
    return { dominant, weights };
  }, [weather, timeContext]);

  return {
    location, weather, timeContext, locationError, loadingWeather,
    fetchLocation, getContextualEmotionWeights,
    activityHint: ACTIVITY_MUSIC_HINTS[timeContext.activity] || ACTIVITY_MUSIC_HINTS.afternoon,
  };
}
