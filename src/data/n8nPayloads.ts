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
    title: '3. Inserção Formatada com Idempotência (Messages)',
    description: 'Estrutura JSON para persistência na tabela "messages". O trigger automático atualiza a ordenação da conversa e a contagem de não lidas.',
    componentNode: 'Gravação no Banco',
    payload: {
      conversation_id: 'c87f2231-10d9-4a0b-99d8-91fb5796b4ef',
      sender_type: 'customer', // 'customer' | 'agent' | 'bot' | 'coexistence_mobile'
      sender_name: 'Joseane Silva',
      content_type: 'text', // 'text' | 'audio' | 'image' | 'video'
      content: 'Olá, gostaria de saber se vocês têm horário disponível para amanhã?',
      status: 'delivered',
      meta_message_id: 'wamid.HBgLMTE5ODc2NTQzMjEVAgASGBQzQjE2RkFFMzE0MTI4Qzg5', // Garante unicidade
      metadata: {
        channel: 'whatsapp',
        phone_number_id: 'PHONE_NUMBER_ID_4829',
        raw_timestamp: 1725648800,
        ai_evaluation_needed: true
      }
    }
  },
  {
    title: '4. Atualização de Status de Leitura (Check Azul no WhatsApp)',
    description: 'Quando a confirmação de leitura é recebida, o status da mensagem é atualizado usando o meta_message_id.',
    componentNode: 'Atualização de Leitura',
    payload: {
      target_table: 'messages',
      match_column: 'meta_message_id',
      match_value: 'wamid.HBgLMTE5ODc2NTQzMjEVAgASGBQzQjE2RkFFMzE0MTI4Qzg5',
      update_fields: {
        status: 'read',
        read_at: '2026-09-06T19:45:00Z'
      }
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
