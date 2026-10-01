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
  Edit2,
  User,
  Briefcase,
  FileText,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { AuthUser } from '../types';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type DayKey = (typeof DAY_KEYS)[number];

const DAY_LABELS: Record<DayKey, string> = {
  monday: 'Segunda-feira',
  tuesday: 'Terça-feira',
  wednesday: 'Quarta-feira',
  thursday: 'Quinta-feira',
  friday: 'Sexta-feira',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

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

  // 1. DADOS PESSOAIS DO USUÁRIO (Tabela: public.profiles)
  const [userName, setUserName] = useState(
    authUser?.name || user?.name || ''
  );
  const [userPhone, setUserPhone] = useState(
    authUser?.phone || user?.phone || ''
  );
  const [roleTitle, setRoleTitle] = useState(
    authUser?.role_title || user?.role_title || ''
  );
  const [userBio, setUserBio] = useState(
    authUser?.bio || user?.bio || ''
  );
  const [mood, setMood] = useState(
    authUser?.mood || user?.mood || 'Disponível'
  );
  const [avatarUrl, setAvatarUrl] = useState<string>(
    authUser?.avatarUrl || user?.avatarUrl || ''
  );
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // E-mail de login autenticado (Exclusivo do Supabase Auth - Read-only)
  const authEmail = authUser?.email || 'usuario@autenticado.com';

  // 2. DADOS EMPRESARIAIS (Persistidos em public.accounts para a empresa ativa)
  const [commercialName, setCommercialName] = useState(
    currentAccount?.name || ''
  );
  const [description, setDescription] = useState(currentAccount?.description || '');
  const [address, setAddress] = useState(currentAccount?.address || '');
  const [coverageArea, setCoverageArea] = useState(
    currentAccount?.coverageArea || 'Localização exata'
  );
  const [locationNotes, setLocationNotes] = useState(
    currentAccount?.locationNotes || ''
  );
  const [category, setCategory] = useState(
    currentAccount?.segment || 'Serviços & Atendimento'
  );
  const [website, setWebsite] = useState(
    currentAccount?.website || 'https://app.monarcahub.com'
  );
  const [extraWebsites, setExtraWebsites] = useState<string[]>(
    Array.isArray(currentAccount?.extraWebsites) ? currentAccount.extraWebsites : []
  );
  
  const accountEmail = currentAccount?.email || '';
  const accountPhone =
    currentAccount?.whatsappPhone ||
    currentAccount?.phone ||
    '';

  const [companyEmail, setCompanyEmail] = useState(accountEmail);
  const [companyPhone, setCompanyPhone] = useState(accountPhone);
  const [bannerUrl, setBannerUrl] = useState<string>(currentAccount?.bannerUrl || '');
  const [businessHours, setBusinessHours] = useState<Record<string, { enabled: boolean; open: string; close: string }>>(
    currentAccount?.businessHours && typeof currentAccount.businessHours === 'object'
      ? currentAccount.businessHours
      : {}
  );
  const [isHoursModalOpen, setIsHoursModalOpen] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  // Sincroniza dados pessoais assim que authUser for hidratado
  useEffect(() => {
    if (authUser) {
      if (authUser.name) setUserName(authUser.name);
      if (authUser.phone !== undefined) setUserPhone(authUser.phone || '');
      if (authUser.role_title !== undefined) setRoleTitle(authUser.role_title || '');
      if (authUser.bio !== undefined) setUserBio(authUser.bio || '');
      if (authUser.mood) setMood(authUser.mood);
      if (authUser.avatarUrl !== undefined) setAvatarUrl(authUser.avatarUrl || '');
    }
  }, [authUser]);

  // Sincroniza se os dados da empresa ativa (currentAccount) mudarem
  useEffect(() => {
    if (currentAccount?.id) {
      if (currentAccount.name !== undefined) setCommercialName(currentAccount.name);
      if (currentAccount.segment !== undefined) setCategory(currentAccount.segment);
      const phoneVal = currentAccount.whatsappPhone || currentAccount.phone || '';
      setCompanyPhone(phoneVal);
      if (currentAccount.email !== undefined) setCompanyEmail(currentAccount.email);
      if (currentAccount.description !== undefined) setDescription(currentAccount.description);
      if (currentAccount.address !== undefined) setAddress(currentAccount.address);
      if (currentAccount.coverageArea !== undefined) setCoverageArea(currentAccount.coverageArea);
      if (currentAccount.locationNotes !== undefined) setLocationNotes(currentAccount.locationNotes);
      if (currentAccount.website !== undefined) setWebsite(currentAccount.website);
      if (Array.isArray(currentAccount.extraWebsites)) setExtraWebsites(currentAccount.extraWebsites);
      if (currentAccount.bannerUrl !== undefined) setBannerUrl(currentAccount.bannerUrl);
      if (currentAccount.businessHours && typeof currentAccount.businessHours === 'object') {
        setBusinessHours(currentAccount.businessHours);
      }
    }
  }, [
    currentAccount?.id,
    currentAccount?.name,
    currentAccount?.segment,
    currentAccount?.whatsappPhone,
    currentAccount?.phone,
    currentAccount?.email,
    currentAccount?.description,
    currentAccount?.address,
    currentAccount?.coverageArea,
    currentAccount?.locationNotes,
    currentAccount?.website,
    currentAccount?.extraWebsites,
    currentAccount?.bannerUrl,
    currentAccount?.businessHours,
  ]);

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
    }, 3500);
  };

  // Salvar dados: grava dados pessoais em public.profiles e dados empresariais em public.accounts
  const saveAll = async (extraUpdates?: Partial<AuthUser>) => {
    setIsSaving(true);
    try {
      // 1. Gravar em public.profiles SOMENTE os dados pessoais
      await updateUserProfile({
        name: userName.trim() || 'Usuário',
        phone: userPhone.trim(),
        role_title: roleTitle.trim(),
        bio: userBio.trim(),
        mood: mood.trim() || 'Disponível',
        avatarUrl: avatarUrl,
        ...extraUpdates,
      });

      // 2. Gravar em public.accounts os dados empresariais correspondentes
      if (updateCurrentAccount && currentAccount?.id) {
        const accResult = await updateCurrentAccount({
          name: commercialName.trim() || currentAccount.name,
          segment: category.trim() || currentAccount.segment,
          whatsappPhone: companyPhone.trim(),
          phone: companyPhone.trim(),
          email: companyEmail.trim(),
          description: description.trim(),
          address: address.trim(),
          coverageArea: coverageArea.trim(),
          locationNotes: locationNotes.trim(),
          website: website.trim(),
          extraWebsites: extraWebsites.map((s) => s.trim()).filter(Boolean),
          bannerUrl: bannerUrl.trim(),
          businessHours: businessHours,
        });

        if (accResult && !accResult.success) {
          console.warn('[ProfileScreen] Aviso ao salvar empresa no banco:', accResult.error);
        }
      }

      showToast('Perfil e dados da empresa salvos com sucesso!');
    } catch (err: any) {
      console.error('Erro ao salvar perfil e empresa:', err);
      showToast('Erro ao salvar perfil. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // Upload de arquivos: integra avatar (bucket avatar) e foto de capa (bucket images)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isBanner = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Por favor, selecione uma imagem de até 5MB.');
      return;
    }

    // Validação estrita de formato: apenas JPEG, PNG e WEBP
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      showToast('Formato não permitido. Selecione apenas imagens JPG, PNG ou WEBP.');
      return;
    }

    if (!isBanner) {
      const activeUserId = authUser?.id || user?.id;
      if (!activeUserId) {
        showToast('Erro: Usuário não autenticado.');
        return;
      }

      setIsUploadingAvatar(true);
      try {
        let ext = 'jpg';
        if (file.type === 'image/png') ext = 'png';
        else if (file.type === 'image/webp') ext = 'webp';
        else if (file.type === 'image/jpeg') {
          const parts = file.name.split('.');
          const realExt = parts.length > 1 ? parts.pop()?.toLowerCase() : 'jpg';
          ext = realExt === 'jpeg' ? 'jpeg' : 'jpg';
        }

        const timestamp = Date.now();
        const filePath = `${activeUserId}/avatar-${timestamp}.${ext}`;

        // Upload no bucket existente 'avatar'
        const { error: uploadError } = await supabase.storage
          .from('avatar')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicData } = supabase.storage
          .from('avatar')
          .getPublicUrl(filePath);

        const newAvatarUrl = publicData.publicUrl;
        setAvatarUrl(newAvatarUrl);
        await updateUserProfile({ avatarUrl: newAvatarUrl });
        setIsAvatarModalOpen(false);
        showToast('Foto de perfil atualizada com sucesso!');
      } catch (err: any) {
        console.error('Erro no upload de avatar:', err);
        showToast(`Erro ao enviar foto: ${err?.message || 'Falha no envio da foto'}`);
      } finally {
        setIsUploadingAvatar(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } else {
      // Upload de capa empresarial: bucket 'images/{account_id}/business/banner-{timestamp}.{ext}'
      if (!currentAccount?.id) {
        showToast('Erro: Nenhuma empresa ativa selecionada.');
        return;
      }

      setIsUploadingBanner(true);
      try {
        let ext = 'jpg';
        if (file.type === 'image/png') ext = 'png';
        else if (file.type === 'image/webp') ext = 'webp';
        else if (file.type === 'image/jpeg') {
          const parts = file.name.split('.');
          const realExt = parts.length > 1 ? parts.pop()?.toLowerCase() : 'jpg';
          ext = realExt === 'jpeg' ? 'jpeg' : 'jpg';
        }

        const timestamp = Date.now();
        const filePath = `${currentAccount.id}/business/banner-${timestamp}.${ext}`;

        // Upload no bucket existente 'images'
        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicData } = supabase.storage
          .from('images')
          .getPublicUrl(filePath);

        const newBannerUrl = publicData.publicUrl;
        setBannerUrl(newBannerUrl);
        if (updateCurrentAccount && currentAccount?.id) {
          await updateCurrentAccount({ bannerUrl: newBannerUrl });
        }
        setIsBannerModalOpen(false);
        showToast('Foto de capa da empresa atualizada com sucesso!');
      } catch (err: any) {
        console.error('Erro no upload de foto de capa:', err);
        showToast(`Erro ao enviar capa: ${err?.message || 'Falha no envio da imagem'}`);
      } finally {
        setIsUploadingBanner(false);
        if (bannerFileInputRef.current) bannerFileInputRef.current.value = '';
      }
    }
  };

  const handleApplyUrl = async (isBanner = false) => {
    if (!urlInput.trim()) return;
    const trimmed = urlInput.trim();
    if (isBanner) {
      setBannerUrl(trimmed);
      if (updateCurrentAccount && currentAccount?.id) {
        await updateCurrentAccount({ bannerUrl: trimmed });
      }
      setIsBannerModalOpen(false);
      showToast('Foto de capa atualizada!');
    } else {
      setAvatarUrl(trimmed);
      await updateUserProfile({ avatarUrl: trimmed });
      setIsAvatarModalOpen(false);
      showToast('Foto de perfil alterada com sucesso!');
    }
    setUrlInput('');
  };

  const handleRemovePhoto = async (isBanner = false) => {
    if (isBanner) {
      setBannerUrl('');
      if (updateCurrentAccount && currentAccount?.id) {
        await updateCurrentAccount({ bannerUrl: '' });
      }
      setIsBannerModalOpen(false);
      showToast('Foto de capa removida.');
    } else {
      setAvatarUrl('');
      await updateUserProfile({ avatarUrl: '' });
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
          disabled={isSaving}
          className="px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-[#00a884] text-white hover:bg-[#02906f] transition-all cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Salvando...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Salvar Perfil</span>
            </>
          )}
        </button>
      </header>

      {/* Hidden file inputs for image upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png,image/webp"
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
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full ring-4 ring-[#111b21] dark:ring-[#111b21] overflow-hidden bg-[#202c33] flex items-center justify-center shadow-xl cursor-pointer relative"
                >
                  {isUploadingAvatar ? (
                    <div className="flex flex-col items-center justify-center gap-1 text-[#00a884]">
                      <Loader2 className="w-7 h-7 animate-spin" />
                      <span className="text-[9px] font-medium text-white">Salvando...</span>
                    </div>
                  ) : avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={userName || 'Avatar'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#00a884] text-white flex items-center justify-center font-bold text-2xl">
                      {(userName || 'U').substring(0, 2).toUpperCase()}
                    </div>
                  )}

                  {/* Camera overlay on hover */}
                  {!isUploadingAvatar && (
                    <div className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-6 h-6 text-white" />
                      <span className="text-[10px] text-white font-medium mt-1">Mudar foto</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Botão [ 📷 Editar ] abaixo da foto de perfil */}
              <button
                onClick={() => setIsAvatarModalOpen(true)}
                disabled={isUploadingAvatar}
                className={`mt-2.5 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                  darkMode
                    ? 'border-[#25d366]/40 text-[#25d366] hover:bg-[#25d366]/10'
                    : 'border-[#00a884] text-[#00a884] hover:bg-[#00a884]/10'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{isUploadingAvatar ? 'Enviando...' : 'Editar Foto'}</span>
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SEÇÃO 1: PERFIL DO USUÁRIO (Tabela: public.profiles) */}
          {/* ========================================================= */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between pb-2 border-b border-[#00a884]/25">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-[#00a884]" />
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-left">
                  Meu Perfil (Dados Pessoais)
                </h2>
              </div>
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#00a884]/15 text-[#00a884]">
                Dados Pessoais
              </span>
            </div>

            {/* Campo: Nome Pessoal */}
            <div className="flex items-start gap-4">
              <div className="pt-3 text-[#8696a0]">
                <User className="w-5 h-5" />
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
                    Nome pessoal
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm font-medium leading-tight"
                    placeholder="Seu nome completo"
                  />
                </div>
              </div>
            </div>

            {/* Campo: Cargo / Função (role_title) */}
            <div className="flex items-start gap-4">
              <div className="pt-3 text-[#8696a0]">
                <Briefcase className="w-5 h-5" />
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
                    Cargo / Função
                  </label>
                  <input
                    type="text"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm font-medium leading-tight"
                    placeholder="Ex: Gerente Comercial, Atendente Sênior, Supervisor"
                  />
                </div>
              </div>
            </div>

            {/* Campo: Telefone Pessoal */}
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
                    className={`absolute -top-2.5 left-3 px-1 text-[11px] font-medium ${
                      darkMode ? 'bg-[#111b21] text-[#8696a0]' : 'bg-white text-[#54656f]'
                    }`}
                  >
                    Telefone pessoal / Celular
                  </label>
                  <input
                    type="tel"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm font-medium leading-tight"
                    placeholder="+55 11 99999-9999"
                  />
                </div>
              </div>
            </div>

            {/* Campo: Bio / Apresentação pessoal */}
            <div className="flex items-start gap-4">
              <div className="pt-3 text-[#8696a0]">
                <FileText className="w-5 h-5" />
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
                    Bio / Apresentação pessoal
                  </label>
                  <textarea
                    rows={2}
                    value={userBio}
                    onChange={(e) => setUserBio(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm font-normal leading-relaxed resize-none"
                    placeholder="Conte um pouco sobre você e sua função"
                  />
                </div>
              </div>
            </div>

            {/* Campo: E-mail de Login (Read-only do Supabase Auth) */}
            <div className="flex items-start gap-4">
              <div className="pt-3 text-[#8696a0]">
                <Mail className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div
                  className={`relative border rounded-xl px-3.5 pt-3 pb-2 transition-colors opacity-90 ${
                    darkMode ? 'border-[#2a3942] bg-[#182229]' : 'border-[#d1d7db] bg-[#f0f2f5]'
                  }`}
                >
                  <label
                    className={`absolute -top-2.5 left-3 px-1 text-[11px] font-medium flex items-center gap-1.5 ${
                      darkMode ? 'bg-[#182229] text-[#8696a0]' : 'bg-[#f0f2f5] text-[#54656f]'
                    }`}
                  >
                    <span>E-mail de Login</span>
                    <span className="text-[10px] text-[#00a884] font-medium inline-flex items-center gap-0.5">
                      <ShieldCheck className="w-3 h-3" /> Autenticado
                    </span>
                  </label>
                  <input
                    type="email"
                    value={authEmail}
                    disabled
                    className="w-full bg-transparent outline-none text-sm font-medium text-[#8696a0] cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={`my-8 border-t ${darkMode ? 'border-[#222e35]' : 'border-[#e9edef]'}`} />

          {/* ========================================================= */}
          {/* SEÇÃO 2: INFORMAÇÕES DA EMPRESA (Tabela: public.accounts) */}
          {/* ========================================================= */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold font-serif tracking-wide text-left">
                Informações da empresa
              </h2>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#8696a0]/15 text-[#8696a0]">
                Conta Ativa: {currentAccount?.name || 'Empresa'}
              </span>
            </div>

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
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#8696a0] font-medium block">Horário de atendimento</span>
                  <button
                    type="button"
                    onClick={() => setIsHoursModalOpen(true)}
                    className="text-xs font-semibold text-[#00a884] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Configurar horários</span>
                  </button>
                </div>
                <div
                  onClick={() => setIsHoursModalOpen(true)}
                  className={`p-3 rounded-xl border text-xs space-y-2 cursor-pointer transition-colors ${
                    darkMode ? 'bg-[#182229] border-[#222e35] hover:border-[#00a884]/60' : 'bg-[#f0f2f5] border-[#d1d7db] hover:border-[#00a884]/60'
                  }`}
                >
                  {Object.keys(businessHours).length === 0 ? (
                    <div className="py-2 text-center text-[#8696a0]">
                      <span>Nenhum horário definido. Clique para configurar a escala semanal.</span>
                    </div>
                  ) : (
                    DAY_KEYS.map((key) => {
                      const item = businessHours[key];
                      const isEnabled = Boolean(item?.enabled);
                      return (
                        <div key={key} className="flex items-center justify-between">
                          <span className="font-medium">{DAY_LABELS[key]}</span>
                          {isEnabled ? (
                            <span className="text-[#00a884] font-semibold">
                              {item?.open || '08:00'} - {item?.close || '18:00'}
                            </span>
                          ) : (
                            <span className="text-[#8696a0]">Fechada</span>
                          )}
                        </div>
                      );
                    })
                  )}
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
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className={`relative flex-1 border rounded-xl px-3.5 pt-3 pb-2 transition-colors ${
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
                        Outro link {index + 1}
                      </label>
                      <input
                        type="url"
                        value={site}
                        onChange={(e) => {
                          const copy = [...extraWebsites];
                          copy[index] = e.target.value;
                          setExtraWebsites(copy);
                        }}
                        placeholder="https://..."
                        className="w-full bg-transparent outline-none text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const copy = extraWebsites.filter((_, i) => i !== index);
                        setExtraWebsites(copy);
                      }}
                      className="p-2.5 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                      title="Remover link"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
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
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm font-medium"
                    placeholder="Email da empresa"
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
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
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
              {/* Opção 1: Carregar do Computador (Supabase Storage: bucket avatar) */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className={`w-full p-3 rounded-xl border flex items-center gap-3 transition-colors cursor-pointer disabled:opacity-50 ${
                  darkMode ? 'bg-[#111b21] border-[#2a3942] hover:bg-[#182229]' : 'bg-[#f0f2f5] border-[#d1d7db] hover:bg-[#e9edef]'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-[#00a884]/20 flex items-center justify-center text-[#00a884] shrink-0">
                  {isUploadingAvatar ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </div>
                <div className="text-left">
                  <span className="font-semibold text-sm block">
                    {isUploadingAvatar ? 'Enviando imagem...' : 'Carregar foto do computador'}
                  </span>
                  <span className="text-[11px] text-[#8696a0]">
                    JPG, PNG ou WEBP (até 5MB)
                  </span>
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
                  {isUploadingBanner ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </div>
                <div className="text-left">
                  <span className="font-semibold text-sm block">
                    {isUploadingBanner ? 'Enviando foto de capa...' : 'Carregar capa do computador'}
                  </span>
                  <span className="text-[11px] text-[#8696a0]">JPG, PNG ou WEBP (até 5MB)</span>
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

      {/* MODAL: Configurar Horários de Atendimento (business_hours JSONB) */}
      {isHoursModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setIsHoursModalOpen(false)}
        >
          <div
            className={`w-full max-w-lg rounded-2xl p-6 shadow-2xl border animate-in zoom-in-95 max-h-[90vh] flex flex-col ${
              darkMode ? 'bg-[#222e35] border-[#2a3942] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#00a884]" />
                <h3 className="font-semibold text-base">Horários de atendimento</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHoursModalOpen(false)}
                className="p-1 rounded-full text-[#8696a0] hover:text-[#e9edef] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#8696a0] mb-4 shrink-0">
              Defina os dias e os intervalos de funcionamento da empresa. Dias desmarcados serão exibidos como "Fechada".
            </p>

            <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-1">
              {DAY_KEYS.map((key) => {
                const currentDay = businessHours[key] || { enabled: false, open: '08:00', close: '18:00' };
                return (
                  <div
                    key={key}
                    className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      darkMode ? 'bg-[#111b21] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`check-${key}`}
                        checked={Boolean(currentDay.enabled)}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setBusinessHours((prev) => ({
                            ...prev,
                            [key]: {
                              enabled: isChecked,
                              open: currentDay.open || '08:00',
                              close: currentDay.close || '18:00',
                            },
                          }));
                        }}
                        className="w-4 h-4 rounded text-[#00a884] focus:ring-[#00a884] cursor-pointer"
                      />
                      <label htmlFor={`check-${key}`} className="text-xs font-semibold cursor-pointer select-none">
                        {DAY_LABELS[key]}
                      </label>
                    </div>

                    {currentDay.enabled ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span>Das</span>
                        <input
                          type="time"
                          value={currentDay.open || '08:00'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBusinessHours((prev) => ({
                              ...prev,
                              [key]: {
                                ...currentDay,
                                open: val,
                              },
                            }));
                          }}
                          className={`px-2 py-1 rounded-lg border text-xs outline-none ${
                            darkMode ? 'bg-[#202c33] border-[#2a3942] text-white' : 'bg-white border-[#d1d7db] text-black'
                          }`}
                        />
                        <span>às</span>
                        <input
                          type="time"
                          value={currentDay.close || '18:00'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBusinessHours((prev) => ({
                              ...prev,
                              [key]: {
                                ...currentDay,
                                close: val,
                              },
                            }));
                          }}
                          className={`px-2 py-1 rounded-lg border text-xs outline-none ${
                            darkMode ? 'bg-[#202c33] border-[#2a3942] text-white' : 'bg-white border-[#d1d7db] text-black'
                          }`}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-[#8696a0] font-medium">Fechada</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t mt-4 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsHoursModalOpen(false)}
                className={`px-4 py-2 rounded-lg text-xs font-medium ${
                  darkMode ? 'bg-[#182229] text-[#8696a0]' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (updateCurrentAccount && currentAccount?.id) {
                    await updateCurrentAccount({ businessHours: businessHours });
                  }
                  setIsHoursModalOpen(false);
                  showToast('Horários de atendimento atualizados com sucesso!');
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#00a884] text-white hover:bg-[#02906f] cursor-pointer"
              >
                Salvar Horários
              </button>
            </div>
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
