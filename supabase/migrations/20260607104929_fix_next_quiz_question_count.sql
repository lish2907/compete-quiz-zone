
-- Fix next_quiz_question to count from quiz_questions directly (avoids question_count drift)
CREATE OR REPLACE FUNCTION public.next_quiz_question(_quiz_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _host  uuid;
  _count integer;
  _idx   integer;
BEGIN
  SELECT host_id INTO _host FROM quizzes WHERE id = _quiz_id;
  IF _host <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COUNT(*) INTO _count FROM quiz_questions WHERE quiz_id = _quiz_id;
  SELECT current_question_index INTO _idx FROM quizzes WHERE id = _quiz_id;

  IF _idx + 1 >= _count THEN
    UPDATE quizzes SET status = 'ended' WHERE id = _quiz_id;
  ELSE
    UPDATE quizzes
       SET current_question_index = _idx + 1
     WHERE id = _quiz_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_quiz_question(uuid) TO authenticated;
