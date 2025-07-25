"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface NavLinkProps {
  href: string;
  label: string;
  icon?: LucideIcon;
  className?: string;
  activeClassName?: string;
  exactMatch?: boolean;
  children?: React.ReactNode;
}

export function NavLink({
  href,
  label,
  icon: Icon,
  className,
  activeClassName,
  exactMatch = false,
  children,
}: NavLinkProps) {
  const pathname = usePathname();
  const isActive = exactMatch ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all",
        "hover:bg-background-secondary hover:text-text-primary",
        isActive
          ? "bg-background-secondary text-text-primary"
          : "text-text-secondary",
        isActive && activeClassName,
        className,
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
      <span>{children || label}</span>
    </Link>
  );
}
