import React, { useState } from 'react';

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
  title?: string;
  showBorder?: boolean;
}

export const getInitials = (fullName: string): string => {
  if (!fullName) return 'U';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base font-semibold',
  xl: 'w-16 h-16 text-lg font-bold',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarUrl,
  size = 'md',
  className = '',
  onClick,
  title,
  showBorder = true,
}) => {
  const [hasError, setHasError] = useState(false);
  const initials = getInitials(name);

  // If avatarUrl exists and has not failed loading
  if (avatarUrl && !hasError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        title={title || name}
        onClick={onClick}
        onError={() => setHasError(true)}
        className={`${sizeClasses[size]} rounded-full object-cover shrink-0 select-none ${
          showBorder ? 'ring-2 ring-[#00a884]/40' : ''
        } ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''} ${className}`}
      />
    );
  }

  // Fallback: Elegant WhatsApp-style initials badge with custom brand green
  return (
    <div
      onClick={onClick}
      title={title || name}
      className={`${sizeClasses[size]} rounded-full bg-[#00a884] text-white flex items-center justify-center font-bold tracking-wider shrink-0 select-none shadow-xs ${
        showBorder ? 'ring-2 ring-[#00a884]/40' : ''
      } ${onClick ? 'cursor-pointer hover:opacity-95 active:scale-[0.98] transition-all' : ''} ${className}`}
    >
      {initials}
    </div>
  );
};
