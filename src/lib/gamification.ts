import {
  Flame,
  Sparkles,
  Brain,
  Trophy,
  GraduationCap,
  Rocket,
  Star,
  Medal,
  type LucideIcon,
} from "lucide-react";

/** XP needed to reach a given level (level 1 starts at 0). */
export const XP_PER_LEVEL = 200;

export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
}

/** Progress (0-100) toward the next level. */
export function levelProgress(xp: number): number {
  return Math.round(((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100);
}

export function xpIntoLevel(xp: number): number {
  return xp % XP_PER_LEVEL;
}

export interface BadgeDef {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  earned: (ctx: BadgeContext) => boolean;
}

export interface BadgeContext {
  xp: number;
  level: number;
  streak: number;
  quizzes: number;
  avgScore: number;
  chats: number;
  flashcards: number;
}

export const BADGES: BadgeDef[] = [
  {
    id: "first-steps",
    label: "First Steps",
    description: "Earned your first XP",
    icon: Sparkles,
    earned: (c) => c.xp > 0,
  },
  {
    id: "curious",
    label: "Curious Mind",
    description: "Had 5 tutor conversations",
    icon: Brain,
    earned: (c) => c.chats >= 5,
  },
  {
    id: "streak-3",
    label: "On Fire",
    description: "3-day study streak",
    icon: Flame,
    earned: (c) => c.streak >= 3,
  },
  {
    id: "streak-7",
    label: "Unstoppable",
    description: "7-day study streak",
    icon: Rocket,
    earned: (c) => c.streak >= 7,
  },
  {
    id: "quiz-master",
    label: "Quiz Master",
    description: "Completed 10 quizzes",
    icon: Trophy,
    earned: (c) => c.quizzes >= 10,
  },
  {
    id: "sharp",
    label: "Sharp Shooter",
    description: "80%+ average score",
    icon: Star,
    earned: (c) => c.avgScore >= 80 && c.quizzes >= 3,
  },
  {
    id: "scholar",
    label: "Scholar",
    description: "Reached level 5",
    icon: GraduationCap,
    earned: (c) => c.level >= 5,
  },
  {
    id: "memory",
    label: "Memory Athlete",
    description: "Reviewed 20 flashcards",
    icon: Medal,
    earned: (c) => c.flashcards >= 20,
  },
];
