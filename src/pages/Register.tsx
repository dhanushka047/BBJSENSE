import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, UserPlus } from "lucide-react";
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
    if (form.password.length < 8) {
      toast({ title: "Password too short", description: "Minimum 8 characters required", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          first_name: form.firstName,
          last_name: form.lastName,
        },
      },
    });
    setLoading(false);

    if (error) {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    } else {
      // Update profile with factory info
      toast({ title: "Check your email", description: "We sent you a confirmation link. Please verify your email to sign in." });
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      <header className="flex items-center justify-between p-4 md:p-6">
        <BrandLogo />
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-lg">
          <div className="glass rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">Create Account</h1>
              <p className="text-muted-foreground text-sm">Register to start monitoring your IoT devices</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" placeholder="John" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} required className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" placeholder="Doe" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} required className="h-11" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="regEmail">Email</Label>
                <Input id="regEmail" type="email" placeholder="you@company.com" value={form.email} onChange={(e) => update("email", e.target.value)} required className="h-11" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="regPassword">Password</Label>
                <div className="relative">
                  <Input id="regPassword" type={showPassword ? "text" : "password"} placeholder="Min 8 characters" value={form.password} onChange={(e) => update("password", e.target.value)} required className="h-11 pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="factory">Factory Name</Label>
                  <Input id="factory" placeholder="My Factory" value={form.factoryName} onChange={(e) => update("factoryName", e.target.value)} required className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" placeholder="City, Country" value={form.location} onChange={(e) => update("location", e.target.value)} required className="h-11" />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-11 gradient-brand text-primary-foreground font-semibold mt-2">
                {loading ? <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <><UserPlus size={18} className="mr-2" /> Create Account</>}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Already have an account?{" "}
              <Link to="/" className="text-primary font-medium hover:underline">Sign In</Link>
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Register;
