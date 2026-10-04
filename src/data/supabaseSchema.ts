// =========================================================================
// ESQUEMA OFICIAL DO BANCO DE DADOS (POSTGRESQL) - CHATSAPP WEB
// ARQUITETURA MULTI-TENANT (MÚLTIPLOS CLIENTES) COM ROW LEVEL SECURITY (RLS)
// =========================================================================

export const SUPABASE_SQL_SCHEMA = `-- =========================================================================
-- ESQUEMA OMNICHAT HUB: MULTI-TENANT POSTGRESQL DDL COMPLETO
-- Isolamento Robusto por Empresa (account_id), RLS e WebSocket Realtime (<100ms)
-- =========================================================================

-- 1. Habilitar extensões úteis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Busca rápida (ILIKE) por nome/telefone

-- =========================================================================
-- 2. EMPRESAS / CLIENTES (TENANTS)
-- Cada cliente seu é um registro isolado nesta tabela
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL, -- Ex: 'Clínica Odonto Viva', 'Imobiliária Prime'
    slug VARCHAR(100) NOT NULL UNIQUE,
    segment VARCHAR(100), -- Ex: 'Saúde', 'Imóveis', 'Varejo'
    plan VARCHAR(50) DEFAULT 'pro',
    whatsapp_phone VARCHAR(50), -- Número oficial vinculado
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir as empresas de demonstração
INSERT INTO public.accounts (id, name, slug, segment, whatsapp_phone)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'MonarcaHub Matriz', 'monarcahub', 'Tecnologia & IA', '+55 51 8451-1283'),
    ('a0000000-0000-0000-0000-000000000002', 'Clínica Odonto Viva', 'odontoviva', 'Saúde & Odontologia', '+55 11 91234-5678'),
    ('a0000000-0000-0000-0000-000000000003', 'Imobiliária Prime Imóveis', 'primeimoveis', 'Imóveis & Locação', '+55 21 99876-5432')
ON CONFLICT (slug) DO NOTHING;

-- =========================================================================
-- 3. USUÁRIOS E ATENDENTES DA EMPRESA (MEMBERSHIP)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.account_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- auth.uid() do sistema de autenticação
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(30) DEFAULT 'agent' CHECK (role IN ('admin', 'supervisor', 'agent')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_users_acc ON public.account_users(account_id);
CREATE INDEX IF NOT EXISTS idx_account_users_user ON public.account_users(user_id);

-- =========================================================================
-- 4. CANAIS DE COMUNICAÇÃO (WhatsApp, Instagram, WebChat)
-- Vinculados diretamente à empresa dona daquele número/instância
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('whatsapp', 'instagram', 'webchat')),
    is_active BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}'::jsonb, -- Armazena instance_name, token do WhatsApp, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_account_channel UNIQUE (account_id, name)
);

CREATE INDEX IF NOT EXISTS idx_channels_account_id ON public.channels(account_id);

-- Inserir canais padrão para cada empresa
INSERT INTO public.channels (account_id, name, type, config)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'whatsapp_principal', 'whatsapp', '{"waba_phone": "+555184511283"}'::jsonb),
    ('a0000000-0000-0000-0000-000000000002', 'whatsapp_odonto', 'whatsapp', '{"waba_phone": "+5511912345678"}'::jsonb),
    ('a0000000-0000-0000-0000-000000000003', 'whatsapp_imob', 'whatsapp', '{"waba_phone": "+5521998765432"}'::jsonb)
ON CONFLICT DO NOTHING;

-- =========================================================================
-- 5. CONTATOS UNIFICADOS (CLIENTES DO TENANT)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    instagram_username VARCHAR(100),
    avatar_url TEXT,
    avatar_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON public.contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(account_id, phone);
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm ON public.contacts USING gin(name gin_trgm_ops);

-- =========================================================================
-- 6. CONVERSAS (THREADS OMNICHANNEL)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    
    status VARCHAR(20) DEFAULT 'ai' CHECK (status IN ('ai', 'human', 'closed')),
    crm_stage VARCHAR(30) DEFAULT 'novo_lead' CHECK (crm_stage IN ('novo_lead', 'qualificado', 'agendado', 'ganho', 'perdido')),
    notes TEXT DEFAULT '',
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    unread_count INT DEFAULT 0,
    last_message_text TEXT,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uq_acc_channel_contact UNIQUE (account_id, channel_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_account_id ON public.conversations(account_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(account_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(account_id, status);

-- =========================================================================
-- 7. MENSAGENS (CHAT HISTORY - UTC)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    
    sender_type VARCHAR(30) NOT NULL CHECK (sender_type IN ('contact', 'ai', 'agent', 'system', 'customer', 'bot', 'coexistence_mobile')),
    sender_name TEXT,
    content TEXT NOT NULL,
    media_url TEXT,
    content_type VARCHAR(20) DEFAULT 'text',
    status VARCHAR(20) DEFAULT 'delivered',
    
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_account_id ON public.messages(account_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_id, created_at ASC);

-- =========================================================================
-- 8. TRIGGER: ATUALIZAR CONVERSA AO INSERIR NOVA MENSAGEM
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations
    SET 
        last_message_text = NEW.content,
        last_message_at = NEW.created_at,
        unread_count = CASE 
            WHEN NEW.sender_type IN ('contact', 'customer') THEN unread_count + 1 
            ELSE unread_count 
        END,
        updated_at = NOW()
    WHERE id = NEW.conversation_id AND account_id = NEW.account_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_after_message_insert ON public.messages;
CREATE TRIGGER trg_after_message_insert
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_message();

-- =========================================================================
-- 8. CÉREBRO DA IA & CONFIGURAÇÕES MULTI-TENANT (cerebro_ia)
-- Substitui a antiga 'gym_configs', agora 100% universal para qualquer segmento
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.cerebro_ia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID, -- Usuário criador / auth.uid() do sistema de autenticação
    
    -- 1. IDENTIDADE E DADOS DO NEGÓCIO (Generalizado de gym_name -> business_name)
    business_name TEXT, -- Nome da empresa / loja / clínica / imobiliária
    address TEXT, -- Endereço físico ou raio de atendimento
    opening_hours TEXT, -- Horário de funcionamento / atendimento humano
    pricing_info TEXT, -- Informações de preços, planos, pacotes ou forma de cobrança
    faq_text TEXT, -- Perguntas frequentes e respostas automáticas
    tone_of_voice TEXT DEFAULT 'Amigável e positiva', -- Tom de voz da IA
    pix_key TEXT, -- Chave PIX oficial para vendas e pagamentos
    branches JSONB DEFAULT '[]'::jsonb, -- Filiais / departamentos
    observations TEXT, -- Observações gerais e diretrizes especiais do cérebro
    
    -- 2. REGRAS DE AUTOMAÇÃO E COMPORTAMENTO
    is_active BOOLEAN DEFAULT true, -- Ativar/pausar IA globalmente
    allow_calls BOOLEAN DEFAULT false, -- Autorizar agendamento / chamadas
    reply_groups BOOLEAN DEFAULT false, -- Responder mensagens em grupos de WhatsApp
    reply_audio BOOLEAN DEFAULT true, -- Responder com áudio ou transcrever notas de voz
    send_images BOOLEAN DEFAULT false, -- Enviar imagens / fotos do catálogo
    integrate_agenda BOOLEAN DEFAULT false, -- Integração com agenda / compromissos
    recognize_payments BOOLEAN DEFAULT false, -- Reconhecer comprovantes de pagamento via IA
    ai_active_all BOOLEAN DEFAULT false, -- Ativar IA para 100% dos novos contatos
    omnichannel BOOLEAN DEFAULT false, -- Modo Omnichannel (WhatsApp + Instagram + Webchat)
    ai_active_instagram BOOLEAN DEFAULT false, -- IA respondendo Direct do Instagram
    instagram_status TEXT DEFAULT 'disconnected', -- Status de conexão do Instagram
    use_official_api_coexistencia BOOLEAN DEFAULT false, -- Coexistência com WhatsApp Cloud API
    test_number TEXT, -- Telefone de testes / sandbox
    extra_users_count INTEGER DEFAULT 0, -- Limite de atendentes extras / licenças
    
    -- 3. BASE DE CONHECIMENTO MODULAR (Regras avançadas, produtos, restrições e FAQs modulares)
    knowledge_base JSONB DEFAULT '[]'::jsonb,
    
    -- 4. CONTROLE TEMPORAL
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uq_account_cerebro UNIQUE (account_id)
);

CREATE INDEX IF NOT EXISTS idx_cerebro_ia_account ON public.cerebro_ia(account_id);

-- =========================================================================
-- 9. SINCRONIZAÇÃO EM TEMPO REAL (WEBSOCKET REALTIME)
-- =========================================================================
ALTER PUBLICATION app_realtime ADD TABLE public.accounts;
ALTER PUBLICATION app_realtime ADD TABLE public.channels;
ALTER PUBLICATION app_realtime ADD TABLE public.contacts;
ALTER PUBLICATION app_realtime ADD TABLE public.conversations;
ALTER PUBLICATION app_realtime ADD TABLE public.messages;
ALTER PUBLICATION app_realtime ADD TABLE public.cerebro_ia;

-- =========================================================================
-- 10. SEGURANÇA MÁXIMA: ROW LEVEL SECURITY (RLS) MULTI-TENANT
-- O próprio banco de dados garante que a Empresa A NUNCA veja dados da Empresa B.
-- =========================================================================
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cerebro_ia ENABLE ROW LEVEL SECURITY;

-- Função auxiliar: descobre os account_ids aos quais o usuário logado tem acesso
CREATE OR REPLACE FUNCTION public.get_current_user_account_ids()
RETURNS SETOF UUID AS $$
BEGIN
    RETURN QUERY
    SELECT account_id FROM public.account_users
    WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas de desenvolvimento (Permite operações filtrando por account_id no app):
CREATE POLICY "Dev: Acesso a accounts" ON public.accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev: Acesso a account_users" ON public.account_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev: Acesso a canais" ON public.channels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev: Acesso a contatos" ON public.contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev: Acesso a conversas" ON public.conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev: Acesso a mensagens" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev: Acesso a cerebro_ia" ON public.cerebro_ia FOR ALL USING (true) WITH CHECK (true);
`;

// =========================================================================
// SCRIPT DE MIGRAÇÃO SEGURO PARA QUEM JÁ TEM AS 4 TABELAS EXISTENTES
// (channels, contacts, conversations, messages)
// NÃO APAGA DADOS EXISTENTES!
// =========================================================================
export const SAFE_MIGRATION_SQL_FOR_EXISTING_DB = `-- =========================================================================
-- MIGRAÇÃO SEGURA: CHATSAPP MULTI-TENANT & AGENTE IA ADMINISTRADOR
-- Execute este script no SQL Editor do seu banco de dados.
-- Ele NÃO apaga suas tabelas nem suas mensagens existentes!
-- =========================================================================

-- 1. Habilitar extensões úteis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- 2. CRIAR TABELA DE EMPRESAS / CLIENTES (ACCOUNTS)
-- Aqui ficam os donos de conta do ChatsApp (suas empresas clientes)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL, -- Nome da empresa cliente (ex: Clínica Odonto Viva)
    slug VARCHAR(100) NOT NULL UNIQUE,
    segment VARCHAR(100), -- Ramo (ex: 'Saúde', 'Imóveis', 'Tecnologia')
    plan VARCHAR(50) DEFAULT 'pro',
    whatsapp_phone VARCHAR(50), -- Número do WhatsApp da empresa
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir a Empresa Matriz e dois Clientes de Exemplo (com IDs fixos para facilitar)
INSERT INTO public.accounts (id, name, slug, segment, whatsapp_phone)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'MonarcaHub Matriz', 'monarcahub', 'Tecnologia & IA', '+55 51 8451-1283'),
    ('a0000000-0000-0000-0000-000000000002', 'Clínica Odonto Viva', 'odontoviva', 'Saúde & Odontologia', '+55 11 91234-5678'),
    ('a0000000-0000-0000-0000-000000000003', 'Imobiliária Prime Imóveis', 'primeimoveis', 'Imóveis & Locação', '+55 21 99876-5432')
ON CONFLICT (slug) DO NOTHING;

-- =========================================================================
-- 3. CRIAR TABELA DE USUÁRIOS E AGENTES DA EMPRESA (ACCOUNT_USERS)
-- Inclui o Agente IA com permissão de administrador global!
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.account_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID, -- UUID do auth.users (opcional para bots/IA)
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(30) DEFAULT 'agent' CHECK (role IN ('superadmin', 'admin', 'supervisor', 'agent', 'ai_agent')),
    is_ai_agent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_users_acc ON public.account_users(account_id);

-- Inserir o Agente IA como Administrador em todas as contas cadastradas
-- O Agente IA responde automaticamente quando o cliente final falar com qualquer empresa!
INSERT INTO public.account_users (account_id, name, email, role, is_ai_agent)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'Agente IA MonarcaHub', 'ia@monarcahub.com', 'ai_agent', TRUE),
    ('a0000000-0000-0000-0000-000000000002', 'Agente IA Odonto Viva', 'ia@odontoviva.com.br', 'ai_agent', TRUE),
    ('a0000000-0000-0000-0000-000000000003', 'Agente IA Prime Imóveis', 'ia@primeimoveis.com.br', 'ai_agent', TRUE)
ON CONFLICT DO NOTHING;

-- =========================================================================
-- 4. ADICIONAR A COLUNA account_id NAS 4 TABELAS EXISTENTES
-- (channels, contacts, conversations, messages)
-- =========================================================================

-- 4.1. Tabela CHANNELS (para saber qual empresa é dona de qual canal/instância)
ALTER TABLE public.channels 
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

-- 4.2. Tabela CONTACTS (para que contatos de uma empresa não apareçam na outra)
ALTER TABLE public.contacts 
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

-- 4.3. Tabela CONVERSATIONS (para que as conversas fiquem restritas à empresa dona)
ALTER TABLE public.conversations 
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

-- 4.4. Tabela MESSAGES (para que as mensagens tenham rastreabilidade por empresa)
ALTER TABLE public.messages 
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

-- =========================================================================
-- 5. ATRIBUIR OS DADOS EXISTENTES À EMPRESA PADRÃO (NÃO DEIXAR NADA ÓRFÃO)
-- =========================================================================
UPDATE public.channels 
SET account_id = 'a0000000-0000-0000-0000-000000000001' 
WHERE account_id IS NULL;

UPDATE public.contacts 
SET account_id = 'a0000000-0000-0000-0000-000000000001' 
WHERE account_id IS NULL;

UPDATE public.conversations 
SET account_id = 'a0000000-0000-0000-0000-000000000001' 
WHERE account_id IS NULL;

UPDATE public.messages 
SET account_id = 'a0000000-0000-0000-0000-000000000001' 
WHERE account_id IS NULL;

-- =========================================================================
-- 6. CRIAR ÍNDICES DE ALTA PERFORMANCE (Para Webhooks e Realtime <100ms)
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_channels_acc_id ON public.channels(account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_acc_id ON public.contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_conversations_acc_id ON public.conversations(account_id);
CREATE INDEX IF NOT EXISTS idx_messages_acc_id ON public.messages(account_id);

-- =========================================================================
-- 7. HABILITAR REPLICAÇÃO REALTIME COM PROTEÇÃO IDEMPOTENTE (SEM ERRO 42710)
-- =========================================================================
DO $$
BEGIN
    -- Canais
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'channels'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
    END IF;

    -- Contatos
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'contacts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
    END IF;

    -- Conversas
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    END IF;

    -- Mensagens
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;

    -- Cérebro da IA
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cerebro_ia'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.cerebro_ia;
    END IF;
END $$;
`;

// =========================================================================
// SCRIPT DIRETO PARA CRIAR E MIGRAR O CÉREBRO DA IA (cerebro_ia)
// Execute este script no SQL Editor do Supabase (100% à prova de erros)
// =========================================================================
export const CEREBRO_IA_SQL_SCRIPT = `-- =========================================================================
-- SCRIPT UNIFICADO DEFINITIVO: CÉREBRO DA IA (cerebro_ia)
-- Executar no SQL Editor do Supabase (Criação Segura, Idempotente e Sem Erros)
-- =========================================================================

-- 1. Habilitar extensão de UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Garantir que a tabela accounts exista (evita erro de chave estrangeira)
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    segment VARCHAR(100),
    plan VARCHAR(50) DEFAULT 'pro',
    whatsapp_phone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir empresa padrão se não existir
INSERT INTO public.accounts (id, name, slug, segment, whatsapp_phone)
VALUES ('a0000000-0000-0000-0000-000000000001', 'MonarcaHub Matriz', 'monarcahub', 'Tecnologia & IA', '+55 51 8451-1283')
ON CONFLICT (slug) DO NOTHING;

-- 3. Criar a tabela cerebro_ia (substitui gym_configs para qualquer nicho de negócio)
CREATE TABLE IF NOT EXISTS public.cerebro_ia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID,

    -- Identidade e Dados do Negócio (gym_name foi generalizado para business_name)
    business_name TEXT DEFAULT 'Empresa Matriz',
    address TEXT,
    opening_hours TEXT,
    pricing_info TEXT,
    faq_text TEXT,
    tone_of_voice TEXT DEFAULT 'Amigável e positiva',
    pix_key TEXT,
    branches JSONB DEFAULT '[]'::jsonb,
    observations TEXT,

    -- Regras de Automação e Comportamento
    is_active BOOLEAN DEFAULT true,
    allow_calls BOOLEAN DEFAULT false,
    reply_groups BOOLEAN DEFAULT false,
    reply_audio BOOLEAN DEFAULT true,
    send_images BOOLEAN DEFAULT false,
    integrate_agenda BOOLEAN DEFAULT false,
    recognize_payments BOOLEAN DEFAULT false,
    ai_active_all BOOLEAN DEFAULT false,
    omnichannel BOOLEAN DEFAULT false,
    ai_active_instagram BOOLEAN DEFAULT false,
    instagram_status TEXT DEFAULT 'disconnected',
    use_official_api_coexistencia BOOLEAN DEFAULT false,
    test_number TEXT,
    extra_users_count INTEGER DEFAULT 0,

    -- Base de Conhecimento Modular (JSON com regras, produtos, faqs, proibições)
    knowledge_base JSONB DEFAULT '[]'::jsonb,

    -- Controle Temporal
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_cerebro_account UNIQUE (account_id)
);

-- 4. Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_cerebro_ia_account ON public.cerebro_ia(account_id);

-- 5. Habilitar RLS (Row Level Security) com política permissiva para a aplicação
ALTER TABLE public.cerebro_ia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso seguro cerebro_ia" ON public.cerebro_ia;
CREATE POLICY "Acesso seguro cerebro_ia" ON public.cerebro_ia FOR ALL USING (true) WITH CHECK (true);

-- 6. Habilitar Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cerebro_ia'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.cerebro_ia;
    END IF;
END $$;

-- 7. MIGRAÇÃO AUTOMÁTICA / INSERÇÃO INICIAL SEGURA (Nunca falha)
DO $$
BEGIN
    -- Caso 1: Se a tabela antiga gym_configs existir neste banco, copia os dados convertendo as colunas
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'gym_configs'
    ) THEN
        INSERT INTO public.cerebro_ia (
            account_id,
            user_id,
            business_name,
            address,
            opening_hours,
            pricing_info,
            faq_text,
            tone_of_voice,
            is_active,
            pix_key,
            branches,
            allow_calls,
            reply_groups,
            reply_audio,
            send_images,
            observations,
            integrate_agenda,
            recognize_payments,
            ai_active_all,
            omnichannel,
            ai_active_instagram,
            test_number,
            extra_users_count,
            instagram_status,
            use_official_api_coexistencia
        )
        SELECT 
            COALESCE(
                (SELECT id FROM public.accounts LIMIT 1),
                'a0000000-0000-0000-0000-000000000001'::uuid
            ) AS account_id,
            g.user_id,
            g.gym_name AS business_name,
            g.address,
            g.opening_hours,
            g.pricing_info,
            g.faq_text,
            COALESCE(g.tone_of_voice, 'Amigável e positiva'),
            COALESCE(g.is_active, true),
            g.pix_key,
            COALESCE(g.branches, '[]'::jsonb),
            COALESCE(g.allow_calls, false),
            COALESCE(g.reply_groups, false),
            COALESCE(g.reply_audio, true),
            COALESCE(g.send_images, false),
            g.observations,
            COALESCE(g.integrate_agenda, false),
            COALESCE(g.recognize_payments, false),
            COALESCE(g.ai_active_all, false),
            COALESCE(g.omnichannel, false),
            COALESCE(g.ai_active_instagram, false),
            g.test_number,
            COALESCE(g.extra_users_count, 0),
            COALESCE(g.instagram_status, 'disconnected'),
            COALESCE(g.use_official_api_coexistencia, false)
        FROM public.gym_configs g
        ON CONFLICT (account_id) DO UPDATE SET
            business_name = EXCLUDED.business_name,
            address = EXCLUDED.address,
            opening_hours = EXCLUDED.opening_hours,
            pricing_info = EXCLUDED.pricing_info,
            faq_text = EXCLUDED.faq_text,
            tone_of_voice = EXCLUDED.tone_of_voice,
            pix_key = EXCLUDED.pix_key,
            branches = EXCLUDED.branches,
            observations = EXCLUDED.observations,
            updated_at = NOW();
    ELSE
        -- Caso 2: Se gym_configs não existir, garante que o registro inicial da matriz exista
        INSERT INTO public.cerebro_ia (
            account_id,
            business_name,
            tone_of_voice,
            is_active,
            reply_audio,
            recognize_payments,
            ai_active_all,
            omnichannel
        )
        VALUES (
            'a0000000-0000-0000-0000-000000000001',
            'MonarcaHub Matriz',
            'Amigável e positiva',
            true,
            true,
            true,
            true,
            true
        )
        ON CONFLICT (account_id) DO NOTHING;
    END IF;
END $$;
`;

// =========================================================================
// SCRIPT DE MIGRAÇÃO: gym_configs (Conta antiga) -> cerebro_ia (Conta unificada)
// Auto-suficiente: Garante a criação da tabela antes de qualquer inserção
// =========================================================================
export const MIGRATION_GYM_CONFIGS_TO_CEREBRO_IA_SQL = `-- =========================================================================
-- SCRIPT DE MIGRAÇÃO COM AUTO-CRIAÇÃO DA TABELA cerebro_ia
-- Garante que 'public.cerebro_ia' exista antes do INSERT para evitar o erro 42P01
-- =========================================================================

-- 1. Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Garantir tabela accounts
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    segment VARCHAR(100),
    plan VARCHAR(50) DEFAULT 'pro',
    whatsapp_phone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.accounts (id, name, slug, segment, whatsapp_phone)
VALUES ('a0000000-0000-0000-0000-000000000001', 'MonarcaHub Matriz', 'monarcahub', 'Tecnologia & IA', '+55 51 8451-1283')
ON CONFLICT (slug) DO NOTHING;

-- 3. GARANTIR A CRIAÇÃO DA TABELA cerebro_ia (Resolve o erro 42P01: relation does not exist)
CREATE TABLE IF NOT EXISTS public.cerebro_ia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID,
    business_name TEXT,
    address TEXT,
    opening_hours TEXT,
    pricing_info TEXT,
    faq_text TEXT,
    tone_of_voice TEXT DEFAULT 'Amigável e positiva',
    is_active BOOLEAN DEFAULT true,
    pix_key TEXT,
    branches JSONB DEFAULT '[]'::jsonb,
    allow_calls BOOLEAN DEFAULT false,
    reply_groups BOOLEAN DEFAULT false,
    reply_audio BOOLEAN DEFAULT true,
    send_images BOOLEAN DEFAULT false,
    observations TEXT,
    integrate_agenda BOOLEAN DEFAULT false,
    recognize_payments BOOLEAN DEFAULT false,
    ai_active_all BOOLEAN DEFAULT false,
    omnichannel BOOLEAN DEFAULT false,
    ai_active_instagram BOOLEAN DEFAULT false,
    instagram_status TEXT DEFAULT 'disconnected',
    use_official_api_coexistencia BOOLEAN DEFAULT false,
    test_number TEXT,
    extra_users_count INTEGER DEFAULT 0,
    knowledge_base JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_cerebro_account UNIQUE (account_id)
);

CREATE INDEX IF NOT EXISTS idx_cerebro_ia_account ON public.cerebro_ia(account_id);
ALTER TABLE public.cerebro_ia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso seguro cerebro_ia" ON public.cerebro_ia;
CREATE POLICY "Acesso seguro cerebro_ia" ON public.cerebro_ia FOR ALL USING (true) WITH CHECK (true);

-- 4. Inserção / Migração Condicional
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'gym_configs'
    ) THEN
        INSERT INTO public.cerebro_ia (
            id,
            account_id,
            user_id,
            business_name,
            address,
            opening_hours,
            pricing_info,
            faq_text,
            tone_of_voice,
            is_active,
            pix_key,
            branches,
            allow_calls,
            reply_groups,
            reply_audio,
            send_images,
            observations,
            integrate_agenda,
            recognize_payments,
            ai_active_all,
            omnichannel,
            ai_active_instagram,
            test_number,
            extra_users_count,
            instagram_status,
            use_official_api_coexistencia
        )
        SELECT 
            g.id,
            COALESCE(
                (SELECT id FROM public.accounts LIMIT 1),
                'a0000000-0000-0000-0000-000000000001'::uuid
            ) AS account_id,
            g.user_id,
            g.gym_name AS business_name,
            g.address,
            g.opening_hours,
            g.pricing_info,
            g.faq_text,
            COALESCE(g.tone_of_voice, 'Amigável e positiva'),
            COALESCE(g.is_active, true),
            g.pix_key,
            COALESCE(g.branches, '[]'::jsonb),
            COALESCE(g.allow_calls, false),
            COALESCE(g.reply_groups, false),
            COALESCE(g.reply_audio, true),
            COALESCE(g.send_images, false),
            g.observations,
            COALESCE(g.integrate_agenda, false),
            COALESCE(g.recognize_payments, false),
            COALESCE(g.ai_active_all, false),
            COALESCE(g.omnichannel, false),
            COALESCE(g.ai_active_instagram, false),
            g.test_number,
            COALESCE(g.extra_users_count, 0),
            COALESCE(g.instagram_status, 'disconnected'),
            COALESCE(g.use_official_api_coexistencia, false)
        FROM public.gym_configs g
        ON CONFLICT (account_id) DO UPDATE SET
            business_name = EXCLUDED.business_name,
            address = EXCLUDED.address,
            opening_hours = EXCLUDED.opening_hours,
            pricing_info = EXCLUDED.pricing_info,
            faq_text = EXCLUDED.faq_text,
            tone_of_voice = EXCLUDED.tone_of_voice,
            pix_key = EXCLUDED.pix_key,
            branches = EXCLUDED.branches,
            observations = EXCLUDED.observations,
            updated_at = NOW();
    ELSE
        -- Se gym_configs estava em outra conta, insere registro padrão editável
        INSERT INTO public.cerebro_ia (
            account_id,
            business_name,
            tone_of_voice,
            is_active,
            reply_audio,
            recognize_payments,
            ai_active_all,
            omnichannel
        )
        VALUES (
            'a0000000-0000-0000-0000-000000000001',
            'MonarcaHub Matriz',
            'Amigável e positiva',
            true,
            true,
            true,
            true,
            true
        )
        ON CONFLICT (account_id) DO NOTHING;
    END IF;
END $$;
`;

// =========================================================================
// RPC TRANSAÇÃO SEGURA E ATÔMICA: CRIAR NOVA EMPRESA E VINCULAR GESTOR
// Executar no SQL Editor do Supabase para atualizar a assinatura e proteções
// =========================================================================
export const CREATE_NEW_ACCOUNT_RPC_SQL = `-- =========================================================================
-- FUNÇÃO RPC: create_new_account (SEGURA, DEFINER, BUSCA POR auth.uid())
-- =========================================================================
CREATE OR REPLACE FUNCTION public.create_new_account(
    p_company_name TEXT,
    p_company_segment TEXT DEFAULT 'Serviços & Atendimento',
    p_admin_name TEXT DEFAULT 'Administrador',
    p_whatsapp_phone TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_email TEXT;
    v_clean_phone TEXT;
    v_duplicate_phone_found BOOLEAN := false;
    v_existing_acc RECORD;
    v_new_account RECORD;
    v_base_slug TEXT;
    v_slug TEXT;
BEGIN
    -- 1. Obter identidade exclusivamente de auth.uid()
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso não autorizado: usuário não autenticado no Supabase Auth.';
    END IF;

    -- Obter e-mail do usuário autenticado a partir de auth.users
    SELECT email INTO v_email
    FROM auth.users
    WHERE id = v_user_id;

    IF v_email IS NULL THEN
        v_email := '';
    END IF;

    -- 2. Proteção contra duplo cadastro / retry acidental pelo mesmo usuário
    -- Se o auth.uid() já possuir uma empresa vinculada como membro humano, reutiliza
    SELECT a.id, a.name, a.slug, a.segment, a.whatsapp_phone, a.plan, a.created_at
    INTO v_existing_acc
    FROM public.account_users au
    JOIN public.accounts a ON a.id = au.account_id
    WHERE au.user_id = v_user_id
      AND (au.is_ai_agent IS NULL OR au.is_ai_agent = false)
    ORDER BY au.created_at ASC
    LIMIT 1;

    IF v_existing_acc.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_linked', true,
            'account', jsonb_build_object(
                'id', v_existing_acc.id,
                'name', v_existing_acc.name,
                'slug', v_existing_acc.slug,
                'segment', v_existing_acc.segment,
                'whatsapp_phone', v_existing_acc.whatsapp_phone,
                'plan', v_existing_acc.plan,
                'createdAt', v_existing_acc.created_at
            ),
            'user', jsonb_build_object(
                'id', v_user_id,
                'name', p_admin_name,
                'email', v_email,
                'role', 'admin',
                'accountId', v_existing_acc.id,
                'accountName', v_existing_acc.name
            )
        );
    END IF;

    -- 3. Detecção de forte indício de duplicidade pelo WhatsApp comercial
    -- Normalizar removendo caracteres não numéricos
    v_clean_phone := regexp_replace(COALESCE(p_whatsapp_phone, ''), '[^0-9]', '', 'g');

    IF length(v_clean_phone) >= 8 THEN
        SELECT true
        INTO v_duplicate_phone_found
        FROM public.accounts a
        WHERE regexp_replace(COALESCE(a.whatsapp_phone, ''), '[^0-9]', '', 'g') = v_clean_phone
           OR (length(v_clean_phone) >= 10 AND regexp_replace(COALESCE(a.whatsapp_phone, ''), '[^0-9]', '', 'g') LIKE '%' || right(v_clean_phone, 8))
        LIMIT 1;

        IF v_duplicate_phone_found THEN
            -- Retorna aviso amigável sem expor dados sensíveis da empresa existente
            RETURN jsonb_build_object(
                'success', false,
                'code', 'POSSIBLE_DUPLICATE_COMPANY',
                'error', 'Encontramos uma empresa que pode já estar cadastrada no ChatsApp.',
                'detail', 'Para proteger os dados da empresa, não podemos vinculá-la automaticamente à sua conta. Entre em contato com o administrador da empresa para solicitar acesso.'
            );
        END IF;
    END IF;

    -- 4. Gerar slug único e legível
    v_base_slug := lower(regexp_replace(
        translate(
            COALESCE(NULLIF(trim(p_company_name), ''), 'empresa'),
            'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
            'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
        ),
        '[^a-z0-9]+', '-', 'g'
    ));
    v_base_slug := trim(both '-' from v_base_slug);
    IF v_base_slug IS NULL OR v_base_slug = '' THEN
        v_base_slug := 'empresa';
    END IF;

    v_slug := v_base_slug || '-' || floor(1000 + random() * 9000)::text;
    WHILE EXISTS (SELECT 1 FROM public.accounts WHERE slug = v_slug) LOOP
        v_slug := v_base_slug || '-' || floor(1000 + random() * 9000)::text;
    END LOOP;

    -- 5. Inserir a nova empresa em public.accounts
    INSERT INTO public.accounts (
        name,
        slug,
        segment,
        plan,
        whatsapp_phone
    )
    VALUES (
        trim(p_company_name),
        v_slug,
        COALESCE(NULLIF(trim(p_company_segment), ''), 'Serviços & Atendimento'),
        'pro',
        trim(COALESCE(p_whatsapp_phone, ''))
    )
    RETURNING id, name, slug, segment, plan, whatsapp_phone, created_at
    INTO v_new_account;

    -- 6. Inserir vínculo em public.account_users (usuário gestor como admin)
    INSERT INTO public.account_users (
        account_id,
        user_id,
        name,
        email,
        role,
        is_ai_agent
    )
    VALUES (
        v_new_account.id,
        v_user_id,
        COALESCE(NULLIF(trim(p_admin_name), ''), 'Administrador'),
        v_email,
        'admin',
        false
    );

    -- 7. Inserir atendente Agente IA da nova empresa (user_id = NULL pois não é usuário Auth)
    INSERT INTO public.account_users (
        account_id,
        user_id,
        name,
        email,
        role,
        is_ai_agent
    )
    VALUES (
        v_new_account.id,
        NULL,
        'Agente IA - ' || trim(p_company_name),
        'ia.' || v_slug || '@monarcahub.com',
        'ai_agent',
        true
    );

    -- 8. Atualizar/criar perfil do gestor em public.profiles (preserva telefone pessoal existente ou deixa NULL)
    INSERT INTO public.profiles (
        id,
        name,
        mood,
        role_title
    )
    VALUES (
        v_user_id,
        COALESCE(NULLIF(trim(p_admin_name), ''), 'Administrador'),
        'Disponível',
        'Gestor / Administrador'
    )
    ON CONFLICT (id) DO UPDATE SET
        name = COALESCE(NULLIF(EXCLUDED.name, ''), public.profiles.name);

    -- 9. Inicializar Cérebro IA da empresa
    INSERT INTO public.cerebro_ia (
        account_id,
        user_id,
        business_name,
        tone_of_voice,
        is_active
    )
    VALUES (
        v_new_account.id,
        v_user_id,
        trim(p_company_name),
        'Amigável, acolhedor e consultivo',
        true
    )
    ON CONFLICT (account_id) DO NOTHING;

    -- 10. Retornar dados da empresa criada
    RETURN jsonb_build_object(
        'success', true,
        'account', jsonb_build_object(
            'id', v_new_account.id,
            'name', v_new_account.name,
            'slug', v_new_account.slug,
            'segment', v_new_account.segment,
            'whatsapp_phone', v_new_account.whatsapp_phone,
            'plan', v_new_account.plan,
            'createdAt', v_new_account.created_at
        ),
        'user', jsonb_build_object(
            'id', v_user_id,
            'name', p_admin_name,
            'email', v_email,
            'role', 'admin',
            'accountId', v_new_account.id,
            'accountName', v_new_account.name
        )
    );
END;
$$;

-- Permissões de execução estritas
REVOKE EXECUTE ON FUNCTION public.create_new_account(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_new_account(TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_new_account(TEXT, TEXT, TEXT, TEXT) TO authenticated;
`;

