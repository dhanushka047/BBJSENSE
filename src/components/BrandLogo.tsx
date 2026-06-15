import { Activity } from "lucide-react";

export function BrandLogo({ size = "default" }: { size?: "small" | "default" | "large" }) {
  const sizeClasses = {
    small: "text-lg gap-2",
    default: "text-2xl gap-2.5",
    large: "text-4xl gap-3",
  };
  const iconSizes = { small: 20, default: 28, large: 40 };

  return (
    <div className={`flex items-center font-bold tracking-tight ${sizeClasses[size]}`}>
      <div className="gradient-brand rounded-lg p-1.5 flex items-center justify-center">
        <Activity className="text-primary-foreground" size={iconSizes[size]} />
      </div>
      <span className="text-gradient-brand">BBJSENSE</span>
    </div>
  );
}
