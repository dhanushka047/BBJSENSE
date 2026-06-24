import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, UserPlus, Mail, Key, Briefcase, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    factoryName: "",
    location: "",
  });

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 4) {
      toast({ title: "Password too short", description: "Minimum 4 characters required", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          first_name: form.firstName,
          last_name: form.lastName,
          factory_name: form.factoryName,
          location: form.location,
        },
      },
    });
    setLoading(true);

    // Wait a brief moment to emulate state transition, then redirect
    setTimeout(() => {
      setLoading(false);
      if (error) {
        toast({ title: "Registration failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Account created!", description: "You have been registered and logged in successfully." });
        navigate("/dashboard");
      }
    }, 400);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      
      <header className="flex items-center justify-between p-6 z-10 border-b border-border bg-card/85">
        <BrandLogo />
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pb-16 z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-lg"
        >
          <div className="relative">
            
            <div className="relative bg-card text-card-foreground rounded-2xl p-8 md:p-10 shadow-xl border border-border">
              <div className="text-center mb-8">
                <div className="inline-flex p-3 rounded-full bg-accent/10 text-accent mb-3">
                  <Sparkles size={20} />
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-2">
                  Create Account
                </h1>
                <p className="text-muted-foreground text-sm">Register to start managing local IoT nodes</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4 font-sans text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">First Name</Label>
                    <Input id="firstName" placeholder="John" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} required className="h-10 bg-background border-border text-foreground" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Last Name</Label>
                    <Input id="lastName" placeholder="Doe" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} required className="h-10 bg-background border-border text-foreground" />
                  </div>
                </div>

                <div className="space-y-2 font-sans text-sm">
                  <Label htmlFor="regEmail" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Email Address</Label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="regEmail" type="email" placeholder="you@company.com" value={form.email} onChange={(e) => update("email", e.target.value)} required className="h-10 pl-10 bg-background border-border text-foreground" />
                  </div>
                </div>

                <div className="space-y-2 font-sans text-sm">
                  <Label htmlFor="regPassword" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Password</Label>
                  <div className="relative">
                    <Key size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="regPassword" type={showPassword ? "text" : "password"} placeholder="Min 4 characters" value={form.password} onChange={(e) => update("password", e.target.value)} required className="h-10 pl-10 pr-10 bg-background border-border text-foreground" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans text-sm">
                  <div className="space-y-2">
                    <Label htmlFor="factory" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Factory Name</Label>
                    <div className="relative">
                      <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input id="factory" placeholder="My Factory" value={form.factoryName} onChange={(e) => update("factoryName", e.target.value)} required className="h-10 pl-10 bg-background border-border text-foreground" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Location</Label>
                    <div className="relative">
                      <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input id="location" placeholder="City, Country" value={form.location} onChange={(e) => update("location", e.target.value)} required className="h-10 pl-10 bg-background border-border text-foreground" />
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full h-11 gradient-brand text-primary-foreground font-semibold mt-4 hover:scale-[1.01] hover:shadow-lg transition-all">
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><UserPlus size={18} className="mr-2" /> Register & Access Console</>
                  )}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Already registered?{" "}
                <Link to="/" className="text-primary font-semibold hover:underline">Sign In</Link>
              </p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Register;
