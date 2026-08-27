-- Conversão automática pra Real: o público da oferta é majoritariamente
-- brasileiro, mas volta e meia aparece uma venda cobrada em outra moeda
-- (ex. comprador europeu pagando em EUR) — sem conversão, essas vendas
-- entravam com o valor numérico bruto na moeda original, inflando/
-- distorcendo todos os agregados do dashboard (KPIs, vendas por produto
-- etc. somam gross_value como se fosse tudo BRL). A partir de agora,
-- gross_value/currency sempre refletem o valor já convertido pra BRL;
-- original_value/original_currency guardam o valor bruto original só
-- pra referência/auditoria (ficam null quando a venda já era em BRL).
alter table sales add column if not exists original_currency text;
alter table sales add column if not exists original_value numeric;
