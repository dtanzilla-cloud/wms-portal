const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

export interface ParsedEmail {
  action: 'IN' | 'OUT' | null
  quantity: number | null
  unit: string | null
  skuId: string | null
  lotNumber: string | null
  poNumber: string | null
  confidence: 'high' | 'low' | 'failed'
  rawIntent: string | null
}

interface SkuEntry {
  id: string
  name: string
  code: string
}

const FAILED: ParsedEmail = {
  action: null,
  quantity: null,
  unit: null,
  skuId: null,
  lotNumber: null,
  poNumber: null,
  confidence: 'failed',
  rawIntent: null,
}

export async function parseEmailWithClaude(
  senderEmail: string,
  subject: string,
  body: string,
  skuList: SkuEntry[],
): Promise<ParsedEmail> {
  const skuLines = skuList.map(s => `${s.code}: ${s.name} (id: ${s.id})`).join('\n')

  const userPrompt = `
From: ${senderEmail}
Subject: ${subject}

Body:
${body}

---
Available SKUs:
${skuLines || '(none)'}

Extract the inventory action from this email and return a JSON object with exactly these fields:
{
  "action": "IN" | "OUT" | null,
  "quantity": number | null,
  "unit": string | null,
  "sku_id": "<uuid from the SKU list above>" | null,
  "lot_number": string | null,
  "po_number": string | null,
  "confidence": "high" | "low" | "failed",
  "raw_intent": "one sentence summary of what the sender meant"
}

Set confidence to "high" only if action, quantity, and sku_id are all unambiguous.
Set confidence to "low" if anything is unclear or missing.
Set confidence to "failed" if no inventory action can be determined.
`.trim()

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: 'You are an inventory management assistant. Extract inventory actions from emails. Respond only with valid JSON, no markdown.',
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      console.error('[parseEmailWithClaude] API error', response.status, await response.text())
      return FAILED
    }

    const data = await response.json()
    const text: string = data?.content?.[0]?.text ?? ''

    const raw = JSON.parse(text)

    return {
      action: raw.action ?? null,
      quantity: raw.quantity ?? null,
      unit: raw.unit ?? null,
      skuId: raw.sku_id ?? null,
      lotNumber: raw.lot_number ?? null,
      poNumber: raw.po_number ?? null,
      confidence: raw.confidence ?? 'failed',
      rawIntent: raw.raw_intent ?? null,
    }
  } catch (err) {
    console.error('[parseEmailWithClaude]', err)
    return FAILED
  }
}
