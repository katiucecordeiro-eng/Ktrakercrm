-- Habilita o Supabase Realtime na tabela events, usada pelo log de
-- eventos ao vivo do dashboard (Sprint 5).
alter publication supabase_realtime add table events;
