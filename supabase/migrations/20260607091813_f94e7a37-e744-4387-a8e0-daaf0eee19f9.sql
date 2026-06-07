
-- Extend quizzes with live state
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS current_question_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- Tighten questions RLS: only admins manage; everyone authed can read
DROP POLICY IF EXISTS "Questions insert" ON public.questions;
DROP POLICY IF EXISTS "Questions update" ON public.questions;
DROP POLICY IF EXISTS "Questions delete" ON public.questions;

CREATE POLICY "Admins insert questions" ON public.questions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update questions" ON public.questions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete questions" ON public.questions
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- quiz_questions junction
CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, question_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed view quiz_questions" ON public.quiz_questions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Quiz hosts manage quiz_questions" ON public.quiz_questions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.host_id = auth.uid()));
CREATE POLICY "Quiz hosts update quiz_questions" ON public.quiz_questions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.host_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.host_id = auth.uid()));
CREATE POLICY "Quiz hosts delete quiz_questions" ON public.quiz_questions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.host_id = auth.uid()));

-- quiz_participants
CREATE TABLE public.quiz_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  incorrect_count integer NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (quiz_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_participants TO authenticated;
GRANT ALL ON public.quiz_participants TO service_role;
ALTER TABLE public.quiz_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed view quiz_participants" ON public.quiz_participants
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users join quizzes" ON public.quiz_participants
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own quiz_participant" ON public.quiz_participants
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.host_id = auth.uid()))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.host_id = auth.uid()));
CREATE POLICY "Hosts delete quiz_participants" ON public.quiz_participants
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.host_id = auth.uid()));

-- quiz_answers
CREATE TABLE public.quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_option text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  points_awarded integer NOT NULL DEFAULT 0,
  answered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, question_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_answers TO authenticated;
GRANT ALL ON public.quiz_answers TO service_role;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View quiz_answers" ON public.quiz_answers
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.host_id = auth.uid()));
CREATE POLICY "Submit own quiz_answers" ON public.quiz_answers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.quizzes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_answers;

-- Helper RPC: submit an answer and update participant score atomically
CREATE OR REPLACE FUNCTION public.submit_quiz_answer(
  _quiz_id uuid,
  _question_id uuid,
  _selected text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _correct text;
  _is_correct boolean;
  _points integer;
  _awarded integer := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT correct_option INTO _correct FROM public.questions WHERE id = _question_id;
  IF _correct IS NULL THEN
    RAISE EXCEPTION 'Question not found';
  END IF;

  SELECT COALESCE(qq.points, 10) INTO _points
  FROM public.quiz_questions qq
  WHERE qq.quiz_id = _quiz_id AND qq.question_id = _question_id;
  _points := COALESCE(_points, 10);

  _is_correct := upper(trim(_selected)) = upper(trim(_correct));
  IF _is_correct THEN _awarded := _points; END IF;

  INSERT INTO public.quiz_answers(quiz_id, question_id, user_id, selected_option, is_correct, points_awarded)
  VALUES (_quiz_id, _question_id, _uid, _selected, _is_correct, _awarded);

  UPDATE public.quiz_participants
  SET score = score + _awarded,
      correct_count = correct_count + CASE WHEN _is_correct THEN 1 ELSE 0 END,
      incorrect_count = incorrect_count + CASE WHEN _is_correct THEN 0 ELSE 1 END
  WHERE quiz_id = _quiz_id AND user_id = _uid;

  RETURN jsonb_build_object('is_correct', _is_correct, 'points', _awarded);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_quiz_answer(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(uuid, uuid, text) TO authenticated;
