import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Loader2, LogOut, Moon, Sun, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · Omicron AI" }] }),
  component: SettingsPage,
});

const CLASSES = ["S1", "S2", "S3", "S4", "S5", "S6"];

function SettingsPage() {
  const { user, profile, roles, refreshProfile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [school, setSchool] = useState("");
  const [classLevel, setClassLevel] = useState("S4");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setSchool(profile.school ?? "");
      setClassLevel(profile.class_level ?? "S4");
    }
  }, [profile]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        school,
        class_level: classLevel as never,
      })
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
        <div className="mt-4 space-y-4">
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

      <Button onClick={handleSignOut} variant="outline" className="mt-5 w-full text-destructive hover:bg-destructive/10">
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}
