import React from 'react';
import { MessageSquare, Phone, Brain, Store } from 'lucide-react';

export type MainNavTab = 'chats' | 'connections' | 'brain' | 'tools';

interface BottomNavBarProps {
  activeTab: MainNavTab;
  onSelectTab: (tab: MainNavTab) => void;
  unreadChatsCount: number;
  connectedChannelsCount?: number;
  isAIActiveGlobal?: boolean;
  darkMode: boolean;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onSelectTab,
  unreadChatsCount,
  connectedChannelsCount = 0,
  isAIActiveGlobal = true,
  darkMode,
}) => {
  const tabs = [
    {
      id: 'chats' as MainNavTab,
      label: 'Conversas',
      icon: MessageSquare,
      badge: unreadChatsCount > 0 ? unreadChatsCount : null,
      badgeColor: 'bg-[#25d366] text-black',
    },
    {
      id: 'connections' as MainNavTab,
      label: 'Conexões',
      icon: Phone,
      badge: null,
      dotIndicator: connectedChannelsCount > 0 ? 'bg-[#25d366]' : 'bg-[#8696a0]',
    },
    {
      id: 'brain' as MainNavTab,
      label: 'Cérebro',
      icon: Brain,
      badge: null,
      dotIndicator: isAIActiveGlobal ? 'bg-[#25d366]' : 'bg-amber-500',
    },
    {
      id: 'tools' as MainNavTab,
      label: 'Ferramentas',
      icon: Store,
      badge: null,
    },
  ];

  return (
    <nav
      id="mobile-bottom-navigation-bar"
      aria-label="Navegação Principal Mobile"
      className={`fixed bottom-0 left-0 right-0 z-40 h-16 border-t select-none transition-colors duration-150 pb-[env(safe-area-inset-bottom,0px)] ${
        darkMode
          ? 'bg-[#202c33] border-[#2f3b43] text-[#aebac1]'
          : 'bg-[#ffffff] border-[#e9edef] text-[#54656f]'
      }`}
    >
      <div className="h-full max-w-md mx-auto grid grid-cols-4 items-center">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              id={`bottom-nav-${tab.id}`}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`relative flex flex-col items-center justify-center h-full w-full py-1 transition-all duration-150 cursor-pointer group active:scale-95 ${
                isActive
                  ? darkMode
                    ? 'text-[#00a884]'
                    : 'text-[#00a884]'
                  : darkMode
                  ? 'text-[#8696a0] hover:text-[#d1d7db]'
                  : 'text-[#54656f] hover:text-[#111b21]'
              }`}
            >
              {/* Icon Container with subtle pill background on active */}
              <div
                className={`relative px-3.5 py-1 rounded-full transition-all duration-150 flex items-center justify-center ${
                  isActive
                    ? darkMode
                      ? 'bg-[#00a884]/15'
                      : 'bg-[#00a884]/12'
                    : 'bg-transparent'
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform duration-150 ${
                    isActive ? 'scale-105 stroke-[2.3]' : 'stroke-[1.8]'
                  }`}
                />

                {/* Unread Message Badge */}
                {tab.badge !== null && (
                  <span
                    className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs ${tab.badgeColor}`}
                  >
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}

                {/* Status Dot Indicator (Conexões & Cérebro) */}
                {tab.dotIndicator && tab.badge === null && (
                  <span className="absolute top-1 right-2 flex h-2 w-2">
                    {tab.id === 'brain' && isAIActiveGlobal && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 border ${
                        darkMode ? 'border-[#202c33]' : 'border-white'
                      } ${tab.dotIndicator}`}
                    />
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={`text-[11px] mt-0.5 tracking-tight transition-colors ${
                  isActive ? 'font-bold text-[#00a884]' : 'font-medium'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
