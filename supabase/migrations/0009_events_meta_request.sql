-- Guarda o payload de request enviado à Meta CAPI (não só a resposta),
-- pra dar visibilidade completa no timeline do visitante do que foi
-- exatamente enviado (user_data já vem hasheado — nunca o access_token,
-- que nunca faz parte do corpo do request).
alter table events add column if not exists meta_request jsonb;
