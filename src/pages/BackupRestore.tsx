import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Database, Download, Upload, Trash2, Plus, Clock, HardDrive, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface Snapshot {
  id: string;
  name: string;
  description: string;
  snapshot_data: any;
  created_by: string;
  created_at: string;
}

const BackupRestore = () => {
  const { role } = useAuth();
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
    if (!error && data) setSnapshots(data as Snapshot[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) fetchSnapshots();
  }, [isSuperAdmin]);

  const invokeBackup = async (action: string, extra: Record<string, any> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    return supabase.functions.invoke("backup-restore", {
      body: { action, ...extra },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data, error } = await invokeBackup("create_snapshot", { name: name.trim(), description: description.trim() });
    setCreating(false);
    if (error) {
      toast({ title: "Error creating snapshot", description: String(error), variant: "destructive" });
    } else {
      toast({ title: "Snapshot created", description: data?.message });
      setName("");
      setDescription("");
      fetchSnapshots();
    }
  };

  const handleRestore = async (snapshotId: string) => {
    setRestoring(snapshotId);
    const { data, error } = await invokeBackup("restore_snapshot", { snapshot_id: snapshotId });
    setRestoring(null);
    if (error) {
      toast({ title: "Error restoring", description: String(error), variant: "destructive" });
    } else {
      toast({ title: "Snapshot restored", description: data?.message });
    }
  };

  const handleDelete = async (snapshotId: string) => {
    setDeleting(snapshotId);
    const { data, error } = await invokeBackup("delete_snapshot", { snapshot_id: snapshotId });
    setDeleting(null);
    if (error) {
      toast({ title: "Error deleting", description: String(error), variant: "destructive" });
    } else {
      toast({ title: "Snapshot deleted" });
      fetchSnapshots();
    }
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <HardDrive size={24} /> Backup & Restore
          </h1>
          <p className="text-sm text-muted-foreground">Create and manage database snapshots</p>
        </div>

        {/* Create Snapshot */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Plus size={18} /> Create Snapshot</CardTitle>
            <CardDescription>Save the current state of all device data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Snapshot Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Before maintenance" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional notes" />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={creating} className="gap-2">
              <Database size={16} /> {creating ? "Creating..." : "Create Snapshot"}
            </Button>
          </CardContent>
        </Card>

        {/* Snapshots List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Clock size={18} /> Saved Snapshots</CardTitle>
            <CardDescription>{snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""} available</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
            ) : snapshots.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No snapshots yet. Create one to get started.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Details</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshots.map((s) => {
                      const meta = s.snapshot_data?.metadata;
                      return (
                        <TableRow key={s.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">{s.name}</p>
                              {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex gap-1.5 flex-wrap">
                              <Badge variant="secondary" className="text-xs">{meta?.device_count || 0} devices</Badge>
                              <Badge variant="outline" className="text-xs">{meta?.reading_count || 0} readings</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(s.created_at), "MMM d, yyyy HH:mm")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              {/* Restore */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm" disabled={restoring === s.id} className="gap-1.5">
                                    <Upload size={14} /> {restoring === s.id ? "Restoring..." : "Restore"}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Restore "{s.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will <strong>replace all current device data</strong> with the snapshot data.
                                      All existing devices, readings, events, and configs will be overwritten. This cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRestore(s.id)}>Yes, Restore</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>

                              {/* Delete */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm" disabled={deleting === s.id} className="gap-1.5">
                                    <Trash2 size={14} />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete "{s.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This snapshot will be permanently deleted. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(s.id)}>
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
      </motion.div>
    </AppLayout>
  );
};

export default BackupRestore;
