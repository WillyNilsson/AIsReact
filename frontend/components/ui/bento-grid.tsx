import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) => {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl mx-auto",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const BentoGridItem = ({
  className,
  title,
  description,
  header,
  icon,
}: {
  className?: string;
  title?: string | ReactNode;
  description?: string | ReactNode;
  header?: ReactNode;
  icon?: ReactNode;
}) => {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-gray-900/90 to-gray-950/90 backdrop-blur-xl p-6 transition-all duration-300",
        "hover:shadow-2xl hover:shadow-indigo-500/[0.1] hover:border-indigo-500/20",
        "hover:bg-gradient-to-br hover:from-gray-900/95 hover:to-gray-950/95",
        className,
      )}
    >
      {/* Animated gradient border */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-10 transition-opacity duration-500" />

      {/* 3D transform on hover */}
      <div className="relative z-10 transform-gpu transition-transform duration-300 group-hover:translate-y-[-2px]">
        {header}
        <div className="mt-4">
          {icon}
          <h3 className="font-semibold text-lg text-white mt-2">{title}</h3>
          <p className="text-gray-400 text-sm mt-1">{description}</p>
        </div>
      </div>

      {/* Floating particles effect */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-10 opacity-0 group-hover:opacity-100 transition-opacity duration-1000">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-indigo-500/30 rounded-full blur-sm animate-float"
              style={{
                left: `${20 + i * 30}%`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: `${3 + i}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
