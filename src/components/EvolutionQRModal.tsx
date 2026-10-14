import React from 'react';
import {
  X,
  QrCode,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { EvolutionState } from '../hooks/useEvolutionWhatsApp';

interface EvolutionQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  qrCodeSrc: string;
  status: EvolutionState;
  statusMessage: string;
  instanceName: string;
  channelName: string;
  onRefreshQr: () => void;
  darkMode: boolean;
}

export const EvolutionQRModal: React.FC<EvolutionQRModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  qrCodeSrc,
  status,
  statusMessage,
  instanceName,
  channelName,
  onRefreshQr,
  darkMode,
}) => {
  if (!isOpen) return null;

  const isConnected = status === 'connected' || status === 'open';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl relative transition-all ${
          darkMode ? 'bg-[#202c33] border-[#313d45] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between pb-3 border-b border-gray-700/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00a884]/20 text-[#00a884] flex items-center justify-center font-bold">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {isConnected ? 'WhatsApp Conectado!' : 'Conectar WhatsApp via QR Code'}
              </h3>
              <p className="text-xs text-[#8696a0]">
                {channelName} • <span className="font-mono text-[#00a884] font-semibold">{instanceName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#8696a0] hover:text-white hover:bg-[#313d45] transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="py-4">
          {isConnected ? (
            /* Sucesso Conectado */
            <div className="text-center py-6 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-emerald-400">WhatsApp Conectado com sucesso!</h4>
                <p className="text-xs text-[#8696a0]">
                  Sua instância <strong>{instanceName}</strong> está ativa. A IA e os atendentes já podem trocar mensagens.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Fechando janela em 2 segundos...</span>
              </div>
            </div>
          ) : (
            /* Exibição do QR Code e Instruções */
            <div className="space-y-4">
              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center">
                <div
                  className={`w-64 h-64 rounded-2xl border-2 p-3 flex items-center justify-center relative overflow-hidden transition-all shadow-inner ${
                    darkMode
                      ? 'bg-white border-[#00a884]/40 shadow-black/40'
                      : 'bg-white border-emerald-300 shadow-emerald-100'
                  }`}
                >
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center text-center p-4 space-y-3">
                      <Loader2 className="w-10 h-10 text-[#00a884] animate-spin" />
                      <span className="text-xs font-semibold text-gray-700">
                        {statusMessage || 'Gerando QR Code...'}
                      </span>
                    </div>
                  ) : qrCodeSrc ? (
                    <div className="relative group">
                      <img
                        src={qrCodeSrc}
                        alt="QR Code WhatsApp"
                        className="w-56 h-56 object-contain rounded-lg select-none"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-4 space-y-2">
                      <AlertCircle className="w-8 h-8 text-amber-400" />
                      <span className="text-xs font-semibold text-gray-700">
                        {statusMessage || 'Aguardando QR Code...'}
                      </span>
                      <button
                        type="button"
                        onClick={onRefreshQr}
                        className="mt-2 px-3 py-1.5 rounded-lg bg-[#00a884] text-white text-xs font-semibold hover:bg-[#009374] transition-colors"
                      >
                        Tentar novamente
                      </button>
                    </div>
                  )}
                </div>

                {/* Status Polling Live Indicator */}
                {!isLoading && qrCodeSrc && (
                  <div className="mt-3 flex items-center justify-between w-full px-2 text-xs">
                    <div className="flex items-center gap-2 text-[#00a884] font-semibold">
                      <span className="w-2 h-2 rounded-full bg-[#25d366] animate-pulse" />
                      <span className="text-[11px]">Aguardando leitura do aparelho...</span>
                    </div>

                    <button
                      type="button"
                      onClick={onRefreshQr}
                      disabled={isLoading}
                      className="text-[11px] font-semibold text-[#8696a0] hover:text-[#00a884] flex items-center gap-1 transition-colors cursor-pointer"
                      title="Atualizar QR Code se expirou"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                      <span>Atualizar QR</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Instruções do WhatsApp */}
              <div
                className={`p-3.5 rounded-2xl border space-y-2 text-xs leading-relaxed ${
                  darkMode ? 'bg-[#182229] border-[#313d45] text-[#8696a0]' : 'bg-gray-50 border-gray-200 text-[#54656f]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-[#00a884]">
                  <Smartphone className="w-4 h-4" />
                  <span>Como Conectar o WhatsApp:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px]">
                  <li>
                    Abra o <strong>WhatsApp</strong> no seu celular
                  </li>
                  <li>
                    Toque nos <strong>3 pontinhos (Android)</strong> ou <strong>Configurações (iPhone)</strong>
                  </li>
                  <li>
                    Selecione <strong>Aparelhos Conectados</strong>
                  </li>
                  <li>
                    Toque em <strong>Conectar um aparelho</strong> e aponte para a tela
                  </li>
                </ol>
              </div>

              {/* Informação sobre segurança e Evolution API */}
              <div className="flex items-center gap-2 px-1 text-[11px] text-[#8696a0]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00a884] shrink-0" />
                <span>
                  Conexão segura via Evolution API. Seus dados e mensagens trafegam com criptografia.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="pt-2 border-t border-gray-700/20 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className={`w-full py-2.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              darkMode ? 'border-[#313d45] hover:bg-[#313d45] text-[#8696a0]' : 'border-gray-300 hover:bg-gray-100 text-gray-700'
            }`}
          >
            {isConnected ? 'Concluir' : 'Cancelar Conexão'}
          </button>
        </div>
      </div>
    </div>
  );
};
