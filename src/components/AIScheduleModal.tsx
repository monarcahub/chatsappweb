import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Clock,
  Calendar,
  Plus,
  Trash2,
  Pencil,
  Check,
  AlertCircle,
  Copy,
  Power,
  PowerOff,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { AIScheduleMode, AIScheduleRule, AIScheduleScope } from '../types';
import {
  AI_SCHEDULE_PRESETS,
  DAY_LABELS_SHORT,
  TIMEZONE_OPTIONS,
  evaluateRuleSchedule,
  formatScheduleSummary,
  isOvernightWindow,
} from '../utils/aiScheduleUtils';
import { AI_SCHEDULING_SQL_SCRIPT } from '../data/supabaseSchema';
import { supabase, isSupabaseConfigured, ensureSupabaseConfig } from '../lib/supabase';

export interface AIScheduleChannelOption {
  id: string;
  name: string;
  type: string;
  ai_enabled?: boolean;
}

interface AIScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  accountId: string;
  accountName: string;
  channels: AIScheduleChannelOption[];
  schedules: AIScheduleRule[];
  initialScope?: AIScheduleScope;
  initialChannelId?: string | null;
  tableMissing?: boolean;
  currentGlobalAIActive: boolean;
  onSchedulesChanged: () => Promise<void> | void;
  onAIStateChanged?: (params: {
    scope: AIScheduleScope;
    channelId?: string | null;
    newState: boolean;
  }) => void;
  onToast?: (message: string) => void;
}

export const AIScheduleModal: React.FC<AIScheduleModalProps> = ({
  isOpen,
  onClose,
  darkMode,
  accountId,
  accountName,
  channels,
  schedules,
  initialScope = 'global' as AIScheduleScope,
  initialChannelId = null,
  tableMissing = false,
  currentGlobalAIActive,
  onSchedulesChanged,
  onAIStateChanged,
  onToast,
}) => {
  const [scopeFilter, setScopeFilter] = useState<'all' | 'global' | 'channel'>('all');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form states
  const [formScope, setFormScope] = useState<AIScheduleScope>(initialScope);
  const [formChannelId, setFormChannelId] = useState<string>(initialChannelId || '');
  const [formName, setFormName] = useState('Plantão IA (Fora do Horário Comercial)');
  const [formMode, setFormMode] = useState<AIScheduleMode>('active_window');
  const [formDays, setFormDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [formStartTime, setFormStartTime] = useState('18:00');
  const [formEndTime, setFormEndTime] = useState('08:00');
  const [formTimezone, setFormTimezone] = useState('America/Sao_Paulo');
  const [formEnabled, setFormEnabled] = useState(true);
  const [applyImmediately, setApplyImmediately] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [localTableMissing, setLocalTableMissing] = useState(tableMissing);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    setLocalTableMissing(tableMissing);
  }, [tableMissing]);

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    setFormScope(initialScope);
    setFormChannelId(initialChannelId || channels[0]?.id || '');

    if (initialScope === 'channel' && initialChannelId) {
      setScopeFilter('channel');
      const existingForChannel = schedules.filter(
        (s) => s.scope === 'channel' && s.channel_id === initialChannelId
      );
      if (existingForChannel.length === 0) {
        startNewRule('channel', initialChannelId);
      } else {
        setIsFormOpen(false);
        setEditingRuleId(null);
      }
    } else {
      setScopeFilter('all');
      if (schedules.length === 0) {
        startNewRule(initialScope, initialChannelId);
      } else {
        setIsFormOpen(false);
        setEditingRuleId(null);
      }
    }
  }, [isOpen, initialScope, initialChannelId]);

  const startNewRule = (targetScope: AIScheduleScope = 'global', targetChannelId: string | null = null) => {
    setEditingRuleId(null);
    setFormScope(targetScope);
    setFormChannelId(targetChannelId || channels[0]?.id || '');
    setFormName(
      targetScope === 'channel'
        ? 'Agendamento do Canal'
        : 'Plantão IA (Fora do Horário Comercial)'
    );
    setFormMode('active_window');
    setFormDays([1, 2, 3, 4, 5]);
    setFormStartTime('18:00');
    setFormEndTime('08:00');
    setFormTimezone('America/Sao_Paulo');
    setFormEnabled(true);
    setApplyImmediately(true);
    setFormError(null);
    setIsFormOpen(true);
  };

  const startEditRule = (rule: AIScheduleRule) => {
    setEditingRuleId(rule.id);
    setFormScope(rule.scope);
    setFormChannelId(rule.channel_id || channels[0]?.id || '');
    setFormName(rule.name);
    setFormMode(rule.mode);
    setFormDays(Array.isArray(rule.days_of_week) ? [...rule.days_of_week] : [1, 2, 3, 4, 5]);
    setFormStartTime(rule.start_time.slice(0, 5));
    setFormEndTime(rule.end_time.slice(0, 5));
    setFormTimezone(rule.timezone || 'America/Sao_Paulo');
    setFormEnabled(rule.is_enabled);
    setApplyImmediately(false);
    setFormError(null);
    setIsFormOpen(true);
  };

  const applyPreset = (presetId: string) => {
    const preset = AI_SCHEDULE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setFormName(preset.name);
    setFormMode(preset.mode);
    setFormDays([...preset.days_of_week]);
    setFormStartTime(preset.start_time);
    setFormEndTime(preset.end_time);
    setFormError(null);
  };

  const toggleDay = (dayIndex: number) => {
    setFormDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex].sort((a, b) => a - b)
    );
  };

  const livePreview = useMemo(() => {
    return evaluateRuleSchedule({
      mode: formMode,
      days_of_week: formDays,
      start_time: formStartTime,
      end_time: formEndTime,
      timezone: formTimezone,
    });
  }, [formMode, formDays, formStartTime, formEndTime, formTimezone]);

  const filteredSchedules = useMemo(() => {
    if (scopeFilter === 'global') return schedules.filter((s) => s.scope === 'global');
    if (scopeFilter === 'channel') {
      if (initialScope === 'channel' && initialChannelId) {
        return schedules.filter(
          (s) => s.scope === 'channel' && s.channel_id === initialChannelId
        );
      }
      return schedules.filter((s) => s.scope === 'channel');
    }
    return schedules;
  }, [schedules, scopeFilter, initialScope, initialChannelId]);

  const isMissingTableErr = (err: any) => {
    const code = String(err?.code || '');
    const msg = String(err?.message || '');
    return (
      code === '42P01' ||
      code === 'PGRST205' ||
      (msg.includes('ai_schedules') && (msg.includes('does not exist') || msg.includes('schema cache')))
    );
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!accountId || accountId === 'all') {
      setFormError('Selecione uma empresa específica no topo do sistema antes de criar um agendamento.');
      return;
    }
    if (formScope === 'channel' && !formChannelId) {
      setFormError('Selecione um canal para aplicar o agendamento individual.');
      return;
    }
    if (formDays.length === 0) {
      setFormError('Selecione pelo menos um dia da semana.');
      return;
    }
    if (!formStartTime || !formEndTime || formStartTime === formEndTime) {
      setFormError('Os horários de início e término não podem ser iguais.');
      return;
    }

    setIsSaving(true);
    try {
      let savedViaApi = false;
      let appliedStateResult: boolean | null = null;

      // 1. Tenta salvar pela rota backend (suporta service_role + exclusão inteligente de canais)
      try {
        const res = await fetch('/api/ai-schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingRuleId || undefined,
            account_id: accountId,
            channel_id: formScope === 'channel' ? formChannelId : null,
            scope: formScope,
            name: formName.trim() || 'Agendamento Automático da IA',
            mode: formMode,
            days_of_week: formDays,
            start_time: formStartTime,
            end_time: formEndTime,
            timezone: formTimezone,
            is_enabled: formEnabled,
            apply_immediately: applyImmediately,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          savedViaApi = true;
          appliedStateResult = data.appliedState ?? null;
        } else if (data?.tableMissing) {
          setLocalTableMissing(true);
          setFormError('A tabela ai_schedules ainda não foi criada no Supabase. Copie e execute o SQL abaixo.');
          return;
        }
      } catch {
        // Segue para persistência direta no Supabase
      }

      // 2. Fallback direto via Supabase SDK (funciona em deploy estático sem Express)
      if (!savedViaApi) {
        await ensureSupabaseConfig();
        if (!isSupabaseConfigured) {
          throw new Error('Supabase não configurado.');
        }

        const nowIso = new Date().toISOString();
        const evalRes = evaluateRuleSchedule({
          mode: formMode,
          days_of_week: formDays,
          start_time: formStartTime,
          end_time: formEndTime,
          timezone: formTimezone,
        });

        const payload: Record<string, any> = {
          account_id: accountId,
          channel_id: formScope === 'channel' ? formChannelId : null,
          scope: formScope,
          name: formName.trim() || 'Agendamento Automático da IA',
          mode: formMode,
          days_of_week: formDays,
          start_time: formStartTime,
          end_time: formEndTime,
          timezone: formTimezone,
          is_enabled: formEnabled,
          updated_at: nowIso,
          ...(evalRes.latestEvent ? { last_slot_key: evalRes.latestEvent.slotKey } : {}),
          ...(formEnabled && applyImmediately && evalRes.expectedStateNow !== null
            ? {
                last_applied_state: evalRes.expectedStateNow,
                last_executed_at: nowIso,
              }
            : {}),
        };

        const query = editingRuleId
          ? supabase
              .from('ai_schedules')
              .update(payload)
              .eq('id', editingRuleId)
              .eq('account_id', accountId)
          : supabase.from('ai_schedules').insert(payload);

        const { error } = await query;
        if (error) {
          if (isMissingTableErr(error)) {
            setLocalTableMissing(true);
            setFormError('A tabela ai_schedules ainda não foi criada no Supabase. Copie e execute o SQL abaixo.');
            return;
          }
          throw new Error(error.message);
        }

        if (formEnabled && applyImmediately && evalRes.expectedStateNow !== null) {
          appliedStateResult = evalRes.expectedStateNow;
          if (formScope === 'global') {
            await supabase.rpc('toggle_company_ai_global', {
              p_account_id: accountId,
              p_ai_enabled: evalRes.expectedStateNow,
            });
          } else if (formChannelId) {
            await supabase.rpc('toggle_channel_ai', {
              p_channel_id: formChannelId,
              p_ai_enabled: evalRes.expectedStateNow,
            });
          }
        }
      }

      if (appliedStateResult !== null && onAIStateChanged) {
        onAIStateChanged({
          scope: formScope,
          channelId: formScope === 'channel' ? formChannelId : null,
          newState: appliedStateResult,
        });
      }

      await onSchedulesChanged();
      setIsFormOpen(false);
      setEditingRuleId(null);
      onToast?.(
        editingRuleId
          ? 'Agendamento da IA atualizado com sucesso!'
          : 'Agendamento da IA criado com sucesso!'
      );
    } catch (err: any) {
      setFormError(err?.message || 'Não foi possível salvar o agendamento.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRuleEnabled = async (rule: AIScheduleRule) => {
    const nextEnabled = !rule.is_enabled;
    setTogglingId(rule.id);
    try {
      let updated = false;
      try {
        const res = await fetch(`/api/ai-schedules/${rule.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: accountId, is_enabled: nextEnabled }),
        });
        if (res.ok) updated = true;
      } catch {
        // fallback abaixo
      }

      if (!updated) {
        await ensureSupabaseConfig();
        const { error } = await supabase
          .from('ai_schedules')
          .update({ is_enabled: nextEnabled, updated_at: new Date().toISOString() })
          .eq('id', rule.id)
          .eq('account_id', accountId);
        if (error) throw new Error(error.message);
      }

      await onSchedulesChanged();
      onToast?.(nextEnabled ? 'Agendamento ativado.' : 'Agendamento pausado.');
    } catch (err: any) {
      onToast?.(`❌ ${err?.message || 'Falha ao atualizar agendamento.'}`);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    setDeletingId(ruleId);
    try {
      let deleted = false;
      try {
        const res = await fetch(`/api/ai-schedules/${ruleId}?account_id=${encodeURIComponent(accountId)}`, {
          method: 'DELETE',
        });
        if (res.ok) deleted = true;
      } catch {
        // fallback abaixo
      }

      if (!deleted) {
        await ensureSupabaseConfig();
        const { error } = await supabase
          .from('ai_schedules')
          .delete()
          .eq('id', ruleId)
          .eq('account_id', accountId);
        if (error) throw new Error(error.message);
      }

      if (editingRuleId === ruleId) {
        setIsFormOpen(false);
        setEditingRuleId(null);
      }
      await onSchedulesChanged();
      onToast?.('Regra de agendamento removida.');
    } catch (err: any) {
      onToast?.(`❌ ${err?.message || 'Falha ao excluir agendamento.'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(AI_SCHEDULING_SQL_SCRIPT);
      setCopiedSql(true);
      onToast?.('Script SQL copiado! Cole e execute no SQL Editor do Supabase.');
      setTimeout(() => setCopiedSql(false), 3000);
    } catch {
      onToast?.('Não foi possível copiar automaticamente.');
    }
  };

  if (!isOpen) return null;

  const surfaceBase = darkMode
    ? 'bg-[#202c33] border-[#313d45] text-[#e9edef]'
    : 'bg-white border-gray-200 text-[#111b21]';
  const subSurface = darkMode
    ? 'bg-[#111b21] border-[#2a3942]'
    : 'bg-gray-50 border-gray-200';
  const mutedText = darkMode ? 'text-[#8696a0]' : 'text-[#54656f]';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in">
      <div
        className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${surfaceBase}`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 flex items-center justify-between gap-3 border-b ${
            darkMode ? 'border-[#2a3942] bg-[#182229]' : 'border-gray-200 bg-gray-50/80'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#00a884]/15 text-[#00a884] flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm sm:text-base truncate">
                Agendamento Automático da IA
              </h2>
              <p className={`text-xs truncate ${mutedText}`}>
                {accountName} · Fuso horário configurável (padrão Brasília)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
              darkMode ? 'text-[#aebac1] hover:bg-[#313d45] hover:text-white' : 'text-gray-500 hover:bg-gray-200 hover:text-black'
            }`}
            aria-label="Fechar modal de agendamento"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {localTableMissing && (
            <div
              className={`p-4 rounded-xl border space-y-2.5 ${
                darkMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-bold mb-1">
                    Migração SQL pendente no Supabase (`public.ai_schedules`)
                  </p>
                  <p className="opacity-90">
                    Para salvar e executar agendamentos automáticos no banco com `pg_cron` e tempo real, execute o script SQL idempotente no SQL Editor do seu projeto Supabase.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopySql}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'Script SQL copiado!' : 'Copiar Script SQL do Agendamento'}</span>
              </button>
            </div>
          )}

          {/* Barra superior de escopo e botão Novo Agendamento */}
          {!isFormOpen && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                className={`inline-flex items-center gap-1 p-1 rounded-lg border ${
                  darkMode ? 'bg-[#111b21] border-[#2a3942]' : 'bg-gray-100 border-gray-200'
                }`}
              >
                {(['all', 'global', 'channel'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setScopeFilter(tab)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      scopeFilter === tab
                        ? darkMode
                          ? 'bg-[#202c33] text-white shadow-xs'
                          : 'bg-white text-[#111b21] shadow-xs'
                        : `${mutedText} hover:text-[#00a884]`
                    }`}
                  >
                    {tab === 'all' ? 'Todos' : tab === 'global' ? 'Geral da Empresa' : 'Por Canal'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  startNewRule(
                    scopeFilter === 'channel' ? 'channel' : initialScope,
                    initialChannelId
                  )
                }
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#00a884] hover:bg-[#02906f] text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Agendamento</span>
              </button>
            </div>
          )}

          {/* Lista de Regras Cadastradas */}
          {!isFormOpen && (
            <div className="space-y-2.5">
              {filteredSchedules.length === 0 ? (
                <div className={`p-7 rounded-xl border text-center ${subSurface}`}>
                  <Calendar className="w-8 h-8 text-[#00a884] mx-auto mb-2.5 opacity-80" />
                  <h3 className="font-bold text-sm mb-1">
                    Nenhum agendamento configurado
                  </h3>
                  <p className={`text-xs max-w-md mx-auto mb-4 leading-relaxed ${mutedText}`}>
                    Configure horários para ativar a IA automaticamente fora do expediente ou pausar durante o atendimento humano.
                  </p>
                  <button
                    type="button"
                    onClick={() => startNewRule(initialScope, initialChannelId)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#00a884] hover:bg-[#02906f] text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Criar Primeiro Agendamento</span>
                  </button>
                </div>
              ) : (
                filteredSchedules.map((rule) => {
                  const targetChannel = rule.channel_id
                    ? channels.find((c) => c.id === rule.channel_id)
                    : null;
                  const evalInfo = evaluateRuleSchedule(rule);
                  const currentTargetActive =
                    rule.scope === 'global'
                      ? currentGlobalAIActive
                      : targetChannel?.ai_enabled !== false;
                  const isOverridden =
                    rule.is_enabled &&
                    evalInfo.expectedStateNow !== null &&
                    currentTargetActive !== evalInfo.expectedStateNow;

                  return (
                    <div
                      key={rule.id}
                      className={`p-3.5 rounded-xl border transition-colors ${subSurface} ${
                        !rule.is_enabled ? 'opacity-65' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm truncate">
                              {rule.name}
                            </span>
                            <span className={`text-[11px] font-medium ${mutedText}`}>
                              · {rule.scope === 'global' ? 'Geral da Empresa' : targetChannel?.name || 'Canal'}
                            </span>
                          </div>

                          <div className="text-xs font-medium tabular-nums flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className={rule.mode === 'active_window' ? 'text-[#00a884]' : 'text-amber-500'}>
                              {formatScheduleSummary(rule)}
                            </span>
                            <span className={mutedText}>·</span>
                            <span className={mutedText}>{rule.timezone}</span>
                          </div>

                          {rule.is_enabled && evalInfo.nextTransitionLabel && (
                            <div className={`text-[11px] tabular-nums flex flex-wrap items-center gap-1.5 ${mutedText}`}>
                              <span>Próxima transição:</span>
                              <strong className={darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}>
                                {evalInfo.nextTransitionLabel}
                              </strong>
                              {isOverridden && (
                                <span className="text-amber-500 font-medium">
                                  · Alterado manualmente agora (retoma no próximo horário)
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleRuleEnabled(rule)}
                            disabled={togglingId === rule.id}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                              rule.is_enabled
                                ? 'bg-[#00a884]/15 text-[#00a884] border-[#00a884]/30 hover:bg-[#00a884]/25'
                                : darkMode
                                ? 'bg-[#202c33] text-[#8696a0] border-[#313d45] hover:text-white'
                                : 'bg-white text-gray-600 border-gray-300 hover:text-black'
                            }`}
                            title={rule.is_enabled ? 'Desativar regra' : 'Ativar regra'}
                          >
                            {togglingId === rule.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : rule.is_enabled ? (
                              'Ativa'
                            ) : (
                              'Inativa'
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => startEditRule(rule)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              darkMode ? 'text-[#aebac1] hover:bg-[#2a3942]' : 'text-gray-500 hover:bg-gray-200'
                            }`}
                            title="Editar regra"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteRule(rule.id)}
                            disabled={deletingId === rule.id}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Excluir regra"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Formulário de Criação / Edição */}
          {isFormOpen && (
            <form onSubmit={handleSaveRule} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm">
                  {editingRuleId ? 'Editar Regra de Agendamento' : 'Nova Regra de Agendamento'}
                </h3>
                {schedules.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditingRuleId(null);
                      setFormError(null);
                    }}
                    className={`text-xs font-semibold hover:underline cursor-pointer ${mutedText}`}
                  >
                    Voltar para lista
                  </button>
                )}
              </div>

              {/* Atalhos Rápidos */}
              <div>
                <label className={`block text-[11px] font-semibold mb-1.5 ${mutedText}`}>
                  Modelos rápidos
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {AI_SCHEDULE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.id)}
                      className={`px-2.5 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
                        darkMode
                          ? 'bg-[#111b21] border-[#2a3942] hover:border-[#00a884]'
                          : 'bg-gray-50 border-gray-200 hover:border-[#00a884]'
                      }`}
                    >
                      <div className="text-[11px] font-bold truncate">{preset.label}</div>
                      <div className={`text-[10px] truncate tabular-nums ${mutedText}`}>
                        {preset.start_time}–{preset.end_time}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Escopo e Nome */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${mutedText}`}>
                    Escopo de aplicação
                  </label>
                  <div
                    className={`grid grid-cols-2 gap-1 p-1 rounded-xl border ${
                      darkMode ? 'bg-[#111b21] border-[#2a3942]' : 'bg-gray-100 border-gray-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setFormScope('global')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        formScope === 'global'
                          ? 'bg-[#00a884] text-white'
                          : mutedText
                      }`}
                    >
                      Geral da Empresa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormScope('channel');
                        if (!formChannelId && channels[0]?.id) setFormChannelId(channels[0].id);
                      }}
                      disabled={channels.length === 0}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 ${
                        formScope === 'channel'
                          ? 'bg-[#00a884] text-white'
                          : mutedText
                      }`}
                    >
                      Canal Individual
                    </button>
                  </div>
                </div>

                {formScope === 'channel' ? (
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${mutedText}`}>
                      Canal alvo
                    </label>
                    <select
                      value={formChannelId}
                      onChange={(e) => setFormChannelId(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-medium focus:outline-none focus:border-[#00a884] ${
                        darkMode ? 'bg-[#111b21] border-[#2a3942] text-[#e9edef]' : 'bg-white border-gray-300 text-[#111b21]'
                      }`}
                    >
                      {channels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.name} ({ch.type})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${mutedText}`}>
                      Nome da regra
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Ex: Plantão Noturno"
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-medium focus:outline-none focus:border-[#00a884] ${
                        darkMode ? 'bg-[#111b21] border-[#2a3942] text-[#e9edef]' : 'bg-white border-gray-300 text-[#111b21]'
                      }`}
                    />
                  </div>
                )}
              </div>

              {formScope === 'channel' && (
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${mutedText}`}>
                    Nome da regra
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: Horário Comercial WhatsApp"
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-medium focus:outline-none focus:border-[#00a884] ${
                      darkMode ? 'bg-[#111b21] border-[#2a3942] text-[#e9edef]' : 'bg-white border-gray-300 text-[#111b21]'
                    }`}
                  />
                </div>
              )}

              {/* Comportamento da Janela */}
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${mutedText}`}>
                  Comportamento automático
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormMode('active_window')}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      formMode === 'active_window'
                        ? 'border-[#00a884] bg-[#00a884]/10'
                        : darkMode
                        ? 'bg-[#111b21] border-[#2a3942]'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-[#00a884]">
                      <Power className="w-3.5 h-3.5" />
                      <span>Ativar IA neste período</span>
                    </div>
                    <p className={`text-[11px] mt-1 ${mutedText}`}>
                      Liga a IA no início e pausa automaticamente ao terminar.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormMode('paused_window')}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      formMode === 'paused_window'
                        ? 'border-amber-500 bg-amber-500/10'
                        : darkMode
                        ? 'bg-[#111b21] border-[#2a3942]'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-amber-500">
                      <PowerOff className="w-3.5 h-3.5" />
                      <span>Pausar IA neste período</span>
                    </div>
                    <p className={`text-[11px] mt-1 ${mutedText}`}>
                      Pausa a IA (expediente humano) e reativa automaticamente ao fim.
                    </p>
                  </button>
                </div>
              </div>

              {/* Dias da Semana */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className={`text-xs font-semibold ${mutedText}`}>
                    Dias da semana
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setFormDays([1, 2, 3, 4, 5])}
                      className="text-[#00a884] hover:underline font-semibold cursor-pointer"
                    >
                      Seg–Sex
                    </button>
                    <span className={mutedText}>·</span>
                    <button
                      type="button"
                      onClick={() => setFormDays([0, 6])}
                      className="text-[#00a884] hover:underline font-semibold cursor-pointer"
                    >
                      Fim de semana
                    </button>
                    <span className={mutedText}>·</span>
                    <button
                      type="button"
                      onClick={() => setFormDays([0, 1, 2, 3, 4, 5, 6])}
                      className="text-[#00a884] hover:underline font-semibold cursor-pointer"
                    >
                      Todos
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {DAY_LABELS_SHORT.map((label, idx) => {
                    const selected = formDays.includes(idx);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        className={`py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[#00a884] border-[#00a884] text-white'
                            : darkMode
                            ? 'bg-[#111b21] border-[#2a3942] text-[#8696a0] hover:border-[#00a884]/50'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-[#00a884]/50'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Horários & Fuso */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${mutedText}`}>
                    {formMode === 'active_window' ? 'Ativar às' : 'Pausar às'}
                  </label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    required
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-mono tabular-nums focus:outline-none focus:border-[#00a884] ${
                      darkMode ? 'bg-[#111b21] border-[#2a3942] text-[#e9edef]' : 'bg-white border-gray-300 text-[#111b21]'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${mutedText}`}>
                    {formMode === 'active_window' ? 'Pausar às' : 'Reativar às'}
                  </label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    required
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-mono tabular-nums focus:outline-none focus:border-[#00a884] ${
                      darkMode ? 'bg-[#111b21] border-[#2a3942] text-[#e9edef]' : 'bg-white border-gray-300 text-[#111b21]'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${mutedText}`}>
                    Fuso horário
                  </label>
                  <div className="relative">
                    <select
                      value={formTimezone}
                      onChange={(e) => setFormTimezone(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-medium focus:outline-none focus:border-[#00a884] ${
                        darkMode ? 'bg-[#111b21] border-[#2a3942] text-[#e9edef]' : 'bg-white border-gray-300 text-[#111b21]'
                      }`}
                    >
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {isOvernightWindow(formStartTime, formEndTime) && (
                <p className="text-[11px] text-[#00a884] font-medium flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Janela noturna: inicia às {formStartTime} e encerra no dia seguinte às {formEndTime}.
                  </span>
                </p>
              )}

              {/* Aplicar imediatamente + Resumo */}
              <div className={`p-3.5 rounded-xl border space-y-2.5 ${subSurface}`}>
                <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={applyImmediately}
                    onChange={(e) => setApplyImmediately(e.target.checked)}
                    className="mt-0.5 accent-[#00a884] rounded cursor-pointer"
                  />
                  <span>
                    <strong className="block">Sincronizar status da IA agora ao salvar</strong>
                    <span className={`text-[11px] ${mutedText}`}>
                      {livePreview.expectedStateNow !== null
                        ? `Com base no horário atual, a IA ficará ${
                            livePreview.expectedStateNow ? 'ATIVA' : 'PAUSADA'
                          } imediatamente.`
                        : 'Ajusta o status atual conforme a regra configurada.'}
                    </span>
                  </span>
                </label>

                <div className={`pt-2 border-t text-[11px] leading-relaxed ${darkMode ? 'border-[#2a3942]' : 'border-gray-200'} ${mutedText}`}>
                  {livePreview.nextTransitionLabel && (
                    <p className="tabular-nums mb-1">
                      Próxima transição programada:{' '}
                      <strong className={darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}>
                        {livePreview.nextTransitionLabel}
                      </strong>
                    </p>
                  )}
                  <p>
                    Você pode pausar ou ativar a IA manualmente a qualquer momento. A alteração manual será preservada até o próximo horário agendado.
                  </p>
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                {schedules.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditingRuleId(null);
                    }}
                    disabled={isSaving}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                      darkMode ? 'border-[#313d45] hover:bg-[#2a3942]' : 'border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    Cancelar
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#00a884] hover:bg-[#02906f] text-white inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{editingRuleId ? 'Salvar Alterações' : 'Salvar Agendamento'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
