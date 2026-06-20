insert into public.subjects (name, slug, description, icon, color) values
('English Language', 'english-language', 'Grammar, comprehension, summary & functional writing', 'BookOpen', 'chart-5'),
('Literature in English', 'literature-in-english', 'Poetry, prose, drama & oral literature', 'BookText', 'chart-5'),
('Geography', 'geography', 'Physical, human & practical geography of Uganda & the world', 'Globe', 'chart-2'),
('History & Political Education', 'history-political-education', 'Uganda, East Africa, world history & governance', 'Landmark', 'chart-4'),
('Christian Religious Education', 'christian-religious-education', 'Bible study, Christian living & moral values', 'Church', 'chart-1'),
('Islamic Religious Education', 'islamic-religious-education', 'Quran, Hadith, Islamic living & values', 'Moon', 'chart-1'),
('Kiswahili', 'kiswahili', 'Lugha ya Kiswahili: sarufi, ufahamu na utungaji', 'Languages', 'chart-3'),
('Luganda', 'luganda', 'Olulimi Oluganda: ennukuta, okutegeera n''okuwandiika', 'Languages', 'chart-3'),
('Entrepreneurship', 'entrepreneurship', 'Business ideas, planning, finance & enterprise', 'Briefcase', 'chart-1'),
('Agriculture', 'agriculture', 'Crop & animal production, soils & farm economics', 'Sprout', 'chart-4'),
('Information & Communication Technology', 'ict', 'Computers, software, networks & digital skills', 'Laptop', 'chart-2'),
('Physical Education', 'physical-education', 'Sports science, fitness, health & games', 'Dumbbell', 'chart-3'),
('Art & Design', 'art-design', 'Drawing, painting, crafts & visual communication', 'Palette', 'chart-5'),
('Performing Arts', 'performing-arts', 'Music, dance & drama performance and theory', 'Music', 'chart-5'),
('Nutrition & Food Technology', 'nutrition-food-technology', 'Food science, nutrition, cookery & food safety', 'Utensils', 'chart-4'),
('Technology & Design', 'technology-design', 'Materials, design process & technical drawing', 'Wrench', 'chart-2'),
('General Science', 'general-science', 'Integrated science for lower secondary learners', 'Atom', 'chart-2')
on conflict (slug) do update set description = excluded.description, icon = excluded.icon, color = excluded.color;