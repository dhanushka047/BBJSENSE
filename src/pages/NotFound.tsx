import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, AlertOctagon, Terminal, Network } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center relative overflow-hidden font-sans">
      
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

      {/* Main 404 Card */}
      <main className="w-full max-w-lg mx-auto px-4 z-10">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          {/* Subtle surrounding atmospheric glow */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-3xl blur-xl opacity-80 pointer-events-none" />
          
          <div className="relative bg-card/45 dark:bg-card/25 backdrop-blur-2xl text-card-foreground rounded-3xl p-8 md:p-12 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] border border-border/40 dark:border-white/5 text-center flex flex-col items-center">
            
            {/* Visual tech crosshair icon with warning sign */}
            <div className="relative mb-8 flex items-center justify-center">
              <div className="absolute inset-0 bg-destructive/10 rounded-full blur-2xl w-32 h-32 pointer-events-none mx-auto" />
              
              {/* Corner tech crosshairs */}
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40 pointer-events-none" />
              
              <div className="p-5 rounded-2xl bg-background/50 dark:bg-background/30 border border-border/30 dark:border-white/5 shadow-md relative z-10">
                <AlertOctagon size={44} className="text-destructive animate-bounce" style={{ animationDuration: '2s' }} />
              </div>
            </div>

            {/* Glowing 404 Text */}
            <h1 className="text-7xl font-extrabold font-mono tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary drop-shadow-[0_0_15px_rgba(29,104,151,0.25)] animate-pulse">
              404
            </h1>
            
            <h2 className="text-lg font-extrabold tracking-tight text-foreground mt-4">Node Address Unreachable</h2>
            <p className="text-muted-foreground text-xs mt-2 font-mono tracking-wide max-w-sm leading-relaxed">
              The requested system route <code className="bg-background/65 px-1.5 py-0.5 rounded font-mono text-[10px] text-destructive/90">{location.pathname}</code> does not exist or has been relocated in the gateway network.
            </p>

            {/* Circuit Line Decorator */}
            <div className="w-full flex items-center gap-2 my-6 opacity-65">
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-border/50 to-border" />
              <Network size={12} className="text-muted-foreground/50 shrink-0" />
              <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-border/50 to-border" />
            </div>

            {/* Back Button */}
            <Link to="/dashboard" className="w-full">
              <motion.button
                whileHover={{ scale: 1.01, translateY: -1 }}
                whileTap={{ scale: 0.99 }}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold shadow-[0_4px_15px_rgba(29,104,151,0.25)] hover:shadow-[0_4px_20px_rgba(29,104,151,0.4)] transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden group border border-primary/20"
              >
                <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
                <span>Return to Dashboard</span>
                {/* Interactive Shine Effect */}
                <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 -translate-x-full group-hover:animate-shine" />
              </motion.button>
            </Link>
          </div>
        </motion.div>

        {/* Footer info */}
        <div className="text-center text-xs text-muted-foreground/50 mt-8 tracking-widest uppercase font-mono flex items-center justify-center gap-2 pointer-events-none">
          <Terminal size={12} />
          <span>Console Link Status: Closed</span>
        </div>
      </main>
    </div>
  );
};

export default NotFound;
