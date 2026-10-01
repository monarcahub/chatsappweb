import React from 'react';

interface WhatsAppWallpaperProps {
  darkMode?: boolean;
}

export const WhatsAppWallpaper: React.FC<WhatsAppWallpaperProps> = ({ darkMode = true }) => {
  return (
    <div
      className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
        darkMode ? 'opacity-[0.06]' : 'opacity-[0.05]'
      }`}
      style={{
        backgroundImage: `radial-gradient(circle at 12px 12px, ${darkMode ? '#8696a0' : '#41525d'} 1.5px, transparent 0)`,
        backgroundSize: '24px 24px',
      }}
    >
      {/* WhatsApp SVG Subtle Pattern Overlay */}
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="wa-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <path
              d="M10 20a4 4 0 1 0 8 0 4 4 0 0 0-8 0zm35 30a3 3 0 1 0 6 0 3 3 0 0 0-6 0zm20-30a5 5 0 1 0 10 0 5 5 0 0 0-10 0zM15 65a4 4 0 1 0 8 0 4 4 0 0 0-8 0z"
              fill={darkMode ? '#ffffff' : '#000000'}
              opacity="0.15"
            />
            <circle cx="50" cy="15" r="2" fill={darkMode ? '#ffffff' : '#000000'} opacity="0.1" />
            <circle cx="20" cy="40" r="1.5" fill={darkMode ? '#ffffff' : '#000000'} opacity="0.1" />
            <circle cx="65" cy="65" r="2" fill={darkMode ? '#ffffff' : '#000000'} opacity="0.1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wa-pattern)" />
      </svg>
    </div>
  );
};
