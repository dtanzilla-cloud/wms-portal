import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/server'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

export type ReplyStatus = 'applied' | 'clarification_needed' | 'rejected'

export interface ReplyData {
  action?: 'IN' | 'OUT' | null
  quantity?: number | null
  unit?: string | null
  skuId?: string | null
  rawIntent?: string | null
  movementId?: string | null
  rejectionReason?: string
}

async function getFromAddress(): Promise<string> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('company_settings')
      .select('warehouse_name, email')
      .eq('id', 1)
      .single()

    if (data?.email && data?.warehouse_name) {
      return `${data.warehouse_name} <${data.email}>`
    }
    if (data?.email) return data.email
  } catch {
    // fall through to env fallback
  }
  return process.env.RESEND_FROM_EMAIL ?? 'CTS Portal <noreply@yourdomain.com>'
}

async function resolveSkuName(skuId: string): Promise<string> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('skus')
      .select('sku_code, description')
      .eq('id', skuId)
      .maybeSingle()
    if (data) return `${data.sku_code} — ${data.description}`
  } catch {
    // fall through
  }
  return skuId
}

export async function sendReplyEmail(
  to: string,
  status: ReplyStatus,
  data: ReplyData,
): Promise<void> {
  const from = await getFromAddress()

  let subject: string
  let text: string

  if (status === 'applied') {
    const skuName = data.skuId ? await resolveSkuName(data.skuId) : 'unknown SKU'
    const action = data.action ?? '?'
    const qty = data.quantity ?? '?'
    const unit = data.unit ? ` ${data.unit}` : ''
    const txId = data.movementId ?? 'N/A'

    subject = `✅ Inventory logged: ${action} ${qty}${unit}`
    text = [
      `✅ Logged: ${action} ${qty}${unit} of ${skuName}.`,
      `Transaction ID: ${txId}`,
    ].join('\n')
  } else if (status === 'clarification_needed') {
    const intent = data.rawIntent ?? 'unclear action'
    subject = '⚠️ Action needed: inventory email could not be parsed'
    text = [
      `⚠️ We received your email but couldn't confidently parse it.`,
      ``,
      `We understood: "${intent}"`,
      ``,
      `Please reply with the format:`,
      `  IN/OUT [quantity] [unit] [product name]`,
      ``,
      `Example: IN 50 cartons Widget A`,
    ].join('\n')
  } else {
    subject = '❌ Unauthorized: inventory transaction not accepted'
    text = [
      `❌ Your email address is not authorized to submit inventory transactions.`,
      ``,
      `Contact your warehouse administrator to be added as an authorized sender.`,
    ].join('\n')
  }

  const result = await getResend().emails.send({ from, to, subject, text })

  if (result.error) {
    throw new Error(
      `Resend error: ${result.error.name} — ${(result.error as any).message ?? JSON.stringify(result.error)}`,
    )
  }
}
