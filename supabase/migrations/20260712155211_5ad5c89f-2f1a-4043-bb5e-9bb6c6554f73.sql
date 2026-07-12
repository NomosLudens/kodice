
CREATE TABLE public.codice_settings (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text,
  fs numeric,
  ls numeric,
  w numeric,
  z numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.codice_settings TO authenticated;
GRANT ALL ON public.codice_settings TO service_role;

ALTER TABLE public.codice_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON public.codice_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.codice_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.codice_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own settings" ON public.codice_settings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER codice_settings_updated_at
  BEFORE UPDATE ON public.codice_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
