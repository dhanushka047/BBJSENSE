import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, LogIn, Key, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Welcome back!", description: "Successfully logged in." });
      navigate("/dashboard");
    }
  };

  const autofillUser = (role: 'admin' | 'user') => {
    if (role === 'admin') {
      setEmail("admin@bbjsense.com");
      setPassword("admin123");
    } else {
      setEmail("user@bbjsense.com");
      setPassword("user123");
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex flex-col relative overflow-hidden">
      {/* Decorative Glowing Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/20 blur-[120px] pointer-events-none" />
      
      <header className="flex items-center justify-between p-6 z-10">
        <BrandLogo />
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pb-16 z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <div className="relative group">
            {/* Colored border glowing effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-accent rounded-2xl blur-lg opacity-40 group-hover:opacity-60 transition duration-1000 group-hover:duration-200" />
            
            <div className="relative glass rounded-2xl p-8 md:p-10 shadow-2xl border border-white/10">
              <div className="text-center mb-8">
                <div className="inline-flex p-3 rounded-full bg-primary/10 text-primary mb-3">
                  <Sparkles size={20} className="animate-pulse" />
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-2 text-gradient-brand">
                  BBJSENSE Portal
                </h1>
                <p className="text-muted-foreground text-sm">Sign in to control and monitor RS-485 IoT devices</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Email Address</Label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11 pl-11 bg-background/50 border-white/10 focus:border-primary/50 focus:ring-primary/20 transition-all font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Password</Label>
                    <Link to="/forgot-password" className="text-xs text-primary/90 hover:text-primary hover:underline transition-all">Forgot?</Link>
                  </div>
                  <div className="relative">
                    <Key size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 pl-11 pr-10 bg-background/50 border-white/10 focus:border-primary/50 focus:ring-primary/20 transition-all font-sans"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-all"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full h-11 gradient-brand text-primary-foreground font-semibold hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.01] transition-all">
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><LogIn size={18} className="mr-2" /> Access Console</>
                  )}
                </Button>
              </form>

              {/* Demo Autocompletion Panel */}
              <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-white/5 space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 block">💡 Quick Login Credentials (SQLite Seeding)</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-8 bg-background/30 hover:bg-background/80"
                    onClick={() => autofillUser('admin')}
                  >
                    👑 Admin Demo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-8 bg-background/30 hover:bg-background/80"
                    onClick={() => autofillUser('user')}
                  >
                    🛠️ User Demo
                  </Button>
                </div>
              </div>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Need account authorization?{" "}
                <Link to="/register" className="text-primary font-semibold hover:underline">Register now</Link>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8 opacity-50 tracking-wider uppercase font-mono">
            Secure Local Server Console
          </p>
        </motion.div>
      </main>
    </div>
  );
};

export default Login;
