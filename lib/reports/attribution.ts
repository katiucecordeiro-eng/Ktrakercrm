// Resolução de campanha real compartilhada entre a tabela de campanhas
// (lib/reports/campaigns.ts) e o funil por campanha — extraída pra um
// módulo próprio pra não duplicar a mesma lógica de 3 níveis em dois
// lugares.

export function normalizeForMatch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type RealCampaignInfo = { campaignName: string | null };

// Resolve a campanha real de uma venda (ou evento) em 3 níveis de
// confiança:
// 1) match exato do campaign_id extraído da UTM contra um campaign_id real
//    (convenção {{campaign.id}}--{{campaign.name}} seguida corretamente);
// 2) mapeamento manual cadastrado em Configurações (offer_id + utm_campaign
//    bruto → campaign_id real), pra quando o nome não bate por fuzzy match;
// 3) fallback por nome: normaliza o utm_campaign bruto e a campanha real e
//    testa se um contém o outro — cobre o caso de o anúncio usar o nome da
//    campanha como utm_campaign em vez do id.
// Sem nenhum dos três, cai no bucket "sem atribuição".
export function resolveCampaignId(
  target: { offerId: string; campaignId: string | null; utmCampaign: string | null },
  realCampaigns: Map<string, RealCampaignInfo>,
  manualMappings: Map<string, string>,
): string | null {
  if (target.campaignId) {
    const key = `${target.offerId}::${target.campaignId}`;
    if (realCampaigns.has(key)) return target.campaignId;
  }

  if (target.utmCampaign) {
    const manual = manualMappings.get(`${target.offerId}::${target.utmCampaign}`);
    if (manual && realCampaigns.has(`${target.offerId}::${manual}`)) return manual;

    const needle = normalizeForMatch(target.utmCampaign);
    if (needle) {
      for (const [key, campaign] of realCampaigns) {
        if (!key.startsWith(`${target.offerId}::`)) continue;
        const name = normalizeForMatch(campaign.campaignName ?? "");
        if (name && (name.includes(needle) || needle.includes(name))) {
          return key.slice(`${target.offerId}::`.length);
        }
      }
    }
  }

  return null;
}
