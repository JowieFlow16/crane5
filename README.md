# Crane5

Build a full-stack web application called "Omicron AI" – an AI-powered tutoring platform for Ugandan students following the NCDC curriculum.

Target users: Secondary school students (S1–S6), teachers, parents, and admins. Make it feel dope, modern, Gen-Z vibrant yet professional, trustworthy, and educational. Use a clean, premium ed-tech aesthetic with Ugandan/East African cultural touches (subtle greens, yellows, earth tones, patterns inspired by Ugandan textiles). High-quality animations, micro-interactions, smooth transitions, and mobile-first responsive design.

Overall Design & UI/UX Requirements

Tech stack: Next.js 15+ (App Router), Tailwind CSS, shadcn/ui + custom components, Lucide icons. Dark/light mode support. Fully responsive (desktop + mobile).

Branding: Logo "Omicron AI" with a futuristic yet approachable feel. Primary colors: Deep teal (#0F766E), vibrant green (#10B981), warm accent (#F59E0B), neutral backgrounds.

Layout: Persistent sidebar navigation (collapsible on mobile), top navbar with user profile, notifications, and search. Dashboard home with quick stats and welcome.

Animations: Framer Motion for dope page transitions, card hovers, loading states, quiz feedback animations, chat message bubbles that slide in. Make it feel premium and engaging (Gen-Z vybe).

Pages/Routes:

/ (Landing – public, hero with CTA to login)

/login, /register, password reset

/dashboard (Student home: progress overview, recommended topics, quick chat)

/chat (Main AI Tutor chat interface)

/quiz (Quiz generation + taking)

/revision (Revision notes & likely exam questions)

/admin (Protected admin dashboard – document upload & management)

/settings

Core Features (Student Side)

Student AI Tutor (Omicron AI)

Natural language chat.

Subjects: Mathematics, Physics, Chemistry, Biology, English (NCDC curriculum).

Step-by-step explanations, age-appropriate language, encouragement, critical thinking prompts.

RAG-powered: Always search uploaded curriculum docs first before answering.

Quiz Generation

Select subject, topic, difficulty (Easy/Medium/Hard), type (MCQ, Short Answer, Mixed).

Generate quiz → Take it → Auto-marking with score, corrections, explanations, weak area highlights.

Revision Mode

Topic summary generator.

Revision notes.

Likely examination questions.

Key concepts highlighter.

User Authentication & Data

Email/password auth + protected routes (use Supabase Auth).

Store chat history, quiz results, user progress in Supabase DB.

Admin Features

Secure admin-only section (/admin).

Upload curriculum documents, notes, past papers, marking guides, teacher resources (Supabase Storage).

Document management: List, search, filter by subject/class/document type, delete.

Knowledge base: Uploaded files become searchable RAG source.

Technical Architecture (Use Supabase – Lovable's native integration)

Supabase:

Authentication

Database tables:

users (with role: student/teacher/admin)

documents (metadata: id, name, subject, class_level, type, storage_path, uploaded_by)

chats (history)

quizzes (generated quizzes)

quiz_results

subjects / topics (for organization)

Storage buckets for documents.

AI Integration: Prepare for Google Gemini API (RAG pipeline). When user asks a question:

Retrieve relevant chunks from uploaded documents.

Feed context + curriculum adherence instructions to Gemini.

Generate response. Never hallucinate outside curriculum when relevant.

Follow NCDC curriculum. Use East African/Ugandan examples where appropriate. Encourage learning, not just answers.

Additional Polish

Progress tracking and weak area insights on dashboard.

Searchable knowledge base.

Beautiful empty states, loading animations, success/error toasts.

Accessibility and performance focused.

Production-ready MVP with clean, scalable code and comments for future Gemini/Supabase keys.

Start by generating the landing page + authentication flow, then the main dashboard and sidebar. Use modern, vibrant, trustworthy ed-tech design with smooth animations. Make it fully functional end-to-end.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://crane5.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0432c70c-effb-4d0b-8312-e3d5ccb3f212).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
