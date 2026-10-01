import React, { useState } from 'react';
import {
  MessageSquare,
  Sparkles,
  Smartphone,
  Play,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
  HelpCircle,
  ExternalLink,
  Bot,
  UserPlus
} from 'lucide-react';
import { Account, AuthUser } from '../types';

interface OnboardingScreenProps {
  darkMode: boolean;
  account: Account;
  user: AuthUser;
  onOpenChannels: () => void;
  onOpenAIBrain: () => void;
  onOpenNewChat: () => void;
  onSkipToDashboard?: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  darkMode,
  account,
  user,
  onOpenChannels,
  onOpenAIBrain,
  onOpenNewChat,
  onSkipToDashboard,
}) => {
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  return (
    <div
      className={`h-full w-full overflow-y-auto p-4 sm:p-8 flex flex-col items-center ${
        darkMode ? 'bg-[#111b21] text-[#e9edef]' : 'bg-[#f0f2f5] text-[#111b21]'
      }`}
    >
      <div className="w-full max-w-4xl space-y-6">
        {/* Welcome Header */}
        <div
          className={`rounded-2xl p-6 sm:p-8 border shadow-sm relative overflow-hidden ${
            darkMode ? 'bg-[#202c33] border-[#313d45]' : 'bg-white border-[#e9edef]'
          }`}
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#00a884]/15 text-[#00a884] mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Workspace Isolado e Seguro</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Boas-vindas ao ChatsApp Web, {account.name}!
              </h1>
              <p className={`text-sm mt-2 max-w-xl leading-relaxed ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                Olá <strong>{user.name}</strong>, seu ambiente corporativo foi criado com sucesso. Siga o guia abaixo para conectar seu primeiro canal de WhatsApp e ativar seu Agente IA.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              {onSkipToDashboard && (
                <button
                  onClick={onSkipToDashboard}
                  className={`px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                    darkMode ? 'border-[#313d45] hover:bg-[#313d45] text-[#8696a0]' : 'border-gray-300 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  Ir para o Painel
                </button>
              )}
              <button
                onClick={onOpenChannels}
                className="px-5 py-3 rounded-xl bg-[#00a884] hover:bg-[#009374] text-white text-sm font-semibold shadow-md flex items-center gap-2 transition-all active:scale-[0.99]"
              >
                <Smartphone className="w-4 h-4" />
                Conectar WhatsApp
              </button>
            </div>
          </div>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Passo 1: Conectar Canal */}
          <div
            className={`rounded-2xl p-5 border shadow-sm flex flex-col justify-between transition-all hover:border-[#00a884]/60 ${
              darkMode ? 'bg-[#202c33] border-[#313d45]' : 'bg-white border-[#e9edef]'
            }`}
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#25d366]/20 text-[#25d366] flex items-center justify-center font-bold text-sm mb-3">
                1
              </div>
              <h3 className="text-base font-bold mb-1">Conectar WhatsApp</h3>
              <p className={`text-xs leading-relaxed mb-4 ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                Conecte seu número de WhatsApp via QR Code ou Meta Cloud API oficial para receber mensagens na caixa de entrada.
              </p>
            </div>
            <button
              onClick={onOpenChannels}
              className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                darkMode ? 'bg-[#111b21] hover:bg-[#2a3942] text-[#00a884]' : 'bg-[#f0f2f5] hover:bg-[#e9edef] text-[#00a884]'
              }`}
            >
              <span>Gerenciar Canais</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Passo 2: Configurar IA */}
          <div
            className={`rounded-2xl p-5 border shadow-sm flex flex-col justify-between transition-all hover:border-[#00a884]/60 ${
              darkMode ? 'bg-[#202c33] border-[#313d45]' : 'bg-white border-[#e9edef]'
            }`}
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm mb-3">
                2
              </div>
              <h3 className="text-base font-bold mb-1">Configurar Agente IA</h3>
              <p className={`text-xs leading-relaxed mb-4 ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                O Agente IA já está configurado e pronto para a sua empresa. Defina catálogo e regras de atendimento.
              </p>
            </div>
            <button
              onClick={onOpenAIBrain}
              className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                darkMode ? 'bg-[#111b21] hover:bg-[#2a3942] text-purple-400' : 'bg-[#f0f2f5] hover:bg-[#e9edef] text-purple-600'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Personalizar IA</span>
            </button>
          </div>

          {/* Passo 3: Iniciar Conversa */}
          <div
            className={`rounded-2xl p-5 border shadow-sm flex flex-col justify-between transition-all hover:border-[#00a884]/60 ${
              darkMode ? 'bg-[#202c33] border-[#313d45]' : 'bg-white border-[#e9edef]'
            }`}
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm mb-3">
                3
              </div>
              <h3 className="text-base font-bold mb-1">Novo Atendimento</h3>
              <p className={`text-xs leading-relaxed mb-4 ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                Inicie um atendimento direto digitando o número do WhatsApp de um cliente ou receba mensagens diretamente dos seus canais conectados.
              </p>
            </div>
            <button
              onClick={onOpenNewChat}
              className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                darkMode ? 'bg-[#111b21] hover:bg-[#2a3942] text-blue-400' : 'bg-[#f0f2f5] hover:bg-[#e9edef] text-blue-600'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Novo Chat</span>
            </button>
          </div>
        </div>

        {/* Video Tutorial Card */}
        <div
          className={`rounded-2xl p-6 border shadow-sm ${
            darkMode ? 'bg-[#202c33] border-[#313d45]' : 'bg-white border-[#e9edef]'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-red-500/15 text-red-500">
                <Play className="w-4 h-4 fill-current" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Tutorial em Vídeo: Primeiros Passos</h3>
                <p className={`text-xs ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                  Aprenda a conectar seu WhatsApp e configurar o Agente IA em menos de 3 minutos
                </p>
              </div>
            </div>
            <span className="text-xs px-2 py-1 rounded bg-[#111b21] text-[#8696a0] font-mono">
              03:15
            </span>
          </div>

          <div
            onClick={() => setIsPlayingVideo(!isPlayingVideo)}
            className="w-full h-52 sm:h-72 rounded-xl bg-gradient-to-br from-[#111b21] via-[#1a2730] to-[#0b141a] border border-[#313d45] flex flex-col items-center justify-center relative cursor-pointer group overflow-hidden"
          >
            {isPlayingVideo ? (
              <div className="p-6 text-center max-w-md">
                <div className="w-12 h-12 rounded-full bg-[#00a884]/20 text-[#00a884] flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white mb-2">Tutorial Interativo Guiado</h4>
                <p className="text-xs text-[#8696a0] mb-4">
                  1. Abra a aba <strong>Canais</strong> no menu esquerdo.<br />
                  2. Clique em <strong>Adicionar Instância WhatsApp</strong>.<br />
                  3. Aponte a câmera do seu celular no QR Code para parear.
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenChannels();
                  }}
                  className="px-4 py-2 rounded-xl bg-[#00a884] text-white text-xs font-semibold"
                >
                  Ir para Conexão de Canais
                </button>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-[#00a884] text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Play className="w-7 h-7 fill-white translate-x-0.5" />
                </div>
                <span className="mt-4 text-xs font-medium text-white/90">
                  Clique para assistir o guia rápido
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
