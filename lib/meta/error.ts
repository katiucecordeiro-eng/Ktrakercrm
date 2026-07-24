type MetaApiError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

// A Graph API sempre devolve mais detalhe que só a mensagem (type, code,
// error_subcode, fbtrace_id) — descartar isso força a usuária a adivinhar
// a causa de erros genéricos como "API access blocked." Formatando tudo,
// dá pra pesquisar o código exato na documentação da Meta ou passar pro
// suporte deles direto.
export function formatMetaApiError(json: Record<string, unknown>, status: number): string {
  const error = json.error as MetaApiError | undefined;
  if (!error?.message) return `HTTP ${status}`;

  const parts = [error.message];
  const details: string[] = [];
  if (error.type) details.push(`type=${error.type}`);
  if (error.code != null) details.push(`code=${error.code}`);
  if (error.error_subcode != null) details.push(`subcode=${error.error_subcode}`);
  if (error.fbtrace_id) details.push(`trace=${error.fbtrace_id}`);
  if (details.length > 0) parts.push(`(${details.join(", ")})`);

  return parts.join(" ");
}
