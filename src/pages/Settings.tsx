import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, User, Bell, Building2, MapPin, Trash2, Database, AlertTriangle, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { localDb } from "@/lib/localDb";

const Settings = () => {
  const { user, profile, role } = useAuth();
  const { siteName, siteLogo, updateBranding } = useBranding();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "super_admin" || role === "admin";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [factoryName, setFactoryName] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  const [customName, setCustomName] = useState("");
  const [customLogo, setCustomLogo] = useState("");
  const [savingBranding, setSavingBranding] = useState(false);

  const [emailOnOffline, setEmailOnOffline] = useState(true);
  const [emailOnAlert, setEmailOnAlert] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [clearing, setClearing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      setFactoryName(profile.factory_name || "");
      setLocation(profile.location || "");
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
          setEmailOnOffline(data.email_on_offline === 1 || data.email_on_offline === true);
          setEmailOnAlert(data.email_on_alert === 1 || data.email_on_alert === true);
        }
      });
  }, [user]);

  useEffect(() => {
    if (siteName) setCustomName(siteName);
    if (siteLogo) setCustomLogo(siteLogo);
  }, [siteName, siteLogo]);

  const handleSaveBranding = async () => {
    setSavingBranding(true);
    try {
      await updateBranding(customName, customLogo);
      toast({ title: "Branding updated", description: "Global site name and logo successfully updated." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingBranding(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select an image smaller than 2MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setCustomLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

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
    try {
      localDb.clearDatabase();
      queryClient.invalidateQueries();
      toast({ title: "Database cleared", description: "All device configs, readings, and events removed successfully." });
    } catch (e: any) {
      toast({ title: "Error clearing database", description: e.message, variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  const handleSeedDummyData = async () => {
    setSeeding(true);
    try {
      localDb.seedDatabase();
      queryClient.invalidateQueries();
      toast({ title: "Dummy data seeded", description: "Database has been populated with mock devices, registers, configurations, and historical metrics." });
    } catch (e: any) {
      toast({ title: "Error seeding data", description: e.message, variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6 w-full">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles size={24} className="text-accent animate-pulse" /> Settings
          </h1>
          <p className="text-sm text-muted-foreground">Manage your profile, alerts, and offline database parameters</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column: Profile Settings (all users) and Alert Notifications (only for admins to balance height) */}
          <div className="space-y-6">
            {/* Profile */}
            <Card className="border border-border bg-card shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User size={18} className="text-primary" /> Profile Settings
                </CardTitle>
                <CardDescription>Configure your personal identity and industrial plant setup</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">First Name</Label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-background border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Last Name</Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-background border-border" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Building2 size={13} /> Factory / Organization
                  </Label>
                  <Input value={factoryName} onChange={(e) => setFactoryName(e.target.value)} placeholder="e.g. Acme Manufacturing" className="bg-background border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MapPin size={13} /> Location / Facility
                  </Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Building A, Floor 2" className="bg-background border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                  <Input value={profile?.email || user?.email || ""} disabled className="opacity-60 bg-background/20 font-mono" />
                </div>
                <Button onClick={handleSaveProfile} disabled={saving} className="gap-2 gradient-brand text-primary-foreground font-semibold">
                  <Save size={16} /> {saving ? "Saving…" : "Save Profile"}
                </Button>
              </CardContent>
            </Card>

            {/* Notifications Card for Admin (Left Column) */}
            {isAdmin && (
              <Card className="border border-border bg-card shadow-sm relative overflow-hidden">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bell size={18} className="text-primary" /> Alert Notifications
                  </CardTitle>
                  <CardDescription>Email alert thresholds and sensor limits warnings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Device Offline Alerts</p>
                      <p className="text-xs text-muted-foreground">Get notified when a physical gateway goes offline</p>
                    </div>
                    <Switch checked={emailOnOffline} onCheckedChange={setEmailOnOffline} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Threshold Warning Alerts</p>
                      <p className="text-xs text-muted-foreground">Receive updates when telemetry exceeds range limits</p>
                    </div>
                    <Switch checked={emailOnAlert} onCheckedChange={setEmailOnAlert} />
                  </div>
                  <Button onClick={handleSaveNotifications} disabled={savingPrefs} variant="secondary" className="gap-2 border border-border font-semibold text-foreground hover:bg-muted/80 bg-background">
                    <Save size={16} /> {savingPrefs ? "Saving…" : "Save Alert Settings"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column:
              - If Admin: System Branding and Admin Tools
              - If Standard User: Alert Notifications (to keep the 2 columns perfectly balanced side-by-side)
          */}
          <div className="space-y-6">
            {isAdmin ? (
              <>
                {/* System Branding */}
                <Card className="border border-border bg-card shadow-sm relative overflow-hidden">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 size={18} className="text-primary" /> System Branding Configuration
                    </CardTitle>
                    <CardDescription>Customize global console title and brand icon for all users</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Site Name</Label>
                      <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. BBJSENSE" className="bg-background border-border font-semibold text-foreground" />
                    </div>
                    
                    <div className="space-y-2.5">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground block">Site Logo Branding</Label>
                      <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/20 border border-border/50">
                        <div className="h-16 w-16 rounded-lg bg-background border border-border flex items-center justify-center overflow-hidden shrink-0">
                          <img src={customLogo || "/logo.png"} alt="Preview" className="h-14 w-14 object-contain" onError={(e) => (e.target as HTMLImageElement).src = "/logo.png"} />
                        </div>
                        <div className="space-y-2 w-full">
                          <input type="file" accept="image/*" id="logo-file-input" className="hidden" onChange={handleLogoUpload} />
                          <Label htmlFor="logo-file-input" className="inline-flex h-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/90 px-4 text-xs font-semibold cursor-pointer border border-border transition-colors">
                            Upload Logo Image
                          </Label>
                          <p className="text-[10px] text-muted-foreground">PNG or JPG, maximum 2MB size. Saved globally.</p>
                        </div>
                      </div>
                    </div>

                    <Button onClick={handleSaveBranding} disabled={savingBranding} className="gap-2 gradient-brand text-primary-foreground font-semibold">
                      <Save size={16} /> {savingBranding ? "Saving branding..." : "Save Branding Settings"}
                    </Button>
                  </CardContent>
                </Card>

                {/* Admin Tools - Super Admin Only */}
                {isSuperAdmin && (
                  <Card className="glass border-destructive/20 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-destructive/5 rounded-full blur-2xl pointer-events-none" />
                    <CardHeader className="pb-3 border-b border-destructive/10 bg-destructive/5">
                      <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                        <AlertTriangle size={18} /> Admin Tools (Local SQLite Engine)
                      </CardTitle>
                      <CardDescription>Super administrator database diagnostics. These operations overwrite state locally.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      {/* Seed Dummy Data */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/10">
                        <div>
                          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            <Database size={14} className="text-primary" /> Seed Mock Data
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Clear all current tables and seed default nodes, registers, charts history, and users.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSeedDummyData}
                          disabled={seeding}
                          className="gap-1.5 border-primary/20 text-primary hover:bg-primary/10 font-medium"
                        >
                          <Database size={14} /> {seeding ? "Seeding..." : "Seed Data"}
                        </Button>
                      </div>

                      {/* Clear Database */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-destructive/5 border border-destructive/15">
                        <div>
                          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            <Trash2 size={14} className="text-destructive" /> Purge Local Database
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Delete all configured devices, channels, readings, and logs. User sessions persist.
                          </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={clearing} className="gap-1.5 font-semibold">
                              <Trash2 size={14} /> {clearing ? "Clearing..." : "Purge DB"}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="border border-border bg-card shadow-xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-foreground">Clear All Database Tables?</AlertDialogTitle>
                              <AlertDialogDescription className="text-muted-foreground">
                                This will permanently delete all local devices, metrics readings, alerts, configurations, and snapshots.
                                Your administrator authentication profile will persist. This action is irreversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-background text-foreground border-border hover:bg-muted">Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleClearDatabase}>
                                Purge All Data
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              /* Notifications Card for Standard User (Right Column to balance the layout side-by-side) */
              <Card className="border border-border bg-card shadow-sm relative overflow-hidden">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bell size={18} className="text-primary" /> Alert Notifications
                  </CardTitle>
                  <CardDescription>Email alert thresholds and sensor limits warnings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Device Offline Alerts</p>
                      <p className="text-xs text-muted-foreground">Get notified when a physical gateway goes offline</p>
                    </div>
                    <Switch checked={emailOnOffline} onCheckedChange={setEmailOnOffline} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Threshold Warning Alerts</p>
                      <p className="text-xs text-muted-foreground">Receive updates when telemetry exceeds range limits</p>
                    </div>
                    <Switch checked={emailOnAlert} onCheckedChange={setEmailOnAlert} />
                  </div>
                  <Button onClick={handleSaveNotifications} disabled={savingPrefs} variant="secondary" className="gap-2 border border-border font-semibold text-foreground hover:bg-muted/80 bg-background">
                    <Save size={16} /> {savingPrefs ? "Saving…" : "Save Alert Settings"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default Settings;
