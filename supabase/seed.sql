-- ============================================================
-- Seed do ambiente local (roda em `npx supabase db reset`)
-- ============================================================
-- Nunca é aplicado no remoto: `supabase/config.toml` só usa este arquivo no
-- reset do stack local. Credenciais de teste:
--
--   professor:  professor@trilha.test / senha123
--   professor2: professor2@trilha.test / senha123 (para testar compartilhamento)
--   atividade:  "Daily Routines" (publicada)
--   entrada:    TESTE1
--   liberação:  aula123
--   aluna:      Maria (com o primeiro link aberto)
--
-- Tudo aqui é recriado a cada reset; não guarde dados reais neste arquivo.

-- ---------- Professor (o trigger on_auth_user_created cria public.professores) ----------
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'professor@trilha.test',
  extensions.crypt('senha123', extensions.gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Professor Teste"}'::jsonb,
  '',
  '',
  '',
  ''
)
on conflict (id) do nothing;

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  gen_random_uuid(),
  'aaaaaaaa-0000-4000-8000-000000000001',
  'aaaaaaaa-0000-4000-8000-000000000001',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","email":"professor@trilha.test","email_verified":true,"phone_verified":false}'::jsonb,
  'email',
  now(),
  now(),
  now()
)
on conflict do nothing;

-- ---------- Segundo professor (para testar compartilhamento de pastas) ----------
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  'dddddddd-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'professor2@trilha.test',
  extensions.crypt('senha123', extensions.gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Professor Dois"}'::jsonb,
  '',
  '',
  '',
  ''
)
on conflict (id) do nothing;

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  gen_random_uuid(),
  'dddddddd-0000-4000-8000-000000000001',
  'dddddddd-0000-4000-8000-000000000001',
  '{"sub":"dddddddd-0000-4000-8000-000000000001","email":"professor2@trilha.test","email_verified":true,"phone_verified":false}'::jsonb,
  'email',
  now(),
  now(),
  now()
)
on conflict do nothing;

-- ---------- Aluna de exemplo (o app usa login anônimo) ----------
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  is_anonymous,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
)
values (
  '00000000-0000-0000-0000-000000000000',
  'bbbbbbbb-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  true,
  now(),
  now(),
  '{"provider":"anonymous","providers":["anonymous"]}'::jsonb,
  '{}'::jsonb
)
on conflict (id) do nothing;

do $$
declare
  v_professor_id bigint;
  v_pasta_id bigint;
  v_atividade_id bigint;
  v_aplicacao_id bigint;
  v_estudante_id bigint;
  v_participacao_id bigint;
  v_primeiro_link bigint;
begin
  select id into v_professor_id
  from public.professores
  where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';

  if v_professor_id is null then
    raise exception 'seed: o professor de teste não foi criado';
  end if;

  -- Pasta
  insert into public.pastas (professor_id, nome)
  values (v_professor_id, 'Aulas')
  returning id into v_pasta_id;

  -- Atividade publicada (nasce ativa, com a entrada aberta)
  insert into public.atividades (
    professor_id,
    pasta_id,
    titulo,
    subtitulo,
    status,
    publicada_em
  )
  values (
    v_professor_id,
    v_pasta_id,
    'Daily Routines',
    'Atividade de exemplo do ambiente local',
    'publicada',
    now()
  )
  returning id into v_atividade_id;

  insert into public.aplicacoes (atividade_id, codigo, data, status)
  values (v_atividade_id, 'TESTE1', current_date, 'aberta')
  returning id into v_aplicacao_id;

  -- Links, na ordem em que o aluno deve fazer
  insert into public.links (atividade_id, ordem, titulo, descricao, href)
  values
    (
      v_atividade_id,
      1,
      'Daily Routines — vocabulário',
      'Lista de palavras e expressões de rotina',
      'https://learnenglish.britishcouncil.org/vocabulary/a1-a2-vocabulary/daily-routines'
    ),
    (
      v_atividade_id,
      2,
      'Present Simple — exercícios',
      null,
      'https://www.perfect-english-grammar.com/present-simple-exercise-1.html'
    ),
    (
      v_atividade_id,
      3,
      'Listening: Daily Routines',
      'Áudio com perguntas de compreensão',
      'https://www.esl-lab.com/easy/daily-routines/'
    );

  -- Senha de liberação (a validação usa o hash; o texto é só para exibir)
  insert into public.atividade_senhas (atividade_id, senha_hash, senha_texto)
  values (
    v_atividade_id,
    extensions.crypt('aula123', extensions.gen_salt('bf')),
    'aula123'
  );

  -- Participação da aluna, já com o primeiro link aberto
  insert into public.estudantes (user_id, nome)
  values ('bbbbbbbb-0000-4000-8000-000000000001', 'Maria')
  returning id into v_estudante_id;

  insert into public.participacoes (aplicacao_id, estudante_id, nome)
  values (v_aplicacao_id, v_estudante_id, 'Maria')
  returning id into v_participacao_id;

  select id into v_primeiro_link
  from public.links
  where atividade_id = v_atividade_id
  order by ordem
  limit 1;

  insert into public.progresso_estudante (participacao_id, link_id, status)
  select
    v_participacao_id,
    l.id,
    case when l.id = v_primeiro_link then 'aberta' else 'bloqueada' end
  from public.links l
  where l.atividade_id = v_atividade_id;
end;
$$;

-- ---------- Pasta própria do segundo professor ----------
-- Assim o explorador dele não nasce vazio e dá para comparar com a pasta
-- compartilhada pelo professor de teste.
insert into public.pastas (professor_id, nome)
select id, 'Aulas do Professor Dois'
from public.professores
where user_id = 'dddddddd-0000-4000-8000-000000000001';
