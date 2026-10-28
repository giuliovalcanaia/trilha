-- Cenário de demonstração usado pelas capturas do README.
--
-- NÃO roda no `db reset`: é aplicado por `node scripts/capturas.mjs` depois do
-- reset, em cima do seed (professor@trilha.test, atividade TESTE1). Assim os
-- testes (pgTAP/E2E) continuam usando o seed enxuto.
--
-- Cria uma árvore com duas unidades e uma aula em andamento com quatro alunos
-- em estágios diferentes — é o que faz o explorador e a aba Alunos renderem bem
-- nas capturas.
do $$
declare
  v_prof bigint;
  v_aulas bigint;
  v_unit3 bigint;
  v_unit1 bigint;
  v_sete bigint;
  v_reading bigint;
  v_andamento bigint;
  v_passado bigint;
  v_leitura bigint;
  v_rascunho bigint;
  v_extra bigint;
  v_aplicacao bigint;
  v_estudante bigint;
  v_user uuid;
  v_participacao bigint;
  v_aluno record;
  v_link record;
  v_indice integer;
begin
  select id into v_prof
  from public.professores
  where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';

  if v_prof is null then
    raise exception 'demo: rode `npx supabase db reset` antes (seed ausente)';
  end if;

  select id into v_aulas
  from public.pastas
  where professor_id = v_prof and nome = 'Aulas';

  insert into public.pastas (professor_id, parent_id, nome)
  values (v_prof, v_aulas, 'Unit 3 — Rotina') returning id into v_unit3;

  insert into public.pastas (professor_id, parent_id, nome)
  values (v_prof, v_aulas, 'Unit 1 — Passado') returning id into v_unit1;

  insert into public.pastas (professor_id, parent_id, nome)
  values (v_prof, null, '7º ano') returning id into v_sete;

  insert into public.pastas (professor_id, parent_id, nome)
  values (v_prof, v_sete, 'Reading') returning id into v_reading;

  -- ---------- Aula em andamento (aba Alunos) ----------
  insert into public.atividades (
    professor_id, pasta_id, titulo, subtitulo, status, publicada_em
  )
  values (
    v_prof,
    v_unit3,
    'Daily Routines — review',
    'Revisão da unidade em quatro etapas',
    'publicada',
    now()
  )
  returning id into v_andamento;

  insert into public.links (atividade_id, ordem, titulo, descricao, href)
  values
    (
      v_andamento, 1, 'Daily routines — vocabulary',
      'Lista de palavras e expressões de rotina',
      'https://learnenglish.britishcouncil.org/vocabulary/a1-a2-vocabulary/daily-routines'
    ),
    (
      v_andamento, 2, 'Present Simple — exercises',
      null,
      'https://www.perfect-english-grammar.com/present-simple-exercise-1.html'
    ),
    (
      v_andamento, 3, 'Listening: A day in the life',
      'Áudio com perguntas de compreensão',
      'https://www.esl-lab.com/easy/daily-routines/'
    ),
    (
      v_andamento, 4, 'Writing: my routine',
      'Produza um parágrafo curto sobre a sua rotina',
      'https://www.britishcouncil.org/english/writing'
    );

  insert into public.atividade_senhas (atividade_id, senha_hash, senha_texto)
  values (
    v_andamento,
    extensions.crypt('aula123', extensions.gen_salt('bf')),
    'aula123'
  );

  insert into public.aplicacoes (atividade_id, codigo, data, status)
  values (v_andamento, 'DEMO01', current_date, 'aberta')
  returning id into v_aplicacao;

  -- Alunos em estágios diferentes; a aluna da captura ("Ana Beatriz") entra
  -- pelo app no script de capturas e conclui duas etapas.
  for v_aluno in
    select * from (values
      ('Bruno Lima', 4, array[9.5, 8.0, 9.0, 10.0]::numeric[]),
      ('Carla Souza', 1, array[7.5]::numeric[]),
      ('Diego Alves', 0, array[]::numeric[]),
      ('Elisa Rocha', 3, array[9.0, 8.5, 10.0]::numeric[])
    ) as t(nome, concluidos, notas)
  loop
    v_user := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, is_anonymous, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      v_user,
      'authenticated',
      'authenticated',
      true,
      now() - interval '1 hour',
      now() - interval '1 hour',
      '{"provider":"anonymous","providers":["anonymous"]}'::jsonb,
      '{}'::jsonb
    );

    insert into public.estudantes (user_id, nome)
    values (v_user, v_aluno.nome)
    returning id into v_estudante;

    insert into public.participacoes (
      aplicacao_id, estudante_id, nome, iniciado_em, concluido_em
    )
    values (
      v_aplicacao,
      v_estudante,
      v_aluno.nome,
      now() - interval '50 minutes',
      case when v_aluno.concluidos = 4 then now() - interval '5 minutes' end
    )
    returning id into v_participacao;

    v_indice := 0;

    for v_link in
      select id from public.links
      where atividade_id = v_andamento
      order by ordem
    loop
      v_indice := v_indice + 1;

      insert into public.progresso_estudante (
        participacao_id, link_id, status, pontuacao
      )
      values (
        v_participacao,
        v_link.id,
        case
          when v_indice <= v_aluno.concluidos then 'concluida'
          when v_indice = v_aluno.concluidos + 1 then 'aberta'
          else 'bloqueada'
        end,
        v_aluno.notas[v_indice]
      );
    end loop;
  end loop;

  -- ---------- Aula usada no GIF do fluxo do aluno ----------
  insert into public.atividades (
    professor_id, pasta_id, titulo, subtitulo, status, publicada_em
  )
  values (
    v_prof,
    v_unit1,
    'Simple Past — irregular verbs',
    'Três etapas para fixar os verbos irregulares',
    'publicada',
    now() - interval '2 days'
  )
  returning id into v_passado;

  insert into public.links (atividade_id, ordem, titulo, descricao, href)
  values
    (
      v_passado, 1, 'Irregular verbs — list',
      'Tabela com os verbos mais usados',
      'https://learnenglish.britishcouncil.org/grammar/english-grammar-reference/irregular-verbs'
    ),
    (
      v_passado, 2, 'Past Simple — exercises',
      null,
      'https://www.perfect-english-grammar.com/past-simple-exercise-1.html'
    ),
    (
      v_passado, 3, 'Quiz: irregular verbs',
      'Teste rápido de 10 perguntas',
      'https://www.englishclub.com/esl-quizzes/irregular-verbs/'
    );

  insert into public.atividade_senhas (atividade_id, senha_hash, senha_texto)
  values (
    v_passado,
    extensions.crypt('aula123', extensions.gen_salt('bf')),
    'aula123'
  );

  insert into public.aplicacoes (atividade_id, codigo, data, status)
  values (v_passado, 'DEMO02', current_date - 1, 'aberta');

  -- ---------- Leitura (mais uma atividade publicada) ----------
  insert into public.atividades (
    professor_id, pasta_id, titulo, subtitulo, status, publicada_em
  )
  values (
    v_prof,
    v_reading,
    'Reading: short stories',
    'Leitura guiada com vocabulário de apoio',
    'publicada',
    now() - interval '5 days'
  )
  returning id into v_leitura;

  insert into public.links (atividade_id, ordem, titulo, href)
  values
    (v_leitura, 1, 'The Gift of the Magi', 'https://www.americanliterature.com/author/o-henry/short-story/the-gift-of-the-magi'),
    (v_leitura, 2, 'The Tell-Tale Heart', 'https://www.americanliterature.com/author/edgar-allan-poe/short-story/the-tell-tale-heart');

  insert into public.atividade_senhas (atividade_id, senha_hash, senha_texto)
  values (
    v_leitura,
    extensions.crypt('aula123', extensions.gen_salt('bf')),
    'aula123'
  );

  insert into public.aplicacoes (atividade_id, codigo, data, status)
  values (v_leitura, 'DEMO03', current_date - 3, 'encerrada');

  -- ---------- Mais duas atividades publicadas na Unit 3 ----------
  insert into public.atividades (
    professor_id, pasta_id, titulo, subtitulo, status, publicada_em
  )
  values (
    v_prof,
    v_unit3,
    'Vocabulary quiz',
    'Dez perguntas de múltipla escolha',
    'publicada',
    now() - interval '1 day'
  )
  returning id into v_extra;

  insert into public.links (atividade_id, ordem, titulo, href)
  values
    (v_extra, 1, 'Quiz: routines', 'https://www.englishclub.com/esl-quizzes/daily-routines/'),
    (v_extra, 2, 'Word list', 'https://learnenglish.britishcouncil.org/vocabulary');

  insert into public.atividade_senhas (atividade_id, senha_hash, senha_texto)
  values (
    v_extra,
    extensions.crypt('aula123', extensions.gen_salt('bf')),
    'aula123'
  );

  insert into public.aplicacoes (atividade_id, codigo, data, status)
  values (v_extra, 'DEMO04', current_date - 1, 'aberta');

  insert into public.atividades (
    professor_id, pasta_id, titulo, subtitulo, status, publicada_em
  )
  values (
    v_prof,
    v_unit3,
    'Listening: at the café',
    'Diálogo com exercício de compreensão',
    'publicada',
    now() - interval '4 days'
  )
  returning id into v_extra;

  insert into public.links (atividade_id, ordem, titulo, href)
  values
    (v_extra, 1, 'At the café — áudio', 'https://www.esl-lab.com/easy/coffee-shop/'),
    (v_extra, 2, 'Vocabulário do diálogo', 'https://learnenglish.britishcouncil.org/vocabulary'),
    (v_extra, 3, 'Quiz de compreensão', 'https://www.esl-lab.com/easy/coffee-shop/quiz/');

  insert into public.atividade_senhas (atividade_id, senha_hash, senha_texto)
  values (
    v_extra,
    extensions.crypt('aula123', extensions.gen_salt('bf')),
    'aula123'
  );

  insert into public.aplicacoes (atividade_id, codigo, data, status)
  values (v_extra, 'DEMO05', current_date - 4, 'encerrada');

  -- ---------- Rascunho (mostra o outro estado no explorador) ----------
  insert into public.atividades (
    professor_id, pasta_id, titulo, subtitulo, status
  )
  values (
    v_prof,
    v_unit3,
    'Listening Practice',
    'Rascunho para a próxima aula',
    'rascunho'
  )
  returning id into v_rascunho;

  insert into public.links (atividade_id, ordem, titulo, href)
  values (v_rascunho, 1, 'BBC Learning English — 6 Minute English', 'https://www.bbc.co.uk/learningenglish/english/features/6-minute-english');
end;
$$;
