
ALTER TABLE public.quiz_participants
  ADD COLUMN IF NOT EXISTS correct_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incorrect_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;

-- Replace submit_quiz_answer to also track correct/incorrect counts
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

  INSERT INTO quiz_answers (quiz_id, user_id, question_id, selected, is_correct, points)
  VALUES (_quiz_id, _uid, _question_id, upper(_selected), _is_correct, _earned);

  UPDATE quiz_participants
     SET score          = score + _earned,
         correct_count  = correct_count  + CASE WHEN _is_correct THEN 1 ELSE 0 END,
         incorrect_count = incorrect_count + CASE WHEN _is_correct THEN 0 ELSE 1 END
   WHERE quiz_id = _quiz_id AND user_id = _uid;

  RETURN jsonb_build_object('is_correct', _is_correct, 'points', _earned);
END;
$$;
