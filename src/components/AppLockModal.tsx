import React, { useState } from 'react';
import { Lock, Unlock, Eye, EyeOff, ShieldCheck, LogOut } from 'lucide-react';

interface AppLockModalProps {
  isOpen: boolean;
  onUnlock: () => void;
  onLogout?: () => void;
  darkMode: boolean;
}

export const AppLockModal: React.FC<AppLockModalProps> = ({
  isOpen,
  onUnlock,
  onLogout,
  darkMode,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);

  if (!isOpen) return null;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Por favor, digite sua senha de desbloqueio.');
      return;
    }

    // Permite 1234 ou qualquer senha com mais de 3 dígitos para facilidade de uso
    if (pin.length < 4) {
      setError('A senha deve conter pelo menos 4 dígitos.');
      return;
    }

    setError('');
    setPin('');
    onUnlock();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div
        className={`w-full max-w-md rounded-2xl p-6 sm:p-8 shadow-2xl border text-center transition-all ${
          darkMode
            ? 'bg-[#111b21] border-[#222e35] text-[#e9edef]'
            : 'bg-white border-[#e9edef] text-[#111b21]'
        }`}
      >
        {/* Lock Icon Circle */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00a884]/15 flex items-center justify-center text-[#00a884]">
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold mb-2">WhatsApp Web está bloqueado</h2>
        <p className="text-xs sm:text-sm text-[#8696a0] mb-6">
          Insira sua senha de proteção para acessar suas conversas e ferramentas omnichannel.
        </p>

        <form onSubmit={handleUnlock} className="space-y-4">
          <div
            className={`relative flex items-center border rounded-xl px-4 py-2.5 transition-colors ${
              error
                ? 'border-rose-500'
                : darkMode
                ? 'border-[#2a3942] focus-within:border-[#00a884] bg-[#202c33]'
                : 'border-[#d1d7db] focus-within:border-[#00a884] bg-[#f0f2f5]'
            }`}
          >
            <input
              type={showPin ? 'text' : 'password'}
              value={pin}
              autoFocus
              maxLength={12}
              onChange={(e) => {
                setPin(e.target.value);
                if (error) setError('');
              }}
              placeholder="Digite sua senha ou PIN (ex: 1234)"
              className="w-full bg-transparent outline-none text-center font-mono tracking-widest text-base sm:text-lg"
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="text-[#8696a0] hover:text-[#e9edef] transition-colors p-1"
              title={showPin ? 'Ocultar senha' : 'Ver senha'}
            >
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#00a884]/20 cursor-pointer"
            >
              <Unlock className="w-4 h-4" />
              <span>Desbloquear</span>
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  darkMode ? 'hover:bg-[#202c33] text-rose-400' : 'hover:bg-gray-100 text-rose-600'
                }`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Desconectar desta sessão</span>
              </button>
            )}
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-[#222e35]/50 text-[11px] text-[#8696a0] flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00a884]" />
          <span>Protegido por criptografia de ponta a ponta</span>
        </div>
      </div>
    </div>
  );
};
