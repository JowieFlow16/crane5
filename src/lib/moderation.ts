import { db } from "@/lib/db";

export const REPORT_REASONS = [
  "Harassment or bullying",
  "Hate speech",
  "Sexual or explicit content",
  "Spam or scam",
  "Exam malpractice / cheating",
  "Other",
] as const;

export type ReportTargetType = "message" | "conversation" | "post" | "comment" | "user";

export interface ContentReport {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  target_type: ReportTargetType;
  target_id: string | null;
  reason: string;
  details: string | null;
  excerpt: string | null;
  status: "open" | "reviewing" | "actioned" | "dismissed";
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_note: string | null;
  created_at: string;
}

export interface UserBlock {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export async function listMyBlocks(): Promise<UserBlock[]> {
  const { data } = await db.from("user_blocks").select("*");
  return (data as UserBlock[]) ?? [];
}

export async function blockUser(myId: string, otherId: string) {
  const { error } = await db
    .from("user_blocks")
    .insert({ blocker_id: myId, blocked_id: otherId } as never);
  if (error) throw new Error("Couldn't block this student.");
}

export async function unblockUser(myId: string, otherId: string) {
  const { error } = await db
    .from("user_blocks")
    .delete()
    .eq("blocker_id", myId)
    .eq("blocked_id", otherId);
  if (error) throw new Error("Couldn't unblock this student.");
}

export async function reportContent(input: {
  reporterId: string;
  reportedUserId?: string | null;
  targetType: ReportTargetType;
  targetId?: string | null;
  reason: string;
  details?: string;
  excerpt?: string | null;
}) {
  const { error } = await db.from("content_reports").insert({
    reporter_id: input.reporterId,
    reported_user_id: input.reportedUserId ?? null,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    reason: input.reason,
    details: input.details?.trim() || null,
    excerpt: input.excerpt?.slice(0, 500) ?? null,
  } as never);
  if (error) throw new Error("Couldn't send that report.");
}

export async function listReports(): Promise<ContentReport[]> {
  const { data } = await db
    .from("content_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data as ContentReport[]) ?? [];
}

export async function setReportStatus(
  id: string,
  status: ContentReport["status"],
  reviewerId: string,
  adminNote?: string,
) {
  const { error } = await db
    .from("content_reports")
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      admin_note: adminNote?.trim() || null,
    } as never)
    .eq("id", id);
  if (error) throw new Error("Couldn't update that report.");
}
