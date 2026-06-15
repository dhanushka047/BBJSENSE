import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, User, Bell, Building2, MapPin, Trash2, Database, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const Settings = () => {
  const { user, profile, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isSuperAdmin = role === "super_admin";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [factoryName, setFactoryName] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  const [emailOnOffline, setEmailOnOffline] = useState(true);
  const [emailOnAlert, setEmailOnAlert] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [clearing, setClearing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name);
      setLastName(profile.last_name);
      setFactoryName(profile.factory_name);
      setLocation(profile.location);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEmailOnOffline(data.email_on_offline);
          setEmailOnAlert(data.email_on_alert);
        }
      });
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ first_name: firstName, last_name: lastName, factory_name: factoryName, location })
      .eq("user_id", user.id);
    setSaving(false);
    toast(error ? { title: "Error", description: error.message, variant: "destructive" } : { title: "Profile updated" });
  };

  const handleSaveNotifications = async () => {
    if (!user) return;
    setSavingPrefs(true);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: user.id, email_on_offline: emailOnOffline, email_on_alert: emailOnAlert }, { onConflict: "user_id" });
    setSavingPrefs(false);
    toast(error ? { title: "Error", description: error.message, variant: "destructive" } : { title: "Notification preferences saved" });
  };

  const handleClearDatabase = async () => {
    setClearing(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("admin-tools", {
      body: { action: "clear_database" },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    setClearing(false);
    if (error) {
      toast({ title: "Error clearing database", description: String(error), variant: "destructive" });
    } else {
      queryClient.invalidateQueries();
      toast({ title: "Database cleared", description: data?.message || "All device data removed." });
    }
  };

  const handleSeedDummyData = async () => {
    setSeeding(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("admin-tools", {
      body: { action: "seed_dummy_data" },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    setSeeding(false);
    if (error) {
      toast({ title: "Error seeding data", description: String(error), variant: "destructive" });
    } else {
      queryClient.invalidateQueries();
      toast({ title: "Dummy data loaded", description: data?.message || "System populated with test data." });
    }
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your profile and preferences</p>
        </div>

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><User size={18} /> Profile</CardTitle>
            <CardDescription>Your personal and organization details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Building2 size={14} /> Factory / Organization</Label>
              <Input value={factoryName} onChange={(e) => setFactoryName(e.target.value)} placeholder="e.g. Acme Manufacturing" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><MapPin size={14} /> Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Building A, Floor 2" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile?.email || user?.email || ""} disabled className="opacity-60" />
            </div>
            <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
              <Save size={16} /> {saving ? "Saving…" : "Save Profile"}
            </Button>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Bell size={18} /> Notifications</CardTitle>
            <CardDescription>Email alert preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Device Offline Alerts</p>
                <p className="text-xs text-muted-foreground">Get notified when a device goes offline</p>
              </div>
              <Switch checked={emailOnOffline} onCheckedChange={setEmailOnOffline} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Threshold Alerts</p>
                <p className="text-xs text-muted-foreground">Get notified when readings exceed limits</p>
              </div>
              <Switch checked={emailOnAlert} onCheckedChange={setEmailOnAlert} />
            </div>
            <Button onClick={handleSaveNotifications} disabled={savingPrefs} variant="secondary" className="gap-2">
              <Save size={16} /> {savingPrefs ? "Saving…" : "Save Preferences"}
            </Button>
          </CardContent>
        </Card>

        {/* Admin Tools - Super Admin Only */}
        {isSuperAdmin && (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                <AlertTriangle size={18} /> Admin Tools
              </CardTitle>
              <CardDescription>Super admin database management. These actions are irreversible.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Seed Dummy Data */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border/50">
                <div>
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Database size={14} className="text-primary" /> Feed Dummy Data
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Create 4 test devices with readings, channel configs, and events
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSeedDummyData}
                  disabled={seeding}
                  className="gap-1.5"
                >
                  <Database size={14} /> {seeding ? "Seeding..." : "Seed Data"}
                </Button>
              </div>

              {/* Clear Database */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                <div>
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Trash2 size={14} className="text-destructive" /> Clear All Device Data
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Remove all devices, readings, events, and configs. Auth data is preserved.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={clearing} className="gap-1.5">
                      <Trash2 size={14} /> {clearing ? "Clearing..." : "Clear DB"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear All Device Data?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete ALL devices, readings, events, and channel configurations.
                        User accounts and authentication data will be preserved. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleClearDatabase}>
                        Yes, Clear Everything
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </AppLayout>
  );
};

export default Settings;
