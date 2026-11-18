export interface N8nPayloadExample {
  title: string;
  description: string;
  componentNode: string;
  payload: any;
}

export const N8N_PAYLOAD_GUIDES: N8nPayloadExample[] = [
  {
    title: '1. Webhook Recebido (WhatsApp Cloud API)',
    description: 'Payload recebido quando um cliente envia mensagem ou quando o atendente envia pelo celular físico (Modo Coexistência).',
    componentNode: 'Webhook Receptor',
    payload: {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_ID_10482938102',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '5511999887766',
                  phone_number_id: 'PHONE_NUMBER_ID_4829'
                },
                contacts: [
                  {
                    profile: { name: 'Joseane Silva' },
                    wa_id: '5511987654321'
                  }
                ],
                messages: [
                  {
                    from: '5511987654321',
                    id: 'wamid.HBgLMTE5ODc2NTQzMjEVAgASGBQzQjE2RkFFMzE0MTI4Qzg5',
                    timestamp: '1725648800',
                    text: {
                      body: 'Olá, gostaria de saber se vocês têm horário disponível para amanhã?'
                    },
                    type: 'text'
                  }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ]
    }
  },
  {
    title: '2. Sincronização Inteligente de Avatar (Storage + avatar_updated_at)',
    description: 'Verificação periódica para atualizar a foto de perfil do contato e persistir a URL direta no banco de dados.',
    componentNode: 'Armazenamento em Nuvem',
    payload: {
      step: 'Check & Cache Avatar',
      condition: 'avatar_updated_at IS NULL OR avatar_updated_at < NOW() - INTERVAL 7 DAYS',
      storage_bucket: 'avatars',
      target_file_path: 'contacts/5511987654321.jpg',
      update_contact_record: {
        avatar_url: 'https://storage.monarcahub.com/avatars/contacts/5511987654321.jpg',
        avatar_updated_at: '2026-09-06T15:25:00Z'
      }
    }
  },
  {
    title: '3. Inserção Idempotente + Coexistência (Messages)',
    description: 'Se fromMe=true (celular físico / smb_message_echoes), gravar sender_type="coexistence_mobile" e status="sent" (ou "read"). O trigger zera unread_count automaticamente.',
    componentNode: 'Gravação no Banco (n8n -> Supabase)',
    payload: {
      conversation_id: 'c87f2231-10d9-4a0b-99d8-91fb5796b4ef',
      sender_type: 'coexistence_mobile', // 'contact' | 'agent' | 'ai' | 'coexistence_mobile'
      sender_name: 'Dispositivo Móvel',
      content_type: 'text',
      content: 'Perfeito! Já deixei agendado para você às 10h.',
      status: 'sent', // 'sent' | 'delivered' | 'read' (nunca deixar pendente)
      meta_message_id: 'wamid.HBgLMTE5ODc2NTQzMjEVAgASGBQzQjE2RkFFMzE0MTI4Qzg5',
      metadata: {
        channel: 'whatsapp',
        fromMe: true,
        viaCoexistence: true,
        wamid: 'wamid.HBgLMTE5ODc2NTQzMjEVAgASGBQzQjE2RkFFMzE0MTI4Qzg5',
      }
    }
  },
  {
    title: '4. Atualização de Status (sent / delivered / read) e Limpeza de Não Lidas',
    description: 'Ao receber messages.update (Evolution) ou statuses[] (Meta), atualize status na tabela messages e zere unread_count na conversa quando lida/sincronizada.',
    componentNode: 'Atualização de Status (Webhook -> Supabase)',
    payload: {
      webhook_endpoint: '/api/webhooks/incoming',
      match_column: 'metadata->>wamid',
      match_value: 'wamid.HBgLMTE5ODc2NTQzMjEVAgASGBQzQjE2RkFFMzE0MTI4Qzg5',
      status: 'read', // Normalizado para: 'sent' | 'delivered' | 'read'
      fromMe: true,
      clear_conversation_unread: true,
      rpc_alternative: 'sync_whatsapp_message_status(p_wamid, p_status, p_conversation_id, p_clear_unread)'
    }
  },
  {
    title: '5. Disparo do Agente de IA (Quando IA está Ativa)',
    description: 'Se a conversa estiver com status ativo de IA, o assistente gera a resposta e a transmite para a conversa.',
    componentNode: 'Motor de IA + Disparo',
    payload: {
      conversation_id: 'c87f2231-10d9-4a0b-99d8-91fb5796b4ef',
      sender_type: 'bot',
      sender_name: 'Atendente Virtual IA',
      content_type: 'text',
      content: 'Olá Joseane! Temos sim, temos horários às 10h e às 15h30. Qual fica melhor para você?',
      status: 'sent',
      metadata: {
        ai_model: 'gemini-2.5-flash',
        confidence_score: 0.98,
        intent_detected: 'agendamento_horario'
      }
    }
  }
];
