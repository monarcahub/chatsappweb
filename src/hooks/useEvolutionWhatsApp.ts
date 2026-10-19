import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured, ensureSupabaseConfig } from '../lib/supabase';

export const EVOLUTION_WEBHOOK_URL = 'https://webhook.monarcahub.com/webhook/evo-manager-v4all';

export type EvolutionState = 'open' | 'connected' | 'close' | 'connecting' | 'disconnected' | 'unknown';

export interface EvolutionActionResponse {
  success?: boolean;
  status?: string;
  state?: string;
  raw_state?: string;
  instanceName?: string;
  base64?: string;
  qrCodeBase64?: string;
  qrcode?: string;
  qr?: string;
  data?: any;
  body?: any;
  [key: string]: any;
}

export interface UseEvolutionWhatsAppOptions {
  userEmail?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  onSuccess?: (channelData: any) => void;
  onError?: (err: any) => void;
}

/**
 * Sanitiza o nome da instância a partir do e-mail do usuário (apenas letras minúsculas e números)
 */
export function sanitizeEvolutionInstanceName(email: string = '', branchId?: string): string {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const base = cleanEmail.split('@')[0]?.replace(/[^a-zA-Z0-9]/g, '') || 'instancia';
  if (branchId) {
    const cleanBranch = branchId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `${base}_${cleanBranch}`;
  }
  return base;
}

/**
 * Extrai imagem Base64 do QR Code a partir de múltiplos formatos possíveis de payload
 */
export function extractQrCodeBase64(payload: any): string {
  if (!payload) return '';
  const rawBase64 =
    payload?.base64 ??
    payload?.qrCodeBase64 ??
    payload?.qrcode ??
    payload?.qr ??
    payload?.data?.base64 ??
    payload?.data?.qrcode?.base64 ??
    payload?.data?.qrcode ??
    payload?.data?.qr ??
    payload?.body?.base64 ??
    payload?.body?.qrcode;

  if (!rawBase64 || typeof rawBase64 !== 'string') return '';
  return rawBase64.startsWith('data:image') ? rawBase64 : `data:image/png;base64,${rawBase64}`;
}

/**
 * Hook oficial do ChatsApp para gerenciamento da Evolution API (WhatsApp QR Code)
 */
export function useEvolutionWhatsApp(options?: UseEvolutionWhatsAppOptions) {
  const [instanceName, setInstanceName] = useState<string>(() =>
    sanitizeEvolutionInstanceName(options?.userEmail || '')
  );
  const [channelName, setChannelName] = useState<string>('WhatsApp Comercial (QR)');
  const [branchSuffix, setBranchSuffix] = useState<string>('');

  // Estados de Conexão
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isLoadingQr, setIsLoadingQr] = useState(false);
  const [qrCodeSrc, setQrCodeSrc] = useState<string>('');
  const [whatsappUnofficialStatus, setWhatsappUnofficialStatus] = useState<EvolutionState>('disconnected');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Referência para o polling de 5 segundos
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);

  // Atualiza nome da instância caso o e-mail mude
  useEffect(() => {
    if (options?.userEmail) {
      setInstanceName(sanitizeEvolutionInstanceName(options.userEmail, branchSuffix));
    }
  }, [options?.userEmail, branchSuffix]);

  // Limpa intervalo ao desmontar
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  /**
   * Envia requisição padronizada para o Webhook Gerenciador da Evolution
   */
  const callEvolutionManager = useCallback(
    async (action: string, targetInstanceName?: string): Promise<EvolutionActionResponse> => {
      const instName = targetInstanceName || instanceName;
      const body = {
        action,
        instanceName: instName,
        instance: { state: action },
      };

      try {
        // Tenta chamada direta (CORS habilitado no webhook.monarcahub.com)
        const res = await fetch(EVOLUTION_WEBHOOK_URL, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          return data;
        }

        // Fallback para rota proxy do backend se houver bloqueio de rede no cliente
        const proxyRes = await fetch('/api/evolution/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (proxyRes.ok) {
          return await proxyRes.json().catch(() => ({}));
        }

        return { success: false, status: 'error', error: `Erro HTTP ${res.status}` };
      } catch (err: any) {
        console.warn(`[Evolution Manager] Erro na ação ${action}:`, err);
        return { success: false, status: 'error', error: err?.message || 'Falha de conexão' };
      }
    },
    [instanceName]
  );

  /**
   * Salva ou atualiza o canal na tabela 'channels' do Supabase como conectado
   */
  const persistConnectedChannel = useCallback(
    async (finalInstanceName: string, nameToSave?: string, phoneToSave?: string) => {
      if (!options?.accountId || options.accountId === 'all') return;

      try {
        await ensureSupabaseConfig();

        const chName = nameToSave || channelName || 'WhatsApp QR';
        const channelConfig: Record<string, any> = {
          api_type: 'evolution_qr',
          instance_name: finalInstanceName,
          provider: 'Api Padrão',
          status: 'connected',
          coexistence_enabled: false,
          ai_enabled: true,
          updated_at: new Date().toISOString(),
        };

        if (phoneToSave) {
          channelConfig.phone = phoneToSave;
          channelConfig.waba_phone = phoneToSave;
        }

        let saved = false;
        let targetChannelId: string | null = null;

        // 1. Tenta salvar diretamente no Supabase
        if (isSupabaseConfigured) {
          const { data: existing } = await supabase
            .from('channels')
            .select('id, config')
            .eq('account_id', options.accountId)
            .eq('type', 'whatsapp');

          if (existing && existing.length > 0) {
            const match = existing.find(
              (c: any) =>
                c.config?.instance_name === finalInstanceName ||
                c.config?.api_type === 'evolution_qr' ||
                c.config?.api_type === 'monarcahub_standard'
            );
            if (match) targetChannelId = match.id;
          }

          if (targetChannelId) {
            const { error: updErr } = await supabase
              .from('channels')
              .update({
                name: chName,
                is_active: true,
                config: channelConfig,
              })
              .eq('id', targetChannelId);
            if (!updErr) saved = true;
          } else {
            const { data: insData, error: insErr } = await supabase
              .from('channels')
              .insert({
                account_id: options.accountId,
                name: chName,
                type: 'whatsapp',
                is_active: true,
                config: channelConfig,
              })
              .select('id')
              .single();
            if (!insErr) {
              saved = true;
              if (insData?.id) targetChannelId = insData.id;
            }
          }
        }

        // 2. Fallback para rota /api/channels
        if (!saved) {
          const apiRes = await fetch('/api/channels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              account_id: options.accountId,
              name: chName,
              type: 'whatsapp',
              config: channelConfig,
            }),
          }).catch(() => null);

          if (apiRes && apiRes.ok) {
            const apiData = await apiRes.json().catch(() => null);
            if (apiData?.channel?.id) {
              targetChannelId = apiData.channel.id;
            }
          }
        }

        if (options?.onSuccess) {
          options.onSuccess({ instanceName: finalInstanceName, name: chName, channelId: targetChannelId });
        }
      } catch (e) {
        console.warn('[Evolution] Erro ao persistir canal conectado:', e);
      }
    },
    [options, channelName]
  );

  /**
   * Desativa o canal no banco de dados após logout
   */
  const deactivateChannelInDb = useCallback(
    async (targetInstanceName: string) => {
      if (!options?.accountId || options.accountId === 'all') return;
      try {
        await ensureSupabaseConfig();
        if (!isSupabaseConfigured) return;

        const { data: existing } = await supabase
          .from('channels')
          .select('id, config')
          .eq('account_id', options.accountId)
          .eq('type', 'whatsapp');

        if (existing && existing.length > 0) {
          for (const ch of existing) {
            if (
              ch.config?.instance_name === targetInstanceName ||
              ch.config?.api_type === 'evolution_qr'
            ) {
              await supabase
                .from('channels')
                .update({
                  is_active: false,
                  config: { ...ch.config, status: 'disconnected' },
                })
                .eq('id', ch.id);
            }
          }
        }
      } catch (e) {
        console.warn('[Evolution] Erro ao desativar canal no banco:', e);
      }
    },
    [options?.accountId]
  );

  /**
   * Limpa o polling de status
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    isConnectingRef.current = false;
  }, []);

  /**
   * Inicia o polling automático a cada 5 segundos
   */
  const startPolling = useCallback(
    (targetInstanceName: string, customChannelName?: string, customPhone?: string) => {
      stopPolling();
      isConnectingRef.current = true;

      pollingIntervalRef.current = setInterval(async () => {
        try {
          const res = await callEvolutionManager('status', targetInstanceName);
          const rawStatus = (res?.status || res?.state || res?.raw_state || '').toLowerCase();

          // Se a resposta trouxer uma atualização do QR Code em Base64, atualiza
          const updatedQr = extractQrCodeBase64(res);
          if (updatedQr) {
            setQrCodeSrc(updatedQr);
          }

          // Quando conectado ("open" ou "connected")
          if (rawStatus === 'open' || rawStatus === 'connected') {
            stopPolling();
            setWhatsappUnofficialStatus('connected');
            setStatusMessage('WhatsApp Conectado com sucesso!');
            setActionSuccessMessage('WhatsApp Conectado com sucesso!');

            // Persiste no banco de dados como canal ativo
            await persistConnectedChannel(targetInstanceName, customChannelName, customPhone);

            // Fecha o modal automaticamente após 2 segundos
            setTimeout(() => {
              setIsQrModalOpen(false);
              setQrCodeSrc('');
              setActionSuccessMessage(null);
            }, 2000);
          } else if (rawStatus === 'close' || rawStatus === 'disconnected') {
            setWhatsappUnofficialStatus('disconnected');
          } else if (rawStatus === 'connecting') {
            setWhatsappUnofficialStatus('connecting');
          }
        } catch (err) {
          console.warn('[Evolution Polling] Erro ao consultar status:', err);
        }
      }, 5000);
    },
    [callEvolutionManager, persistConnectedChannel, stopPolling]
  );

  /**
   * Fluxo Completo de Conexão com QR Code
   * 1. Abre o Modal com loading "Gerando QR Code..."
   * 2. Chama action: "create"
   * 3. Aguarda ~1 segundo e chama action: "qr"
   * 4. Se não vier no "qr", consulta imediatamente action: "status"
   * 5. Renderiza a imagem e inicia o polling a cada 5 segundos
   */
  const startConnectionFlow = useCallback(
    async (customInstanceName?: string, customChannelName?: string, customPhone?: string) => {
      const targetInstance = customInstanceName || instanceName;
      if (!targetInstance) return;

      if (customInstanceName) setInstanceName(customInstanceName);
      if (customChannelName) setChannelName(customChannelName);

      setIsQrModalOpen(true);
      setIsLoadingQr(true);
      setQrCodeSrc('');
      setStatusMessage('Inicializando instância e gerando QR Code...');
      setWhatsappUnofficialStatus('connecting');

      try {
        // Passo 1: Chama action: "create"
        await callEvolutionManager('create', targetInstance);

        // Passo 2: Aguarda ~1 segundo
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Passo 3: Chama action: "qr"
        const qrRes = await callEvolutionManager('qr', targetInstance);
        let base64Img = extractQrCodeBase64(qrRes);

        // Passo 4: Se não vier no qr, consulta imediatamente action: "status"
        if (!base64Img) {
          const statusRes = await callEvolutionManager('status', targetInstance);
          base64Img = extractQrCodeBase64(statusRes);

          const rawStatus = (statusRes?.status || statusRes?.state || statusRes?.raw_state || '').toLowerCase();
          if (rawStatus === 'open' || rawStatus === 'connected') {
            setWhatsappUnofficialStatus('connected');
            setStatusMessage('WhatsApp já está Conectado!');
            setIsLoadingQr(false);
            await persistConnectedChannel(targetInstance, customChannelName, customPhone);
            setTimeout(() => setIsQrModalOpen(false), 1500);
            return;
          }
        }

        if (base64Img) {
          setQrCodeSrc(base64Img);
          setStatusMessage('Aponte a câmera do WhatsApp para o QR Code abaixo:');
        } else {
          setStatusMessage('Aguardando servidor liberar o QR Code...');
        }

        setIsLoadingQr(false);

        // Passo 5: Inicia o Polling de 5 segundos
        startPolling(targetInstance, customChannelName, customPhone);
      } catch (err: any) {
        setIsLoadingQr(false);
        setStatusMessage('Falha ao gerar QR Code. Tente novamente.');
        if (options?.onError) options.onError(err);
      }
    },
    [instanceName, callEvolutionManager, startPolling, persistConnectedChannel, options]
  );

  /**
   * Recarrega manualmente o QR Code dentro do modal
   */
  const refreshQrCode = useCallback(async () => {
    setIsLoadingQr(true);
    setStatusMessage('Atualizando QR Code...');
    try {
      const qrRes = await callEvolutionManager('qr', instanceName);
      let base64Img = extractQrCodeBase64(qrRes);
      if (!base64Img) {
        const statusRes = await callEvolutionManager('status', instanceName);
        base64Img = extractQrCodeBase64(statusRes);
      }
      if (base64Img) {
        setQrCodeSrc(base64Img);
        setStatusMessage('QR Code atualizado com sucesso! Escaneie pelo WhatsApp:');
      }
    } catch {
      setStatusMessage('Erro ao atualizar QR Code. Tente novamente.');
    } finally {
      setIsLoadingQr(false);
    }
  }, [callEvolutionManager, instanceName]);

  /**
   * Botão "Verificar Conexão" (chama action: "status")
   */
  const checkStatus = useCallback(
    async (targetInstance?: string) => {
      const inst = targetInstance || instanceName;
      setIsActionLoading(true);
      try {
        const res = await callEvolutionManager('status', inst);
        const rawStatus = (res?.status || res?.state || res?.raw_state || '').toLowerCase();

        if (rawStatus === 'open' || rawStatus === 'connected') {
          setWhatsappUnofficialStatus('connected');
          setActionSuccessMessage('Instância Conectada e Online!');
        } else {
          setWhatsappUnofficialStatus('disconnected');
          setActionSuccessMessage('Instância Desconectada ou Fechada.');
        }

        setTimeout(() => setActionSuccessMessage(null), 3000);
        return rawStatus;
      } catch {
        setWhatsappUnofficialStatus('unknown');
      } finally {
        setIsActionLoading(false);
      }
    },
    [callEvolutionManager, instanceName]
  );

  /**
   * Botão "Reiniciar" (chama action: "restart")
   */
  const restartInstance = useCallback(
    async (targetInstance?: string) => {
      const inst = targetInstance || instanceName;
      setIsActionLoading(true);
      try {
        await callEvolutionManager('restart', inst);
        setActionSuccessMessage('Instância do WhatsApp reiniciada com sucesso!');
        setTimeout(() => setActionSuccessMessage(null), 3000);
        await checkStatus(inst);
      } catch (e: any) {
        console.warn('Erro ao reiniciar:', e);
      } finally {
        setIsActionLoading(false);
      }
    },
    [callEvolutionManager, instanceName, checkStatus]
  );

  /**
   * Botão "Desconectar" (chama action: "logout")
   */
  const logoutInstance = useCallback(
    async (targetInstance?: string) => {
      const inst = targetInstance || instanceName;
      setIsActionLoading(true);
      stopPolling();
      try {
        await callEvolutionManager('logout', inst);
        setWhatsappUnofficialStatus('disconnected');
        setQrCodeSrc('');
        setActionSuccessMessage('WhatsApp desconectado com sucesso.');
        await deactivateChannelInDb(inst);
        setTimeout(() => setActionSuccessMessage(null), 3000);
      } catch (e: any) {
        console.warn('Erro ao desconectar:', e);
      } finally {
        setIsActionLoading(false);
      }
    },
    [callEvolutionManager, instanceName, stopPolling, deactivateChannelInDb]
  );

  /**
   * Fecha o modal de QR Code e para o polling
   */
  const closeQrModal = useCallback(() => {
    setIsQrModalOpen(false);
    stopPolling();
  }, [stopPolling]);

  return {
    instanceName,
    setInstanceName,
    channelName,
    setChannelName,
    branchSuffix,
    setBranchSuffix,
    // Modal & QR Code
    isQrModalOpen,
    isLoadingQr,
    qrCodeSrc,
    whatsappUnofficialStatus,
    statusMessage,
    actionSuccessMessage,
    isActionLoading,
    // Ações
    startConnectionFlow,
    refreshQrCode,
    checkStatus,
    restartInstance,
    logoutInstance,
    closeQrModal,
  };
}
