// Gera o nome padronizado sugerido para o item novo a partir dos atributos
// estruturados da solicitação (nunca texto livre digitado do zero pelo
// Suprimentos) — mantém o padrão de nomenclatura consistente no catálogo.
// O campo continua editável no formulário de aprovação; isso é só o ponto
// de partida.
export function gerarNomePadrao(params: {
  familiaNome: string;
  descricaoCurta: string;
  aplicacao: string;
  lado: "D" | "E" | null;
}): string {
  const partes = [
    params.familiaNome,
    params.descricaoCurta,
    params.aplicacao,
  ]
    .map((parte) => parte.trim())
    .filter(Boolean)
    .map((parte) => parte.toUpperCase());

  let nome = partes.join(" - ");

  if (params.lado) {
    nome += ` (L${params.lado})`;
  }

  return nome;
}
