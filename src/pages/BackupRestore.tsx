import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Database, Download, Upload, Trash2, Plus, Clock, HardDrive, AlertTriangle, FileUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { localDb } from "@/lib/localDb";

interface Snapshot {
  id: string;
  name: string;
  description: string;
  snapshot_data: string; // Stored as a JSON string containing { metadata, binary }
  created_by: string;
  created_at: string;
}

const BackupRestore = () => {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const isSuperAdmin = role === "super_admin";

  const fetchSnapshots = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("database_snapshots")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setSnapshots(data as Snapshot[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchSnapshots();
    }
  }, [isSuperAdmin]);

  // Client-Side Snapshot Creation
  const handleCreateSnapshot = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setCreating(true);

    try {
      // Export current SQLite state
      const binary = localDb.getBinary();
      const base64 = btoa(String.fromCharCode(...binary));

      const deviceCount = localDb.query("SELECT COUNT(*) as cnt FROM devices")[0]?.cnt || 0;
      const readingCount = localDb.query("SELECT COUNT(*) as cnt FROM device_readings")[0]?.cnt || 0;

      const meta = { device_count: deviceCount, reading_count: readingCount };
      const snapshotData = JSON.stringify({ metadata: meta, binary: base64 });

      const { error } = await supabase.from("database_snapshots").insert({
        name: name.trim(),
        description: description.trim(),
        snapshot_data: snapshotData,
        created_by: user?.id,
      });

      if (error) throw error;

      toast({ title: "Snapshot created", description: "Database state successfully saved into the local storage snapshot." });
      setName("");
      setDescription("");
      fetchSnapshots();
    } catch (e: any) {
      toast({ title: "Error creating snapshot", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  // Client-Side Snapshot Restore
  const handleRestoreSnapshot = async (snapshotId: string) => {
    setRestoring(snapshotId);
    try {
      const { data, error } = await supabase
        .from("database_snapshots")
        .select("snapshot_data")
        .eq("id", snapshotId)
        .single();

      if (error) throw error;
      if (!data?.snapshot_data) throw new Error("No snapshot data found.");

      const parsed = JSON.parse(data.snapshot_data);
      if (!parsed.binary) throw new Error("Invalid snapshot format.");

      // Decode base64 to binary Array
      const binary = Uint8Array.from(atob(parsed.binary), (c) => c.charCodeAt(0));

      toast({ title: "Restoring...", description: "Loading database binary and refreshing dashboard." });
      setTimeout(() => {
        localDb.loadBinary(binary);
      }, 500);
    } catch (e: any) {
      toast({ title: "Error restoring snapshot", description: e.message, variant: "destructive" });
      setRestoring(null);
    }
  };

  // Client-Side Snapshot Deletion
  const handleDeleteSnapshot = async (snapshotId: string) => {
    setDeleting(snapshotId);
    try {
      const { error } = await supabase.from("database_snapshots").delete().eq("id", snapshotId);
      if (error) throw error;

      toast({ title: "Snapshot deleted" });
      fetchSnapshots();
    } catch (e: any) {
      toast({ title: "Error deleting snapshot", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  // Raw .sqlite Binary File Downloader
  const handleExportSqliteFile = () => {
    try {
      const binary = localDb.getBinary();
      const blob = new Blob([binary], { type: "application/x-sqlite3" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bbjsense_backup_${format(new Date(), "yyyyMMdd_HHmmss")}.sqlite`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Database exported", description: "Your .sqlite database backup has been downloaded." });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    }
  };

  // Raw .sqlite File Importer
  const handleImportSqliteFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        if (!arrayBuffer) throw new Error("Failed to read file buffer.");

        const binary = new Uint8Array(arrayBuffer);
        toast({ title: "Restoring file...", description: "Applying imported SQLite schema and refreshing dashboard." });
        setTimeout(() => {
          localDb.loadBinary(binary);
        }, 800);
      } catch (err: any) {
        toast({ title: "Import failed", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (!isSuperAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Super admin access required.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <HardDrive size={24} className="text-accent" /> Backup & Restore
            </h1>
            <p className="text-sm text-muted-foreground">Create local snapshots or export database files directly to your computer</p>
          </div>
          <Button onClick={handleExportSqliteFile} className="gradient-brand text-primary-foreground font-semibold flex items-center gap-1.5 self-start">
            <Download size={15} /> Export .sqlite DB
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Create Snapshot & File Upload */}
          <div className="md:col-span-1 space-y-6">
            {/* Create Snapshot Card */}
            <Card className="border border-border bg-card shadow-sm relative overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-base flex items-center gap-2"><Plus size={16} className="text-primary" /> Create Snapshot</CardTitle>
                <CardDescription>Save database state into local storage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Snapshot Name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pre-maintenance backup" className="bg-background border-border text-foreground" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details..." className="bg-background border-border text-foreground" />
                </div>
                <Button onClick={handleCreateSnapshot} disabled={creating} className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-semibold gap-1.5">
                  <Database size={15} /> {creating ? "Creating..." : "Save Snapshot"}
                </Button>
              </CardContent>
            </Card>

            {/* Direct Restore Upload Card */}
            <Card className="border border-border bg-card shadow-sm relative overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-base flex items-center gap-2"><FileUp size={16} className="text-primary" /> Restore from File</CardTitle>
                <CardDescription>Import a previously exported .sqlite database file</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <Label htmlFor="sqlite-file" className="flex flex-col items-center justify-center border border-dashed border-border hover:border-primary rounded-xl p-6 cursor-pointer bg-background hover:bg-muted transition duration-300">
                  <Upload size={24} className="text-muted-foreground mb-2" />
                  <span className="text-xs font-semibold text-foreground">Select .sqlite file</span>
                  <span className="text-[10px] text-muted-foreground mt-1 text-center">Caution: This completely overwrites current state.</span>
                  <input
                    id="sqlite-file"
                    type="file"
                    accept=".sqlite,.db"
                    onChange={handleImportSqliteFile}
                    className="hidden"
                  />
                </Label>
              </CardContent>
            </Card>
          </div>

          {/* Snapshots Table */}
          <Card className="md:col-span-2 border border-border bg-card shadow-sm relative overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base flex items-center gap-2"><Clock size={16} className="text-primary" /> Saved In-Browser Snapshots</CardTitle>
              <CardDescription>Local snapshots stored inside the SQLite snapshots database table</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Loading snapshots list...</p>
              ) : snapshots.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Database size={32} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm font-semibold">No local snapshots created yet.</p>
                  <p className="text-xs">Configure the form on the left to save the current database state.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="w-full text-sm">
                    <TableHeader className="bg-muted/10">
                      <TableRow>
                        <TableHead className="py-3 px-4">Name</TableHead>
                        <TableHead className="py-3 px-4 hidden sm:table-cell">Details</TableHead>
                        <TableHead className="py-3 px-4">Created At</TableHead>
                        <TableHead className="py-3 px-4 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {snapshots.map((s) => {
                        let meta = { device_count: 0, reading_count: 0 };
                        try {
                          const parsed = JSON.parse(s.snapshot_data);
                          if (parsed.metadata) meta = parsed.metadata;
                        } catch (_) {}

                        return (
                          <TableRow key={s.id} className="hover:bg-muted/25 transition-colors border-b border-border/20">
                            <TableCell className="py-3.5 px-4 font-semibold text-foreground">
                              <div>
                                <p className="font-semibold text-foreground">{s.name}</p>
                                {s.description && <p className="text-xs text-muted-foreground font-normal mt-0.5">{s.description}</p>}
                              </div>
                            </TableCell>
                            <TableCell className="py-3.5 px-4 hidden sm:table-cell">
                              <div className="flex gap-1.5">
                                <Badge variant="secondary" className="text-[10px] font-bold border-0 bg-primary/10 text-primary">
                                  {meta.device_count} Devs
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] font-bold border-0 bg-primary/10 text-primary">
                                  {meta.reading_count} Recs
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="py-3.5 px-4 text-xs text-muted-foreground font-mono">
                              {format(new Date(s.created_at), "MMM d, yyyy HH:mm")}
                            </TableCell>
                            <TableCell className="py-3.5 px-4 text-right">
                              <div className="flex gap-2 justify-end">
                                {/* Restore Snapshot */}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm" disabled={restoring === s.id} className="gap-1 h-8 text-xs border-border hover:bg-primary/10 hover:text-primary bg-background">
                                      <Upload size={13} /> {restoring === s.id ? "Restoring..." : "Restore"}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="border border-border bg-card shadow-xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-foreground">Restore Local Snapshot "{s.name}"?</AlertDialogTitle>
                                      <AlertDialogDescription className="text-muted-foreground">
                                        This will <strong>completely replace the current database state</strong>.
                                        Any un-snapshotted metrics, sensor settings, or configurations will be overwritten. This cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="bg-background text-foreground border-border hover:bg-muted">Cancel</AlertDialogCancel>
                                      <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/95" onClick={() => handleRestoreSnapshot(s.id)}>
                                        Apply Restore
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>

                                {/* Delete Snapshot */}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" disabled={deleting === s.id} className="gap-1 h-8 text-xs font-semibold">
                                      <Trash2 size={13} />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="border border-border bg-card shadow-xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-foreground">Delete Snapshot "{s.name}"?</AlertDialogTitle>
                                      <AlertDialogDescription className="text-muted-foreground">
                                        This snapshot record will be permanently deleted from local database tables. This action is irreversible.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="bg-background text-foreground border-border hover:bg-muted">Cancel</AlertDialogCancel>
                                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDeleteSnapshot(s.id)}>
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default BackupRestore;
