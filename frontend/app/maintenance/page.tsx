"use client";

import { Card } from "@/components/ui/card";
import { Wrench, Clock, Bell, Twitter } from "lucide-react";

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <Card className="max-w-2xl w-full p-8 md:p-12">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Animated Icon */}
          <div className="relative">
            <div className="p-6 rounded-full bg-amber-100 dark:bg-amber-950/20">
              <Wrench className="w-16 h-16 text-amber-600 dark:text-amber-500 animate-spin-slow" />
            </div>
            <div className="absolute -top-2 -right-2 p-2 rounded-full bg-white dark:bg-gray-800 shadow-lg">
              <Clock className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>
          </div>

          {/* Main Message */}
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
              We'll be right back!
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              We're performing maintenance to improve your experience.
            </p>
          </div>

          {/* Stay Updated */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6">
            <a
              href="https://twitter.com/aisreact"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Twitter className="w-4 h-4" />
              <span className="text-sm">Follow updates</span>
            </a>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
            >
              <Bell className="w-4 h-4" />
              <span className="text-sm">Check again</span>
            </button>
          </div>
        </div>
      </Card>

      <style jsx>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes progress {
          0% {
            width: 0%;
          }
          50% {
            width: 70%;
          }
          100% {
            width: 95%;
          }
        }

        :global(.animate-spin-slow) {
          animation: spin-slow 8s linear infinite;
        }

        :global(.animate-progress) {
          animation: progress 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
