-- Código de teste do Meta Test Events, antes só disponível via env var
-- (META_TEST_EVENT_CODE_<SLUG>, exigindo redeploy a cada oferta nova) —
-- vira campo de texto simples no formulário da oferta, já que não é um
-- segredo (a própria Meta mostra esse código na tela de Test Events, sem
-- risco em ficar em texto puro no banco, ao contrário dos tokens de API).
-- Fecha a última peça que ainda exigia mexer na Vercel pra cadastrar uma
-- oferta nova — todo o resto já era 100% pelo formulário.
alter table offers
  add column if not exists meta_test_event_code text;
