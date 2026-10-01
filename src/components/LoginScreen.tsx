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
  AlertCircle
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
  const [newPassword, setNewPassword] = useState('');
  const [newConfirmPassword, setNewConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewConfirmPassword, setShowNewConfirmPassword] = useState(false);

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
    setRegisterError(null);

    if (!newCompanyName.trim() || !newEmail.trim()) {
      setRegisterError('Por favor preencha o nome da empresa e o e-mail.');
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

    setIsLoading(true);
    try {
      const res = await registerAccount(
        newCompanyName.trim(),
        newCompanySegment.trim() || 'Serviços & Atendimento',
        newAdminName.trim() || 'Administrador',
        newEmail.trim(),
        newPassword
      );

      if (!res.success) {
        setRegisterError(res.error || 'Falha ao registrar empresa. Tente novamente.');
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
            src="https://vhibadmtznoomdanosyj.supabase.co/storage/v1/object/public/images/ChatsAppWebAI-favicon.png"
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
                src="https://vhibadmtznoomdanosyj.supabase.co/storage/v1/object/public/images/ChatsAppWebAI-favicon.png"
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
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (loginError) setLoginError(null);
                    }}
                    placeholder="seu.email@empresa.com.br"
                    className="w-full bg-transparent text-sm focus:outline-none placeholder:text-[#8696a0]"
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
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (loginError) setLoginError(null);
                    }}
                    placeholder="Digite sua senha"
                    className="w-full bg-transparent text-sm focus:outline-none placeholder:text-[#8696a0]"
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
                <input
                  type="text"
                  required
                  placeholder="Ex: Prime Odonto, Imóveis Alpha"
                  value={newCompanyName}
                  onChange={(e) => {
                    setNewCompanyName(e.target.value);
                    if (registerError) setRegisterError(null);
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none placeholder:text-[#8696a0] ${
                    darkMode
                      ? 'bg-[#111b21] border-[#313d45] focus:border-[#00a884]'
                      : 'bg-[#f7f9fa] border-[#d1d7db] focus:border-[#00a884]'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#8696a0] mb-1 block">
                    Segmento / Ramo
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Saúde, Vendas"
                    value={newCompanySegment}
                    onChange={(e) => setNewCompanySegment(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none placeholder:text-[#8696a0] ${
                      darkMode
                        ? 'bg-[#111b21] border-[#313d45] focus:border-[#00a884]'
                        : 'bg-[#f7f9fa] border-[#d1d7db] focus:border-[#00a884]'
                    }`}
                  />
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
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none placeholder:text-[#8696a0] ${
                      darkMode
                        ? 'bg-[#111b21] border-[#313d45] focus:border-[#00a884]'
                        : 'bg-[#f7f9fa] border-[#d1d7db] focus:border-[#00a884]'
                    }`}
                  />
                </div>
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
                    placeholder="admin@suaempresa.com.br"
                    value={newEmail}
                    onChange={(e) => {
                      setNewEmail(e.target.value);
                      if (registerError) setRegisterError(null);
                    }}
                    className="w-full bg-transparent text-sm focus:outline-none placeholder:text-[#8696a0]"
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
                      placeholder="Mín. 6 dígitos"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (registerError) setRegisterError(null);
                      }}
                      className="w-full bg-transparent text-xs focus:outline-none placeholder:text-[#8696a0]"
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
                      placeholder="Repita a senha"
                      value={newConfirmPassword}
                      onChange={(e) => {
                        setNewConfirmPassword(e.target.value);
                        if (registerError) setRegisterError(null);
                      }}
                      className="w-full bg-transparent text-xs focus:outline-none placeholder:text-[#8696a0]"
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
                    Cadastrar e Acessar
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
    </div>
  );
};
