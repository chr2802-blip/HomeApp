-- Who may listen on a home's Realtime channel: see src/lib/realtime.ts.
--
-- A phone joins the private channel `home:<homeId>` with a token this app signs, whose
-- `homes` claim lists every home its owner belongs to. This policy lets it read a topic
-- only when the topic names one of those homes. There is deliberately no INSERT policy:
-- phones never broadcast, only the server does, with the secret key.
--
-- Only Supabase has a `realtime` schema. Everywhere else — a laptop's Postgres, the test
-- databases, the `db:check` shadow — this does nothing. And a policy that cannot be
-- created on Supabase is a warning rather than a failed production build: without it the
-- channel refuses every phone, and every open list goes on polling as it did before.
-- The same SQL is in the README, to run by hand if the warning ever appears.
DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NULL OR to_regprocedure('realtime.topic()') IS NULL THEN
    RAISE NOTICE 'No Supabase Realtime in this database; skipping the home channel policy.';
    RETURN;
  END IF;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "homehub members hear their homes" ON realtime.messages';
    EXECUTE $policy$
      CREATE POLICY "homehub members hear their homes" ON realtime.messages
      FOR SELECT TO authenticated
      USING (
        realtime.messages.extension = 'broadcast'
        AND (SELECT realtime.topic()) LIKE 'home:%'
        AND substr((SELECT realtime.topic()), 6) IN (
          SELECT jsonb_array_elements_text(
            coalesce(current_setting('request.jwt.claims', true)::jsonb -> 'homes', '[]'::jsonb)
          )
        )
      )
    $policy$;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not create the Realtime home channel policy (%); open lists will poll instead.', SQLERRM;
  END;
END
$$;
