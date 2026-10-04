import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Account, AuthUser } from '../types';
import { supabase, isSupabaseConfigured, ensureSupabaseConfig } from '../lib/supabase';

interface AuthContextType {
  user: AuthUser | null;
  currentAccount: Account;
  availableAccounts: Account[];
  isAuthenticated: boolean;
  login: (email: string, password?: string, targetAccountId?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
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

const STORAGE_KEY_USER = 'chatsapp_auth_user';
const STORAGE_KEY_ACCOUNT = 'chatsapp_current_account';
const STORAGE_KEY_ALL_ACCOUNTS = 'chatsapp_accounts_list';

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Inicializa a conta atual sem fallbacks arbitrários
  const [currentAccount, setCurrentAccount] = useState<Account>(() => {
    try {
      const savedAcc = localStorage.getItem(STORAGE_KEY_ACCOUNT);
      if (savedAcc) {
        const parsed = JSON.parse(savedAcc);
        if (parsed && typeof parsed.id === 'string' && parsed.id !== 'a0000000-0000-0000-0000-000000000001') {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Erro ao ler conta atual:', e);
    }
    return UNLINKED_ACCOUNT;
  });

  // Inicializa a lista de contas disponíveis para o usuário logado
  const [availableAccounts, setAvailableAccounts] = useState<Account[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ALL_ACCOUNTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = parsed.filter(
            (a: any) => a && a.id && a.id !== 'a0000000-0000-0000-0000-000000000001'
          );
          if (filtered.length > 0) return filtered;
        }
      }
    } catch (e) {
      console.warn('Erro ao ler accounts do localStorage:', e);
    }
    return [];
  });

  // Inicializa o usuário logado
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY_USER);
      if (savedUser) {
        return JSON.parse(savedUser);
      }
    } catch (e) {
      console.warn('Erro ao ler usuário logado:', e);
    }
    return null;
  });

  // Flag de bloqueio para impedir que syncUserAccountsFromDb execute durante o onboarding
  const isRegisteringRef = useRef(false);

  // Salvar no localStorage sempre que houver mudanças
  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
    }
  }, [user]);

  useEffect(() => {
    if (currentAccount && currentAccount.id) {
      localStorage.setItem(STORAGE_KEY_ACCOUNT, JSON.stringify(currentAccount));
    } else {
      localStorage.removeItem(STORAGE_KEY_ACCOUNT);
    }
  }, [currentAccount]);

  useEffect(() => {
    if (availableAccounts && availableAccounts.length > 0) {
      localStorage.setItem(STORAGE_KEY_ALL_ACCOUNTS, JSON.stringify(availableAccounts));
    } else {
      localStorage.removeItem(STORAGE_KEY_ALL_ACCOUNTS);
    }
  }, [availableAccounts]);

  // Sincroniza em segundo plano estritamente as empresas reais vinculadas ao usuário logado via account_users
  useEffect(() => {
    const syncUserAccountsFromDb = async () => {
      // Se houver processo de onboarding / cadastro em andamento, não sobrescreve
      if (isRegisteringRef.current) return;
      if (!user?.id) return;

      try {
        await ensureSupabaseConfig();
        if (!isSupabaseConfigured) return;

        // Autorização estrita: auth.uid() -> account_users.user_id = user.id
        const { data: byUserId, error: byUserIdErr } = await supabase
          .from('account_users')
          .select('account_id, role, is_ai_agent, accounts(*)')
          .eq('user_id', user.id);

        if (byUserIdErr) {
          console.warn('Erro ao sincronizar account_users:', byUserIdErr);
          return;
        }

        // Se o onboarding foi iniciado durante a chamada, aborta sem alterar o estado
        if (isRegisteringRef.current) return;

        if (byUserId) {
          const userAccounts: Account[] = byUserId
            .filter((r: any) => r && (r.is_ai_agent === null || r.is_ai_agent === false))
            .map((r: any) => r.accounts)
            .filter((a: any) => Boolean(a && a.id))
            .map((a: any) => mapDbAccountToAccount(a));

          if (userAccounts.length > 0) {
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
            setAvailableAccounts(options);

            // Se a conta atual não pertencer à lista de empresas vinculadas do usuário, seleciona a primeira dele
            setCurrentAccount((prev) => {
              if (prev.id === 'all' && userAccounts.length > 1) return prev;
              const exists = userAccounts.some((a) => a.id === prev.id);
              return exists && prev.id !== '' ? prev : userAccounts[0];
            });
          } else if (!isRegisteringRef.current) {
            // Nenhuma conta vinculada a este usuário no banco de dados
            setAvailableAccounts([]);
            setCurrentAccount(UNLINKED_ACCOUNT);
          }
        }
      } catch (err) {
        console.warn('Erro ao sincronizar empresas do usuário no AuthContext:', err);
      }
    };

    const syncUserProfileFromDb = async () => {
      if (!user?.id) return;
      try {
        await ensureSupabaseConfig();
        if (!isSupabaseConfigured) return;

        const { data: profileRow, error: profileErr } = await supabase
          .from('profiles')
          .select('id, name, phone, role_title, bio, mood, avatar_url')
          .eq('id', user.id)
          .maybeSingle();

        if (profileRow) {
          setUser((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              name: profileRow.name || prev.name,
              phone: profileRow.phone ?? prev.phone,
              role_title: profileRow.role_title ?? prev.role_title,
              bio: profileRow.bio ?? prev.bio,
              mood: profileRow.mood || prev.mood || 'Disponível',
              avatarUrl: profileRow.avatar_url ?? prev.avatarUrl,
            };
          });
        } else if (!profileErr) {
          // Se ainda não existir registro em profiles para este auth.uid(), cria inicial sem email
          const fallbackName = user.name || 'Usuário';
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              name: fallbackName,
              mood: 'Disponível',
            })
            .select('id, name, phone, role_title, bio, mood, avatar_url')
            .maybeSingle();

          if (newProfile) {
            setUser((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                name: newProfile.name || prev.name,
                avatarUrl: newProfile.avatar_url ?? prev.avatarUrl,
                mood: newProfile.mood || prev.mood,
              };
            });
          }
        }
      } catch (err) {
        console.warn('Erro ao sincronizar public.profiles:', err);
      }
    };

    syncUserAccountsFromDb();
    syncUserProfileFromDb();
  }, [user?.id]);

  // Login com verificação inteligente de e-mail e senha no Supabase (API Serverless + Direct Client Fallback)
  const login = async (
    email: string,
    password?: string,
    targetAccountId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Tentar primeiro via Endpoint de API (/api/auth/login)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: password || '' }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.account && data.user) {
        const acc: Account = {
          id: data.account.id,
          name: data.account.name,
          slug: data.account.slug,
          segment: data.account.segment,
          whatsappPhone: data.account.whatsappPhone || '+55 11 99999-9999',
          plan: data.account.plan || 'Plano Pro Omnichannel',
          createdAt: data.account.createdAt,
        };
        const authUser: AuthUser = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role || 'admin',
          accountId: acc.id,
          accountName: acc.name,
          avatarUrl: data.user.avatarUrl,
        };

        const accountsList =
          Array.isArray(data.availableAccounts) && data.availableAccounts.length > 0
            ? data.availableAccounts
            : [acc];

        setAvailableAccounts(accountsList);
        setCurrentAccount(acc);
        setUser(authUser);
        return { success: true };
      }

      // Se a rota respondeu explicitamente que a senha é incorreta ou usuário não existe
      if (res.status === 401 || res.status === 404 || res.status === 400) {
        return {
          success: false,
          error: data.error || 'Credenciais inválidas. Verifique seu e-mail e senha.',
        };
      }

      // Se o erro foi 503 (Supabase não configurado no backend da Vercel)
      if (res.status === 503) {
        console.warn('Backend /api/auth/login sem Supabase configurado:', data.error);
      }
    } catch (err: any) {
      console.warn('Aviso: /api/auth/login inacessível, tentando conexão direta com Supabase SDK...', err);
    }

    // 2. Fallback resiliente: autenticação direta via Supabase Client
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Falha na conexão com o servidor de autenticação. Tente novamente mais tarde.',
      };
    }

    try {
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

      // Login no Supabase Auth bem sucedido! Localiza estritamente as empresas vinculadas a este usuário via user.id
      const authUserId = authData.user?.id;
      if (!authUserId) {
        return {
          success: false,
          error: 'Identificador de usuário não retornado pelo serviço de autenticação.',
        };
      }

      let userRows: any[] | null = null;
      const { data: byUserId } = await supabase
        .from('account_users')
        .select('*, accounts(*)')
        .eq('user_id', authUserId);

      if (byUserId && byUserId.length > 0) {
        userRows = byUserId;
      } else {
        const { data: byEmail } = await supabase
          .from('account_users')
          .select('*, accounts(*)')
          .eq('email', cleanEmail);

        if (byEmail && byEmail.length > 0) {
          userRows = byEmail;
          // Vincula o user_id permanente em account_users
          supabase
            .from('account_users')
            .update({ user_id: authUserId })
            .eq('email', cleanEmail)
            .is('user_id', null)
            .then(() => {});
        }
      }

      const validAccounts: Account[] = (userRows || [])
        .map((r: any) => r.accounts)
        .filter((accRow: any) => Boolean(accRow && accRow.id))
        .map((accRow: any) => mapDbAccountToAccount(accRow));

      // 3. Carregar ou criar perfil pessoal em public.profiles usando o authUserId
      let profileData: any = null;
      try {
        const { data: existingProfile, error: profSelectErr } = await supabase
          .from('profiles')
          .select('id, name, phone, role_title, bio, mood, avatar_url')
          .eq('id', authUserId)
          .maybeSingle();

        if (existingProfile) {
          profileData = existingProfile;
        } else if (!profSelectErr) {
          const initialName =
            userRows?.[0]?.name ||
            authData.user?.user_metadata?.name ||
            cleanEmail.split('@')[0] ||
            'Usuário';

          const { data: createdProfile } = await supabase
            .from('profiles')
            .insert({
              id: authUserId,
              name: initialName,
              mood: 'Disponível',
            })
            .select('id, name, phone, role_title, bio, mood, avatar_url')
            .maybeSingle();

          if (createdProfile) {
            profileData = createdProfile;
          }
        }
      } catch (profErr) {
        console.warn('Erro ao consultar public.profiles no login:', profErr);
      }

      if (validAccounts.length > 0) {
        const primaryAcc = validAccounts[0];
        const primaryUserRow = userRows?.find((r: any) => r.accounts?.id === primaryAcc.id) || userRows?.[0];

        const authUser: AuthUser = {
          id: authUserId,
          name: profileData?.name || primaryUserRow?.name || authData.user?.user_metadata?.name || 'Administrador',
          email: authData.user?.email || primaryUserRow?.email || cleanEmail,
          role: primaryUserRow?.role || 'admin',
          accountId: primaryAcc.id,
          accountName: primaryAcc.name,
          phone: profileData?.phone,
          role_title: profileData?.role_title,
          bio: profileData?.bio,
          mood: profileData?.mood || 'Disponível',
          avatarUrl: profileData?.avatar_url,
        };

        const options: Account[] = [...validAccounts];
        if (validAccounts.length > 1) {
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

        setAvailableAccounts(options);
        setCurrentAccount(primaryAcc);
        setUser(authUser);
        return { success: true };
      }

      // Se autenticado no Supabase Auth mas SEM NENHUM vínculo em account_users:
      // Tenta auto-provisionar a empresa para o usuário (ex: recém-cadastrado pós-confirmação de e-mail)
      let pendingReg: any = null;
      try {
        const rawPending = localStorage.getItem(`pending_reg_${cleanEmail}`);
        if (rawPending) pendingReg = JSON.parse(rawPending);
      } catch {}

      const metaCompanyName =
        pendingReg?.companyName ||
        authData.user?.user_metadata?.company_name ||
        authData.user?.user_metadata?.companyName;
      const metaSegment =
        pendingReg?.segment ||
        authData.user?.user_metadata?.company_segment ||
        authData.user?.user_metadata?.companySegment ||
        'Serviços & Atendimento';
      const metaAdminName =
        pendingReg?.adminName ||
        profileData?.name ||
        authData.user?.user_metadata?.name ||
        cleanEmail.split('@')[0] ||
        'Administrador';

      const companyNameToCreate = metaCompanyName?.trim() || `Empresa de ${metaAdminName}`;

      let autoProvisionedAcc: Account | null = null;

      // 1. Tentar provisionar via RPC create_new_account
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('create_new_account', {
          p_company_name: companyNameToCreate,
          p_company_segment: metaSegment,
          p_admin_name: metaAdminName,
        });

        if (!rpcErr && rpcRes?.account) {
          autoProvisionedAcc = {
            id: rpcRes.account.id,
            name: rpcRes.account.name || companyNameToCreate,
            slug: rpcRes.account.slug || 'empresa',
            segment: rpcRes.account.segment || metaSegment,
            whatsappPhone: rpcRes.account.whatsapp_phone || '',
            plan: rpcRes.account.plan || 'Plano Pro Omnichannel',
            createdAt: rpcRes.account.createdAt || new Date().toISOString(),
          };
        }
      } catch (rpcEx) {
        console.warn('RPC create_new_account falhou, tentando inserção direta:', rpcEx);
      }

      // 2. Fallback de inserção direta caso a RPC não tenha sido criada no banco
      if (!autoProvisionedAcc) {
        try {
          const baseSlug = companyNameToCreate
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'empresa';
          const slug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;

          const { data: createdAcc } = await supabase
            .from('accounts')
            .insert({
              name: companyNameToCreate,
              slug,
              segment: metaSegment,
              plan: 'pro',
            })
            .select('*')
            .single();

          if (createdAcc) {
            await supabase.from('account_users').insert([
              {
                account_id: createdAcc.id,
                user_id: authUserId,
                name: metaAdminName,
                email: cleanEmail,
                role: 'admin',
                is_ai_agent: false,
              },
              {
                account_id: createdAcc.id,
                name: `Agente IA - ${companyNameToCreate}`,
                email: `ia.${slug}@monarcahub.com`,
                role: 'ai_agent',
                is_ai_agent: true,
              },
            ]);

            await supabase.from('cerebro_ia').upsert(
              {
                account_id: createdAcc.id,
                user_id: authUserId,
                business_name: companyNameToCreate,
                tone_of_voice: 'Amigável, acolhedor e consultivo',
                is_active: true,
              },
              { onConflict: 'account_id' }
            );

            autoProvisionedAcc = mapDbAccountToAccount(createdAcc);
          }
        } catch (directEx) {
          console.warn('Erro no fallback de criação da empresa:', directEx);
        }
      }

      if (autoProvisionedAcc) {
        const authUser: AuthUser = {
          id: authUserId,
          name: metaAdminName,
          email: authData.user?.email || cleanEmail,
          role: 'admin',
          accountId: autoProvisionedAcc.id,
          accountName: autoProvisionedAcc.name,
          phone: profileData?.phone,
          role_title: profileData?.role_title || 'Gestor / Administrador',
          bio: profileData?.bio,
          mood: profileData?.mood || 'Disponível',
          avatarUrl: profileData?.avatar_url,
        };

        setAvailableAccounts([autoProvisionedAcc]);
        setCurrentAccount(autoProvisionedAcc);
        setUser(authUser);

        try {
          localStorage.setItem(STORAGE_KEY_ACCOUNT, JSON.stringify(autoProvisionedAcc));
          localStorage.setItem(STORAGE_KEY_ALL_ACCOUNTS, JSON.stringify([autoProvisionedAcc]));
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(authUser));
          localStorage.removeItem(`pending_reg_${cleanEmail}`);
        } catch {}

        return { success: true };
      }

      const unlinkedUser: AuthUser = {
        id: authUserId,
        name: profileData?.name || authData.user?.user_metadata?.name || cleanEmail.split('@')[0],
        email: authData.user?.email || cleanEmail,
        role: 'agent',
        accountId: '',
        accountName: 'Nenhuma empresa vinculada',
        phone: profileData?.phone,
        role_title: profileData?.role_title,
        bio: profileData?.bio,
        mood: profileData?.mood || 'Disponível',
        avatarUrl: profileData?.avatar_url,
      };

      setAvailableAccounts([]);
      setCurrentAccount(UNLINKED_ACCOUNT);
      setUser(unlinkedUser);
      return { success: true };
    } catch (directErr: any) {
      console.error('Erro na autenticação:', directErr);
      return {
        success: false,
        error: directErr?.message || 'Erro inesperado ao consultar o servidor.',
      };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_ACCOUNT);
    localStorage.removeItem(STORAGE_KEY_ALL_ACCOUNTS);
  };

  const switchAccount = (accountId: string) => {
    const target = availableAccounts.find((a) => a.id === accountId);
    if (!target) return;
    setCurrentAccount(target);
    if (user) {
      setUser({
        ...user,
        accountId: target.id,
        accountName: target.name,
      });
    }
  };

  // Atualizar perfil do usuário logado (persistido em public.profiles)
  const updateUserProfile = async (updates: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updated));
      return updated;
    });

    const targetUserId = user?.id;
    if (!targetUserId) return;

    try {
      await ensureSupabaseConfig();
      const payload: Record<string, any> = {
        id: targetUserId,
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.phone !== undefined) payload.phone = updates.phone;
      if (updates.role_title !== undefined) payload.role_title = updates.role_title;
      if (updates.bio !== undefined) payload.bio = updates.bio;
      if (updates.mood !== undefined) payload.mood = updates.mood;
      if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;

      const { error } = await supabase
        .from('profiles')
        .upsert(payload);

      if (error) {
        console.error('[Supabase] Erro ao salvar em public.profiles:', error.message);
      }
    } catch (err) {
      console.error('[Supabase] Falha ao atualizar public.profiles:', err);
    }
  };

  // Atualizar dados da conta atual (persiste em public.accounts e sincroniza contexto)
  const updateCurrentAccount = async (updates: Partial<Account>): Promise<{ success: boolean; error?: string }> => {
    if (!currentAccount?.id) {
      return { success: false, error: 'Nenhuma empresa ativa selecionada.' };
    }

    const updatedAccount: Account = { ...currentAccount, ...updates };

    // Atualiza estado local imediatamente para feedback reativo
    setCurrentAccount(updatedAccount);
    setAvailableAccounts((prevList) =>
      prevList.map((acc) => (acc.id === currentAccount.id ? { ...acc, ...updates } : acc))
    );
    try {
      localStorage.setItem(STORAGE_KEY_ACCOUNT, JSON.stringify(updatedAccount));
    } catch {}

    // Se o nome da empresa mudou, reflete em user.accountName
    if (updates.name && user) {
      const updatedUser: AuthUser = { ...user, accountName: updates.name };
      setUser(updatedUser);
      try {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
      } catch {}
    }

    try {
      await ensureSupabaseConfig();
      if (!isSupabaseConfigured) {
        return { success: true };
      }

      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Mapear todas as colunas existentes em public.accounts
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

      // Verificação de segurança prévia de duplicidade pelo WhatsApp comercial
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
              // Para números do Brasil (DDI 55), compara DDD + número
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

      // Se a confirmação de e-mail estiver ativa no projeto Supabase, a sessão vem nula
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
          // Se o banco ainda não recebeu a atualização com p_whatsapp_phone, chama versão com 3 params
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

      // Se a RPC detectar forte indício de empresa já cadastrada
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

      // 3. REIDRATAÇÃO DIRETA NO BANCO (NÃO DEPENDER SOMENTE DO RETORNO DA RPC):
      // Consulta novamente o banco usando exclusivamente: account_users.user_id = auth.user.id
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

      // Se a conta não apareceu ainda no select direto de account_users devido a atraso de replicação,
      // usa os dados retornados pela RPC transacional
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

      // Se o número de WhatsApp foi fornecido e a conta ainda não o possui preenchido, atualiza
      if (cleanWhatsappPhone && !targetAccount.whatsappPhone) {
        targetAccount.whatsappPhone = cleanWhatsappPhone;
        supabase
          .from('accounts')
          .update({ whatsapp_phone: cleanWhatsappPhone })
          .eq('id', targetAccount.id)
          .then(() => {});
      }

      const activeAccountsList = freshAccounts.length > 0 ? freshAccounts : [targetAccount];

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

      // Atualiza o estado da aplicação
      setAvailableAccounts(activeAccountsList);
      setCurrentAccount(targetAccount);
      setUser(registeredUser);

      // Persistência local no navegador
      try {
        localStorage.setItem(STORAGE_KEY_ACCOUNT, JSON.stringify(targetAccount));
        localStorage.setItem(STORAGE_KEY_ALL_ACCOUNTS, JSON.stringify(activeAccountsList));
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(registeredUser));
        localStorage.removeItem(`pending_reg_${cleanEmail}`);
      } catch {}

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
        isAuthenticated: !!user,
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
