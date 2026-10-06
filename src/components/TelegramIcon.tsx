import React from 'react';

interface TelegramIconProps {
  className?: string;
  variant?: 'plane' | 'circle';
}

/**
 * Ícone oficial de alta definição do Telegram
 * variant="plane": avião de papel com preenchimento currentColor (para badges com fundo azul)
 * variant="circle": círculo oficial com gradiente azul Telegram (#229ED9 / #0088cc) e avião branco
 */
export const TelegramIcon: React.FC<TelegramIconProps> = ({
  className = 'w-3 h-3',
  variant = 'plane',
}) => {
  if (variant === 'circle') {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Telegram"
      >
        <circle cx="12" cy="12" r="12" fill="#0088cc" />
        <path
          d="m17.5 7.5-13 5c-.9.3-.9.8-.2 1.1l3.3 1 7.7-4.9c.4-.2.7-.1.4.1l-6.2 5.6v3.4c.3 0 .5-.1.7-.3l1.6-1.6 3.4 2.5c.6.3 1.1.2 1.2-.6l2.2-10.4c.2-.9-.3-1.3-1.1-1z"
          fill="#ffffff"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Telegram"
    >
      <path d="m20.665 3.717-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l-.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.432z" />
    </svg>
  );
};
