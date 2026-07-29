-- 1. Restore Data API privileges (lost on remix)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- public read-only tables
GRANT SELECT ON public.subjects TO anon;
GRANT SELECT ON public.topics TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;

-- ai_usage is written only by security-definer functions
REVOKE INSERT, UPDATE, DELETE ON public.ai_usage FROM authenticated;

-- 2. Seed the subject catalogue
INSERT INTO public.subjects (name, slug, icon, color, description) VALUES
  ('Mathematics','mathematics','Sigma','#6366f1','Numbers, algebra, geometry, statistics and calculus.'),
  ('Physics','physics','Atom','#0ea5e9','Motion, energy, electricity, waves and modern physics.'),
  ('Chemistry','chemistry','FlaskConical','#14b8a6','Matter, reactions, organic and physical chemistry.'),
  ('Biology','biology','Leaf','#22c55e','Life processes, genetics, ecology and human biology.'),
  ('English Language','english-language','BookOpen','#f97316','Grammar, comprehension, composition and summary skills.'),
  ('Literature in English','literature-in-english','BookMarked','#e11d48','Poetry, prose, drama and literary appreciation.'),
  ('Geography','geography','Globe2','#0891b2','Physical, human and regional geography of Uganda and the world.'),
  ('History & Political Education','history-political-education','Landmark','#a16207','East African and world history, governance and citizenship.'),
  ('Christian Religious Education','christian-religious-education','Church','#8b5cf6','Biblical studies, ethics and Christian living.'),
  ('Islamic Religious Education','islamic-religious-education','Moon','#059669','Qur''an, Hadith, Islamic history and practice.'),
  ('Kiswahili','kiswahili','Languages','#f43f5e','Sarufi, ufahamu, insha na fasihi.'),
  ('Luganda','luganda','Languages','#d946ef','Ennyingo, okusoma n''okuwandiika mu Luganda.'),
  ('Entrepreneurship','entrepreneurship','Briefcase','#eab308','Business ideas, records, marketing and finance.'),
  ('Agriculture','agriculture','Sprout','#65a30d','Crop and animal production, soils and farm management.'),
  ('Information & Communication Technology','ict','Cpu','#3b82f6','Computers, software, networks and digital literacy.'),
  ('Physical Education','physical-education','Dumbbell','#ef4444','Sports science, fitness and health.'),
  ('Art & Design','art-design','Palette','#ec4899','Drawing, design principles and visual creativity.'),
  ('Performing Arts','performing-arts','Music','#7c3aed','Music, dance and drama.'),
  ('Nutrition & Food Technology','nutrition-food-technology','UtensilsCrossed','#f59e0b','Food science, nutrition and meal planning.'),
  ('Technology & Design','technology-design','Wrench','#64748b','Technical drawing, materials and design projects.'),
  ('General Science','general-science','Microscope','#06b6d4','Integrated lower-secondary science.')
ON CONFLICT (slug) DO NOTHING;