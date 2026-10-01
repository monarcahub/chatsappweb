// =========================================================================
// SISTEMA DE NOTIFICAÇÕES (ÁUDIO SYNTHESIZER WHATSAPP + NOTIFICATION API)
// =========================================================================

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Desbloqueia o AudioContext no primeiro gesto do usuário (requisito de autoplay dos navegadores)
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch {}
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { once: true, passive: true });
  window.addEventListener('keydown', unlockAudio, { once: true, passive: true });
  window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
}

// Chaves de preferência no LocalStorage
const SOUND_ENABLED_KEY = 'chatsapp_sound_enabled';
const DESKTOP_ENABLED_KEY = 'chatsapp_desktop_enabled';

export function isSoundNotificationEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem(SOUND_ENABLED_KEY);
  return val === null ? true : val !== 'false';
}

export function setSoundNotificationEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SOUND_ENABLED_KEY, enabled ? 'true' : 'false');
}

export function isDesktopNotificationPrefEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem(DESKTOP_ENABLED_KEY);
  return val === null ? true : val !== 'false';
}

export function setDesktopNotificationPrefEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DESKTOP_ENABLED_KEY, enabled ? 'true' : 'false');
}

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  try {
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setDesktopNotificationPrefEnabled(true);
    }
    return permission;
  } catch (err) {
    console.warn('[Notification] Erro ao solicitar permissão de notificação no navegador:', err);
    try {
      return Notification.permission;
    } catch {
      return 'denied';
    }
  }
}

/**
 * Reproduz o toque sonoro característico de nova mensagem do WhatsApp
 * Sintetizado via Web Audio API para funcionar 100% offline, sem falhas de rede ou CORS.
 * Dual-tone suave: E5 (659.25Hz) seguido de A5 (880Hz)
 */
export function playIncomingNotificationSound(): void {
  try {
    if (!isSoundNotificationEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Primeiro tom suave (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    
    // Envelope ADSR rápido
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.25, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.16);

    // Segundo tom harmônico (880 Hz) ligeiramente sobreposto
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.08);

    gain2.gain.setValueAtTime(0.001, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.32, now + 0.11);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.45);
  } catch (err) {
    console.warn('[Notification] Não foi possível reproduzir som de notificação:', err);
  }
}

/**
 * Som sutil de confirmação de envio (Outgoing Message Click)
 */
export function playOutgoingNotificationSound(): void {
  try {
    if (!isSoundNotificationEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.06);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  } catch (err) {
    console.warn('[Notification] Não foi possível reproduzir som de envio:', err);
  }
}

export interface ShowNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  conversationId?: string;
  channel?: string;
  onClick?: () => void;
}

/**
 * Dispara uma notificação nativa da área de trabalho do sistema operacional
 * e dispara o evento in-app para exibição de balão visual flutuante e som.
 */
export function showDesktopNotification(options: ShowNotificationOptions): void {
  const { title, body, icon, conversationId, channel, onClick } = options;

  // 1. Reproduz o áudio de mensagem
  playIncomingNotificationSound();

  // 2. Dispara evento in-app para toasts / badges / balões visuais
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('chatsapp:new_incoming_message', {
        detail: {
          conversationId,
          title,
          body,
          icon,
          channel: channel || 'whatsapp',
          timestamp: new Date().toISOString(),
        },
      })
    );
  }

  // 3. Verifica permissão de notificação da área de trabalho nativa do SO
  if (
    !isBrowserNotificationSupported() ||
    getBrowserNotificationPermission() !== 'granted' ||
    !isDesktopNotificationPrefEnabled()
  ) {
    return;
  }

  try {
    const notification = new Notification(title, {
      body: body || 'Nova mensagem recebida',
      icon: icon || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120',
      tag: `chatsapp-${conversationId || 'new'}`,
      silent: true, // Já reproduzimos nosso som Web Audio sintetizado
    });

    notification.onclick = (e) => {
      e.preventDefault();
      window.focus();
      onClick?.();
      notification.close();
    };

    // Fecha automaticamente após 6 segundos
    setTimeout(() => {
      try {
        notification.close();
      } catch {}
    }, 6000);
  } catch (err) {
    console.warn('[Notification] Erro ao exibir notificação nativa do SO:', err);
  }
}

/**
 * Dispara um teste completo do sistema de notificações (som + banner in-app + desktop se ativo)
 */
export function testNotificationSystem(): void {
  showDesktopNotification({
    title: '🔔 Teste de Notificação ChatsApp',
    body: 'O sistema de notificações de novas mensagens está ativo e funcionando perfeitamente!',
    conversationId: 'test',
  });
}
