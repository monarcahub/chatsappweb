import React, { useState } from 'react';
import {
  MessageSquare,
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  UserPlus,
  LogIn,
  X,
  Shield,
  FileText,
  Eye,
  EyeOff,
  AlertCircle,
  Phone,
  Building2,
  Briefcase,
  UserCheck,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginScreenProps {
  darkMode?: boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ darkMode = true }) => {
  const { login, registerAccount, availableAccounts } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // Form de cadastro de nova empresa
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanySegment, setNewCompanySegment] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newWhatsappPhone, setNewWhatsappPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newConfirmPassword, setNewConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewConfirmPassword, setShowNewConfirmPassword] = useState(false);

  // Estado para detecção de empresa possivelmente já cadastrada
  const [duplicateWarning, setDuplicateWarning] = useState<{ message: string; detail: string } | null>(null);
  const [isAlreadyMemberModalOpen, setIsAlreadyMemberModalOpen] = useState(false);

  // Lista de países com DDI, bandeiras e placeholders
  const COUNTRY_OPTIONS = [
    { code: 'BR', name: 'Brasil', ddi: '+55', flag: '🇧🇷', placeholder: '(11) 99999-9999' },
    { code: 'US', name: 'Estados Unidos', ddi: '+1', flag: '🇺🇸', placeholder: '555-883-6346' },
    { code: 'PT', name: 'Portugal', ddi: '+351', flag: '🇵🇹', placeholder: '912 345 678' },
    { code: 'ES', name: 'Espanha', ddi: '+34', flag: '🇪🇸', placeholder: '612 345 678' },
    { code: 'AR', name: 'Argentina', ddi: '+54', flag: '🇦🇷', placeholder: '9 11 1234-5678' },
    { code: 'MX', name: 'México', ddi: '+52', flag: '🇲🇽', placeholder: '55 1234 5678' },
    { code: 'GB', name: 'Reino Unido', ddi: '+44', flag: '🇬🇧', placeholder: '7911 123456' },
    { code: 'FR', name: 'França', ddi: '+33', flag: '🇫🇷', placeholder: '6 12 34 56 78' },
    { code: 'DE', name: 'Alemanha', ddi: '+49', flag: '🇩🇪', placeholder: '151 23456789' },
    { code: 'IT', name: 'Itália', ddi: '+39', flag: '🇮🇹', placeholder: '312 345 6789' },
    { code: 'CL', name: 'Chile', ddi: '+56', flag: '🇨🇱', placeholder: '9 1234 5678' },
    { code: 'UY', name: 'Uruguai', ddi: '+598', flag: '🇺🇾', placeholder: '91 234 567' },
    { code: 'PY', name: 'Paraguai', ddi: '+595', flag: '🇵🇾', placeholder: '981 123456' },
    { code: 'CO', name: 'Colômbia', ddi: '+57', flag: '🇨🇴', placeholder: '300 123 4567' },
    { code: 'PE', name: 'Peru', ddi: '+51', flag: '🇵🇪', placeholder: '912 345 678' },
    { code: 'OTHER', name: 'Outro País', ddi: '+', flag: '🌐', placeholder: 'Ex: +1 555-883-6346' },
  ];

  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_OPTIONS[0]);

  // Formatação flexível para telefone local ou internacional
  const formatPhone = (val: string, countryCode: string = 'BR') => {
    if (countryCode !== 'BR') {
      // Para números de outros países, permite caracteres internacionais de forma limpa
      return val.replace(/[^\d\s\-()+]/g, '');
    }
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : '';
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoginError(null);
    setIsLoading(true);

    try {
      const res = await login(email.trim(), password);
      if (!res.success) {
        setLoginError(res.error || 'E-mail ou senha incorretos.');
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Erro inesperado ao realizar login.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setRegisterError(null);
    setDuplicateWarning(null);

    const cleanCompany = newCompanyName.trim();
    const cleanAdmin = newAdminName.trim();
    const cleanMail = newEmail.trim();
    const cleanPhone = newWhatsappPhone.trim();
    const digits = cleanPhone.replace(/\D/g, '');

    if (!cleanCompany || !cleanMail) {
      setRegisterError('Por favor preencha o nome da empresa e o e-mail corporativo.');
      return;
    }

    if (!cleanAdmin) {
      setRegisterError('Por favor informe seu nome (Gestor).');
      return;
    }

    if (digits.length < 6) {
      setRegisterError('Por favor informe um WhatsApp/telefone comercial válido.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setRegisterError('A senha de acesso deve conter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== newConfirmPassword) {
      setRegisterError('A confirmação de senha não coincide com a senha digitada.');
      return;
    }

    // Monta o telefone internacional completo com DDI
    let fullPhone = cleanPhone;
    if (!fullPhone.startsWith('+')) {
      const ddi = selectedCountry.ddi.trim();
      fullPhone = ddi === '+' ? `+${fullPhone}` : `${ddi} ${fullPhone}`;
    }

    setIsLoading(true);
    try {
      const res = await registerAccount(
        cleanCompany,
        newCompanySegment.trim() || 'Serviços & Atendimento',
        cleanAdmin,
        cleanMail,
        newPassword,
        fullPhone
      );

      if (!res.success) {
        if (res.isPossibleDuplicate) {
          setDuplicateWarning({
            message: res.error || 'Encontramos uma empresa que pode já estar cadastrada no ChatsApp.',
            detail:
              res.detail ||
              'Para proteger os dados da empresa, não podemos vinculá-la automaticamente à sua conta. Entre em contato com o administrador da empresa para solicitar acesso.',
          });
        } else {
          setRegisterError(res.error || 'Falha ao registrar empresa. Tente novamente.');
        }
      }
    } catch (err: any) {
      setRegisterError(err?.message || 'Erro de conexão ao criar workspace.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen w-screen flex flex-col justify-between overflow-y-auto ${
        darkMode ? 'bg-[#111b21] text-[#e9edef]' : 'bg-[#f0f2f5] text-[#111b21]'
      }`}
    >
      {/* Top Brand Stripe (WhatsApp Web Style) */}
      <div className="h-44 bg-[#00a884] w-full flex items-center px-6 sm:px-12 lg:px-20 relative shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="https://vhibadmtznoomdanosyj.supabase.co/storage/v1/object/public/images/ChatsAppWebAI-favicon.webp"
            alt="ChatsApp Web AI"
            className="w-10 h-10 rounded-full object-contain bg-white/20 shadow-sm p-1"
          />
          <div>
            <span className="text-white font-semibold text-lg sm:text-xl tracking-tight block">
              ChatsApp Web AI
            </span>
            <span className="text-white/80 text-xs block font-medium">
              Plataforma Omnichannel Multi-empresa
            </span>
          </div>
        </div>
      </div>

      {/* Main Centered Card Container */}
      <div className="flex-1 flex items-center justify-center px-4 -mt-20 z-10 pb-8">
        <div
          className={`w-full max-w-md rounded-2xl shadow-2xl border p-6 sm:p-8 ${
            darkMode ? 'bg-[#202c33] border-[#313d45]' : 'bg-white border-[#e9edef]'
          }`}
        >
          {/* Header do Box */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#00a884]/15 mb-3 p-1">
              <img
                src="https://vhibadmtznoomdanosyj.supabase.co/storage/v1/object/public/images/ChatsAppWebAI-favicon.webp"
                alt="ChatsApp Web AI Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              {mode === 'login' ? 'Acesse o painel da sua empresa' : 'Cadastre sua nova empresa'}
            </h1>
            <p className="text-xs text-[#8696a0] mt-1.5 leading-relaxed">
              {mode === 'login'
                ? 'Entre com suas credenciais de atendente ou gestor'
                : 'Crie seu ambiente de atendimento em poucos segundos'}
            </p>
          </div>

          {/* Segmented Control / Tabs */}
          <div className="flex bg-[#111b21] p-1 rounded-xl border border-[#313d45] mb-6">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                mode === 'login'
                  ? 'bg-[#00a884] text-white shadow-sm'
                  : 'text-[#8696a0] hover:text-[#e9edef]'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                mode === 'register'
                  ? 'bg-[#00a884] text-white shadow-sm'
                  : 'text-[#8696a0] hover:text-[#e9edef]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Cadastrar Empresa
            </button>
          </div>

          {/* Formulário de Login */}
          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {loginError && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-[#8696a0] mb-1.5 block">
                  E-mail de Acesso
                </label>
                <div
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border transition-colors ${
                    darkMode
                      ? 'bg-[#111b21] border-[#313d45] focus-within:border-[#00a884]'
                      : 'bg-[#f7f9fa] border-[#d1d7db] focus-within:border-[#00a884]'
                  }`}
                >
                  <Mail className="w-4 h-4 text-[#8696a0] shrink-0" />
                  <input
                    type="email"
                    required
                    autoComplete="username email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (loginError) setLoginError(null);
                    }}
                    placeholder="seu.email@empresa.com.br"
                    style={{ colorScheme: darkMode ? 'dark' : 'light' }}
                    className={`w-full bg-transparent text-sm focus:outline-none placeholder:text-[#8696a0] ${
                      darkMode ? 'login-autofill-dark text-[#e9edef]' : 'login-autofill-light text-[#111b21]'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[#8696a0] mb-1.5 block">
                  Senha
                </label>
                <div
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border transition-colors ${
                    darkMode
                      ? 'bg-[#111b21] border-[#313d45] focus-within:border-[#00a884]'
                      : 'bg-[#f7f9fa] border-[#d1d7db] focus-within:border-[#00a884]'
                  }`}
                >
                  <Lock className="w-4 h-4 text-[#8696a0] shrink-0" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (loginError) setLoginError(null);
                    }}
                    placeholder="Digite sua senha"
                    style={{ colorScheme: darkMode ? 'dark' : 'light' }}
                    className={`w-full bg-transparent text-sm focus:outline-none placeholder:text-[#8696a0] ${
                      darkMode ? 'login-autofill-dark text-[#e9edef]' : 'login-autofill-light text-[#111b21]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[#8696a0] hover:text-[#e9edef] p-0.5"
                    title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-[#8696a0] hover:text-white select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded accent-[#00a884] w-3.5 h-3.5"
                  />
                  Lembrar de mim
                </label>
                <button
                  type="button"
                  onClick={() => alert('Para redefinir sua senha, solicite suporte ao administrador da sua conta.')}
                  className="text-[#00a884] hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 rounded-xl bg-[#00a884] hover:bg-[#009374] active:scale-[0.99] text-white font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Entrando...
                  </span>
                ) : (
                  <>
                    Entrar no Painel
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : duplicateWarning ? (
            /* Alerta Amigável de Empresa Possivelmente Já Cadastrada */
            <div className="space-y-4 animate-in fade-in duration-200">
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3 ${
                  darkMode
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <h3 className="font-semibold text-sm leading-snug">
                    {duplicateWarning.message}
                  </h3>
                  <p className="text-xs leading-relaxed opacity-90">
                    {duplicateWarning.detail}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAlreadyMemberModalOpen(true)}
                  className="w-full py-3 rounded-xl bg-[#00a884] hover:bg-[#009374] active:scale-[0.99] text-white font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  Já faço parte desta empresa
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDuplicateWarning(null);
                    setRegisterError(null);
                  }}
                  className={`w-full py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                    darkMode
                      ? 'border-[#313d45] hover:bg-[#313d45] text-[#8696a0]'
                      : 'border-gray-300 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  Tentar com outro WhatsApp ou dados
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDuplicateWarning(null);
                    setMode('login');
                    setEmail(newEmail);
                  }}
                  className="w-full text-center text-xs text-[#00a884] hover:underline pt-1 cursor-pointer"
                >
                  Ir para o Login com meu e-mail
                </button>
              </div>
            </div>
          ) : (
            /* Formulário de Cadastro */
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              {registerError && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{registerError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-[#8696a0] mb-1 block">
                  Nome da Empresa
                </label>
                <div
                  className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-colors ${
                    darkMode
                      ? 'bg-[#111b21] border-[#313d45] focus-within:border-[#00a884]'
                      : 'bg-[#f7f9fa] border-[#d1d7db] focus-within:border-[#00a884]'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-[#8696a0] shrink-0" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: Prime Odonto, Imóveis Alpha"
                    value={newCompanyName}
                    onChange={(e) => {
                      setNewCompanyName(e.target.value);
                      if (registerError) setRegisterError(null);
                    }}
                    className={`w-full bg-transparent text-sm focus:outline-none placeholder:text-[#8696a0] ${
                      darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#8696a0] mb-1 block">
                    Segmento / Ramo
                  </label>
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${
                      darkMode
                        ? 'bg-[#111b21] border-[#313d45] focus-within:border-[#00a884]'
                        : 'bg-[#f7f9fa] border-[#d1d7db] focus-within:border-[#00a884]'
                    }`}
                  >
                    <Briefcase className="w-4 h-4 text-[#8696a0] shrink-0" />
                    <input
                      type="text"
                      placeholder="Ex: Saúde, Imóveis"
                      value={newCompanySegment}
                      onChange={(e) => setNewCompanySegment(e.target.value)}
                      className={`w-full bg-transparent text-sm focus:outline-none placeholder:text-[#8696a0] ${
                        darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-[#8696a0] mb-1 block">
                    Seu Nome (Gestor)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Alex Belmonte"
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    className={`w-full px-3.5 py-2 rounded-xl border text-sm focus:outline-none placeholder:text-[#8696a0] ${
                      darkMode
                        ? 'bg-[#111b21] border-[#313d45] focus:border-[#00a884]'
                        : 'bg-[#f7f9fa] border-[#d1d7db] focus:border-[#00a884]'
                    }`}
                  />
                </div>
              </div>

              {/* WhatsApp Comercial da Empresa com Seletor de País */}
              <div>
                <label className="text-xs font-medium text-[#8696a0] mb-1 block">
                  WhatsApp Comercial da Empresa
                </label>
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${
                    darkMode
                      ? 'bg-[#111b21] border-[#313d45] focus-within:border-[#00a884]'
                      : 'bg-[#f7f9fa] border-[#d1d7db] focus-within:border-[#00a884]'
                  }`}
                >
                  {/* Seletor de País com Bandeira e DDI */}
                  <div className="flex items-center gap-1 shrink-0 pr-2 border-r border-[#313d45]/40">
                    <span className="text-sm select-none leading-none">{selectedCountry.flag}</span>
                    <select
                      value={selectedCountry.code}
                      onChange={(e) => {
                        const found = COUNTRY_OPTIONS.find((c) => c.code === e.target.value);
                        if (found) {
                          setSelectedCountry(found);
                          setNewWhatsappPhone('');
                        }
                      }}
                      className={`bg-transparent text-xs font-semibold focus:outline-none cursor-pointer pr-1 py-0.5 ${
                        darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'
                      }`}
                      aria-label="Código DDI do País"
                    >
                      {COUNTRY_OPTIONS.map((c) => (
                        <option
                          key={c.code}
                          value={c.code}
                          className={darkMode ? 'bg-[#202c33] text-[#e9edef]' : 'bg-white text-[#111b21]'}
                        >
                          {c.flag} {c.ddi} ({c.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="tel"
                    required
                    placeholder={selectedCountry.placeholder}
                    value={newWhatsappPhone}
                    onChange={(e) => {
                      setNewWhatsappPhone(formatPhone(e.target.value, selectedCountry.code));
                      if (registerError) setRegisterError(null);
                    }}
                    className={`w-full bg-transparent text-sm focus:outline-none placeholder:text-[#8696a0] ${
                      darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'
                    }`}
                  />
                </div>
                <p className="text-[10px] text-[#8696a0] mt-1 pl-1">
                  Exemplo ({selectedCountry.name}): <span className="font-mono">{selectedCountry.ddi} {selectedCountry.placeholder}</span>
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-[#8696a0] mb-1 block">
                  E-mail Corporativo
                </label>
                <div
                  className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-colors ${
                    darkMode
                      ? 'bg-[#111b21] border-[#313d45] focus-within:border-[#00a884]'
                      : 'bg-[#f7f9fa] border-[#d1d7db] focus-within:border-[#00a884]'
                  }`}
                >
                  <Mail className="w-4 h-4 text-[#8696a0] shrink-0" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="admin@suaempresa.com.br"
                    value={newEmail}
                    onChange={(e) => {
                      setNewEmail(e.target.value);
                      if (registerError) setRegisterError(null);
                    }}
                    style={{ colorScheme: darkMode ? 'dark' : 'light' }}
                    className={`w-full bg-transparent text-sm focus:outline-none placeholder:text-[#8696a0] ${
                      darkMode ? 'login-autofill-dark text-[#e9edef]' : 'login-autofill-light text-[#111b21]'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#8696a0] mb-1 block">
                    Criar Senha
                  </label>
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${
                      darkMode
                        ? 'bg-[#111b21] border-[#313d45] focus-within:border-[#00a884]'
                        : 'bg-[#f7f9fa] border-[#d1d7db] focus-within:border-[#00a884]'
                    }`}
                  >
                    <Lock className="w-4 h-4 text-[#8696a0] shrink-0" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      placeholder="Mín. 6 dígitos"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (registerError) setRegisterError(null);
                      }}
                      style={{ colorScheme: darkMode ? 'dark' : 'light' }}
                      className={`w-full bg-transparent text-xs focus:outline-none placeholder:text-[#8696a0] ${
                        darkMode ? 'login-autofill-dark text-[#e9edef]' : 'login-autofill-light text-[#111b21]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="text-[#8696a0] hover:text-[#e9edef] p-0.5"
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-[#8696a0] mb-1 block">
                    Confirmar Senha
                  </label>
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${
                      darkMode
                        ? 'bg-[#111b21] border-[#313d45] focus-within:border-[#00a884]'
                        : 'bg-[#f7f9fa] border-[#d1d7db] focus-within:border-[#00a884]'
                    }`}
                  >
                    <Lock className="w-4 h-4 text-[#8696a0] shrink-0" />
                    <input
                      type={showNewConfirmPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      placeholder="Repita a senha"
                      value={newConfirmPassword}
                      onChange={(e) => {
                        setNewConfirmPassword(e.target.value);
                        if (registerError) setRegisterError(null);
                      }}
                      style={{ colorScheme: darkMode ? 'dark' : 'light' }}
                      className={`w-full bg-transparent text-xs focus:outline-none placeholder:text-[#8696a0] ${
                        darkMode ? 'login-autofill-dark text-[#e9edef]' : 'login-autofill-light text-[#111b21]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewConfirmPassword(!showNewConfirmPassword)}
                      className="text-[#8696a0] hover:text-[#e9edef] p-0.5"
                    >
                      {showNewConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-[#8696a0] pt-0.5">
                Sua senha é protegida com criptografia avançada para acesso seguro e sincronização multi-dispositivo.
              </p>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 rounded-xl bg-[#00a884] hover:bg-[#009374] active:scale-[0.99] text-white font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Criando workspace...
                  </span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Cadastrar Empresa
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Footer com Links e Créditos */}
      <footer className="py-5 text-center text-xs text-[#8696a0] shrink-0 border-t border-[#313d45]/40 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 px-4">
        <button
          type="button"
          onClick={() => setIsPrivacyModalOpen(true)}
          className="hover:text-[#00a884] transition-colors underline-offset-4 hover:underline cursor-pointer"
        >
          Políticas de Privacidade
        </button>
        <span className="hidden sm:inline text-[#8696a0]/40">•</span>
        <span className="font-medium text-[#e9edef]/80">
          Desenvolvido por <span className="text-[#00a884] font-semibold">MonarcaHub</span>
        </span>
      </footer>

      {/* Modal de Políticas de Privacidade */}
      {isPrivacyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div
            className={`w-full max-w-lg rounded-2xl shadow-2xl border p-6 max-h-[85vh] overflow-y-auto ${
              darkMode ? 'bg-[#202c33] border-[#313d45] text-[#e9edef]' : 'bg-white border-[#d1d7db] text-[#111b21]'
            }`}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#313d45]/60 mb-4">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-[#00a884]" />
                <h2 className="text-base font-bold">Políticas de Privacidade</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-[#8696a0] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-[#8696a0]">
              <div>
                <h3 className="font-semibold text-sm text-[#e9edef] mb-1">
                  1. Proteção de Dados e Sigilo Comercial
                </h3>
                <p>
                  O <strong>ChatsApp Web AI</strong> foi projetado segundo as melhores práticas da LGPD (Lei Geral de Proteção de Dados - Lei nº 13.709/2018). As informações trafegadas nas conversas do WhatsApp, contatos, mídias e notas de atendimento são de propriedade restrita da empresa contratante.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-sm text-[#e9edef] mb-1">
                  2. Isolamento de Contas
                </h3>
                <p>
                  Cada empresa possui ambiente e dados estritamente segregados. Nenhuma outra empresa ou atendente de outro workspace possui acesso ou visualização das suas mensagens, clientes ou números de WhatsApp.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-sm text-[#e9edef] mb-1">
                  3. Tratamento de Mensagens e Inteligência Artificial
                </h3>
                <p>
                  O Agente IA processa mensagens recebidas exclusivamente para atender os chamados e contatos da respectiva empresa, respeitando as instruções de prompt e limites operacionais definidos no seu painel.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-sm text-[#e9edef] mb-1">
                  4. Suporte e Contato
                </h3>
                <p>
                  Dúvidas sobre privacidade e gestão dos dados podem ser direcionadas diretamente à equipe da <strong>MonarcaHub</strong> através dos canais oficiais de suporte.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#313d45]/60 flex justify-end">
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#00a884] hover:bg-[#009374] text-white font-semibold text-xs transition-colors"
              >
                Entendi e Concordo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Explicativo: Já faço parte desta empresa */}
      {isAlreadyMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div
            className={`w-full max-w-md rounded-2xl shadow-2xl border p-6 ${
              darkMode ? 'bg-[#202c33] border-[#313d45] text-[#e9edef]' : 'bg-white border-[#d1d7db] text-[#111b21]'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#313d45]/60 mb-4">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 text-[#00a884]" />
                <h2 className="text-base font-bold">Acesso à Empresa Existente</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAlreadyMemberModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-[#8696a0] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                  darkMode ? 'bg-[#111b21] border-[#313d45] text-[#8696a0]' : 'bg-gray-50 border-gray-200 text-gray-700'
                }`}
              >
                <Info className="w-4 h-4 text-[#00a884] shrink-0 mt-0.5" />
                <span>
                  Por questões rigorosas de segurança e sigilo de dados, nenhuma conta de usuário é vinculada automaticamente a uma empresa cadastrada.
                </span>
              </div>

              <p className={darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}>
                Para ter acesso ao ambiente da empresa, solicite ao <strong>administrador / gestor</strong> da mesma que adicione seu e-mail (<strong>{newEmail || 'seu e-mail corporativo'}</strong>) na lista de atendentes do ChatsApp.
              </p>

              <p className={darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}>
                Assim que ele conceder seu acesso, basta fazer login com seu e-mail e senha para gerenciar seus canais e atendimentos.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-[#313d45]/60 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAlreadyMemberModalOpen(false);
                  setDuplicateWarning(null);
                  setMode('login');
                  setEmail(newEmail);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#009374] text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Ir para o Login
              </button>
              <button
                type="button"
                onClick={() => setIsAlreadyMemberModalOpen(false)}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                  darkMode ? 'border-[#313d45] hover:bg-[#313d45] text-[#8696a0]' : 'border-gray-300 hover:bg-gray-100 text-gray-700'
                }`}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
