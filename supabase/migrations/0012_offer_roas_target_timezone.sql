-- Sprint F: meta de ROAS configurável (usada nos badges verde/vermelho,
-- antes um limiar fixo de 2x hardcoded) e fuso horário por oferta (usado
-- na quebra de vendas por hora do dia — antes sempre UTC/hora do servidor).
alter table offers
  add column if not exists roas_target numeric(6, 2) not null default 2,
  add column if not exists timezone text not null default 'America/Sao_Paulo';
