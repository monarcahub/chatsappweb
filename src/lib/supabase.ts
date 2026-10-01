import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Variáveis de ambiente no padrão Vite
const metaEnv = (import.meta as any).env || {};
const buildUrl = metaEnv.VITE_SUPABASE_URL || '';
const buildAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';

// Limpeza automática de URL caso venha com /rest/v1 ou barra final
export const sanitizeSupabaseUrl = (url: string): string => {
  if (!url) return '';
  return url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
};

// Lê do build do Vite ou do cache dinâmico de runtime
let activeUrl =
  sanitizeSupabaseUrl(buildUrl) ||
  (typeof window !== 'undefined' ? localStorage.getItem('chatsapp_supabase_url') || '' : '');
let activeAnonKey =
  buildAnonKey.trim() ||
  (typeof window !== 'undefined' ? localStorage.getItem('chatsapp_supabase_anon_key') || '' : '');

export let isSupabaseConfigured = Boolean(
  activeUrl &&
  activeAnonKey &&
  activeUrl.startsWith('https://') &&
  !activeUrl.includes('your-project')
);

// Instanciação inicial segura
export let supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(activeUrl, activeAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-anon-key', {
      auth: { persistSession: false },
    });

/**
 * Garante que a configuração do Supabase esteja carregada.
 * Se as variáveis VITE_ não foram injetadas no build da Vercel (ex: salvas como Secret),
 * busca de /api/config dinamicamente no backend Serverless sem falhas.
 */
export async function ensureSupabaseConfig(): Promise<boolean> {
  if (isSupabaseConfigured) return true;

  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.supabaseUrl && data.supabaseAnonKey) {
        activeUrl = sanitizeSupabaseUrl(data.supabaseUrl);
        activeAnonKey = data.supabaseAnonKey.trim();
        isSupabaseConfigured = true;

        if (typeof window !== 'undefined') {
          localStorage.setItem('chatsapp_supabase_url', activeUrl);
          localStorage.setItem('chatsapp_supabase_anon_key', activeAnonKey);
        }

        supabase = createClient(activeUrl, activeAnonKey, {
          realtime: {
            params: {
              eventsPerSecond: 10,
            },
          },
        });
        return true;
      }
    }
  } catch (e) {
    console.warn('Erro ao consultar /api/config:', e);
  }

  return isSupabaseConfigured;
}

// Execução imediata no carregamento para autoconfiguração rápida
if (typeof window !== 'undefined' && !isSupabaseConfigured) {
  ensureSupabaseConfig().catch(() => {});
}

/**
 * Helper para verificar conectividade com o Supabase
 */
export async function checkSupabaseConnection(): Promise<{
  connected: boolean;
  error?: string;
}> {
  await ensureSupabaseConfig();

  if (!isSupabaseConfigured) {
    return {
      connected: false,
      error: 'Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não configuradas',
    };
  }

  try {
    const { error } = await supabase.from('channels').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      return { connected: false, error: error.message };
    }
    return { connected: true };
  } catch (err: any) {
    return { connected: false, error: err?.message || 'Falha de conexão com o banco de dados' };
  }
}
