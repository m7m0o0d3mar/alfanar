import { useState } from 'react';

interface AvatarProps {
  url?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 50%)`;
}

export default function Avatar({ url, name, email, size = 32, className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || email || 'U')[0].toUpperCase();
  const bgColor = stringToColor(name || email || 'U');

  if (url && !imgError) {
    return (
      <img
        src={url}
        alt={name || 'Avatar'}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size, minWidth: size }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold select-none ${className}`}
      style={{
        width: size, height: size, minWidth: size,
        fontSize: Math.max(size * 0.4, 10),
        background: `linear-gradient(135deg, ${bgColor}, ${bgColor}dd)`,
      }}
    >
      {initial}
    </div>
  );
}
