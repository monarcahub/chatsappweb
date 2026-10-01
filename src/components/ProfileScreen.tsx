import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Camera,
  Store,
  AlignLeft,
  MapPin,
  Shapes,
  LayoutGrid,
  Link2,
  Mail,
  Phone,
  Upload,
  Trash2,
  Check,
  ChevronDown,
  Plus,
  Clock,
  ExternalLink,
  Smile,
  Edit2
} from 'lucide-react';
import { AuthUser } from '../types';
import { useAuth } from '../context/AuthContext';

interface ProfileScreenProps {
  darkMode: boolean;
  onClose: () => void;
  user?: AuthUser | null;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  darkMode,
  onClose,
  user,
}) => {
  const { user: authUser, currentAccount, updateUserProfile, updateCurrentAccount } = useAuth();

  // Profile data states initialized with user values or screenshot defaults
  const [commercialName, setCommercialName] = useState(
    user?.commercialName || user?.name || 'Alex Belmonte M'
  );
  const [description, setDescription] = useState(
    user?.description || 'Fundador da Monarca Hub'
  );
  const [address, setAddress] = useState(user?.address || '');
  const [coverageArea, setCoverageArea] = useState(
    user?.coverageArea || 'Localização exata'
  );
  const [locationNotes, setLocationNotes] = useState(
    user?.locationNotes || ''
  );
  const [category, setCategory] = useState(
    user?.category || 'Serviço de automação'
  );
  const [website, setWebsite] = useState(
    user?.website || 'https://app.monarcahub.com'
  );
  const [extraWebsites, setExtraWebsites] = useState<string[]>([]);
  
  // Puxar email e telefone dos dados de contato da conta atual / usuário autenticado
  const accountEmail = currentAccount?.email || user?.email || authUser?.email || 'alex@monarcahub.com';
  const accountPhone =
    currentAccount?.whatsappPhone ||
    currentAccount?.phone ||
    user?.phone ||
    authUser?.phone ||
    '+55 55 9680-4923';

  const [email, setEmail] = useState(accountEmail);
  const [phone, setPhone] = useState(accountPhone);
  const [mood, setMood] = useState(user?.mood || 'Current mood');

  // Sincroniza se os dados de contato da conta mudarem
  useEffect(() => {
    if (currentAccount?.email) {
      setEmail(currentAccount.email);
    }
    const phoneVal = currentAccount?.whatsappPhone || currentAccount?.phone;
    if (phoneVal) {
      setPhone(phoneVal);
    }
  }, [currentAccount]);

  // Avatar & Banner states
  const [avatarUrl, setAvatarUrl] = useState<string>(
    user?.avatarUrl ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80'
  );
  const [bannerUrl, setBannerUrl] = useState<string>(
    user?.bannerUrl || ''
  );

  // Modals & UI helpers
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isMoodModalOpen, setIsMoodModalOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bannerFileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Save changes to Auth context and Account contact info
  const saveAll = (extraUpdates?: Partial<AuthUser>) => {
    const updates: Partial<AuthUser> = {
      name: commercialName,
      commercialName,
      description,
      address,
      coverageArea,
      locationNotes,
      category,
      website,
      email,
      phone,
      mood,
      avatarUrl,
      bannerUrl,
      ...extraUpdates,
    };
    updateUserProfile(updates);

    if (updateCurrentAccount) {
      updateCurrentAccount({
        email,
        phone,
        whatsappPhone: phone,
      });
    }

    showToast('Perfil e contatos da conta atualizados com sucesso!');
  };

  // Image upload handler (converts to base64 Data URL)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isBanner = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Por favor, selecione uma imagem de até 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (isBanner) {
        setBannerUrl(dataUrl);
        saveAll({ bannerUrl: dataUrl });
        setIsBannerModalOpen(false);
        showToast('Foto de capa atualizada!');
      } else {
        setAvatarUrl(dataUrl);
        saveAll({ avatarUrl: dataUrl });
        setIsAvatarModalOpen(false);
        showToast('Foto de perfil alterada com sucesso!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = (isBanner = false) => {
    if (!urlInput.trim()) return;
    if (isBanner) {
      setBannerUrl(urlInput.trim());
      saveAll({ bannerUrl: urlInput.trim() });
      setIsBannerModalOpen(false);
      showToast('Foto de capa atualizada!');
    } else {
      setAvatarUrl(urlInput.trim());
      saveAll({ avatarUrl: urlInput.trim() });
      setIsAvatarModalOpen(false);
      showToast('Foto de perfil alterada com sucesso!');
    }
    setUrlInput('');
  };

  const handleRemovePhoto = (isBanner = false) => {
    if (isBanner) {
      setBannerUrl('');
      saveAll({ bannerUrl: '' });
      setIsBannerModalOpen(false);
      showToast('Foto de capa removida.');
    } else {
      setAvatarUrl('');
      saveAll({ avatarUrl: '' });
      setIsAvatarModalOpen(false);
      showToast('Foto de perfil removida.');
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col select-none overflow-hidden ${
        darkMode ? 'bg-[#111b21] text-[#e9edef]' : 'bg-[#f0f2f5] text-[#111b21]'
      }`}
    >
      {/* Top Header Bar: ✕ Perfil */}
      <header
        className={`h-14 px-6 flex items-center justify-between border-b shrink-0 z-20 ${
          darkMode ? 'bg-[#202c33] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
        }`}
      >
        <div className="flex items-center gap-6">
          <button
            onClick={onClose}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              darkMode ? 'hover:bg-[#374248] text-[#aebac1]' : 'hover:bg-[#e9edef] text-[#54656f]'
            }`}
            title="Fechar perfil"
          >
            <X className="w-5 h-5" />
          </button>
          <h1 className="text-base sm:text-lg font-semibold tracking-wide">Perfil</h1>
        </div>

        <button
          onClick={() => saveAll()}
          className="px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-[#00a884] text-white hover:bg-[#02906f] transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
        >
          <Check className="w-4 h-4" />
          <span>Salvar</span>
        </button>
      </header>

      {/* Hidden file inputs for local image upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileUpload(e, false)}
      />
      <input
        type="file"
        ref={bannerFileInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileUpload(e, true)}
      />

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 pb-24">
          {/* Banner & Avatar Container */}
          <div className="relative mb-6">
            {/* Banner Area */}
            <div
              className={`w-full h-44 sm:h-52 rounded-2xl overflow-hidden relative border ${
                darkMode ? 'bg-[#182229] border-[#222e35]' : 'bg-[#e9edef] border-[#d1d7db]'
              }`}
            >
              {bannerUrl ? (
                <img
                  src={bannerUrl}
                  alt="Capa do Perfil"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-[#182229] to-[#202c33]">
                  <span className="text-xs text-[#8696a0]">Sem foto de capa</span>
                </div>
              )}

              {/* Botão Editar da Capa (Top Right) */}
              <button
                onClick={() => setIsBannerModalOpen(true)}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs font-medium flex items-center gap-1.5 backdrop-blur-xs transition-colors cursor-pointer shadow-md"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Editar</span>
              </button>
            </div>

            {/* Avatar & Mood Overlapping Section */}
            <div className="flex flex-col items-center -mt-14 sm:-mt-16 relative z-10">
              {/* Current mood pill badge */}
              <button
                onClick={() => setIsMoodModalOpen(true)}
                className={`mb-2 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 border shadow-sm transition-colors cursor-pointer ${
                  darkMode
                    ? 'bg-[#202c33] border-[#2a3942] text-[#e9edef] hover:border-[#00a884]'
                    : 'bg-white border-[#d1d7db] text-[#111b21] hover:border-[#00a884]'
                }`}
                title="Editar status/mood"
              >
                <Smile className="w-3.5 h-3.5 text-[#00a884]" />
                <span>{mood}</span>
              </button>

              {/* Profile Avatar Image */}
              <div className="relative group">
                <div
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full ring-4 ring-[#111b21] dark:ring-[#111b21] overflow-hidden bg-[#202c33] flex items-center justify-center shadow-xl cursor-pointer"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={commercialName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#00a884] text-white flex items-center justify-center font-bold text-2xl">
                      {commercialName.substring(0, 2).toUpperCase()}
                    </div>
                  )}

                  {/* Camera overlay on hover */}
                  <div className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                    <span className="text-[10px] text-white font-medium mt-1">Mudar foto</span>
                  </div>
                </div>
              </div>

              {/* Botão [ 📷 Editar ] abaixo da foto de perfil (estilo screenshot) */}
              <button
                onClick={() => setIsAvatarModalOpen(true)}
                className={`mt-2.5 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                  darkMode
                    ? 'border-[#25d366]/40 text-[#25d366] hover:bg-[#25d366]/10'
                    : 'border-[#00a884] text-[#00a884] hover:bg-[#00a884]/10'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Editar</span>
              </button>
            </div>
          </div>

          {/* Seção: Informações da empresa */}
          <div className="space-y-5">
            <h2 className="text-lg sm:text-xl font-bold font-serif tracking-wide text-left mb-4">
              Informações da empresa
            </h2>

            {/* Campo: Nome comercial */}
            <div className="flex items-start gap-4">
              <div className="pt-3 text-[#8696a0]">
                <Store className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div
                  className={`relative border rounded-xl px-3.5 pt-3 pb-2 transition-colors ${
                    darkMode
                      ? 'border-[#2a3942] focus-within:border-[#00a884] bg-[#111b21]'
                      : 'border-[#d1d7db] focus-within:border-[#00a884] bg-white'
                  }`}
                >
                  <label
                    className={`absolute -top-2.5 left-3 px-1 text-[11px] font-medium ${
                      darkMode ? 'bg-[#111b21] text-[#8696a0]' : 'bg-white text-[#54656f]'
                    }`}
                  >
                    Nome comercial
                  </label>
                  <input
                    type="text"
                    value={commercialName}
                    onChange={(e) => setCommercialName(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm font-medium leading-tight"
                    placeholder="Nome comercial da empresa"
                  />
                </div>
              </div>
            </div>

            {/* Campo: Descrição */}
            <div className="flex items-start gap-4">
              <div className="pt-3 text-[#8696a0]">
                <AlignLeft className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div
                  className={`relative border rounded-xl px-3.5 pt-3 pb-2 transition-colors ${
                    darkMode
                      ? 'border-[#2a3942] focus-within:border-[#00a884] bg-[#111b21]'
                      : 'border-[#d1d7db] focus-within:border-[#00a884] bg-white'
                  }`}
                >
                  <label
                    className={`absolute -top-2.5 left-3 px-1 text-[11px] font-medium ${
                      darkMode ? 'bg-[#111b21] text-[#8696a0]' : 'bg-white text-[#54656f]'
                    }`}
                  >
                    Descrição
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm font-normal leading-relaxed resize-none"
                    placeholder="Descrição da empresa"
                  />
                </div>
              </div>
            </div>

            {/* Campo: Endereço & Área de cobertura */}
            <div className="flex items-start gap-4">
              <div className="pt-3 text-[#8696a0]">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-3">
                {/* Endereço input */}
                <div
                  className={`relative border rounded-xl px-3.5 pt-3 pb-2 transition-colors ${
                    darkMode
                      ? 'border-[#2a3942] focus-within:border-[#00a884] bg-[#111b21]'
                      : 'border-[#d1d7db] focus-within:border-[#00a884] bg-white'
                  }`}
                >
                  <label
                    className={`absolute -top-2.5 left-3 px-1 text-[11px] font-medium ${
                      darkMode ? 'bg-[#111b21] text-[#8696a0]' : 'bg-white text-[#54656f]'
                    }`}
                  >
                    Endereço
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm"
                    placeholder="Endereço"
                  />
                </div>

                {/* Área de cobertura (Dropdown) */}
                <div
                  className={`relative border rounded-xl px-3.5 pt-3 pb-2 transition-colors ${
                    darkMode
                      ? 'border-[#2a3942] focus-within:border-[#00a884] bg-[#111b21]'
                      : 'border-[#d1d7db] focus-within:border-[#00a884] bg-white'
                  }`}
                >
                  <label
                    className={`absolute -top-2.5 left-3 px-1 text-[11px] font-medium ${
                      darkMode ? 'bg-[#111b21] text-[#8696a0]' : 'bg-white text-[#54656f]'
                    }`}
                  >
                    Área de cobertura
                  </label>
                  <select
                    value={coverageArea}
                    onChange={(e) => setCoverageArea(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm appearance-none cursor-pointer"
                  >
                    <option value="Localização exata" className={darkMode ? 'bg-[#202c33]' : 'bg-white'}>
                      Localização exata
                    </option>
                    <option value="Raio de 5 km" className={darkMode ? 'bg-[#202c33]' : 'bg-white'}>
                      Raio de 5 km
                    </option>
                    <option value="Raio de 15 km" className={darkMode ? 'bg-[#202c33]' : 'bg-white'}>
                      Raio de 15 km
                    </option>
                    <option value="Toda a região metropolitana" className={darkMode ? 'bg-[#202c33]' : 'bg-white'}>
                      Toda a região metropolitana
                    </option>
                    <option value="Atendimento online nacional" className={darkMode ? 'bg-[#202c33]' : 'bg-white'}>
                      Atendimento online nacional
                    </option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#8696a0] absolute right-3 top-3.5 pointer-events-none" />
                </div>

                {/* Observações sobre a localização */}
                <div
                  className={`relative border rounded-xl px-3.5 pt-3 pb-2 transition-colors ${
                    darkMode
                      ? 'border-[#2a3942] focus-within:border-[#00a884] bg-[#111b21]'
                      : 'border-[#d1d7db] focus-within:border-[#00a884] bg-white'
                  }`}
                >
                  <label
                    className={`absolute -top-2.5 left-3 px-1 text-[11px] font-medium ${
                      darkMode ? 'bg-[#111b21] text-[#8696a0]' : 'bg-white text-[#54656f]'
                    }`}
                  >
                    Observações sobre a localização
                  </label>
                  <input
                    type="text"
                    value={locationNotes}
                    onChange={(e) => setLocationNotes(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm"
                    placeholder="Ex: Prédio comercial, sala 402"
                  />
                </div>

                {/* Mapa estilizado em dark theme com o Pin Vermelho centralizado */}
                <div
                  className={`w-full h-44 sm:h-52 rounded-xl relative overflow-hidden border flex items-center justify-center ${
                    darkMode ? 'bg-[#182229] border-[#222e35]' : 'bg-[#e9edef] border-[#d1d7db]'
                  }`}
                >
                  {/* Subtle map grid vector lines */}
                  <svg
                    className="absolute inset-0 w-full h-full opacity-20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.8" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid-pattern)" />
                    <circle cx="50%" cy="50%" r="55" fill="none" stroke="#00a884" strokeWidth="1" strokeDasharray="3 3" />
                  </svg>

                  {/* Red Map Pin exactly as in screenshot 1 */}
                  <div className="relative flex flex-col items-center select-none transform -translate-y-2">
                    <MapPin className="w-10 h-10 text-red-500 fill-red-500 drop-shadow-xl" />
                    <div className="w-3.5 h-1.5 bg-black/40 rounded-full blur-[1px] mt-0.5" />
                  </div>

                  <span className="absolute bottom-2 right-3 text-[10px] text-[#8696a0] bg-black/50 px-2 py-0.5 rounded backdrop-blur-xs">
                    Mapa de localização
                  </span>
                </div>
              </div>
            </div>

            {/* Campo: Horário de atendimento */}
            <div className="flex items-start gap-4 pt-2">
              <div className="pt-1 text-[#8696a0]">
                <Clock className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-2">
                <span className="text-xs text-[#8696a0] font-medium block">Horário de atendimento</span>
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                    darkMode ? 'bg-[#182229] border-[#222e35]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Segunda a Sexta</span>
                    <span className="text-[#00a884] font-semibold">08:00 - 18:00</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Sábado</span>
                    <span className="text-[#8696a0]">Fechada</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Domingo</span>
                    <span className="text-[#8696a0]">Fechada</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Campo: Categoria */}
            <div className="flex items-start gap-4 pt-2">
              <div className="pt-2 text-[#8696a0]">
                <Shapes className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <span className="text-xs text-[#8696a0] font-medium block mb-2">Categoria</span>
                <button
                  onClick={() => setIsCategoryModalOpen(true)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium border shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2 ${
                    darkMode
                      ? 'bg-[#1f2c34] border-[#2a3942] text-[#e9edef] hover:border-[#00a884]'
                      : 'bg-white border-[#d1d7db] text-[#111b21] hover:border-[#00a884]'
                  }`}
                >
                  <span>{category}</span>
                  <Edit2 className="w-3 h-3 text-[#8696a0]" />
                </button>
              </div>
            </div>
          </div>

          <div className={`my-8 border-t ${darkMode ? 'border-[#222e35]' : 'border-[#e9edef]'}`} />

          {/* Seção: Produtos e serviços */}
          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-bold font-serif tracking-wide text-left">
              Produtos e serviços
            </h2>

            <div className="flex items-center gap-4">
              <div className="text-[#8696a0]">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <div>
                <button
                  onClick={() => setIsCatalogModalOpen(true)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold border flex items-center gap-2 transition-colors cursor-pointer shadow-xs ${
                    darkMode
                      ? 'bg-white/5 hover:bg-white/10 border-white/10 text-[#e9edef]'
                      : 'bg-black/5 hover:bg-black/10 border-black/10 text-[#111b21]'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 text-[#00a884]" />
                  <span>Adicionar catálogo</span>
                </button>
              </div>
            </div>
          </div>

          <div className={`my-8 border-t ${darkMode ? 'border-[#222e35]' : 'border-[#e9edef]'}`} />

          {/* Seção: Links */}
          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-bold font-serif tracking-wide text-left">
              Links
            </h2>

            <div className="flex items-start gap-4">
              <div className="pt-3 text-[#8696a0]">
                <Link2 className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-3">
                <div
                  className={`relative border rounded-xl px-3.5 pt-3 pb-2 transition-colors ${
                    darkMode
                      ? 'border-[#2a3942] focus-within:border-[#00a884] bg-[#111b21]'
                      : 'border-[#d1d7db] focus-within:border-[#00a884] bg-white'
                  }`}
                >
                  <label
                    className={`absolute -top-2.5 left-3 px-1 text-[11px] font-medium ${
                      darkMode ? 'bg-[#111b21] text-[#8696a0]' : 'bg-white text-[#54656f]'
                    }`}
                  >
                    Site
                  </label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm font-medium"
                    placeholder="https://suaempresa.com"
                  />
                </div>

                {extraWebsites.map((site, index) => (
                  <div
                    key={index}
                    className={`relative border rounded-xl px-3.5 pt-3 pb-2 transition-colors ${
                      darkMode
                        ? 'border-[#2a3942] focus-within:border-[#00a884] bg-[#111b21]'
                        : 'border-[#d1d7db] focus-within:border-[#00a884] bg-white'
                    }`}
                  >
                    <label
                      className={`absolute -top-2.5 left-3 px-1 text-[11px] font-medium ${
                        darkMode ? 'bg-[#111b21] text-[#8696a0]' : 'bg-white text-[#54656f]'
                      }`}
                    >
                      Outro link
                    </label>
                    <input
                      type="url"
                      value={site}
                      onChange={(e) => {
                        const copy = [...extraWebsites];
                        copy[index] = e.target.value;
                        setExtraWebsites(copy);
                      }}
                      className="w-full bg-transparent outline-none text-sm"
                    />
                  </div>
                ))}

                <button
                  onClick={() => setExtraWebsites([...extraWebsites, 'https://'])}
                  className="text-xs font-semibold text-[#00a884] hover:underline cursor-pointer flex items-center gap-1 pt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar outro site</span>
                </button>
              </div>
            </div>
          </div>

          <div className={`my-8 border-t ${darkMode ? 'border-[#222e35]' : 'border-[#e9edef]'}`} />

          {/* Seção: Informações de contato */}
          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-bold font-serif tracking-wide text-left">
              Informações de contato
            </h2>

            {/* Email (Puxado dos dados de contato da conta) */}
            <div className="flex items-start gap-4">
              <div className="pt-3 text-[#8696a0]">
                <Mail className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div
                  className={`relative border rounded-xl px-3.5 pt-3 pb-2 transition-colors ${
                    darkMode
                      ? 'border-[#2a3942] focus-within:border-[#00a884] bg-[#111b21]'
                      : 'border-[#d1d7db] focus-within:border-[#00a884] bg-white'
                  }`}
                >
                  <label
                    className={`absolute -top-2.5 left-3 px-1 text-[11px] font-medium flex items-center gap-1.5 ${
                      darkMode ? 'bg-[#111b21] text-[#8696a0]' : 'bg-white text-[#54656f]'
                    }`}
                  >
                    <span>Email</span>
                    {currentAccount?.name && (
                      <span className="text-[10px] text-[#00a884] font-normal">
                        ({currentAccount.name})
                      </span>
                    )}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm font-medium"
                    placeholder="Email da conta"
                  />
                </div>
              </div>
            </div>

            {/* Telefone (Puxado dos dados de contato da conta) */}
            <div className="flex items-start gap-4">
              <div className="pt-3 text-[#8696a0]">
                <Phone className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div
                  className={`relative border rounded-xl px-3.5 pt-3 pb-2 transition-colors ${
                    darkMode
                      ? 'border-[#2a3942] focus-within:border-[#00a884] bg-[#111b21]'
                      : 'border-[#d1d7db] focus-within:border-[#00a884] bg-white'
                  }`}
                >
                  <label
                    className={`absolute -top-2.5 left-3 px-1 text-[11px] font-medium flex items-center gap-1.5 ${
                      darkMode ? 'bg-[#111b21] text-[#8696a0]' : 'bg-white text-[#54656f]'
                    }`}
                  >
                    <span>Telefone</span>
                    <span className="text-[10px] text-[#00a884] font-normal">
                      (WhatsApp da conta)
                    </span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm font-semibold"
                    placeholder="+55 55 9680-4923"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Editor da Foto de Perfil */}
      {isAvatarModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setIsAvatarModalOpen(false)}
        >
          <div
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border animate-in zoom-in-95 ${
              darkMode ? 'bg-[#222e35] border-[#2a3942] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#00a884]" />
                <h3 className="font-semibold text-base">Alterar foto do perfil</h3>
              </div>
              <button
                onClick={() => setIsAvatarModalOpen(false)}
                className="p-1 rounded-full text-[#8696a0] hover:text-[#e9edef] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#8696a0] mb-5">
              Escolha uma foto do seu computador ou informe um link direto para a imagem.
            </p>

            <div className="space-y-3">
              {/* Opção 1: Carregar do Computador */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`w-full p-3 rounded-xl border flex items-center gap-3 transition-colors cursor-pointer ${
                  darkMode ? 'bg-[#111b21] border-[#2a3942] hover:bg-[#182229]' : 'bg-[#f0f2f5] border-[#d1d7db] hover:bg-[#e9edef]'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-[#00a884]/20 flex items-center justify-center text-[#00a884] shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-sm block">Carregar foto do computador</span>
                  <span className="text-[11px] text-[#8696a0]">JPG, PNG, GIF ou WEBP (até 5MB)</span>
                </div>
              </button>

              {/* Opção 2: Inserir URL */}
              <div
                className={`p-3 rounded-xl border space-y-2 ${
                  darkMode ? 'bg-[#111b21] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#00a884]" />
                  <span className="font-semibold text-xs">Ou cole o link direto da imagem</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://exemplo.com/minha-foto.jpg"
                    className={`flex-1 px-3 py-2 rounded-lg text-xs outline-none border ${
                      darkMode ? 'bg-[#202c33] border-[#2a3942] text-white' : 'bg-white border-[#d1d7db] text-black'
                    }`}
                  />
                  <button
                    onClick={() => handleApplyUrl(false)}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#00a884] text-white hover:bg-[#02906f] cursor-pointer"
                  >
                    Aplicar
                  </button>
                </div>
              </div>

              {/* Opção 3: Remover Foto */}
              {avatarUrl && (
                <button
                  onClick={() => handleRemovePhoto(false)}
                  className="w-full p-2.5 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remover foto atual</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Editor da Foto de Capa (Banner) */}
      {isBannerModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setIsBannerModalOpen(false)}
        >
          <div
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border animate-in zoom-in-95 ${
              darkMode ? 'bg-[#222e35] border-[#2a3942] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#00a884]" />
                <h3 className="font-semibold text-base">Alterar foto de capa</h3>
              </div>
              <button
                onClick={() => setIsBannerModalOpen(false)}
                className="p-1 rounded-full text-[#8696a0] hover:text-[#e9edef] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => bannerFileInputRef.current?.click()}
                className={`w-full p-3 rounded-xl border flex items-center gap-3 transition-colors cursor-pointer ${
                  darkMode ? 'bg-[#111b21] border-[#2a3942] hover:bg-[#182229]' : 'bg-[#f0f2f5] border-[#d1d7db] hover:bg-[#e9edef]'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-[#00a884]/20 flex items-center justify-center text-[#00a884] shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-sm block">Carregar capa do computador</span>
                  <span className="text-[11px] text-[#8696a0]">JPG ou PNG panorâmico</span>
                </div>
              </button>

              <div
                className={`p-3 rounded-xl border space-y-2 ${
                  darkMode ? 'bg-[#111b21] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#00a884]" />
                  <span className="font-semibold text-xs">Ou cole o link da capa</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://exemplo.com/capa.jpg"
                    className={`flex-1 px-3 py-2 rounded-lg text-xs outline-none border ${
                      darkMode ? 'bg-[#202c33] border-[#2a3942] text-white' : 'bg-white border-[#d1d7db] text-black'
                    }`}
                  />
                  <button
                    onClick={() => handleApplyUrl(true)}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#00a884] text-white hover:bg-[#02906f] cursor-pointer"
                  >
                    Aplicar
                  </button>
                </div>
              </div>

              {bannerUrl && (
                <button
                  onClick={() => handleRemovePhoto(true)}
                  className="w-full p-2.5 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remover capa atual</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Editar Categoria */}
      {isCategoryModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setIsCategoryModalOpen(false)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl border animate-in zoom-in-95 ${
              darkMode ? 'bg-[#222e35] border-[#2a3942] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <Shapes className="w-4 h-4 text-[#00a884]" />
              <span>Selecionar Categoria</span>
            </h3>

            <div className="space-y-2 mb-4">
              {[
                'Serviço de automação',
                'Tecnologia & Software',
                'Marketing & Vendas',
                'Consultoria Empresarial',
                'Comércio Eletrônico',
                'Atendimento ao Cliente',
              ].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setCategory(cat);
                    setIsCategoryModalOpen(false);
                  }}
                  className={`w-full p-2.5 rounded-lg text-left text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                    category === cat
                      ? 'bg-[#00a884]/20 text-[#00a884]'
                      : darkMode
                      ? 'hover:bg-[#111b21] text-[#e9edef]'
                      : 'hover:bg-[#f0f2f5] text-[#111b21]'
                  }`}
                >
                  <span>{cat}</span>
                  {category === cat && <Check className="w-4 h-4 text-[#00a884]" />}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsCategoryModalOpen(false)}
              className="w-full py-2 rounded-lg text-xs font-semibold bg-[#00a884] text-white hover:bg-[#02906f] cursor-pointer"
            >
              Concluir
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Adicionar Catálogo de Produtos */}
      {isCatalogModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setIsCatalogModalOpen(false)}
        >
          <div
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border animate-in zoom-in-95 ${
              darkMode ? 'bg-[#222e35] border-[#2a3942] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-[#00a884]" />
                <h3 className="font-semibold text-base">Catálogo de Produtos e Serviços</h3>
              </div>
              <button
                onClick={() => setIsCatalogModalOpen(false)}
                className="p-1 rounded-full text-[#8696a0] hover:text-[#e9edef] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#8696a0] mb-4">
              Exiba produtos, planos e serviços diretamente para seus clientes do WhatsApp.
            </p>

            <div
              className={`p-4 rounded-xl border text-center mb-4 ${
                darkMode ? 'bg-[#111b21] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
              }`}
            >
              <LayoutGrid className="w-8 h-8 text-[#00a884] mx-auto mb-2 opacity-80" />
              <p className="text-xs font-medium">Nenhum item adicionado ainda.</p>
              <span className="text-[11px] text-[#8696a0]">Crie seu primeiro item para sincronizar com o WhatsApp.</span>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsCatalogModalOpen(false)}
                className={`px-4 py-2 rounded-lg text-xs font-medium ${
                  darkMode ? 'bg-[#182229] text-[#8696a0]' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  setIsCatalogModalOpen(false);
                  showToast('Item adicionado ao catálogo!');
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#00a884] text-white hover:bg-[#02906f]"
              >
                + Criar Novo Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Mood Status */}
      {isMoodModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setIsMoodModalOpen(false)}
        >
          <div
            className={`w-full max-w-xs rounded-2xl p-5 shadow-2xl border animate-in zoom-in-95 ${
              darkMode ? 'bg-[#222e35] border-[#2a3942] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-sm mb-3">Definir status (mood)</h3>
            <input
              type="text"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-xs outline-none border mb-4 ${
                darkMode ? 'bg-[#111b21] border-[#2a3942] text-white' : 'bg-white border-[#d1d7db] text-black'
              }`}
              placeholder="Ex: Current mood, Focado, Em reunião..."
            />
            <button
              onClick={() => {
                setIsMoodModalOpen(false);
                saveAll({ mood });
              }}
              className="w-full py-2 rounded-lg text-xs font-semibold bg-[#00a884] text-white hover:bg-[#02906f]"
            >
              Salvar status
            </button>
          </div>
        </div>
      )}

      {/* Floating Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-[#00a884] text-white text-xs font-semibold shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
