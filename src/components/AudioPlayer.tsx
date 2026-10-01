import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Download, ExternalLink, Mic, Loader2, AlertCircle } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  duration?: string;
  senderType?: string;
  isMe?: boolean;
  darkMode?: boolean;
  messageId?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  duration = '0:06',
  senderType = 'contact',
  isMe = false,
  darkMode = true,
  messageId,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeUrl, setActiveUrl] = useState<string>('');
  const [attemptedFallback, setAttemptedFallback] = useState(false);

  // Determina a URL ideal para o áudio (.ogg / .opus / .mp3 / .wav)
  // Se for uma URL externa http/https, usa o proxy do servidor para garantir CORS e MIME headers
  const getInitialPlayUrl = useCallback((rawUrl: string) => {
    if (!rawUrl) return '';
    const cleanUrl = rawUrl.trim();

    // Se já for data URI ou blob ou rota local
    if (cleanUrl.startsWith('data:') || cleanUrl.startsWith('blob:') || cleanUrl.startsWith('/')) {
      return cleanUrl;
    }

    // Se for URL externa, usar o proxy da aplicação que entrega com CORS e MIME correto
    if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
      // Verifica se o navegador suporta OGG nativamente
      const testAudio = typeof document !== 'undefined' ? document.createElement('audio') : null;
      const canPlayOgg = testAudio?.canPlayType('audio/ogg; codecs=opus') || testAudio?.canPlayType('audio/ogg');

      // Se for Safari/iOS (sem suporte nativo a ogg) e o arquivo for .ogg/.opus, solicita transcodificação em MP3 direto
      const isOggFile = /\.og[ga]|\.opus/i.test(cleanUrl);
      if (isOggFile && !canPlayOgg) {
        return `/api/audio-proxy?url=${encodeURIComponent(cleanUrl)}&format=mp3`;
      }

      return `/api/audio-proxy?url=${encodeURIComponent(cleanUrl)}`;
    }

    return cleanUrl;
  }, []);

  // Inicializa URL
  useEffect(() => {
    setHasError(false);
    setErrorMessage('');
    setAttemptedFallback(false);
    setActiveUrl(getInitialPlayUrl(src));
  }, [src, getInitialPlayUrl]);

  // Global Audio Coordinator: Quando qualquer áudio der Play, pausa os outros
  useEffect(() => {
    const handleGlobalPlay = (e: Event) => {
      const customEvent = e as CustomEvent<{ playerId: string }>;
      if (customEvent.detail?.playerId !== (messageId || src)) {
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      }
    };

    window.addEventListener('chatsapp:audio:play', handleGlobalPlay);
    return () => {
      window.removeEventListener('chatsapp:audio:play', handleGlobalPlay);
    };
  }, [messageId, src]);

  // Formata segundos para MM:SS
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Toca um tom agradável quando for nota simulada ou sem URL real
  const playSynthesizedChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  };

  // Alterna Play/Pause
  const togglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Se for áudio simulado (sem URL válida na web)
    if (!activeUrl) {
      if (isPlaying) {
        setIsPlaying(false);
      } else {
        setIsPlaying(true);
        playSynthesizedChime();
        const targetSec = effectiveDuration || 6;
        let step = 0;
        const timer = setInterval(() => {
          step += 0.25;
          setCurrentTime(step);
          if (step >= targetSec) {
            clearInterval(timer);
            setIsPlaying(false);
            setCurrentTime(0);
          }
        }, 250);
      }
      return;
    }

    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        setIsLoading(true);
        setHasError(false);

        // Notifica outros players para pausarem
        window.dispatchEvent(
          new CustomEvent('chatsapp:audio:play', {
            detail: { playerId: messageId || src },
          })
        );

        await audioRef.current.play();
        setIsPlaying(true);
        setIsLoading(false);
      } catch (err: any) {
        console.warn('[Audio Player] Erro ao reproduzir diretamente:', err.message);
        setIsLoading(false);

        // Se falhou e ainda não tentou a transcodificação para MP3 no servidor (ex: Safari)
        if (!attemptedFallback && src.startsWith('http')) {
          setAttemptedFallback(true);
          const fallbackUrl = `/api/audio-proxy?url=${encodeURIComponent(src)}&format=mp3`;
          setActiveUrl(fallbackUrl);
        } else {
          setHasError(true);
          setErrorMessage('Não foi possível reproduzir este áudio');
          setIsPlaying(false);
        }
      }
    }
  };

  // Clique na barra de progresso para avançar / retroceder
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!progressBarRef.current || !audioRef.current) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));

    const targetTime = (totalDuration || 6) * percentage;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  // Alterna velocidade de reprodução (1x -> 1.5x -> 2x)
  const toggleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const speeds = [1, 1.5, 2];
    const nextIndex = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  // Alterna mute
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Erro do elemento de áudio
  const handleAudioError = () => {
    setIsLoading(false);
    setIsPlaying(false);

    // Se o formato original .ogg falhou no navegador, tenta automaticamente via proxy MP3
    if (!attemptedFallback && src.startsWith('http')) {
      setAttemptedFallback(true);
      const fallbackUrl = `/api/audio-proxy?url=${encodeURIComponent(src)}&format=mp3`;
      setActiveUrl(fallbackUrl);
    } else {
      setHasError(true);
      setErrorMessage('Formato incompatível ou arquivo indisponível');
    }
  };

  // Parser de duração passada por prop (ex: "0:42" ou "1:15")
  const parsedPropDuration = (() => {
    if (!duration || typeof duration !== 'string') return 0;
    const parts = duration.split(':');
    if (parts.length === 2) {
      const m = parseInt(parts[0], 10);
      const s = parseInt(parts[1], 10);
      if (!isNaN(m) && !isNaN(s)) return m * 60 + s;
    }
    return 0;
  })();

  const effectiveDuration = totalDuration > 0 ? totalDuration : parsedPropDuration || 6;
  const progressPercent = Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100));

  // Gera pequenas barras para o waveform simulado estilo WhatsApp
  const waveformHeights = [
    40, 65, 85, 50, 95, 75, 45, 60, 90, 100, 70, 50, 80, 90, 60, 45, 70, 85, 60, 40,
  ];

  return (
    <div
      className={`flex flex-col py-1.5 px-1 min-w-[240px] max-w-[320px] rounded-lg select-none transition-colors ${
        darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'
      }`}
    >
      {/* Elemento de áudio invisível */}
      <audio
        ref={audioRef}
        src={activeUrl}
        preload="metadata"
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            const d = audioRef.current.duration;
            if (isFinite(d) && d > 0) {
              setTotalDuration(d);
            }
          }
        }}
        onDurationChange={() => {
          if (audioRef.current) {
            const d = audioRef.current.duration;
            if (isFinite(d) && d > 0) {
              setTotalDuration(d);
            }
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
          }
        }}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onError={handleAudioError}
      />

      <div className="flex items-center gap-3">
        {/* Botão Play / Pause */}
        <button
          type="button"
          onClick={togglePlay}
          disabled={isLoading && !isPlaying}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-transform active:scale-95 cursor-pointer ${
            hasError
              ? 'bg-amber-600/80 hover:bg-amber-600 text-white'
              : isMe
              ? 'bg-[#00a884] hover:bg-[#008f6f] text-white'
              : 'bg-[#00a884] hover:bg-[#008f6f] text-white'
          }`}
          title={hasError ? 'Tentar novamente' : isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : hasError ? (
            <RotateCcw className="w-4 h-4" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Barra de Progresso e Waveform */}
        <div className="flex-1 flex flex-col justify-center min-w-0">
          <div
            ref={progressBarRef}
            onClick={handleSeek}
            className="relative h-6 flex items-center gap-[2px] cursor-pointer group py-1"
            title="Clique para avançar ou retroceder"
          >
            {/* Barras de Waveform do WhatsApp */}
            <div className="w-full flex items-center justify-between gap-[2px] h-full">
              {waveformHeights.map((h, i) => {
                const barPercent = (i / waveformHeights.length) * 100;
                const isPassed = progressPercent >= barPercent;

                return (
                  <div
                    key={i}
                    style={{ height: `${h}%` }}
                    className={`w-1 rounded-full transition-all duration-100 ${
                      isPassed
                        ? 'bg-[#00a884]'
                        : darkMode
                        ? 'bg-[#8696a0]/40 group-hover:bg-[#8696a0]/60'
                        : 'bg-[#667781]/30 group-hover:bg-[#667781]/50'
                    }`}
                  />
                );
              })}
            </div>

            {/* Marcador de posição da reprodução */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#00a884] shadow-md pointer-events-none transition-all duration-75"
              style={{ left: `calc(${progressPercent}% - 5px)` }}
            />
          </div>

          {/* Rodapé do áudio: Tempo, Velocidade e Ações */}
          <div className="flex justify-between items-center text-[11px] mt-0.5">
            <span className={darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}>
              {isPlaying ? formatTime(currentTime) : totalDuration > 0 ? formatTime(totalDuration) : duration}
            </span>

            <div className="flex items-center gap-2">
              {/* Seletor de Velocidade (1x / 1.5x / 2x) */}
              <button
                type="button"
                onClick={toggleSpeed}
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                  playbackRate > 1
                    ? 'bg-[#00a884]/20 text-[#00a884]'
                    : darkMode
                    ? 'text-[#8696a0] hover:bg-[#374248]'
                    : 'text-[#667781] hover:bg-[#e9edef]'
                }`}
                title="Mudar velocidade de reprodução"
              >
                {playbackRate}x
              </button>

              {/* Botão de Mudo */}
              <button
                type="button"
                onClick={toggleMute}
                className={`p-0.5 rounded-full transition-colors cursor-pointer ${
                  darkMode ? 'text-[#8696a0] hover:text-[#e9edef]' : 'text-[#667781] hover:text-[#111b21]'
                }`}
                title={isMuted ? 'Ativar som' : 'Silenciar'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-amber-500" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              {/* Link externo para baixar ou abrir o arquivo original */}
              {src.startsWith('http') && (
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className={`p-0.5 rounded-full transition-colors ${
                    darkMode ? 'text-[#8696a0] hover:text-[#e9edef]' : 'text-[#667781] hover:text-[#111b21]'
                  }`}
                  title="Abrir arquivo de áudio original em nova aba"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de erro ou instrução caso o áudio falhe */}
      {hasError && (
        <div className="mt-2 p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
          {src.startsWith('http') && (
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium hover:text-amber-500 shrink-0 text-[10px] ml-1"
            >
              Baixar .ogg
            </a>
          )}
        </div>
      )}
    </div>
  );
};
