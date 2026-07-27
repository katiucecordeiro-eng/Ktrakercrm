-- Sprint F: toast de nova venda em tempo real precisa saber o status
-- anterior no UPDATE (pra só notificar quando vira 'approved' de fato,
-- não em qualquer atualização da linha) — REPLICA IDENTITY FULL inclui a
-- linha antiga inteira no payload do Realtime, não só a chave primária.
alter table sales replica identity full;
alter publication supabase_realtime add table sales;
