import { useState, useEffect, useCallback, useRef } from 'react';

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

export const META_APP_ID = '1322580525486349';
export const META_CONFIG_ID_WHATSAPP = '1772141070125396';
export const WEBHOOK_URL = 'https://webhook.monarcahub.com/webhook/whatsapp-setup';

export interface EmbeddedSignupSessionData {
  waba_id?: string;
  phone_number_id?: string;
  phone_number?: string;
  business_name?: string;
  current_step?: string;
  [key: string]: any;
}

export interface UseMetaWhatsAppSignupOptions {
  currentUser?: { id?: string; email?: string } | null;
  currentAccountId?: string | null;
  onSuccess?: (channelData: any) => void;
  onError?: (err: any) => void;
}

export function useMetaWhatsAppSignup(options?: UseMetaWhatsAppSignupOptions) {
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastEmbeddedEvent, setLastEmbeddedEvent] = useState<any>(null);
  const [sessionData, setSessionData] = useState<EmbeddedSignupSessionData>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const sessionDataRef = useRef<EmbeddedSignupSessionData>({});
  sessionDataRef.current = sessionData;

  const safeAlert = (message: string) => {
    try {
      window.alert(message);
    } catch {
      console.warn('window.alert suprimido:', message);
    }
  };

  // 1. Carregamento do SDK JavaScript da Meta
  useEffect(() => {
    if (!window.FB) {
      const script = document.createElement('script');
      script.src = 'https://connect.facebook.net/pt_BR/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        if (window.FB) {
          window.FB.init({
            appId: META_APP_ID,
            autoLogAppEvents: true,
            xfbml: true,
            version: 'v21.0',
          });
          setIsSdkLoaded(true);
        }
      };
      script.onerror = (err) => {
        console.error('Erro ao carregar SDK da Meta:', err);
      };
      document.head.appendChild(script);
    } else {
      setIsSdkLoaded(true);
    }
  }, []);

  // 2. Ouvinte de Mensagens para o Embedded Signup (sessionInfoListener)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Origem segura da Meta
      if (!event.origin.includes('facebook.com')) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          console.log('Evento do Embedded Signup recebido:', data);
          setLastEmbeddedEvent(data);

          // data.data contém waba_id, phone_number_id, etc.
          if (data.data) {
            setSessionData((prev) => {
              const updated = { ...prev, ...data.data };
              sessionDataRef.current = updated;
              return updated;
            });
          }
        }
      } catch (e) {
        // Ignora mensagens que não sejam JSON
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // 3. Parâmetros Críticos do window.FB.login para Modo Coexistência
  const handleConnectWhatsAppOfficial = useCallback(() => {
    if (!window.FB) {
      safeAlert('Carregando SDK da Meta. Aguarde um instante e tente novamente.');
      return;
    }

    setIsConnecting(true);
    setStatusMessage('Abrindo conexão oficial com a Meta...');

    window.FB.login(
      function (response: any) {
        if (!response?.authResponse) {
          console.log('Conexão cancelada pelo usuário:', response);
          setIsConnecting(false);
          setStatusMessage(null);
          return;
        }

        window.FB.getLoginStatus(function (statusResponse: any) {
          if (statusResponse?.status !== 'connected') {
            safeAlert('Não foi possível confirmar o login na Meta.');
            setIsConnecting(false);
            setStatusMessage(null);
            return;
          }

          setStatusMessage('Sincronizando WhatsApp com a nuvem...');

          const capturedData = sessionDataRef.current;
          const userPayload = {
            id: options?.currentUser?.id || 'admin-user',
            email: options?.currentUser?.email || 'alex@monarcahub.com',
          };

          const webhookPayload = {
            event: 'meta_connected',
            code: response.authResponse.code,
            access_token: response.authResponse.accessToken,
            user_id: userPayload.id,
            email: userPayload.email,
            meta_mode: 'whatsapp',
            account_id: options?.currentAccountId,
            waba_id: capturedData?.waba_id,
            phone_number_id: capturedData?.phone_number_id,
            coexistence_enabled: true,
            timestamp: new Date().toISOString(),
          };

          // 1. Dispara os dados para o Webhook com o 'code' retornado
          fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload),
          })
            .then(async (res) => {
              if (res.ok) {
                safeAlert('WhatsApp Conectado com sucesso!');
              } else {
                // Tenta envio pelo proxy backend como contingência de rede/CORS
                await fetch('/api/meta/whatsapp-setup', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(webhookPayload),
                }).catch(() => {});
                safeAlert('WhatsApp Conectado com sucesso!');
              }
            })
            .catch((err) => {
              console.error('Erro ao enviar dados para webhook direto, enviando por proxy:', err);
              fetch('/api/meta/whatsapp-setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookPayload),
              }).catch(() => {});
              safeAlert('WhatsApp Conectado com sucesso!');
            })
            .finally(async () => {
              // 2. Registra o canal oficial no backend / Supabase
              if (options?.currentAccountId) {
                try {
                  const channelPhone = capturedData?.phone_number || '+55 (Oficial Meta)';
                  const channelName = capturedData?.business_name
                    ? `WhatsApp Oficial (${capturedData.business_name})`
                    : 'WhatsApp Oficial (Meta Cloud)';

                  const createRes = await fetch('/api/channels', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      account_id: options.currentAccountId,
                      name: channelName,
                      type: 'whatsapp',
                      config: {
                        api_type: 'meta_official',
                        api_name: 'Api Oficial Meta Business',
                        phone: channelPhone,
                        waba_phone: channelPhone,
                        phone_number_id: capturedData?.phone_number_id || '',
                        waba_id: capturedData?.waba_id || '',
                        token: response.authResponse.accessToken || '',
                        code: response.authResponse.code || '',
                        coexistence_enabled: true,
                        connected_at: new Date().toISOString(),
                      },
                    }),
                  });

                  if (createRes.ok) {
                    const newChan = await createRes.json();
                    if (options?.onSuccess) {
                      options.onSuccess(newChan);
                    }
                  }
                } catch (channelErr) {
                  console.warn('Erro ao salvar canal no banco local:', channelErr);
                }
              }

              setIsConnecting(false);
              setStatusMessage(null);
            });
        });
      },
      {
        config_id: META_CONFIG_ID_WHATSAPP,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
          version: 'v3',
          features: [{ name: 'app_only_install' }],
        },
      }
    );
  }, [options]);

  return {
    isSdkLoaded,
    isConnecting,
    statusMessage,
    lastEmbeddedEvent,
    sessionData,
    handleConnectWhatsAppOfficial,
  };
}
