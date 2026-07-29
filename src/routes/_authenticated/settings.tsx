import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { AiUsageCard } from "@/components/AiUsageCard";
import { Camera, Loader2, LogOut, Moon, Sun, Target, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SUBJECTS } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · Omicron AI" }] }),
  component: SettingsPage,
});

const CLASSES = ["S1", "S2", "S3", "S4", "S5", "S6"];
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 year

function SettingsPage() {
  const { user, profile, roles, refreshProfile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [school, setSchool] = useState("");
  const [classLevel, setClassLevel] = useState("S4");
  const [bio, setBio] = useState("");
  const [goal, setGoal] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setSchool(profile.school ?? "");
      setClassLevel(profile.class_level ?? "S4");
      setBio(profile.bio ?? "");
      setGoal(profile.learning_goal ?? "");
      setFavorites(profile.favorite_subjects ?? []);
    }
  }, [profile]);

  const toggleFavorite = (s: string) =>
    setFavorites((f) => (f.includes(s) ? f.filter((x) => x !== s) : [...f, s]));

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, SIGNED_URL_TTL);
      const url = signed?.signedUrl;
      if (!url) throw new Error("no url");
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", user.id);
      if (profErr) throw profErr;
      await refreshProfile();
      toast.success("Profile picture updated! 📸");
    } catch {
      toast.error("Couldn't upload picture.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        school,
        class_level: classLevel as never,
        bio,
        learning_goal: goal,
        favorite_subjects: favorites,
      } as never)
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error("Couldn't save changes.");
      return;
    }
    await refreshProfile();
    toast.success("Profile updated!");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const initial = (fullName || profile?.email || "U").charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-muted-foreground">Manage your profile and preferences.</p>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card"
      >
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <h2 className="font-display font-semibold">Profile</h2>
          <span className="ml-auto rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium capitalize">
            {roles[0] ?? "student"}
          </span>
        </div>

        {/* Avatar */}
        <div className="mt-5 flex items-center gap-4">
          <div className="relative">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="h-20 w-20 rounded-full object-cover ring-2 ring-border"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-primary text-2xl font-bold text-primary-foreground">
                {initial}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105"
              aria-label="Change picture"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickAvatar}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Profile picture</p>
            <p>JPG or PNG, up to 5MB.</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={profile?.email ?? ""} disabled />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select value={classLevel} onValueChange={setClassLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>School</Label>
              <Input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="e.g. Kampala SS" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Bio</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us a bit about yourself…"
              rows={3}
              maxLength={280}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-accent" /> Learning goal
            </Label>
            <Input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Score A in Biology UCE"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Favourite subjects</Label>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleFavorite(s)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    favorites.includes(s)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={save} variant="hero" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mt-5 rounded-2xl border border-border bg-card p-6 shadow-card"
      >
        <h2 className="font-display font-semibold">Preferences</h2>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <div>
              <p className="text-sm font-medium">Dark mode</p>
              <p className="text-xs text-muted-foreground">Easier on the eyes at night.</p>
            </div>
          </div>
          <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
        </div>
      </motion.section>

      <AiUsageCard className="mt-5" />


      <Button onClick={handleSignOut} variant="outline" className="mt-5 w-full text-destructive hover:bg-destructive/10">
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}
