import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Map sheet "Etapa" to pipeline stages
function mapStatus(status: string): { pipe: string; sdr_stage: string | null; closer_stage: string | null } {
  const s = (status || '').toLowerCase().trim()
  
  // SDR stages
  if (s.includes('lead') || s.includes('novo')) return { pipe: 'sdr', sdr_stage: 'lead', closer_stage: null }
  if (s.includes('fez contato') || s.includes('em contato') || s.includes('conecta')) return { pipe: 'sdr', sdr_stage: 'conectado', closer_stage: null }
  if (s.includes('sql') || s.includes('qualificado')) return { pipe: 'sdr', sdr_stage: 'sql', closer_stage: null }
  if (s.includes('reunião marcada') || s.includes('reuniao marcada') || s.includes('marcada')) {
    return { pipe: 'closer', sdr_stage: null, closer_stage: 'reuniao_agendada' }
  }
  
  // Closer stages
  if (s.includes('no show') || s.includes('noshow')) return { pipe: 'closer', sdr_stage: null, closer_stage: 'no_show' }
  if (s.includes('realizada')) return { pipe: 'closer', sdr_stage: null, closer_stage: 'reuniao_realizada' }
  if (s.includes('link') || s.includes('enviado')) return { pipe: 'closer', sdr_stage: null, closer_stage: 'link_enviado' }
  if (s.includes('contrato') || s.includes('assinado') || s.includes('fechado')) return { pipe: 'closer', sdr_stage: null, closer_stage: 'contrato_assinado' }
  
  return { pipe: 'sdr', sdr_stage: 'lead', closer_stage: null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
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
      const nome = lead.nome || lead.Nome || lead.name || lead.Name || 'Sem nome'
      const telefone = lead.telefone || lead.Telefone || lead.phone || lead.Phone || ''
      const email = lead.email || lead.Email || ''
      const cnpj = lead.cnpj || lead.CNPJ || ''
      const valorDivida = lead.valor_divida || lead.valor || lead.Valor || null
      const origem = lead.origem || lead.source || lead.Source || lead.Origem || ''
      const status = lead.etapa || lead.Etapa || lead.status || lead.Status || 'lead'
      const sheetRowId = lead.sheet_row_id || lead.row_id || lead.id || lead.ID || ''
      const leadUf = lead.uf || lead.UF || ''
      const leadData = lead.data || lead.Data || ''

      const { pipe, sdr_stage, closer_stage } = mapStatus(status)

      // Check if card exists by sheet_row_id
      if (sheetRowId) {
        const { data: existing } = await supabase
          .from('pipeline_cards')
          .select('id')
          .eq('sheet_row_id', String(sheetRowId))
          .maybeSingle()

        if (existing) {
          const { data, error } = await supabase
            .from('pipeline_cards')
            .update({ nome, telefone, email, cnpj, valor_divida: valorDivida, pipe, sdr_stage, closer_stage, origem })
            .eq('id', existing.id)
            .select()
            .single()

          if (error) throw error
          results.push({ action: 'updated', card: data })
          continue
        }
      }

      // Insert new
      const { data, error } = await supabase
        .from('pipeline_cards')
        .insert({ nome, telefone, email, cnpj, valor_divida: valorDivida, pipe, sdr_stage, closer_stage, origem, sheet_row_id: sheetRowId || null })
        .select()
        .single()

      if (error) throw error
      results.push({ action: 'created', card: data })
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
