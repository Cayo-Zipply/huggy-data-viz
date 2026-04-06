import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Map sheet "Etapa" to pipeline stages
function mapStatus(status: string): { pipe: string; sdr_stage: string | null; closer_stage: string | null } {
  const s = (status || '').toLowerCase().trim()
  
  // SDR stages
  if (s.includes('fez contato') || s.includes('lead') || s.includes('novo')) return { pipe: 'sdr', sdr_stage: 'lead', closer_stage: null }
  if (s.includes('conecta') || s.includes('em contato')) return { pipe: 'sdr', sdr_stage: 'conectado', closer_stage: null }
  if (s.includes('sql') || s.includes('qualificado')) return { pipe: 'sdr', sdr_stage: 'sql', closer_stage: null }
  if (s.includes('reunião marcada') || s.includes('reuniao marcada') || s.includes('marcada') || s.includes('agend')) {
    return { pipe: 'closer', sdr_stage: null, closer_stage: 'reuniao_agendada' }
  }
  
  // Closer stages
  if (s.includes('no show') || s.includes('noshow')) return { pipe: 'closer', sdr_stage: null, closer_stage: 'no_show' }
  if (s.includes('realizada')) return { pipe: 'closer', sdr_stage: null, closer_stage: 'reuniao_realizada' }
  if (s.includes('link') || s.includes('enviado')) return { pipe: 'closer', sdr_stage: null, closer_stage: 'link_enviado' }
  if (s.includes('contrato') || s.includes('assinado') || s.includes('fechado')) return { pipe: 'closer', sdr_stage: null, closer_stage: 'contrato_assinado' }
  
  return { pipe: 'sdr', sdr_stage: 'lead', closer_stage: null }
}

// Normalize phone: strip non-digits
function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '')
}

// Get a field from the lead object, trying multiple key variations
function getField(lead: Record<string, any>, ...keys: string[]): string {
  for (const key of keys) {
    if (lead[key] !== undefined && lead[key] !== null && String(lead[key]).trim() !== '') {
      return String(lead[key]).trim()
    }
  }
  return ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Also handle GET for webhook test/ping
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', message: 'Webhook pipeline ativo' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    console.log('Webhook received:', JSON.stringify(body))

    // Support single or batch
    const leads = Array.isArray(body) ? body : [body]

    const results = []
    for (const lead of leads) {
      const nome = getField(lead, 'nome', 'Nome', 'name', 'Name') || 'Sem nome'
      const telefone = normalizePhone(getField(lead, 'telefone', 'Telefone', 'phone', 'Phone', 'celular', 'Celular', 'whatsapp'))
      const email = getField(lead, 'email', 'Email', 'e-mail', 'E-mail')
      const cnpj = getField(lead, 'cnpj', 'CNPJ')
      const valorRaw = getField(lead, 'valor_divida', 'valor', 'Valor', 'Valor da Dívida', 'valor_da_divida')
      const valorDivida = valorRaw ? parseFloat(valorRaw.replace(/[^\d.,]/g, '').replace(',', '.')) || null : null
      const origem = getField(lead, 'origem', 'source', 'Source', 'Origem', 'canal', 'Canal')
      const etapa = getField(lead, 'etapa', 'Etapa', 'status', 'Status', 'stage', 'Stage') || 'lead'
      const sheetRowId = getField(lead, 'sheet_row_id', 'row_id', 'id', 'ID')

      const { pipe, sdr_stage, closer_stage } = mapStatus(etapa)

      // Try to find existing card: first by sheet_row_id, then by phone
      let existingId: string | null = null

      if (sheetRowId) {
        const { data } = await supabase
          .from('pipeline_cards')
          .select('id')
          .eq('sheet_row_id', String(sheetRowId))
          .maybeSingle()
        if (data) existingId = data.id
      }

      if (!existingId && telefone) {
        const { data } = await supabase
          .from('pipeline_cards')
          .select('id')
          .eq('telefone', telefone)
          .maybeSingle()
        if (data) existingId = data.id
      }

      if (existingId) {
        // Update existing card
        const updateData: Record<string, any> = { pipe, sdr_stage, closer_stage }
        if (nome && nome !== 'Sem nome') updateData.nome = nome
        if (telefone) updateData.telefone = telefone
        if (email) updateData.email = email
        if (cnpj) updateData.cnpj = cnpj
        if (valorDivida) updateData.valor_divida = valorDivida
        if (origem) updateData.origem = origem

        const { data: updated, error } = await supabase
          .from('pipeline_cards')
          .update(updateData)
          .eq('id', existingId)
          .select()
          .single()

        if (error) throw error
        results.push({ action: 'updated', card: updated })
      } else {
        // Insert new card
        const { data: created, error } = await supabase
          .from('pipeline_cards')
          .insert({
            nome, telefone, email, cnpj, valor_divida: valorDivida,
            pipe, sdr_stage, closer_stage, origem,
            sheet_row_id: sheetRowId || (telefone ? `phone-${telefone}` : null)
          })
          .select()
          .single()

        if (error) throw error
        results.push({ action: 'created', card: created })
      }
    }

    return new Response(JSON.stringify({ success: true, count: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
