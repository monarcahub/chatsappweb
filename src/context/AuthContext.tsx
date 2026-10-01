import React, { createContext, useContext, useState, useEffect } from 'react';
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
  registerAccount: (accountName: string, segment: string, adminName: string, email: string, password: string) => Promise<{ success: boolean; account?: Account; error?: string }>;
  updateUserProfile: (updates: Partial<AuthUser>) => void;
  updateCurrentAccount: (updates: Partial<Account>) => void;
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
      if (!user?.id) return;
      try {
        await ensureSupabaseConfig();
        if (!isSupabaseConfigured) return;

        const { data: userRows, error } = await supabase
          .from('account_users')
          .select('*, accounts(*)')
          .eq('user_id', user.id);

        if (!error && userRows) {
          const userAccounts: Account[] = userRows
            .map((r: any) => r.accounts)
            .filter((a: any) => Boolean(a && a.id))
            .map((a: any) => ({
              id: a.id,
              name: a.name,
              slug: a.slug,
              segment: a.segment,
              whatsappPhone: a.whatsapp_phone || '',
              plan: a.plan || 'Plano Pro Omnichannel',
              createdAt: a.created_at,
            }));

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
              return exists ? prev : userAccounts[0];
            });
          } else {
            // Nenhuma conta vinculada a este usuário no banco de dados
            setAvailableAccounts([]);
            setCurrentAccount(UNLINKED_ACCOUNT);
          }
        }
      } catch (err) {
        console.warn('Erro ao sincronizar empresas do usuário no AuthContext:', err);
      }
    };

    syncUserAccountsFromDb();
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
          error: 'Identificador de usuário não retornado pelo Supabase Auth.',
        };
      }

      const { data: userRows, error: userErr } = await supabase
        .from('account_users')
        .select('*, accounts(*)')
        .eq('user_id', authUserId);

      const validAccounts: Account[] = (userRows || [])
        .map((r: any) => r.accounts)
        .filter((accRow: any) => Boolean(accRow && accRow.id))
        .map((accRow: any) => ({
          id: accRow.id,
          name: accRow.name,
          slug: accRow.slug,
          segment: accRow.segment,
          whatsappPhone: accRow.whatsapp_phone || '',
          plan: accRow.plan || 'Plano Pro Omnichannel',
          createdAt: accRow.created_at,
        }));

      if (validAccounts.length > 0) {
        const primaryAcc = validAccounts[0];
        const primaryUserRow = userRows?.find((r: any) => r.accounts?.id === primaryAcc.id) || userRows?.[0];

        const authUser: AuthUser = {
          id: authUserId,
          name: primaryUserRow?.name || authData.user?.user_metadata?.name || 'Administrador',
          email: primaryUserRow?.email || cleanEmail,
          role: primaryUserRow?.role || 'admin',
          accountId: primaryAcc.id,
          accountName: primaryAcc.name,
          avatarUrl: primaryUserRow?.avatar_url,
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
      // NÃO atribui nenhuma empresa automaticamente (evita vazamento de tenant entre usuários)
      const unlinkedUser: AuthUser = {
        id: authUserId,
        name: authData.user?.user_metadata?.name || cleanEmail.split('@')[0],
        email: cleanEmail,
        role: 'agent',
        accountId: '',
        accountName: 'Nenhuma empresa vinculada',
      };

      setAvailableAccounts([]);
      setCurrentAccount(UNLINKED_ACCOUNT);
      setUser(unlinkedUser);
      return { success: true };
    } catch (directErr: any) {
      console.error('Erro na autenticação direta do Supabase:', directErr);
      return {
        success: false,
        error: directErr?.message || 'Erro inesperado ao consultar o Supabase.',
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

  // Atualizar perfil do usuário logado (ex: foto de perfil personalizada)
  const updateUserProfile = (updates: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updated));
      return updated;
    });
  };

  // Atualizar dados da conta atual (ex: telefone, email, nome)
  const updateCurrentAccount = (updates: Partial<Account>) => {
    setCurrentAccount((prev) => {
      const updated = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY_ACCOUNT, JSON.stringify(updated));
      return updated;
    });
    setAvailableAccounts((prevList) =>
      prevList.map((acc) => (acc.id === currentAccount.id ? { ...acc, ...updates } : acc))
    );
  };

  // Cadastro de nova empresa com senha obrigatória: grava no Supabase (accounts + account_users + auth.users)
  const registerAccount = async (
    accountName: string,
    segment: string,
    adminName: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; account?: Account; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: accountName.trim(),
          companySegment: segment.trim() || 'Serviços & Atendimento',
          adminName: adminName.trim() || 'Administrador',
          email: cleanEmail,
          password: password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.account && data.user) {
        const registeredAcc: Account = {
          id: data.account.id,
          name: data.account.name,
          slug: data.account.slug,
          segment: data.account.segment,
          whatsappPhone: data.account.whatsappPhone || '',
          plan: data.account.plan || 'Plano Pro Omnichannel',
          createdAt: data.account.createdAt,
        };

        const registeredUser: AuthUser = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role || 'admin',
          accountId: registeredAcc.id,
          accountName: registeredAcc.name,
        };

        // O novo usuário vê APENAS a sua própria empresa (isolamento rigoroso)
        setAvailableAccounts([registeredAcc]);
        setCurrentAccount(registeredAcc);
        setUser(registeredUser);

        return { success: true, account: registeredAcc };
      } else {
        return {
          success: false,
          error: data.error || 'Erro ao realizar cadastro da empresa.',
        };
      }
    } catch (err: any) {
      console.warn('Erro ao chamar /api/auth/register:', err);
      return {
        success: false,
        error: 'Erro de conexão ao registrar empresa.',
      };
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
