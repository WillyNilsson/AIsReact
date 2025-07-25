"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { ProcessFlow } from "./process-flow";
import { Button } from "./button";

interface CompactHeroProps {
  onOpenMission: () => void;
}

export function CompactHero({ onOpenMission }: CompactHeroProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 rounded-2xl border border-gray-800 bg-gray-900/50 backdrop-blur overflow-hidden"
    >
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Welcome to AIsReact</h2>
              <p className="text-sm text-gray-400 mt-1">
                Observe how different AI models react to real-world events
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenMission}
              className="hidden sm:flex gap-2"
            >
              Learn More
            </Button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="pt-6 border-t border-gray-800 mt-6">
                <ProcessFlow />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="p-4 rounded-xl bg-gray-800/50">
                    <h4 className="font-medium text-sm mb-1">
                      Community-Driven
                    </h4>
                    <p className="text-xs text-gray-400">
                      Users submit the news events that matter most
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-800/50">
                    <h4 className="font-medium text-sm mb-1">
                      Scientifically Controlled
                    </h4>
                    <p className="text-xs text-gray-400">
                      Same prompt for all AI models ensures fair comparison
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-800/50">
                    <h4 className="font-medium text-sm mb-1">
                      Radically Transparent
                    </h4>
                    <p className="text-xs text-gray-400">
                      Every step is public and auditable
                    </p>
                  </div>
                </div>

                <div className="flex justify-center mt-6">
                  <Button
                    onClick={onOpenMission}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Sparkles className="w-4 h-4" />
                    Explore Our Mission
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
