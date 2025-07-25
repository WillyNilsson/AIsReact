"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  LogOut,
  Plus,
  CheckCircle,
  XCircle,
  ChevronDown,
  Home,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authApi } from "@/lib/api";
import { logger } from "@/lib/logger";
import { DropdownPortal } from "./dropdown-portal";

interface UserDropdownProps {
  user: {
    username: string;
    role: string;
  };
}

export function UserDropdown({ user }: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Check if we're on mobile using matchMedia
      const isMobile = window.matchMedia("(max-width: 639px)").matches;
      if (isMobile) {
        document.body.style.overflow = "hidden";
      }
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
      router.push("/");
    } catch (error) {
      logger.error("Logout error", error);
      router.push("/");
    }
  };

  const menuItems = [
    {
      href: `/profile/${user.username}`,
      label: "Profile",
      icon: User,
    },
    { type: "divider" },
    {
      href: "/",
      label: "Home",
      icon: Home,
    },
    {
      href: "/verify",
      label: "Verify",
      icon: CheckCircle,
    },
    {
      href: "/rejected",
      label: "Rejected",
      icon: XCircle,
    },
    {
      href: "/submit",
      label: "Submit",
      icon: Plus,
    },
    // ...(["moderator", "admin"].includes(user.role)
    //   ? [
    //     {
    //       href: "/moderate",
    //       label: "Moderate",
    //       icon: Shield,
    //     },
    //   ]
    //   : []),
    { type: "divider" },
    {
      action: handleLogout,
      label: "Sign Out",
      icon: LogOut,
    },
  ];

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center space-x-2 p-2 rounded-lg",
          "hover:bg-white/5 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-white/20",
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`User menu for ${user.username}`}
        title={`User menu for ${user.username}`}
      >
        <div className="h-8 w-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center">
          <User className="h-4 w-4 text-white" />
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-gray-400 transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <DropdownPortal>
          {/* Mobile: Full-screen modal - hidden on desktop */}
          <div className="sm:hidden">
            <div
              className="fixed inset-0 bg-black/80 z-[9998]"
              onClick={() => setIsOpen(false)}
            />
            <div
              ref={dropdownRef}
              className="fixed inset-0 bg-gray-950 z-[9999] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{user.username}</p>
                    <p className="text-sm text-gray-400">{user.role}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  aria-label="Close menu"
                  title="Close menu"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              {/* Menu items */}
              <div className="flex-1 py-4">
                {menuItems.map((item, index) => {
                  if (item.type === "divider") {
                    return <hr key={index} className="my-4 border-white/10" />;
                  }

                  if (item.action) {
                    return (
                      <button
                        key={item.label}
                        onClick={() => {
                          setIsOpen(false);
                          item.action();
                        }}
                        className={cn(
                          "w-full flex items-center space-x-4 px-6 py-4",
                          "text-left text-base text-gray-300",
                          "hover:bg-white/5 hover:text-white transition-colors",
                        )}
                      >
                        {item.icon && <item.icon className="h-5 w-5" />}
                        <span>{item.label}</span>
                      </button>
                    );
                  }

                  return item.href ? (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "flex items-center space-x-4 px-6 py-4",
                        "text-base text-gray-300",
                        "hover:bg-white/5 hover:text-white transition-colors",
                      )}
                    >
                      {item.icon && <item.icon className="h-5 w-5" />}
                      <span>{item.label}</span>
                    </Link>
                  ) : null;
                })}
              </div>
            </div>
          </div>

          {/* Desktop: Dropdown - hidden on mobile */}
          <div
            ref={dropdownRef}
            className="hidden sm:block fixed w-56 rounded-lg bg-gray-900 border border-white/10 shadow-xl py-1 z-[9999] max-h-[calc(100vh-5rem)] overflow-y-auto"
            style={{
              top: buttonRef.current
                ? buttonRef.current.getBoundingClientRect().bottom + 8
                : 0,
              left: buttonRef.current
                ? buttonRef.current.getBoundingClientRect().right - 224
                : 0,
            }}
          >
            {menuItems.map((item, index) => {
              if (item.type === "divider") {
                return <hr key={index} className="my-1 border-white/10" />;
              }

              if (item.action) {
                return (
                  <button
                    key={item.label}
                    onClick={() => {
                      setIsOpen(false);
                      item.action();
                    }}
                    className={cn(
                      "w-full flex items-center space-x-3 px-4 py-2",
                      "text-left text-sm text-gray-300",
                      "hover:bg-white/5 hover:text-white transition-colors",
                    )}
                  >
                    {item.icon && <item.icon className="h-4 w-4" />}
                    <span>{item.label}</span>
                  </button>
                );
              }

              return item.href ? (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center space-x-3 px-4 py-2",
                    "text-sm text-gray-300",
                    "hover:bg-white/5 hover:text-white transition-colors",
                  )}
                >
                  {item.icon && <item.icon className="h-4 w-4" />}
                  <span>{item.label}</span>
                </Link>
              ) : null;
            })}
          </div>
        </DropdownPortal>
      )}
    </div>
  );
}
