
-- 1. Add missing columns to quizzes
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS current_question_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- 2. questions table
CREATE TABLE IF NOT EXISTS public.questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question        text NOT NULL,
  option_a        text NOT NULL,
  option_b        text NOT NULL,
  option_c        text NOT NULL,
  option_d        text NOT NULL,
  correct_option  text NOT NULL CHECK (correct_option IN ('A','B','C','D')),
  explanation     text,
  category        text,
  difficulty      text DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- 3. quiz_questions join table
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id     uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  points      integer NOT NULL DEFAULT 10,
  UNIQUE (quiz_id, question_id)
);

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

-- 4. quiz_participants
CREATE TABLE IF NOT EXISTS public.quiz_participants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id      uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Player',
  score        integer NOT NULL DEFAULT 0,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, user_id)
);

ALTER TABLE public.quiz_participants ENABLE ROW LEVEL SECURITY;

-- 5. quiz_answers
CREATE TABLE IF NOT EXISTS public.quiz_answers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id     uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected    text NOT NULL CHECK (selected IN ('A','B','C','D')),
  is_correct  boolean NOT NULL DEFAULT false,
  points      integer NOT NULL DEFAULT 0,
  answered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, user_id, question_id)
);

ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;

-- ─── RLS: questions ───────────────────────────────────────────────────────────
CREATE POLICY "questions_select_auth" ON public.questions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "questions_insert_own" ON public.questions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);

CREATE POLICY "questions_update_own" ON public.questions
  FOR UPDATE TO authenticated USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);

CREATE POLICY "questions_delete_own" ON public.questions
  FOR DELETE TO authenticated USING (auth.uid() = host_id);

-- ─── RLS: quiz_questions ──────────────────────────────────────────────────────
CREATE POLICY "qq_select_auth" ON public.quiz_questions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "qq_insert_host" ON public.quiz_questions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.quizzes WHERE id = quiz_id AND host_id = auth.uid())
  );

CREATE POLICY "qq_update_host" ON public.quiz_questions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes WHERE id = quiz_id AND host_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes WHERE id = quiz_id AND host_id = auth.uid()));

CREATE POLICY "qq_delete_host" ON public.quiz_questions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes WHERE id = quiz_id AND host_id = auth.uid()));

-- ─── RLS: quiz_participants ───────────────────────────────────────────────────
CREATE POLICY "qp_select_auth" ON public.quiz_participants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "qp_insert_self" ON public.quiz_participants
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "qp_update_self" ON public.quiz_participants
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "qp_delete_self" ON public.quiz_participants
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── RLS: quiz_answers ────────────────────────────────────────────────────────
CREATE POLICY "qa_select_own" ON public.quiz_answers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "qa_insert_own" ON public.quiz_answers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "qa_update_own" ON public.quiz_answers
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "qa_delete_own" ON public.quiz_answers
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Host can read all answers for their quizzes
CREATE POLICY "qa_select_host" ON public.quiz_answers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes WHERE id = quiz_id AND host_id = auth.uid()));

-- ─── Realtime publications ────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'quizzes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quizzes;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'quiz_questions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_questions;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'quiz_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_participants;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'quiz_answers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_answers;
  END IF;
END $$;

-- ─── submit_quiz_answer RPC ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_quiz_answer(
  _quiz_id     uuid,
  _question_id uuid,
  _selected    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid        uuid := auth.uid();
  _correct    text;
  _points_val integer;
  _is_correct boolean;
  _earned     integer;
BEGIN
  -- Get correct option and points for this question in this quiz
  SELECT q.correct_option, qq.points
    INTO _correct, _points_val
    FROM questions q
    JOIN quiz_questions qq ON qq.question_id = q.id AND qq.quiz_id = _quiz_id
   WHERE q.id = _question_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found in this quiz';
  END IF;

  _is_correct := (upper(_selected) = upper(_correct));
  _earned     := CASE WHEN _is_correct THEN _points_val ELSE 0 END;

  -- Record answer (will error on duplicate due to UNIQUE constraint)
  INSERT INTO quiz_answers (quiz_id, user_id, question_id, selected, is_correct, points)
  VALUES (_quiz_id, _uid, _question_id, upper(_selected), _is_correct, _earned);

  -- Update participant score
  UPDATE quiz_participants
     SET score = score + _earned
   WHERE quiz_id = _quiz_id AND user_id = _uid;

  RETURN jsonb_build_object('is_correct', _is_correct, 'points', _earned);
END;
$$;

-- Allow authenticated users to call it
GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(uuid, uuid, text) TO authenticated;

-- ─── next_question RPC (host advances question) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.next_quiz_question(_quiz_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _host uuid;
  _count integer;
  _idx   integer;
BEGIN
  SELECT host_id, question_count INTO _host, _count
    FROM quizzes WHERE id = _quiz_id;

  IF _host <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT current_question_index INTO _idx FROM quizzes WHERE id = _quiz_id;

  IF _idx + 1 >= _count THEN
    UPDATE quizzes SET status = 'ended' WHERE id = _quiz_id;
  ELSE
    UPDATE quizzes SET current_question_index = _idx + 1 WHERE id = _quiz_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_quiz_question(uuid) TO authenticated;
