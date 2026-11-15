import { useState, useEffect, useCallback, useRef } from 'react';
import { AccountSubscriptionStatus } from '../types';
import { supabase, isSupabaseConfigured, ensureSupabaseConfig } from '../lib/supabase';

interface UseSubscriptionStatusResult {
  subscriptionStatus: AccountSubscriptionStatus | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function toFiniteNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

function toNullableString(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractRpcPayload(raw: unknown): Record<string, any> | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    const first = raw[0];
    return first && typeof first === 'object' ? (first as Record<string, any>) : null;
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, any>;
    if (obj.subscription && typeof obj.subscription === 'object' && !obj.plan_id && !obj.planId) {
      return { ...obj, ...obj.subscription };
    }
    if (obj.data && typeof obj.data === 'object' && !obj.plan_id && !obj.planId) {
      return { ...obj, ...obj.data };
    }
    return obj;
  }
  return null;
}

function computeDaysRemainingFromIso(isoEnd: string | null): number | null {
  if (!isoEnd) return null;
  const endTime = new Date(isoEnd).getTime();
  if (!Number.isFinite(endTime)) return null;
  const diffMs = endTime - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function useSubscriptionStatus(accountId?: string | null): UseSubscriptionStatusResult {
  const [subscriptionStatus, setSubscriptionStatus] = useState<AccountSubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const requestCounterRef = useRef(0);

  const fetchStatus = useCallback(async () => {
    if (!accountId || accountId === 'all') {
      setSubscriptionStatus(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestCounterRef.current;
    setIsLoading(true);
    setError(null);

    try {
      await ensureSupabaseConfig();
      if (!isSupabaseConfigured) {
        if (requestId === requestCounterRef.current) {
          setSubscriptionStatus(null);
          setIsLoading(false);
        }
        return;
      }

      // 1. Consulta principal via RPC oficial no Supabase (read-only)
      let rpcPayload: Record<string, any> | null = null;
      let rpcKeys: string[] = [];
      let rpcFailed = false;

      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_account_subscription_status',
        { p_account_id: accountId }
      );

      if (rpcError) {
        rpcFailed = true;
        console.warn('Erro ao consultar get_account_subscription_status:', rpcError.message);
      } else {
        rpcPayload = extractRpcPayload(rpcData);
        if (rpcPayload) {
          rpcKeys = Object.keys(rpcPayload);
        }
      }

      // 2. Complemento read-only em account_subscriptions + subscription_plans (RLS)
      //    caso a RPC não retorne algum campo de exibição ou tenha falhado.
      //    Nunca consulta o campo legado accounts.plan.
      let subRow: Record<string, any> | null = null;
      const needsSubscriptionEnrichment =
        rpcFailed ||
        !rpcPayload ||
        (rpcPayload.plan_id === undefined && rpcPayload.planId === undefined) ||
        (rpcPayload.plan_name === undefined && rpcPayload.planName === undefined);

      if (needsSubscriptionEnrichment) {
        const { data: subData } = await supabase
          .from('account_subscriptions')
          .select(
            `
            id,
            account_id,
            plan_id,
            status,
            trial_started_at,
            trial_ends_at,
            current_period_start,
            current_period_end,
            created_at,
            subscription_plans (
              id,
              name,
              description,
              ai_response_quota,
              max_active_channels,
              trial_days,
              is_trial
            )
          `
          )
          .eq('account_id', accountId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subData && typeof subData === 'object') {
          subRow = subData as Record<string, any>;
        }
      }

      const planFromJoin =
        subRow?.subscription_plans && typeof subRow.subscription_plans === 'object'
          ? (Array.isArray(subRow.subscription_plans)
              ? subRow.subscription_plans[0]
              : subRow.subscription_plans)
          : null;

      // 3. Contagem real de canais ativos caso a RPC não forneça
      let activeChannelsFromTable: number | null = null;
      const rpcActiveChannels = toFiniteNumber(
        rpcPayload?.active_channels_count ??
          rpcPayload?.active_channels ??
          rpcPayload?.channels_active ??
          rpcPayload?.activeChannelsCount ??
          rpcPayload?.activeChannels
      );

      if (rpcActiveChannels === null) {
        const { data: channelsData } = await supabase
          .from('channels')
          .select('id, is_active')
          .eq('account_id', accountId);

        if (Array.isArray(channelsData)) {
          activeChannelsFromTable = channelsData.filter((ch) => ch.is_active !== false).length;
        }
      }

      if (requestId !== requestCounterRef.current) return;

      // Se nem RPC nem account_subscriptions retornaram registro
      if (!rpcPayload && !subRow) {
        setSubscriptionStatus({
          accountId,
          hasSubscription: false,
          planId: null,
          planName: 'Assinatura não localizada',
          status: 'active',
          isTrial: false,
          isLegacy: false,
          isExpired: false,
          trialStartedAt: null,
          trialEndsAt: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          daysRemaining: null,
          aiQuota: null,
          aiConsumed: 0,
          aiActiveReservations: 0,
          aiEffectiveConsumed: 0,
          aiRemaining: null,
          isQuotaExhausted: false,
          maxActiveChannels: null,
          activeChannelsCount: activeChannelsFromTable ?? 0,
          allowChannelReplacement: true,
          humanAttendancePreserved: true,
          rawRpcKeys: rpcKeys,
        });
        if (rpcFailed) {
          setError('Não foi possível consultar o status da assinatura no momento.');
        }
        setIsLoading(false);
        return;
      }

      const raw = rpcPayload || {};

      const planId =
        toNullableString(raw.plan_id ?? raw.planId ?? raw.subscription_plan_id ?? subRow?.plan_id) ||
        null;

      const isLegacy =
        planId === 'legacy_grandfathered' ||
        raw.is_legacy === true ||
        raw.isLegacy === true ||
        raw.legacy === true;

      const status =
        toNullableString(raw.status ?? raw.subscription_status ?? subRow?.status) || 'active';

      const isTrial =
        !isLegacy &&
        (planId === 'trial_7d' ||
          Boolean(planId && planId.toLowerCase().startsWith('trial')) ||
          status === 'trialing' ||
          raw.is_trial === true ||
          raw.isTrial === true ||
          planFromJoin?.is_trial === true);

      const rawPlanName =
        toNullableString(
          raw.plan_name ?? raw.planName ?? raw.name ?? planFromJoin?.name
        ) || null;

      const planName = isLegacy
        ? rawPlanName || 'Operação Ativa (Legado)'
        : rawPlanName || (isTrial ? 'Avaliação Gratuita (7 dias)' : planId || 'Plano Ativo');

      const trialStartedAt = isLegacy
        ? null
        : toNullableString(
            raw.trial_started_at ??
              raw.trialStartedAt ??
              raw.started_at ??
              subRow?.trial_started_at ??
              subRow?.created_at
          );

      // Regra crítica: legacy_grandfathered possui trial_ends_at = NULL e nunca deve mostrar expiração
      const trialEndsAt = isLegacy
        ? null
        : toNullableString(
            raw.trial_ends_at ?? raw.trialEndsAt ?? raw.expires_at ?? subRow?.trial_ends_at
          );

      const currentPeriodStart = toNullableString(
        raw.current_period_start ?? raw.currentPeriodStart ?? subRow?.current_period_start
      );
      const currentPeriodEnd = isLegacy
        ? null
        : toNullableString(
            raw.current_period_end ?? raw.currentPeriodEnd ?? subRow?.current_period_end
          );

      const rpcDaysRemaining = toFiniteNumber(
        raw.days_remaining ?? raw.daysRemaining ?? raw.trial_days_remaining
      );
      const daysRemaining = isLegacy
        ? null
        : rpcDaysRemaining !== null
        ? Math.max(0, Math.ceil(rpcDaysRemaining))
        : computeDaysRemainingFromIso(trialEndsAt);

      const aiQuota = isLegacy
        ? null
        : toFiniteNumber(
            raw.ai_quota ??
              raw.ai_response_quota ??
              raw.ai_responses_quota ??
              raw.ai_limit ??
              raw.ai_responses_limit ??
              raw.aiQuota ??
              planFromJoin?.ai_response_quota
          );

      const aiConsumed =
        toFiniteNumber(
          raw.ai_consumed ??
            raw.ai_responses_consumed ??
            raw.ai_used ??
            raw.ai_responses_used ??
            raw.aiConsumed
        ) ?? 0;

      const aiActiveReservations =
        toFiniteNumber(
          raw.ai_active_reservations ??
            raw.active_reservations ??
            raw.ai_reserved ??
            raw.aiActiveReservations
        ) ?? 0;

      const rpcEffectiveConsumed = toFiniteNumber(
        raw.ai_effective_consumed ??
          raw.effective_ai_consumed ??
          raw.aiEffectiveConsumed
      );
      const aiEffectiveConsumed =
        rpcEffectiveConsumed !== null ? rpcEffectiveConsumed : aiConsumed + aiActiveReservations;

      const rpcAiRemaining = toFiniteNumber(
        raw.ai_remaining ?? raw.ai_responses_remaining ?? raw.aiRemaining
      );
      const aiRemaining =
        isLegacy || aiQuota === null
          ? null
          : rpcAiRemaining !== null
          ? Math.max(0, rpcAiRemaining)
          : Math.max(0, aiQuota - aiEffectiveConsumed);

      const isExpired =
        !isLegacy &&
        (raw.is_expired === true ||
          raw.isExpired === true ||
          status === 'expired' ||
          (isTrial && trialEndsAt !== null && (daysRemaining === 0 || new Date(trialEndsAt).getTime() <= Date.now())));

      const isQuotaExhausted =
        !isLegacy &&
        (raw.is_quota_exhausted === true ||
          raw.isQuotaExhausted === true ||
          raw.ai_suspended === true ||
          (aiQuota !== null && aiQuota > 0 && aiEffectiveConsumed >= aiQuota));

      const maxActiveChannels = isLegacy
        ? null
        : toFiniteNumber(
            raw.max_active_channels ??
              raw.max_channels ??
              raw.channel_limit ??
              raw.maxActiveChannels ??
              planFromJoin?.max_active_channels
          );

      const activeChannelsCount = rpcActiveChannels ?? activeChannelsFromTable ?? 0;

      const allowChannelReplacement =
        typeof raw.allow_channel_replacement === 'boolean'
          ? raw.allow_channel_replacement
          : typeof raw.can_replace_channel === 'boolean'
          ? raw.can_replace_channel
          : true;

      const humanAttendancePreserved =
        typeof raw.human_attendance_preserved === 'boolean'
          ? raw.human_attendance_preserved
          : !isExpired;

      setSubscriptionStatus({
        accountId,
        hasSubscription: raw.has_subscription !== false,
        planId,
        planName,
        status,
        isTrial,
        isLegacy,
        isExpired,
        trialStartedAt,
        trialEndsAt,
        currentPeriodStart,
        currentPeriodEnd,
        daysRemaining,
        aiQuota,
        aiConsumed,
        aiActiveReservations,
        aiEffectiveConsumed,
        aiRemaining,
        isQuotaExhausted,
        maxActiveChannels,
        activeChannelsCount,
        allowChannelReplacement,
        humanAttendancePreserved,
        rawRpcKeys: rpcKeys,
      });

      if (rpcFailed && !subRow) {
        setError('Não foi possível consultar os detalhes completos da assinatura.');
      }
    } catch (err: any) {
      if (requestId === requestCounterRef.current) {
        console.warn('Erro inesperado em useSubscriptionStatus:', err);
        setError('Não foi possível carregar os dados da assinatura.');
      }
    } finally {
      if (requestId === requestCounterRef.current) {
        setIsLoading(false);
      }
    }
  }, [accountId]);

  useEffect(() => {
    fetchStatus();

    if (!isSupabaseConfigured || !accountId || accountId === 'all') return;

    const sub = supabase
      .channel(`subscription-status-${accountId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'account_subscriptions', filter: `account_id=eq.${accountId}` },
        () => {
          fetchStatus();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'channels', filter: `account_id=eq.${accountId}` },
        () => {
          fetchStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [accountId, fetchStatus]);

  return {
    subscriptionStatus,
    isLoading,
    error,
    refresh: fetchStatus,
  };
}
