import { auth, defineMcp } from "@lovable.dev/mcp-js";
import completeStudyTask from "./tools/complete-study-task";
import createStudyTask from "./tools/create-study-task";
import getMyProgress from "./tools/get-my-progress";
import listSavedNotes from "./tools/list-saved-notes";
import listStudyTasks from "./tools/list-study-tasks";
import listSubjects from "./tools/list-subjects";
import saveNote from "./tools/save-note";

// The OAuth issuer must be the direct Supabase host; the project ref is the one
// value that survives publish unchanged.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "crane5",
  title: "Crane5",
  version: "0.1.0",
  instructions:
    "Tools for Crane5, an NCDC-aligned AI study companion for Ugandan students. Use `list_subjects` to see the curriculum, `get_my_progress` for the learner's mastery and streaks, `list_study_tasks`/`create_study_task`/`complete_study_task` for the study planner, and `list_saved_notes`/`save_note` for saved revision notes. All tools act as the signed-in Crane5 learner.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listSubjects,
    getMyProgress,
    listStudyTasks,
    createStudyTask,
    completeStudyTask,
    listSavedNotes,
    saveNote,
  ],
});
