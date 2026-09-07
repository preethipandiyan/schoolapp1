import React, { useState, useRef, useEffect } from 'react';
import { LuPlay as Play, LuPause as Pause } from 'react-icons/lu';

export default function CustomAudioPlayer({ src, isMe }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
    };

    const setAudioTime = () => setCurrentTime(audio.currentTime);

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', () => setIsPlaying(false));

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', () => setIsPlaying(false));
    };
  }, []);

  const togglePlayPause = () => {
    const prevValue = isPlaying;
    setIsPlaying(!prevValue);
    if (!prevValue) {
      audioRef.current.play();
    } else {
      audioRef.current.pause();
    }
  };

  const formatTime = (time) => {
    if (time && !isNaN(time) && time !== Infinity) {
      const minutes = Math.floor(time / 60);
      const formatMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
      const seconds = Math.floor(time % 60);
      const formatSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;
      return `${formatMinutes}:${formatSeconds}`;
    }
    return '00:00';
  };

  const handleProgressChange = (e) => {
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  return (
    <div className={`flex items-center gap-3 w-60 sm:w-64 p-2 rounded-full ${isMe ? 'bg-primary-700/50 backdrop-blur-sm border border-white/10' : 'bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700'} shadow-sm`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button 
        onClick={togglePlayPause}
        className={`w-9 h-9 flex items-center justify-center rounded-full shrink-0 shadow-sm transition-transform active:scale-95 ${isMe ? 'bg-white dark:bg-slate-900 text-primary-600' : 'bg-primary-600 text-white'}`}
      >
        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
      </button>
      
      <div className="flex-1 flex flex-col justify-center pr-3">
        <input 
          type="range" 
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleProgressChange}
          className={`w-full h-1.5 rounded-full appearance-none cursor-pointer ${isMe ? 'bg-primary-400 [&::-webkit-slider-thumb]:bg-white' : 'bg-slate-300 dark:bg-slate-600 [&::-webkit-slider-thumb]:bg-primary-600'} [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-sm transition-all`}
        />
        <div className={`flex justify-between text-[11px] mt-1.5 font-medium ${isMe ? 'text-primary-100' : 'text-slate-500 dark:text-slate-400'}`}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
