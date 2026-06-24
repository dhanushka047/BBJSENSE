import { useBranding } from "@/contexts/BrandingContext";

export function BrandLogo({ size = "default" }: { size?: "small" | "default" | "large" }) {
  const { siteName, siteLogo } = useBranding();

  const logoSizes = {
    small: "h-12 w-12",     // 48px (was 32px)
    default: "h-16 w-16",   // 64px (was 48px)
    large: "h-28 w-28",     // 112px (was 80px)
  };

  return (
    <div className="flex items-center justify-center bg-transparent">
      <img
        src={siteLogo}
        alt={siteName}
        className={`${logoSizes[size]} object-contain`}
        onError={(e) => {
          // Fallback to default logo if custom URL fails to load
          (e.target as HTMLImageElement).src = "/logo.png";
        }}
      />
    </div>
  );
}
