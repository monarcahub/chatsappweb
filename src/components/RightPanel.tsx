import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  Bot,
  UserCheck,
  Tag as TagIcon,
  Plus,
  StickyNote,
  DollarSign,
  Briefcase,
  Layers,
  ChevronRight,
  ShieldCheck,
  Check,
  AlertTriangle,
  Code,
  Globe,
  Instagram,
  MessageSquare,
  Mail,
  Phone,
  User,
  Pencil,
} from 'lucide-react';
import { Contact, AIStatus, Tag, CRMStage, ConversationStatus } from '../types';
import { TelegramIcon } from './TelegramIcon';

interface RightPanelProps {
  contact: Contact;
  onClose: () => void;
  onUpdateAIStatus: (status: AIStatus) => void;
  onToggleCoexistence: () => void;
  onUpdateDealStage: (stage: CRMStage) => void;
  onUpdateDealValue: (value: number) => void;
  onAddTag: (tag: Tag) => void;
  onRemoveTag: (tagId: string) => void;
  onAddNote: (text: string) => void;
  availableTags: Tag[];
  darkMode: boolean;
  onUpdateContactName?: (name: string) => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  contact,
  onClose,
  onUpdateAIStatus,
  onToggleCoexistence,
  onUpdateDealStage,
  onUpdateDealValue,
  onAddTag,
  onRemoveTag,
  onAddNote,
  availableTags,
  darkMode,
  onUpdateContactName,
}) => {
  const [newNoteText, setNewNoteText] = useState('');
  const [dealValInput, setDealValInput] = useState(contact.crm.dealValue?.toString() || '');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(contact.name);

  useEffect(() => {
    setEditedName(contact.name);
    setIsEditingName(false);
  }, [contact.id, contact.name]);

  const handleSaveName = () => {
    if (editedName.trim() && onUpdateContactName) {
      onUpdateContactName(editedName.trim());
    }
    setIsEditingName(false);
  };

  const handleAddNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    onAddNote(newNoteText.trim());
    setNewNoteText('');
  };

  const handleDealValueBlur = () => {
    const num = parseFloat(dealValInput);
    if (!isNaN(num)) {
      onUpdateDealValue(num);
    }
  };

  // Funil de Vendas oficial solicitado:
  // crm_stage ('novo_lead', 'qualificado', 'agendado', 'ganho', 'perdido')
  const stages: { key: CRMStage; label: string; color: string }[] = [
    { key: 'novo_lead', label: '1. Novo Lead', color: 'bg-blue-500' },
    { key: 'qualificado', label: '2. Qualificado', color: 'bg-indigo-500' },
    { key: 'agendado', label: '3. Agendado', color: 'bg-amber-500' },
    { key: 'ganho', label: '4. Ganho (Fechado)', color: 'bg-emerald-500' },
    { key: 'perdido', label: '5. Perdido', color: 'bg-rose-500' },
  ];

  // Normalização de estágio atual
  const currentStageKey = ((): CRMStage => {
    const s = contact.crm.dealStage as string;
    if (s === 'lead' || s === 'novo_lead') return 'novo_lead';
    if (s === 'contacted' || s === 'qualificado') return 'qualificado';
    if (s === 'proposal' || s === 'negotiation' || s === 'agendado') return 'agendado';
    if (s === 'won' || s === 'ganho') return 'ganho';
    if (s === 'lost' || s === 'perdido') return 'perdido';
    return 'novo_lead';
  })();

  const getChannelIcon = () => {
    switch (contact.channel) {
      case 'telegram':
        return <TelegramIcon className="w-4 h-4 text-[#0088cc]" />;
      case 'instagram':
        return <Instagram className="w-4 h-4 text-pink-500" />;
      case 'webchat':
        return <Globe className="w-4 h-4 text-blue-500" />;
      case 'whatsapp':
      default:
        return <MessageSquare className="w-4 h-4 text-[#25d366]" />;
    }
  };

  return (
    <div
      className={`w-full md:w-80 lg:w-96 flex flex-col h-full border-l shrink-0 transition-colors duration-200 ${
        darkMode ? 'bg-[#111b21] border-[#222e35] text-[#e9edef]' : 'bg-[#f0f2f5] border-[#e9edef] text-[#111b21]'
      }`}
    >
      {/* Panel Header */}
      <div
        className={`px-4 py-3 flex items-center justify-between border-b ${
          darkMode ? 'bg-[#202c33] border-[#222e35]' : 'bg-white border-[#e9edef]'
        }`}
      >
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Briefcase className="w-4 h-4 text-[#00a884]" />
          <span>Dados do Cliente & CRM</span>
        </div>
        <button
          id="btn-close-right-panel"
          onClick={onClose}
          className={`p-1.5 rounded-full ${
            darkMode ? 'hover:bg-[#374248] text-[#8696a0]' : 'hover:bg-[#f0f2f5] text-[#54656f]'
          }`}
          title="Fechar painel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* Profile Card */}
        <div
          className={`p-4 rounded-xl border flex flex-col items-center text-center ${
            darkMode ? 'bg-[#202c33] border-[#222e35]' : 'bg-white border-[#e9edef]'
          }`}
        >
          <div className="relative mb-3">
            <img
              src={contact.avatarUrl}
              alt={contact.name}
              className="w-20 h-20 rounded-full object-cover ring-4 ring-[#00a884]/20"
            />
            <span
              className={`absolute bottom-0 right-1 w-4 h-4 rounded-full border-2 ${
                contact.coexistenceEnabled ? 'bg-[#25d366]' : 'bg-gray-400'
              } ${darkMode ? 'border-[#202c33]' : 'border-white'}`}
              title={contact.coexistenceEnabled ? 'Coexistência Celular Ativa' : 'Apenas Cloud API'}
            />
          </div>

          {/* Nome com suporte a edição imediata */}
          {isEditingName ? (
            <div className="flex items-center gap-1.5 w-full max-w-[240px]">
              <input
                type="text"
                autoFocus
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
                className={`flex-1 px-2.5 py-1 text-sm rounded-lg border outline-hidden transition-all ${
                  darkMode
                    ? 'bg-[#111b21] border-[#00a884] text-[#e9edef]'
                    : 'bg-white border-[#00a884] text-[#111b21]'
                }`}
              />
              <button
                type="button"
                onClick={handleSaveName}
                title="Salvar nome"
                className="p-1.5 bg-[#00a884] text-white rounded-lg hover:bg-[#02906f] transition-colors cursor-pointer shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 group max-w-full">
              <h3 className="font-bold text-base truncate max-w-[200px]" title={contact.name}>
                {contact.name}
              </h3>
              {onUpdateContactName && (
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  title="Editar nome do contato"
                  className="p-1 text-gray-400 hover:text-[#00a884] rounded-md transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Dados cadastrais */}
          <div className="w-full mt-3 pt-3 border-t border-gray-700/30 text-xs space-y-1.5 text-left">
            <div className="flex items-center gap-2 text-gray-400">
              <span className="shrink-0">{getChannelIcon()}</span>
              <span className="truncate font-medium text-[#e9edef]">
                {contact.channel === 'telegram'
                  ? 'Telegram'
                  : contact.channel === 'whatsapp'
                  ? 'WhatsApp Oficial'
                  : contact.channel === 'instagram'
                  ? 'Instagram Direct'
                  : 'Chat do Site'}
              </span>
            </div>
            {contact.phone && (
              <div className="flex items-center gap-2 text-gray-400">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate text-gray-300">{contact.phone}</span>
              </div>
            )}
            {contact.instagramUsername && (
              <div className="flex items-center gap-2 text-gray-400">
                <Instagram className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate text-gray-300">@{contact.instagramUsername.replace('@', '')}</span>
              </div>
            )}
            {contact.email && (
              <div className="flex items-center gap-2 text-gray-400">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate text-gray-300">{contact.email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Funil de Vendas (CRM Stage) */}
        <div
          className={`p-3.5 rounded-xl border ${
            darkMode ? 'bg-[#202c33] border-[#222e35]' : 'bg-white border-[#e9edef]'
          }`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-[#00a884]">
              <Layers className="w-3.5 h-3.5" />
              <span>Funil de Vendas</span>
            </div>
            <span className="text-[10px] text-gray-400">Sincronizado</span>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {stages.map((st) => {
              const isCurrent = currentStageKey === st.key;
              return (
                <button
                  key={st.key}
                  id={`btn-stage-${st.key}`}
                  onClick={() => onUpdateDealStage(st.key)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isCurrent
                      ? 'bg-[#00a884] text-white shadow-sm ring-1 ring-white/20'
                      : darkMode
                      ? 'bg-[#111b21] hover:bg-[#2a3942] text-gray-300'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isCurrent ? 'bg-white' : st.color
                      }`}
                    />
                    <span>{st.label}</span>
                  </div>
                  {isCurrent && <Check className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </div>

          {/* Valor da Oportunidade */}
          <div className="mt-3 pt-3 border-t border-gray-700/30">
            <label className="block text-[11px] font-medium text-gray-400 mb-1">
              Valor da Negociação (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-gray-400">R$</span>
              <input
                id="input-deal-value"
                type="number"
                value={dealValInput}
                onChange={(e) => setDealValInput(e.target.value)}
                onBlur={handleDealValueBlur}
                placeholder="0,00"
                className={`w-full pl-9 pr-3 py-1.5 rounded-lg text-xs border ${
                  darkMode
                    ? 'bg-[#111b21] border-gray-700 text-[#e9edef]'
                    : 'bg-gray-50 border-gray-300 text-[#111b21]'
                } focus:outline-none focus:border-[#00a884]`}
              />
            </div>
          </div>
        </div>

        {/* Tags / Etiquetas (tags text[]) */}
        <div
          className={`p-3.5 rounded-xl border ${
            darkMode ? 'bg-[#202c33] border-[#222e35]' : 'bg-white border-[#e9edef]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-[#00a884]">
              <TagIcon className="w-3.5 h-3.5" />
              <span>Etiquetas (tags)</span>
            </div>
            <button
              id="btn-add-tag-dropdown"
              onClick={() => setShowTagDropdown(!showTagDropdown)}
              className="p-1 rounded-md hover:bg-[#111b21] text-xs flex items-center gap-1 text-[#53bdeb]"
            >
              <Plus className="w-3 h-3" />
              <span>Adicionar</span>
            </button>
          </div>

          {showTagDropdown && (
            <div className="p-2 mb-2 rounded-lg bg-[#111b21] border border-gray-700 space-y-1">
              <span className="text-[10px] text-gray-400 block mb-1">Disponíveis:</span>
              <div className="flex flex-wrap gap-1">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      onAddTag(tag);
                      setShowTagDropdown(false);
                    }}
                    style={{ backgroundColor: tag.color, color: tag.textColor || '#fff' }}
                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase hover:opacity-90"
                  >
                    + {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {contact.tags.length === 0 ? (
              <span className="text-xs text-gray-500 italic">Nenhuma etiqueta atribuída</span>
            ) : (
              contact.tags.map((t) => (
                <span
                  key={t.id}
                  style={{ backgroundColor: t.color, color: t.textColor || '#fff' }}
                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 shadow-sm"
                >
                  <span>{t.name}</span>
                  <button
                    onClick={() => onRemoveTag(t.id)}
                    className="hover:text-red-300 ml-0.5"
                    title="Remover etiqueta"
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Anotações Rápidas (notes text) */}
        <div
          className={`p-3.5 rounded-xl border ${
            darkMode ? 'bg-[#202c33] border-[#222e35]' : 'bg-white border-[#e9edef]'
          }`}
        >
          <div className="flex items-center gap-1.5 font-semibold text-xs text-[#00a884] mb-2">
            <StickyNote className="w-3.5 h-3.5" />
            <span>Anotações Internas (notes)</span>
          </div>

          <form onSubmit={handleAddNoteSubmit} className="mb-3">
            <textarea
              id="input-crm-note"
              rows={2}
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Adicionar nota sobre o cliente ou acordo..."
              className={`w-full p-2 rounded-lg text-xs border ${
                darkMode
                  ? 'bg-[#111b21] border-gray-700 text-[#e9edef]'
                  : 'bg-gray-50 border-gray-300 text-[#111b21]'
              } focus:outline-none focus:border-[#00a884] mb-1.5 resize-none`}
            />
            <button
              type="submit"
              id="btn-save-crm-note"
              disabled={!newNoteText.trim()}
              className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-[#00a884] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Salvar Anotação
            </button>
          </form>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {contact.crm.notes?.length === 0 ? (
              <span className="text-xs text-gray-500 italic">Nenhuma anotação ainda</span>
            ) : (
              contact.crm.notes.map((n) => (
                <div
                  key={n.id}
                  className={`p-2 rounded-lg text-xs border ${
                    darkMode ? 'bg-[#111b21] border-gray-800' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed text-gray-300">{n.text}</p>
                  <div className="flex justify-between items-center text-[10px] text-gray-500 mt-1.5">
                    <span>{n.author}</span>
                    <span>{n.createdAt}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Visualizador de JSON para Integração / Webhooks */}
        <div
          className={`p-3 rounded-xl border ${
            darkMode ? 'bg-[#202c33] border-[#222e35]' : 'bg-white border-[#e9edef]'
          }`}
        >
          <button
            onClick={() => setShowJsonPreview(!showJsonPreview)}
            className="w-full flex items-center justify-between text-xs font-medium text-gray-400 hover:text-[#00a884]"
          >
            <div className="flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5" />
              <span>Payload da Conversa (JSON)</span>
            </div>
            <span>{showJsonPreview ? 'Recolher' : 'Expandir'}</span>
          </button>

          {showJsonPreview && (
            <pre className="mt-2 p-2 rounded-lg bg-[#0c1317] text-[#34d399] text-[10px] font-mono overflow-x-auto">
              {JSON.stringify(
                {
                  contact_id: contact.id,
                  name: contact.name,
                  channel: contact.channel,
                  crm_stage: currentStageKey,
                  tags: contact.tags.map((t) => t.name),
                  ai_status: contact.aiStatus,
                  coexistence_enabled: contact.coexistenceEnabled,
                },
                null,
                2
              )}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
