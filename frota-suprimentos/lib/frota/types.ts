export type Role = "unidade" | "suprimentos" | "frota_corporativo";

export type StatusSolicitacao =
  | "pendente"
  | "em_analise"
  | "vinculado"
  | "aprovado"
  | "rejeitado";

export const STATUS_LABELS: Record<StatusSolicitacao, string> = {
  pendente: "Pendente",
  em_analise: "Em Análise",
  vinculado: "Vinculado a Item Existente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

// Papel visual do badge de status (mapeado para as variantes de Badge).
export const STATUS_BADGE_VARIANT: Record<
  StatusSolicitacao,
  "default" | "secondary" | "warning" | "destructive" | "outline"
> = {
  pendente: "warning",
  em_analise: "outline",
  vinculado: "secondary",
  aprovado: "default",
  rejeitado: "destructive",
};

export type Lado = "D" | "E";

export const LADO_LABELS: Record<Lado, string> = {
  D: "Direito (D)",
  E: "Esquerdo (E)",
};

// Lista fechada só para guiar o Select do formulário — a coluna no banco é
// texto livre (unidades incomuns não devem travar a solicitação).
export const UNIDADES_MEDIDA = [
  "UN",
  "PC",
  "CX",
  "KG",
  "L",
  "M",
  "PAR",
  "JG",
  "KIT",
] as const;

export type Decisao = "vinculado_existente" | "aprovado_novo" | "rejeitado";

export interface Profile {
  id: string;
  nome: string;
  role: Role;
  unidade: string | null;
}

export interface Familia {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
}

export interface Solicitacao {
  id: string;
  unidade: string;
  solicitante_id: string;
  familia_id: string;
  descricao_curta: string;
  referencia_fabricante: string;
  aplicacao: string;
  lado: Lado | null;
  unidade_medida: string;
  foto_url: string | null;
  status: StatusSolicitacao;
  item_vinculado_id: string | null;
  responsavel_suprimentos_id: string | null;
  data_solicitacao: string;
  data_resposta: string | null;
  sla_limite: string;
  created_at: string;
  updated_at: string;
}

// Formato retornado pela view/join usado na fila e no detalhe: junta a
// solicitação com os nomes já resolvidos (evita N+1 de profiles/familias
// no client).
export interface SolicitacaoComRelacoes extends Solicitacao {
  familia_nome: string;
  solicitante_nome: string;
  responsavel_nome: string | null;
}

export interface CatalogoPadrao {
  id: string;
  codigo_benner: string;
  nome_padronizado: string;
  familia_id: string | null;
  referencia_fabricante_principal: string | null;
  atributos_json: Record<string, unknown>;
  ncm_cest: string | null;
  status: "ativo" | "inativo";
  data_ultima_revisao: string;
  created_at: string;
}

export interface ItemSimilar {
  id: string;
  codigo_benner: string;
  nome_padronizado: string;
  familia_id: string | null;
  ncm_cest: string | null;
  status: string;
  match_tipo: "referencia_exata" | "similaridade_textual";
  score: number;
}
