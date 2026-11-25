import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AccountSubscriptionStatus } from '../types';
import { supabase, isSupabaseConfigured, ensureSupabaseConfig } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface UseSubscriptionStatusResult {
  subscriptionStatus: AccountSubscriptionStatus | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type FetchReason = 'init' | 'auth' | 'realtime' | 'manual';

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
  const { isAuthenticated, user, availableAccounts } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<AccountSubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasValidSession, setHasValidSession] = useState<boolean>(false);

  const normalizedAccountId = typeof accountId === 'string' ? accountId.trim() : '';
  const isValidAccountId =
    Boolean(normalizedAccountId) &&
    normalizedAccountId !== 'all' &&
    normalizedAccountId !== 'undefined' &&
    normalizedAccountId !== 'null' &&
    UUID_REGEX.test(normalizedAccountId);

  const authorizedIdsKey = useMemo(
    () =>
      (availableAccounts || [])
        .map((acc) => acc?.id)
        .filter((id): id is string => Boolean(id) && id !== 'all' && UUID_REGEX.test(id))
        .join(','),
    [availableAccounts]
  );

  const isAccountAuthorized = useMemo(() => {
    if (!isAuthenticated || !user?.id || !isValidAccountId) return false;
    if (!authorizedIdsKey) return false;
    return authorizedIdsKey.split(',').includes(normalizedAccountId);
  }, [isAuthenticated, user?.id, isValidAccountId, authorizedIdsKey, normalizedAccountId]);

  const requestCounterRef = useRef<number>(0);
  const activeAccountIdRef = useRef<string>('');
  activeAccountIdRef.current = isAccountAuthorized ? normalizedAccountId : '';

  const hasValidSessionRef = useRef<boolean>(false);
  hasValidSessionRef.current = hasValidSession;

  const lastErrorRef = useRef<string | null>(null);
  lastErrorRef.current = error;

  const lastSessionUserIdRef = useRef<string | null>(null);
  const inFlightFetchRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const pendingRealtimeRefreshRef = useRef<boolean>(false);
  const fetchStatusRef = useRef<((reason?: FetchReason) => Promise<void>) | null>(null);

  const fetchStatus = useCallback(
    async (reason: FetchReason = 'manual') => {
      if (!isAccountAuthorized || !normalizedAccountId) {
        requestCounterRef.current += 1;
        inFlightFetchRef.current = null;
        pendingRealtimeRefreshRef.current = false;
        lastSessionUserIdRef.current = null;
        setHasValidSession(false);
        setSubscriptionStatus(null);
        setIsLoading(false);
        setError(null);
        return;
      }

      const targetAccountId = normalizedAccountId;
      const flightKey = `${targetAccountId}:${user?.id || ''}`;

      // Evita chamadas duplicadas simultâneas para a mesma empresa e usuário
      if (inFlightFetchRef.current?.key === flightKey) {
        if (reason === 'realtime' || reason === 'manual') {
          pendingRealtimeRefreshRef.current = true;
        }
        return inFlightFetchRef.current.promise;
      }

      const requestId = ++requestCounterRef.current;
      setIsLoading(true);
      if (reason !== 'realtime') {
        setError(null);
      }

      const runPromise = (async () => {
        try {
          await ensureSupabaseConfig();
          if (
            requestId !== requestCounterRef.current ||
            activeAccountIdRef.current !== targetAccountId
          ) {
            return;
          }

          if (!isSupabaseConfigured) {
            setHasValidSession(false);
            setSubscriptionStatus(null);
            setError('Serviço de assinatura não configurado no cliente.');
            return;
          }

          // Verifica sessão válida do usuário autenticado no cliente Supabase antes da RPC
          let { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (
            requestId !== requestCounterRef.current ||
            activeAccountIdRef.current !== targetAccountId
          ) {
            return;
          }

          let session = sessionData?.session ?? null;
          if (session?.expires_at && session.expires_at * 1000 <= Date.now() + 5000) {
            const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
            if (
              requestId !== requestCounterRef.current ||
              activeAccountIdRef.current !== targetAccountId
            ) {
              return;
            }
            if (!refreshErr && refreshed?.session) {
              session = refreshed.session;
            } else if (refreshErr) {
              sessionError = refreshErr;
              session = null;
            }
          }

          if (sessionError || !session?.access_token || !session?.user?.id) {
            lastSessionUserIdRef.current = null;
            setHasValidSession(false);
            setSubscriptionStatus(null);
            setError(
              'Sessão de autenticação do Supabase ausente ou expirada. Faça login novamente para consultar a assinatura.'
            );
            return;
          }

          lastSessionUserIdRef.current = session.user.id;
          if (!hasValidSessionRef.current) {
            setHasValidSession(true);
          }

          // 1. Consulta principal via RPC oficial no Supabase (read-only, somente authenticated)
          const { data: rpcData, error: rpcError } = await supabase.rpc(
            'get_account_subscription_status',
            { p_account_id: targetAccountId }
          );

          if (
            requestId !== requestCounterRef.current ||
            activeAccountIdRef.current !== targetAccountId
          ) {
            return;
          }

          if (rpcError) {
            console.warn('Erro ao consultar get_account_subscription_status:', rpcError.message);
            const isPermissionErr =
              rpcError.code === '42501' ||
              /permission denied|not authorized|unauthorized/i.test(rpcError.message || '');
            setSubscriptionStatus(null);
            setError(
              isPermissionErr
                ? `Permissão negada ao consultar assinatura: ${rpcError.message}`
                : `Não foi possível consultar o status da assinatura: ${rpcError.message || 'erro inesperado'}`
            );
            return;
          }

          const rpcPayload = extractRpcPayload(rpcData);
          const rpcKeys = rpcPayload ? Object.keys(rpcPayload) : [];

          // 2. Complemento read-only em account_subscriptions + subscription_plans (RLS)
          //    caso a RPC não retorne algum campo de exibição.
          //    Nunca consulta o campo legado accounts.plan.
          let subRow: Record<string, any> | null = null;
          const needsSubscriptionEnrichment =
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
              .eq('account_id', targetAccountId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (
              requestId !== requestCounterRef.current ||
              activeAccountIdRef.current !== targetAccountId
            ) {
              return;
            }

            if (subData && typeof subData === 'object') {
              subRow = subData as Record<string, any>;
            }
          }

          const planFromJoin =
            subRow?.subscription_plans && typeof subRow.subscription_plans === 'object'
              ? Array.isArray(subRow.subscription_plans)
                ? subRow.subscription_plans[0]
                : subRow.subscription_plans
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
              .eq('account_id', targetAccountId);

            if (
              requestId !== requestCounterRef.current ||
              activeAccountIdRef.current !== targetAccountId
            ) {
              return;
            }

            if (Array.isArray(channelsData)) {
              activeChannelsFromTable = channelsData.filter((ch) => ch.is_active !== false).length;
            }
          }

          if (
            requestId !== requestCounterRef.current ||
            activeAccountIdRef.current !== targetAccountId
          ) {
            return;
          }

          // Se a consulta foi bem-sucedida, mas nenhum registro de assinatura foi retornado
          if (!rpcPayload && !subRow) {
            setSubscriptionStatus({
              accountId: targetAccountId,
              hasSubscription: false,
              planId: null,
              planName: 'Assinatura não localizada',
              status: 'inactive',
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
            setError(null);
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
              (isTrial &&
                trialEndsAt !== null &&
                (daysRemaining === 0 || new Date(trialEndsAt).getTime() <= Date.now())));

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
            accountId: targetAccountId,
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
          setError(null);
        } catch (err: any) {
          if (
            requestId === requestCounterRef.current &&
            activeAccountIdRef.current === targetAccountId
          ) {
            console.warn('Erro inesperado em useSubscriptionStatus:', err);
            setSubscriptionStatus(null);
            setError(
              err?.message
                ? `Não foi possível carregar os dados da assinatura: ${err.message}`
                : 'Não foi possível carregar os dados da assinatura.'
            );
          }
        } finally {
          if (inFlightFetchRef.current?.promise === runPromise) {
            inFlightFetchRef.current = null;
          }
          if (
            requestId === requestCounterRef.current &&
            activeAccountIdRef.current === targetAccountId
          ) {
            setIsLoading(false);
            if (pendingRealtimeRefreshRef.current) {
              pendingRealtimeRefreshRef.current = false;
              void fetchStatusRef.current?.('realtime');
            }
          }
        }
      })();

      inFlightFetchRef.current = { key: flightKey, promise: runPromise };
      return runPromise;
    },
    [isAccountAuthorized, normalizedAccountId, user?.id]
  );

  fetchStatusRef.current = fetchStatus;

  // Inicialização controlada + sincronização com mudanças na sessão do Supabase Auth
  useEffect(() => {
    requestCounterRef.current += 1;
    inFlightFetchRef.current = null;
    pendingRealtimeRefreshRef.current = false;

    if (!isAccountAuthorized || !normalizedAccountId) {
      lastSessionUserIdRef.current = null;
      setHasValidSession(false);
      setSubscriptionStatus(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setSubscriptionStatus(null);
    void fetchStatus('init');

    if (!isSupabaseConfigured) return;

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (activeAccountIdRef.current !== normalizedAccountId) return;

      if (event === 'SIGNED_OUT') {
        requestCounterRef.current += 1;
        inFlightFetchRef.current = null;
        pendingRealtimeRefreshRef.current = false;
        lastSessionUserIdRef.current = null;
        setHasValidSession(false);
        setSubscriptionStatus(null);
        setIsLoading(false);
        setError(null);
        return;
      }

      // INITIAL_SESSION já é validada pela chamada inicial fetchStatus('init')
      if (event === 'INITIAL_SESSION') {
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.access_token && session?.user?.id) {
          const sessionChanged = lastSessionUserIdRef.current !== session.user.id;
          const needsRecovery = !hasValidSessionRef.current || Boolean(lastErrorRef.current);
          if (event === 'TOKEN_REFRESHED' && !sessionChanged && !needsRecovery) {
            return;
          }
          void fetchStatus('auth');
        }
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [isAccountAuthorized, normalizedAccountId, user?.id, fetchStatus]);

  // Canal Realtime aberto somente após autenticação, empresa autorizada e sessão válida confirmada
  useEffect(() => {
    if (!isSupabaseConfigured || !isAccountAuthorized || !normalizedAccountId || !hasValidSession) {
      return;
    }

    const sub = supabase
      .channel(`subscription-status-${normalizedAccountId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'account_subscriptions',
          filter: `account_id=eq.${normalizedAccountId}`,
        },
        () => {
          void fetchStatus('realtime');
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels',
          filter: `account_id=eq.${normalizedAccountId}`,
        },
        () => {
          void fetchStatus('realtime');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [isAccountAuthorized, normalizedAccountId, hasValidSession, fetchStatus]);

  const refresh = useCallback(() => fetchStatus('manual'), [fetchStatus]);

  return {
    subscriptionStatus,
    isLoading,
    error,
    refresh,
  };
}
