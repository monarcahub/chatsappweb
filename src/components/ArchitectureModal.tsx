import React, { useState } from 'react';
import {
  X,
  Database,
  Workflow,
  Radio,
  Smartphone,
  Copy,
  Check,
  Code,
  ShieldCheck,
  Zap,
  ArrowRight
} from 'lucide-react';
import { SUPABASE_SQL_SCHEMA, SAFE_MIGRATION_SQL_FOR_EXISTING_DB } from '../data/supabaseSchema';
import { N8N_PAYLOAD_GUIDES } from '../data/n8nPayloads';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({
  isOpen,
  onClose,
  darkMode,
}) => {
  const [activeTab, setActiveTab] = useState<'sql' | 'payloads' | 'realtime' | 'coexistence'>('sql');
  const [sqlMode, setSqlMode] = useState<'safe_migration' | 'full_ddl'>('safe_migration');
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedPayloadIndex, setCopiedPayloadIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const currentSql = sqlMode === 'safe_migration' ? SAFE_MIGRATION_SQL_FOR_EXISTING_DB : SUPABASE_SQL_SCHEMA;

  const handleCopySql = () => {
    navigator.clipboard.writeText(currentSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleCopyPayload = (payload: any, index: number) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedPayloadIndex(index);
    setTimeout(() => setCopiedPayloadIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden ${
          darkMode ? 'bg-[#111b21] border-[#222e35] text-[#e9edef]' : 'bg-white border-gray-200 text-[#111b21]'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-b shrink-0 ${
            darkMode ? 'bg-[#202c33] border-[#222e35]' : 'bg-[#f0f2f5] border-[#e9edef]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold">
                Arquitetura do Sistema: Banco de Dados & Webhooks
              </h2>
              <p className={`text-xs ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                Validação de schemas, triggers de performance e payloads para tempo real
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-full ${
              darkMode ? 'hover:bg-[#374248] text-[#8696a0]' : 'hover:bg-[#e9edef] text-[#54656f]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          className={`px-6 py-2.5 flex items-center gap-2 border-b overflow-x-auto no-scrollbar shrink-0 ${
            darkMode ? 'bg-[#182229] border-[#222e35]' : 'bg-[#f9fafb] border-[#e9edef]'
          }`}
        >
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'sql'
                ? 'bg-[#00a884] text-white shadow'
                : darkMode
                ? 'text-[#8696a0] hover:bg-[#202c33]'
                : 'text-[#54656f] hover:bg-gray-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>1. Tabelas do Banco (SQL DDL)</span>
          </button>

          <button
            onClick={() => setActiveTab('payloads')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'payloads'
                ? 'bg-[#00a884] text-white shadow'
                : darkMode
                ? 'text-[#8696a0] hover:bg-[#202c33]'
                : 'text-[#54656f] hover:bg-gray-200'
            }`}
          >
            <Workflow className="w-4 h-4" />
            <span>2. Payloads JSON de Integração</span>
          </button>

          <button
            onClick={() => setActiveTab('realtime')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'realtime'
                ? 'bg-[#00a884] text-white shadow'
                : darkMode
                ? 'text-[#8696a0] hover:bg-[#202c33]'
                : 'text-[#54656f] hover:bg-gray-200'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>3. Sincronização em Tempo Real</span>
          </button>

          <button
            onClick={() => setActiveTab('coexistence')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'coexistence'
                ? 'bg-[#00a884] text-white shadow'
                : darkMode
                ? 'text-[#8696a0] hover:bg-[#202c33]'
                : 'text-[#54656f] hover:bg-gray-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>4. Modo Coexistência Meta</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* TAB 1: SQL */}
          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-sm text-[#00a884]">
                    {sqlMode === 'safe_migration'
                      ? 'Script de Migração Segura (Para quem já tem as 4 tabelas)'
                      : 'DDL Completo do Banco de Dados (Criar do Zero)'}
                  </h3>
                  <p className={`text-xs ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                    {sqlMode === 'safe_migration'
                      ? 'Cria accounts, account_users com Agente IA, e adiciona account_id em channels, contacts, conversations e messages sem apagar nada.'
                      : 'Esquema completo do banco PostgreSQL com RLS, índices e triggers.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-[#202c33] p-0.5 rounded-lg border border-[#313d45]">
                    <button
                      onClick={() => setSqlMode('safe_migration')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                        sqlMode === 'safe_migration'
                          ? 'bg-[#00a884] text-white'
                          : 'text-[#8696a0] hover:text-white'
                      }`}
                    >
                      Migração Segura
                    </button>
                    <button
                      onClick={() => setSqlMode('full_ddl')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                        sqlMode === 'full_ddl'
                          ? 'bg-[#00a884] text-white'
                          : 'text-[#8696a0] hover:text-white'
                      }`}
                    >
                      DDL Completo
                    </button>
                  </div>

                  <button
                    onClick={handleCopySql}
                    className="px-3 py-1.5 rounded-lg bg-[#00a884] hover:bg-[#00a884]/90 text-white text-xs font-bold flex items-center gap-1.5 shadow shrink-0"
                  >
                    {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedSql ? 'Copiado!' : 'Copiar Script'}</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-black/70 border border-gray-800 text-xs font-mono text-emerald-400 overflow-x-auto max-h-[500px]">
                <pre>{currentSql}</pre>
              </div>
            </div>
          )}

          {/* TAB 2: PAYLOADS */}
          {activeTab === 'payloads' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-sm text-[#00a884]">
                  Estruturação dos Payloads de Integração
                </h3>
                <p className={`text-xs ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                  Como os webhooks, automações e agentes de IA manipulam os dados para alimentar a interface em tempo real.
                </p>
              </div>

              <div className="space-y-4">
                {N8N_PAYLOAD_GUIDES.map((guide, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border ${
                      darkMode ? 'bg-[#182229] border-[#222e35]' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#00a884] px-2 py-0.5 rounded bg-[#00a884]/15 border border-[#00a884]/30">
                          {guide.componentNode}
                        </span>
                        <h4 className="font-semibold text-xs">{guide.title}</h4>
                      </div>
                      <button
                        onClick={() => handleCopyPayload(guide.payload, idx)}
                        className={`text-xs font-medium flex items-center gap-1 ${
                          copiedPayloadIndex === idx ? 'text-[#00a884]' : 'text-[#8696a0] hover:text-white'
                        }`}
                      >
                        {copiedPayloadIndex === idx ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Copiar JSON
                          </>
                        )}
                      </button>
                    </div>
                    <p className={`text-xs mb-3 ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                      {guide.description}
                    </p>
                    <div className="p-3 rounded-lg bg-black/70 border border-gray-800 text-[11px] font-mono text-cyan-300 overflow-x-auto">
                      <pre>{JSON.stringify(guide.payload, null, 2)}</pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: REALTIME INTEGRATION */}
          {activeTab === 'realtime' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-sm text-[#00a884]">
                  Como Funciona a Sincronização em Tempo Real
                </h3>
                <p className={`text-xs ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                  O banco despacha eventos instantâneos WebSocket para o ChatsApp Web em menos de 80ms.
                </p>
              </div>

              {/* Guia de Publicação */}
              <div
                className={`p-4 rounded-xl border text-xs leading-relaxed space-y-2.5 ${
                  darkMode ? 'bg-[#182229] border-[#222e35]' : 'bg-emerald-50/50 border-emerald-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-[#00a884]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Publicação e escuta de eventos:</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-[#8696a0]">
                  <li>
                    <strong>Publicação de tabelas:</strong> O banco de dados publica alterações de <code>messages</code>, <code>conversations</code> e <code>contacts</code> para o barramento em tempo real.
                  </li>
                  <li>
                    <strong>Escuta Reativa:</strong> A interface do ChatsApp Web ouve novas inserções e atualizações de status para refletir as mensagens instantaneamente.
                  </li>
                </ul>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-gray-700/30">
                  <span className="text-[11px] text-gray-400">
                    Se você já executou o script da <strong>Aba 1 (SQL DDL)</strong>, o Realtime já foi ativado via comando SQL!
                  </span>
                  <button
                    onClick={() => {
                      const sql = `ALTER PUBLICATION app_realtime ADD TABLE public.messages;\nALTER PUBLICATION app_realtime ADD TABLE public.conversations;\nALTER PUBLICATION app_realtime ADD TABLE public.contacts;`;
                      navigator.clipboard.writeText(sql);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2000);
                    }}
                    className="px-3 py-1 rounded-md bg-[#00a884] hover:bg-[#02906f] text-white text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer w-fit"
                  >
                    {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copiar SQL de Ativação Realtime</span>
                  </button>
                </div>
              </div>

              {/* Architecture Diagram */}
              <div
                className={`p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-semibold ${
                  darkMode ? 'bg-[#182229] border-[#222e35]' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex flex-col items-center p-3 rounded-lg bg-[#25d366]/10 border border-[#25d366]/30 text-center w-full md:w-auto">
                  <Smartphone className="w-6 h-6 text-[#25d366] mb-1" />
                  <span>Meta Cloud API</span>
                  <span className="text-[10px] text-gray-400">Cliente ou Celular Físico</span>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 rotate-90 md:rotate-0" />

                <div className="flex flex-col items-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center w-full md:w-auto">
                  <Workflow className="w-6 h-6 text-amber-500 mb-1" />
                  <span>Automações</span>
                  <span className="text-[10px] text-gray-400">Webhook + IA + Formatação</span>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 rotate-90 md:rotate-0" />

                <div className="flex flex-col items-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center w-full md:w-auto">
                  <Database className="w-6 h-6 text-emerald-400 mb-1" />
                  <span>Banco de Dados</span>
                  <span className="text-[10px] text-gray-400">Trigger + Realtime WAL</span>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 rotate-90 md:rotate-0" />

                <div className="flex flex-col items-center p-3 rounded-lg bg-[#00a884]/20 border border-[#00a884]/40 text-center w-full md:w-auto">
                  <Zap className="w-6 h-6 text-[#00a884] mb-1" />
                  <span>ChatsApp React Web</span>
                  <span className="text-[10px] text-gray-400">Atualização em &lt; 80ms</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: META COEXISTENCE */}
          {activeTab === 'coexistence' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-sm text-[#00a884]">
                  O que é o Modo Coexistência da Meta e como funciona?
                </h3>
                <p className={`text-xs ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                  O recurso oficial mais valioso para pequenas e médias empresas:
                </p>
              </div>

              <div
                className={`p-4 rounded-xl border space-y-3 leading-relaxed text-xs ${
                  darkMode ? 'bg-[#182229] border-[#222e35]' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#00a884]/20 text-[#00a884] shrink-0 mt-0.5">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm mb-1">Como funciona na prática:</h4>
                    <p className={darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}>
                      Ao registrar um número no modo <strong>WhatsApp Cloud API Coexistence</strong>, o atendente ou dono da empresa continua com o WhatsApp Business instalado no celular físico (Android/iPhone).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 shrink-0 mt-0.5">
                    <Workflow className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm mb-1">Sincronização bidirecional:</h4>
                    <p className={darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}>
                      Quando o atendente digita e envia uma mensagem pelo celular, a API oficial dispara um webhook com a flag de mensagem enviada do dispositivo (marcada no banco como <code>sender_type = 'coexistence_mobile'</code>). O ChatsApp Web renderiza a mensagem imediatamente com o selo <strong>"Enviado via Celular Físico"</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm mb-1">Estabilidade e Continuidade:</h4>
                    <p className={darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}>
                      Em soluções não-oficiais, usar o app no celular costuma derrubar a sessão web ou gerar descompasso de mensagens. Com a API Oficial + Coexistência, o sistema opera com total estabilidade, sem desconexões ou bloqueios de número!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
