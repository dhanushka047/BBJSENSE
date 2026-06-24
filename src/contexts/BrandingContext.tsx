import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BrandingContextType {
  siteName: string;
  siteLogo: string;
  isLoading: boolean;
  updateBranding: (name: string, logo: string) => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType>({
  siteName: "BBJSENSE",
  siteLogo: "/logo.png",
  isLoading: true,
  updateBranding: async () => {},
});

export const useBranding = () => useContext(BrandingContext);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [siteName, setSiteName] = useState("BBJSENSE");
  const [siteLogo, setSiteLogo] = useState("/logo.png");
  const [isLoading, setIsLoading] = useState(true);

  const fetchBranding = async () => {
    try {
      const { data } = await supabase.from("system_settings").select("*");
      if (data) {
        setSiteName(data.site_name || "BBJSENSE");
        setSiteLogo(data.site_logo || "/logo.png");
        
        // Update document title dynamically too!
        document.title = data.site_name || "BBJSENSE";
      }
    } catch (err) {
      console.error("Failed to load branding:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();

    // Subscribe to real-time system settings changes
    const channel = supabase
      .channel("system-settings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_settings" }, (payload: any) => {
        console.log("[Branding] Real-time update received:", payload);
        if (payload.new) {
          setSiteName(payload.new.site_name || "BBJSENSE");
          setSiteLogo(payload.new.site_logo || "/logo.png");
          document.title = payload.new.site_name || "BBJSENSE";
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateBranding = async (name: string, logo: string) => {
    const { error } = await supabase.from("system_settings").upsert({
      site_name: name,
      site_logo: logo,
    });

    if (error) {
      throw error;
    }

    setSiteName(name);
    setSiteLogo(logo);
    document.title = name;
  };

  return (
    <BrandingContext.Provider value={{ siteName, siteLogo, isLoading, updateBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}
