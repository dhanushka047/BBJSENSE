import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, LogIn, Key, Mail, Terminal } from "lucide-react";
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

  // Variants for staggered entrance animation
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center relative overflow-hidden font-sans">
      
      {/* Background Ambient Glows & Grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div 
          className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-primary/10 dark:bg-primary/5 blur-[130px] animate-pulse" 
          style={{ animationDuration: '12s' }} 
        />
        <div 
          className="absolute -bottom-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-secondary/15 dark:bg-secondary/5 blur-[110px]" 
        />
        {/* Sleek industrial grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(120,119,198,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(120,119,198,0.03)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      {/* Transparent Header */}
      <header className="flex items-center justify-between px-8 py-6 z-10 w-full absolute top-0 left-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 backdrop-blur-md shadow-sm">
            <img src="/logo.png" alt="logo" className="h-5 w-5 object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold font-mono tracking-widest text-muted-foreground uppercase leading-none">Console</span>
            <span className="text-[9px] text-primary font-mono font-bold leading-none mt-0.5">v1.2.0</span>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Login Card */}
      <main className="w-full max-w-md mx-auto px-4 z-10 pt-16 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          {/* Subtle surrounding atmospheric glow */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-3xl blur-xl opacity-80 pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />
          
          <div className="relative bg-card/45 dark:bg-card/25 backdrop-blur-2xl text-card-foreground rounded-3xl p-8 md:p-10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] border border-border/40 dark:border-white/5">
            
            {/* Header / Logo section */}
            <div className="text-center mb-8 flex flex-col items-center relative">
              <div className="absolute inset-0 bg-primary/10 dark:bg-primary/5 rounded-full blur-2xl w-32 h-32 -translate-y-4 mx-auto pointer-events-none" />
              
              <motion.div 
                whileHover={{ scale: 1.05, rotate: 1 }} 
                transition={{ type: "spring", stiffness: 400, damping: 12 }}
                className="relative z-10 mb-4 p-2 rounded-2xl bg-background/50 dark:bg-background/30 border border-border/30 dark:border-white/5 shadow-md"
              >
                <BrandLogo size="large" />
              </motion.div>
              
              <h2 className="text-lg font-extrabold tracking-tight text-foreground">Console Access</h2>
              <p className="text-muted-foreground text-xs mt-1.5 font-mono tracking-wide max-w-[280px]">
                Industrial IoT Gateway Node Registry
              </p>
            </div>

            {/* Form Fields */}
            <motion.form 
              onSubmit={handleLogin} 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-5"
            >
              <motion.div variants={itemVariants} className="space-y-1.5">
                <Label 
                  htmlFor="email" 
                  className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/75 mb-1.5 block"
                >
                  Email Address
                </Label>
                <div className="relative group">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/80 group-focus-within:text-primary transition-colors duration-200" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 pl-12 bg-background/30 dark:bg-background/15 backdrop-blur-md border border-border/40 dark:border-white/5 rounded-xl focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-primary/60 focus:bg-background/60 transition-all duration-300 font-sans text-foreground text-sm shadow-inner"
                  />
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label 
                    htmlFor="password" 
                    className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/75 mb-1.5 block"
                  >
                    Password
                  </Label>
                  <Link 
                    to="/forgot-password" 
                    className="text-xs text-primary/85 hover:text-primary hover:underline transition-all duration-200"
                  >
                    Forgot?
                  </Link>
                </div>
                <div className="relative group">
                  <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/80 group-focus-within:text-primary transition-colors duration-200" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 pl-12 pr-11 bg-background/30 dark:bg-background/15 backdrop-blur-md border border-border/40 dark:border-white/5 rounded-xl focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-primary/60 focus:bg-background/60 transition-all duration-300 font-sans text-foreground text-sm shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/80 hover:text-foreground transition-all duration-200"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </motion.div>

              {/* Login Button */}
              <motion.div variants={itemVariants} className="pt-2">
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.01, translateY: -1 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold shadow-[0_6px_20px_rgba(29,104,151,0.2)] hover:shadow-[0_6px_25px_rgba(29,104,151,0.45)] transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden group border border-primary/20"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <LogIn size={18} className="transition-transform group-hover:translate-x-0.5" />
                      <span>Access Console</span>
                      {/* Interactive Shine Effect */}
                      <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 -translate-x-full group-hover:animate-shine" />
                    </>
                  )}
                </motion.button>
              </motion.div>
            </motion.form>

            {/* Technical Seeded Quick Access Panel */}
            <div className="mt-8 p-5 rounded-2xl bg-muted/10 dark:bg-card/15 border border-border/40 dark:border-white/5 backdrop-blur-md relative overflow-hidden">
              {/* Corner crosshairs for premium tech aesthetic */}
              <div className="absolute top-0 right-0 w-6 h-6 border-t border-r border-primary/20 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b border-l border-primary/20 pointer-events-none" />
              
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 block mb-3 font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-pulse" />
                Quick Access (Demo Seeding)
              </span>
              
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs h-9 bg-background/35 dark:bg-background/10 border-border/40 dark:border-white/5 hover:border-primary/50 hover:bg-background/85 text-foreground transition-all duration-300 rounded-xl flex items-center justify-center gap-1.5 group font-medium shadow-sm"
                  onClick={() => autofillUser('admin')}
                >
                  <span className="w-1 h-1 rounded-full bg-primary opacity-40 group-hover:opacity-100 transition-opacity" />
                  Admin Console
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs h-9 bg-background/35 dark:bg-background/10 border-border/40 dark:border-white/5 hover:border-primary/50 hover:bg-background/85 text-foreground transition-all duration-300 rounded-xl flex items-center justify-center gap-1.5 group font-medium shadow-sm"
                  onClick={() => autofillUser('user')}
                >
                  <span className="w-1 h-1 rounded-full bg-success opacity-40 group-hover:opacity-100 transition-opacity" />
                  User Panel
                </Button>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground mt-6">
              Need account authorization?{" "}
              <Link to="/register" className="text-primary font-semibold hover:underline transition-colors duration-200">
                Register now
              </Link>
            </p>
          </div>
        </motion.div>

        {/* Footer info */}
        <div className="text-center text-xs text-muted-foreground/50 mt-8 tracking-widest uppercase font-mono flex items-center justify-center gap-2 pointer-events-none">
          <Terminal size={12} />
          <span>Secure Local Server Console</span>
        </div>
      </main>
    </div>
  );
};

export default Login;
