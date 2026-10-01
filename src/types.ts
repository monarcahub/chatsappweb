export type ChannelType = 'whatsapp' | 'instagram' | 'webchat';

export type ChannelName = 'whatsapp_principal' | 'instagram_comercial' | 'chat_site' | string;

// Definição da Empresa / Tenant (Multi-Tenancy)
export interface Account {
  id: string;
  name: string;
  slug: string;
  segment?: string;
  whatsappPhone?: string;
  phone?: string;
  email?: string;
  plan?: string;
  logoUrl?: string;
  createdAt?: string;
}

// Perfil do Atendente / Usuário Logado
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent' | 'supervisor';
  avatarUrl?: string;
  accountId: string;
  accountName: string;
  commercialName?: string;
  description?: string;
  address?: string;
  coverageArea?: string;
  locationNotes?: string;
  category?: string;
  website?: string;
  phone?: string;
  role_title?: string;
  bio?: string;
  username?: string;
  bannerUrl?: string;
  mood?: string;
}

export interface Channel {
  id: string;
  accountId?: string;
  name: ChannelName;
  type: ChannelType;
  config?: Record<string, any>;
  isActive?: boolean;
}

// CRÍTICO: Indica se a IA está respondendo, se o atendente assumiu ou se a conversa foi finalizada
export type ConversationStatus = 'ai' | 'human' | 'closed';

// Compatibilidade de status de IA
export type AIStatus = 'active' | 'inactive' | 'paused' | 'human_takeover' | ConversationStatus;

// Funil de Vendas do CRM Integrado
export type CRMStage = 'novo_lead' | 'qualificado' | 'agendado' | 'ganho' | 'perdido';

// Tipos de remetente do sistema
export type MessageSenderType =
  | 'contact' // Mensagem enviada pelo cliente (via WhatsApp, Insta ou Site)
  | 'ai' // Mensagem gerada pela Inteligência Artificial
  | 'agent' // Mensagem enviada pelo atendente humano
  | 'system' // Mensagem de sistema (ex: "Atendente assumiu a conversa")
  // Aliases para compatibilidade legada
  | 'customer'
  | 'bot'
  | 'coexistence_mobile';

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export type MessageContentType = 'text' | 'audio' | 'image' | 'video' | 'document' | 'template' | 'sticker' | 'gif';

export interface Tag {
  id: string;
  name: string;
  color: string; // hex ou classe tailwind
  textColor?: string;
}

export interface CRMData {
  dealStage: CRMStage | 'lead' | 'contacted' | 'proposal' | 'negotiation' | 'won' | 'lost';
  dealValue?: number;
  assignedAgent?: string;
  notes: Array<{
    id: string;
    text: string;
    createdAt: string;
    author: string;
  }>;
  customFields?: Record<string, string>;
}

export interface Contact {
  id: string;
  accountId?: string;
  name: string;
  phone?: string;
  email?: string;
  instagram_username?: string;
  instagramUsername?: string;
  avatarUrl: string;
  avatarUpdatedAt?: string;
  channel: ChannelType;
  channelId: string;
  coexistenceEnabled: boolean;
  aiStatus: AIStatus;
  status?: ConversationStatus;
  crm: CRMData;
  tags: Tag[];
  createdAt?: string;
}

export interface Message {
  id: string;
  accountId?: string;
  conversationId: string;
  senderType: MessageSenderType;
  sender_type?: string;
  senderName?: string;
  contentType: MessageContentType;
  content: string;
  mediaUrl?: string;
  mediaDuration?: string; // para áudio ex: "0:06"
  createdAt?: string; // ISO UTC (timestamptz)
  timestamp: string; // Formatado para exibição rápida no fuso de Brasília
  status: MessageStatus;
  reaction?: string;
  isStarred?: boolean;
  metadata?: {
    metaMessageId?: string;
    coexistenceSource?: 'mobile_app' | 'cloud_api';
    tokensUsed?: number;
    quickReplies?: string[];
    channel?: ChannelType;
    [key: string]: any;
  };
}

export interface Conversation {
  id: string;
  accountId?: string;
  contactId?: string;
  channelId?: string;
  contact: Contact;
  // CRÍTICO: 'ai' = IA respondendo | 'human' = Atendente assumiu | 'closed' = Conversa finalizada
  status: ConversationStatus;
  crmStage?: CRMStage;
  notes?: string;
  tags?: string[];
  lastMessage: {
    text: string;
    timestamp: string;
    senderType: MessageSenderType;
    status: MessageStatus;
    contentType: MessageContentType;
    mediaDuration?: string;
  };
  unreadCount: number;
  isPinned: boolean;
  isArchived: boolean;
  isFavorite: boolean;
  isMuted?: boolean;
  isGroup: boolean;
  updatedAt: string;
  lastMessageAt?: string;
}
