import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Account, AuthUser } from '../types';
import { supabase, isSupabaseConfigured, ensureSupabaseConfig } from '../lib/supabase';

interface AuthContextType {
  user: AuthUser | null;
  currentAccount: Account;
  availableAccounts: Account[];
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  login: (email: string, password?: string, targetAccountId?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void> | void;
  switchAccount: (accountId: string) => void;
  registerAccount: (
    accountName: string,
    segment: string,
    adminName: string,
    email: string,
    password: string,
    whatsappPhone?: string
  ) => Promise<{
    success: boolean;
    account?: Account;
    error?: string;
    isPossibleDuplicate?: boolean;
    detail?: string;
  }>;
  updateUserProfile: (updates: Partial<AuthUser>) => Promise<void> | void;
  updateCurrentAccount: (updates: Partial<Account>) => Promise<{ success: boolean; error?: string }> | void;
}

const LEGACY_STORAGE_KEY_USER = 'chatsapp_auth_user';
const LEGACY_STORAGE_KEY_ACCOUNT = 'chatsapp_current_account';
const LEGACY_STORAGE_KEY_ALL_ACCOUNTS = 'chatsapp_accounts_list';
const PREFERRED_ACCOUNT_STORAGE_KEY = 'chatsapp_preferred_account_id';

export const UNLINKED_ACCOUNT: Account = {
  id: '',
  name: 'Nenhuma empresa vinculada',
  slug: 'nenhuma-empresa',
  segment: 'Sem Vínculo',
  whatsappPhone: '',
  plan: 'Sem plano ativo',
  createdAt: '',
};

export const mapDbAccountToAccount = (accRow: any): Account => {
  if (!accRow) return UNLINKED_ACCOUNT;
  return {
    id: accRow.id,
    name: accRow.name || 'Empresa',
    slug: accRow.slug || 'empresa',
    segment: accRow.segment || 'Serviços & Atendimento',
    whatsappPhone: accRow.whatsapp_phone || '',
    phone: accRow.whatsapp_phone || '',
    email: accRow.email || '',
    plan: accRow.plan || 'Plano Pro Omnichannel',
    logoUrl: accRow.logo_url || '',
    createdAt: accRow.created_at,
    description: accRow.description || '',
    address: accRow.address || '',
    coverageArea: accRow.coverage_area || 'Localização exata',
    locationNotes: accRow.location_notes || '',
    website: accRow.website || '',
    extraWebsites: Array.isArray(accRow.extra_websites) ? accRow.extra_websites : [],
    bannerUrl: accRow.banner_url || '',
    businessHours:
      accRow.business_hours && typeof accRow.business_hours === 'object'
        ? accRow.business_hours
        : {},
  };
};

const clearLegacyAndAuthStorage = (clearPreferredAccount = false) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY_USER);
    localStorage.removeItem(LEGACY_STORAGE_KEY_ACCOUNT);
    localStorage.removeItem(LEGACY_STORAGE_KEY_ALL_ACCOUNTS);
    if (clearPreferredAccount) {
      localStorage.removeItem(PREFERRED_ACCOUNT_STORAGE_KEY);
    }
  } catch {
    // Ignora falhas de acesso ao storage
  }
};

const getPreferredAccountId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const preferred = localStorage.getItem(PREFERRED_ACCOUNT_STORAGE_KEY);
    return preferred && preferred.trim() ? preferred.trim() : null;
  } catch {
    return null;
  }
};

const setPreferredAccountId = (accountId: string) => {
  if (typeof window === 'undefined') return;
  try {
    if (accountId) {
      localStorage.setItem(PREFERRED_ACCOUNT_STORAGE_KEY, accountId);
    } else {
      localStorage.removeItem(PREFERRED_ACCOUNT_STORAGE_KEY);
    }
  } catch {
    // Ignora falhas de acesso ao storage
  }
};

const buildAccountOptions = (userAccounts: Account[]): Account[] => {
  const options: Account[] = [...userAccounts];
  if (userAccounts.length > 1) {
    options.push({
      id: 'all',
      name: 'Todas as Minhas Empresas (Consolidado)',
      slug: 'todas-minhas-empresas',
      segment: 'Visão Geral Multi-Tenant',
      whatsappPhone: '',
      plan: 'Consolidado',
      createdAt: new Date().toISOString(),
    });
  }
  return options;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Nunca considera localStorage como prova de autenticação ou autorização
  const [user, setUser] = useState<AuthUser | null>(null);
  const [currentAccount, setCurrentAccount] = useState<Account>(UNLINKED_ACCOUNT);
  const [availableAccounts, setAvailableAccounts] = useState<Account[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  const isRegisteringRef = useRef<boolean>(false);
  const sessionEpochRef = useRef<number>(0);
  const activeUserIdRef = useRef<string | null>(null);
  const hasLoadedLinksRef = useRef<boolean>(false);
  const hydrationInFlightRef = useRef<{ userId: string; promise: Promise<void> } | null>(null);

  const currentAccountIdRef = useRef<string>(currentAccount.id);
  currentAccountIdRef.current = currentAccount.id;

  const hydrateFromSession = useCallback(
    async (
      session: Session | null,
      options?: { force?: boolean; preferredAccountId?: string }
    ): Promise<void> => {
      if (!session?.access_token || !session?.user?.id) {
        sessionEpochRef.current += 1;
        hydrationInFlightRef.current = null;
        activeUserIdRef.current = null;
        hasLoadedLinksRef.current = false;
        setUser(null);
        setAvailableAccounts([]);
        setCurrentAccount(UNLINKED_ACCOUNT);
        clearLegacyAndAuthStorage(false);
        setIsAuthLoading(false);
        return;
      }

      const authUserId = session.user.id;

      // Evita consultas redundantes durante TOKEN_REFRESHED quando identidade e vínculos permanecem iguais
      if (
        !options?.force &&
        activeUserIdRef.current === authUserId &&
        hasLoadedLinksRef.current
      ) {
        setIsAuthLoading(false);
        return;
      }

      if (!options?.force && hydrationInFlightRef.current?.userId === authUserId) {
        return hydrationInFlightRef.current.promise;
      }

      const myEpoch = ++sessionEpochRef.current;

      const runHydration = (async () => {
        try {
          await ensureSupabaseConfig();
          if (myEpoch !== sessionEpochRef.current || !isSupabaseConfigured) {
            return;
          }

          // Garante remoção de chaves legadas que armazenavam objetos completos de usuário/empresas
          clearLegacyAndAuthStorage(false);

          // 1. Consulta vínculos exclusivamente pelo user_id autenticado (exclui agentes de IA)
          const { data: accountUserRows, error: uaError } = await supabase
            .from('account_users')
            .select('account_id, role, name, email, is_ai_agent, accounts(*)')
            .eq('user_id', authUserId);

          if (myEpoch !== sessionEpochRef.current) return;

          if (uaError) {
            console.warn('Erro ao consultar vínculos em account_users:', uaError.message);
            activeUserIdRef.current = authUserId;
            hasLoadedLinksRef.current = false;
            setAvailableAccounts([]);
            setCurrentAccount(UNLINKED_ACCOUNT);
            setUser({
              id: authUserId,
              name:
                session.user.user_metadata?.name ||
                session.user.email?.split('@')[0] ||
                'Usuário',
              email: session.user.email || '',
              role: 'agent',
              accountId: '',
              accountName: 'Nenhuma empresa vinculada',
              mood: 'Disponível',
            });
            return;
          }

          const humanRows = (accountUserRows || []).filter(
            (r: any) => r && (r.is_ai_agent === null || r.is_ai_agent === false)
          );

          const userAccounts: Account[] = humanRows
            .map((r: any) => r.accounts)
            .filter((a: any) => Boolean(a && a.id))
            .map((a: any) => mapDbAccountToAccount(a));

          // 2. Carrega ou inicializa perfil pessoal em public.profiles pelo auth.uid()
          let profileData: any = null;
          try {
            const { data: profileRow, error: profileErr } = await supabase
              .from('profiles')
              .select('id, name, phone, role_title, bio, mood, avatar_url')
              .eq('id', authUserId)
              .maybeSingle();

            if (myEpoch !== sessionEpochRef.current) return;

            if (profileRow) {
              profileData = profileRow;
            } else if (!profileErr) {
              const fallbackName =
                humanRows[0]?.name ||
                session.user.user_metadata?.name ||
                session.user.email?.split('@')[0] ||
                'Usuário';

              const { data: newProfile } = await supabase
                .from('profiles')
                .insert({
                  id: authUserId,
                  name: fallbackName,
                  mood: 'Disponível',
                })
                .select('id, name, phone, role_title, bio, mood, avatar_url')
                .maybeSingle();

              if (myEpoch !== sessionEpochRef.current) return;
              if (newProfile) {
                profileData = newProfile;
              }
            }
          } catch (profErr) {
            console.warn('Erro ao sincronizar public.profiles:', profErr);
          }

          if (myEpoch !== sessionEpochRef.current) return;

          if (userAccounts.length > 0) {
            const optionsList = buildAccountOptions(userAccounts);
            const preferredId = options?.preferredAccountId || getPreferredAccountId();
            const currentValidId = currentAccountIdRef.current;

            let selectedAccount = userAccounts[0];
            if (preferredId && optionsList.some((a) => a.id === preferredId)) {
              selectedAccount = optionsList.find((a) => a.id === preferredId) || userAccounts[0];
            } else if (currentValidId && optionsList.some((a) => a.id === currentValidId)) {
              selectedAccount =
                optionsList.find((a) => a.id === currentValidId) || userAccounts[0];
            }

            const primaryUserRow =
              humanRows.find((r: any) => r.accounts?.id === selectedAccount.id) || humanRows[0];

            const resolvedUser: AuthUser = {
              id: authUserId,
              name:
                profileData?.name ||
                primaryUserRow?.name ||
                session.user.user_metadata?.name ||
                session.user.email?.split('@')[0] ||
                'Administrador',
              email: session.user.email || primaryUserRow?.email || '',
              role: primaryUserRow?.role || 'admin',
              accountId: selectedAccount.id,
              accountName: selectedAccount.name,
              phone: profileData?.phone,
              role_title: profileData?.role_title,
              bio: profileData?.bio,
              mood: profileData?.mood || 'Disponível',
              avatarUrl: profileData?.avatar_url,
            };

            activeUserIdRef.current = authUserId;
            hasLoadedLinksRef.current = true;
            setAvailableAccounts(optionsList);
            setCurrentAccount(selectedAccount);
            setUser(resolvedUser);
            setPreferredAccountId(selectedAccount.id);
          } else {
            // Usuário autenticado sem empresa vinculada: nunca atribui empresa padrão
            const unlinkedUser: AuthUser = {
              id: authUserId,
              name:
                profileData?.name ||
                session.user.user_metadata?.name ||
                session.user.email?.split('@')[0] ||
                'Usuário',
              email: session.user.email || '',
              role: 'agent',
              accountId: '',
              accountName: 'Nenhuma empresa vinculada',
              phone: profileData?.phone,
              role_title: profileData?.role_title,
              bio: profileData?.bio,
              mood: profileData?.mood || 'Disponível',
              avatarUrl: profileData?.avatar_url,
            };

            activeUserIdRef.current = authUserId;
            hasLoadedLinksRef.current = true;
            setAvailableAccounts([]);
            setCurrentAccount(UNLINKED_ACCOUNT);
            setUser(unlinkedUser);
            setPreferredAccountId('');
          }
        } catch (err) {
          console.warn('Erro ao validar sessão e vínculos no Supabase:', err);
          if (myEpoch === sessionEpochRef.current) {
            activeUserIdRef.current = null;
            hasLoadedLinksRef.current = false;
            setAvailableAccounts([]);
            setCurrentAccount(UNLINKED_ACCOUNT);
            setUser(null);
          }
        } finally {
          if (hydrationInFlightRef.current?.promise === runHydration) {
            hydrationInFlightRef.current = null;
          }
          if (myEpoch === sessionEpochRef.current) {
            setIsAuthLoading(false);
          }
        }
      })();

      hydrationInFlightRef.current = { userId: authUserId, promise: runHydration };
      return runHydration;
    },
    []
  );

  // Inicialização da sessão única via Supabase Auth + listener onAuthStateChange sem deadlocks
  useEffect(() => {
    let isMounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleHydration = (session: Session | null, force = false) => {
      if (pendingTimer) {
        clearTimeout(pendingTimer);
      }
      pendingTimer = setTimeout(() => {
        if (!isMounted || isRegisteringRef.current) return;
        void hydrateFromSession(session, { force });
      }, 0);
    };

    const initAuth = async () => {
      try {
        await ensureSupabaseConfig();
        if (!isMounted) return;

        if (!isSupabaseConfigured) {
          clearLegacyAndAuthStorage(false);
          setUser(null);
          setAvailableAccounts([]);
          setCurrentAccount(UNLINKED_ACCOUNT);
          setIsAuthLoading(false);
          return;
        }

        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
          if (!isMounted) return;

          if (event === 'SIGNED_OUT') {
            if (pendingTimer) clearTimeout(pendingTimer);
            scheduleHydration(null, true);
            return;
          }

          if (isRegisteringRef.current) {
            return;
          }

          // INITIAL_SESSION é tratada explicitamente abaixo via getSession()
          if (event === 'INITIAL_SESSION') {
            return;
          }

          if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            scheduleHydration(session);
            return;
          }

          if (event === 'TOKEN_REFRESHED') {
            if (
              session?.user?.id &&
              activeUserIdRef.current === session.user.id &&
              hasLoadedLinksRef.current
            ) {
              return;
            }
            scheduleHydration(session);
          }
        });
        authSubscription = authListener?.subscription ?? null;

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (sessionError || !sessionData?.session?.access_token) {
          await hydrateFromSession(null, { force: true });
        } else {
          await hydrateFromSession(sessionData.session);
        }
      } catch (err) {
        console.warn('Falha ao inicializar autenticação:', err);
        if (isMounted) {
          await hydrateFromSession(null, { force: true });
        }
      }
    };

    void initAuth();

    return () => {
      isMounted = false;
      if (pendingTimer) clearTimeout(pendingTimer);
      authSubscription?.unsubscribe();
    };
  }, [hydrateFromSession]);

  // Login centralizado exclusivamente no Supabase Auth
  const login = async (
    email: string,
    password?: string,
    targetAccountId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();

    try {
      await ensureSupabaseConfig();
      if (!isSupabaseConfigured) {
        return {
          success: false,
          error: 'Serviço de autenticação não configurado no cliente.',
        };
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password || '',
      });

      if (authError) {
        let msg = authError.message;
        if (msg.includes('Invalid login credentials')) {
          msg = 'Credenciais inválidas. E-mail ou senha incorretos.';
        } else if (msg.includes('Email not confirmed')) {
          msg = 'E-mail ainda não confirmado. Por favor, verifique sua caixa de entrada.';
        }
        return {
          success: false,
          error: msg,
        };
      }

      if (!authData.session || !authData.user?.id) {
        return {
          success: false,
          error: 'Sessão de autenticação não retornada pelo Supabase.',
        };
      }

      await hydrateFromSession(authData.session, {
        force: true,
        preferredAccountId: targetAccountId,
      });

      return { success: true };
    } catch (directErr: any) {
      console.error('Erro na autenticação:', directErr);
      return {
        success: false,
        error: directErr?.message || 'Erro inesperado ao autenticar.',
      };
    }
  };

  // Logout real no Supabase Auth (escopo local) + limpeza integral de estado e caches
  const logout = async () => {
    sessionEpochRef.current += 1;
    hydrationInFlightRef.current = null;
    activeUserIdRef.current = null;
    hasLoadedLinksRef.current = false;

    setUser(null);
    setAvailableAccounts([]);
    setCurrentAccount(UNLINKED_ACCOUNT);
    setIsAuthLoading(false);
    clearLegacyAndAuthStorage(true);

    try {
      await ensureSupabaseConfig();
      if (isSupabaseConfigured) {
        await supabase.auth.signOut({ scope: 'local' });
      }
    } catch (err) {
      console.warn('Aviso ao encerrar sessão local no Supabase Auth:', err);
    }
  };

  const switchAccount = (accountId: string) => {
    const target = availableAccounts.find((a) => a.id === accountId);
    if (!target) return;
    setCurrentAccount(target);
    setPreferredAccountId(target.id);
    if (user) {
      setUser({
        ...user,
        accountId: target.id,
        accountName: target.name,
      });
    }
  };

  // Atualizar perfil do usuário logado (persistido em public.profiles com sessão válida)
  const updateUserProfile = async (updates: Partial<AuthUser>) => {
    const previousUser = user;
    setUser((prev) => {
      if (!prev) return null;
      return { ...prev, ...updates };
    });

    try {
      await ensureSupabaseConfig();
      if (!isSupabaseConfigured) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUserId = sessionData?.session?.user?.id;
      if (!sessionData?.session?.access_token || !sessionUserId) {
        if (previousUser) setUser(previousUser);
        return;
      }

      const payload: Record<string, any> = {
        id: sessionUserId,
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.phone !== undefined) payload.phone = updates.phone;
      if (updates.role_title !== undefined) payload.role_title = updates.role_title;
      if (updates.bio !== undefined) payload.bio = updates.bio;
      if (updates.mood !== undefined) payload.mood = updates.mood;
      if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;

      const { error } = await supabase.from('profiles').upsert(payload);

      if (error) {
        console.error('[Supabase] Erro ao salvar em public.profiles:', error.message);
      }
    } catch (err) {
      console.error('[Supabase] Falha ao atualizar public.profiles:', err);
    }
  };

  // Atualizar dados da conta atual (persiste em public.accounts e sincroniza contexto)
  const updateCurrentAccount = async (
    updates: Partial<Account>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentAccount?.id || currentAccount.id === 'all') {
      return { success: false, error: 'Nenhuma empresa ativa selecionada.' };
    }

    const updatedAccount: Account = { ...currentAccount, ...updates };

    setCurrentAccount(updatedAccount);
    setAvailableAccounts((prevList) =>
      prevList.map((acc) => (acc.id === currentAccount.id ? { ...acc, ...updates } : acc))
    );

    if (updates.name && user) {
      setUser({ ...user, accountName: updates.name });
    }

    try {
      await ensureSupabaseConfig();
      if (!isSupabaseConfigured) {
        return { success: true };
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        return { success: false, error: 'Sessão de autenticação inválida ou expirada.' };
      }

      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) payload.name = updates.name.trim();
      if (updates.segment !== undefined) payload.segment = updates.segment.trim();
      if (updates.whatsappPhone !== undefined) {
        payload.whatsapp_phone = updates.whatsappPhone.trim();
      } else if (updates.phone !== undefined) {
        payload.whatsapp_phone = updates.phone.trim();
      }
      if (updates.description !== undefined) payload.description = updates.description.trim();
      if (updates.address !== undefined) payload.address = updates.address.trim();
      if (updates.coverageArea !== undefined) payload.coverage_area = updates.coverageArea.trim();
      if (updates.locationNotes !== undefined) payload.location_notes = updates.locationNotes.trim();
      if (updates.website !== undefined) payload.website = updates.website.trim();
      if (updates.extraWebsites !== undefined) payload.extra_websites = updates.extraWebsites;
      if (updates.email !== undefined) payload.email = updates.email.trim();
      if (updates.bannerUrl !== undefined) payload.banner_url = updates.bannerUrl.trim();
      if (updates.businessHours !== undefined) payload.business_hours = updates.businessHours;

      const { error } = await supabase
        .from('accounts')
        .update(payload)
        .eq('id', currentAccount.id);

      if (error) {
        console.error('[Supabase] Erro ao atualizar public.accounts:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      console.error('[Supabase] Falha ao atualizar public.accounts:', err);
      return { success: false, error: err?.message || 'Erro ao persistir dados da empresa.' };
    }
  };

  // Cadastro de nova empresa: supabase.auth.signUp() -> supabase.rpc('create_new_account') -> hidratação estrita
  const registerAccount = async (
    accountName: string,
    segment: string,
    adminName: string,
    email: string,
    password: string,
    whatsappPhone: string = ''
  ): Promise<{
    success: boolean;
    account?: Account;
    error?: string;
    isPossibleDuplicate?: boolean;
    detail?: string;
  }> => {
    isRegisteringRef.current = true;
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanAdminName = adminName.trim() || 'Administrador';
      const cleanCompanyName = accountName.trim();
      const cleanSegment = segment.trim() || 'Serviços & Atendimento';
      const cleanWhatsappPhone = whatsappPhone.trim();
      const normalizedPhone = cleanWhatsappPhone.replace(/\D/g, '');

      await ensureSupabaseConfig();
      if (!isSupabaseConfigured) {
        return {
          success: false,
          error: 'Serviço de autenticação não configurado no cliente.',
        };
      }

      // Verificação prévia opcional de duplicidade pelo WhatsApp comercial
      if (normalizedPhone.length >= 8) {
        try {
          const { data: existingAccounts } = await supabase
            .from('accounts')
            .select('id, whatsapp_phone');

          if (existingAccounts && existingAccounts.length > 0) {
            const hasDuplicate = existingAccounts.some((acc: any) => {
              const dbPhone = (acc.whatsapp_phone || '').replace(/\D/g, '');
              if (!dbPhone || dbPhone.length < 8) return false;
              if (dbPhone === normalizedPhone) return true;
              if (dbPhone.length >= 10 && normalizedPhone.length >= 10) {
                if (dbPhone.startsWith('55') && normalizedPhone.startsWith('55')) {
                  return dbPhone.slice(-9) === normalizedPhone.slice(-9);
                }
              }
              return false;
            });

            if (hasDuplicate) {
              return {
                success: false,
                isPossibleDuplicate: true,
                error: 'Encontramos uma empresa que pode já estar cadastrada no ChatsApp.',
                detail:
                  'Para proteger os dados da empresa, não podemos vinculá-la automaticamente à sua conta. Entre em contato com o administrador da empresa para solicitar acesso.',
              };
            }
          }
        } catch (checkErr) {
          console.warn('Checagem prévia de duplicidade ignorada por RLS:', checkErr);
        }
      }

      // 1. Criar usuário no Supabase Auth com senha e metadados completos
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            name: cleanAdminName,
            company_name: cleanCompanyName,
            company_segment: cleanSegment,
            whatsapp_phone: cleanWhatsappPhone,
          },
        },
      });

      if (signUpError) {
        let msg = signUpError.message;
        if (msg.includes('already registered') || msg.includes('already been registered')) {
          msg = 'Este e-mail já está cadastrado. Por favor, faça login ou utilize outro e-mail.';
        } else if (msg.includes('Password should be at least')) {
          msg = 'A senha de acesso deve ter pelo menos 6 caracteres.';
        }
        return {
          success: false,
          error: msg,
        };
      }

      const authUser = signUpData?.user;
      if (!authUser) {
        return {
          success: false,
          error: 'Não foi possível registrar o usuário no serviço de autenticação.',
        };
      }

      if (!signUpData.session) {
        return {
          success: false,
          error:
            'Cadastro criado! A confirmação de e-mail está ativada no seu Supabase. Desative "Confirm email" em Authentication -> Providers -> Email para acesso imediato sem necessidade de confirmação.',
        };
      }

      // 2. Chamar a RPC transacional create_new_account com privilégios seguros
      let rpcResult: any = null;
      let rpcError: any = null;

      try {
        const call4 = await supabase.rpc('create_new_account', {
          p_company_name: cleanCompanyName,
          p_company_segment: cleanSegment,
          p_admin_name: cleanAdminName,
          p_whatsapp_phone: cleanWhatsappPhone,
        });

        if (call4.error && call4.error.code === 'PGRST202') {
          const call3 = await supabase.rpc('create_new_account', {
            p_company_name: cleanCompanyName,
            p_company_segment: cleanSegment,
            p_admin_name: cleanAdminName,
          });
          rpcResult = call3.data;
          rpcError = call3.error;
        } else {
          rpcResult = call4.data;
          rpcError = call4.error;
        }
      } catch (rpcEx: any) {
        rpcError = rpcEx;
      }

      if (
        rpcResult &&
        (rpcResult.success === false || rpcResult.code === 'POSSIBLE_DUPLICATE_COMPANY')
      ) {
        return {
          success: false,
          isPossibleDuplicate: true,
          error:
            rpcResult.error || 'Encontramos uma empresa que pode já estar cadastrada no ChatsApp.',
          detail:
            rpcResult.detail ||
            'Para proteger os dados da empresa, não podemos vinculá-la automaticamente à sua conta. Entre em contato com o administrador da empresa para solicitar acesso.',
        };
      }

      if (rpcError) {
        console.error('Falha na RPC create_new_account:', rpcError);
        return {
          success: false,
          error: rpcError.message || 'Falha ao inicializar espaço da empresa.',
        };
      }

      // 3. Re-hidratação estrita no banco pelo user_id autenticado (exclui agentes de IA)
      const { data: userAccountsData, error: uaError } = await supabase
        .from('account_users')
        .select('account_id, role, is_ai_agent, accounts(*)')
        .eq('user_id', authUser.id);

      if (uaError) {
        console.warn('Aviso ao consultar vínculos após create_new_account:', uaError);
      }

      const freshAccounts: Account[] = (userAccountsData || [])
        .filter((r: any) => r && (r.is_ai_agent === null || r.is_ai_agent === false))
        .map((r: any) => r.accounts)
        .filter((a: any) => Boolean(a && a.id))
        .map((a: any) => mapDbAccountToAccount(a));

      const createdAccId = rpcResult?.account?.id;
      let targetAccount = freshAccounts.find((a) => a.id === createdAccId);

      if (!targetAccount && rpcResult?.account) {
        targetAccount = {
          id: rpcResult.account.id,
          name: rpcResult.account.name || cleanCompanyName,
          slug: rpcResult.account.slug || 'empresa',
          segment: rpcResult.account.segment || cleanSegment,
          whatsappPhone: rpcResult.account.whatsapp_phone || cleanWhatsappPhone,
          plan: rpcResult.account.plan || 'Plano Pro Omnichannel',
          createdAt: rpcResult.account.createdAt || new Date().toISOString(),
        };
        freshAccounts.unshift(targetAccount);
      } else if (!targetAccount && freshAccounts.length > 0) {
        targetAccount = freshAccounts[0];
      }

      if (!targetAccount) {
        return {
          success: false,
          error:
            'A empresa foi criada no sistema, mas não foi possível carregar os dados no momento. Por favor faça login com seu e-mail e senha.',
        };
      }

      if (cleanWhatsappPhone && !targetAccount.whatsappPhone) {
        targetAccount.whatsappPhone = cleanWhatsappPhone;
        supabase
          .from('accounts')
          .update({ whatsapp_phone: cleanWhatsappPhone })
          .eq('id', targetAccount.id)
          .then(() => {});
      }

      const activeAccountsList = buildAccountOptions(freshAccounts);

      const registeredUser: AuthUser = {
        id: authUser.id,
        name: cleanAdminName,
        email: cleanEmail,
        role: 'admin',
        accountId: targetAccount.id,
        accountName: targetAccount.name,
        phone: cleanWhatsappPhone,
        role_title: 'Gestor / Administrador',
        mood: 'Disponível',
      };

      sessionEpochRef.current += 1;
      activeUserIdRef.current = authUser.id;
      hasLoadedLinksRef.current = true;
      setAvailableAccounts(activeAccountsList);
      setCurrentAccount(targetAccount);
      setUser(registeredUser);
      setPreferredAccountId(targetAccount.id);
      setIsAuthLoading(false);
      clearLegacyAndAuthStorage(false);

      return { success: true, account: targetAccount };
    } catch (err: any) {
      console.error('[Supabase] Falha no fluxo de cadastro:', err);
      return {
        success: false,
        error: err?.message || 'Erro inesperado ao registrar empresa. Tente novamente.',
      };
    } finally {
      isRegisteringRef.current = false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        currentAccount,
        availableAccounts,
        isAuthenticated: Boolean(user?.id),
        isAuthLoading,
        login,
        logout,
        switchAccount,
        registerAccount,
        updateUserProfile,
        updateCurrentAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
