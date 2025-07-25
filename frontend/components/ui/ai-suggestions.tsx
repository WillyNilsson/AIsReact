import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Zap } from "lucide-react";

export function AISmartSuggestions({
  context,
  onSuggestionSelect,
}: {
  context: string;
  onSuggestionSelect: (suggestion: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    // Simulate AI processing
    if (context.length > 10) {
      setIsThinking(true);
      const timer = setTimeout(() => {
        setSuggestions([
          "Complete this thought with AI assistance",
          "Enhance clarity and engagement",
          "Add supporting evidence",
        ]);
        setIsThinking(false);
      }, 800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [context]);

  return (
    <AnimatePresence>
      {(isThinking || suggestions.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          className="absolute bottom-full mb-2 w-full"
        >
          <div className="neumorph-glass rounded-2xl p-4 space-y-2">
            {isThinking ? (
              <div className="flex items-center gap-2 text-indigo-400">
                <Brain className="w-4 h-4 animate-pulse" />
                <span className="text-sm">AI is thinking...</span>
                <div className="flex gap-1">
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 h-1 bg-indigo-400 rounded-full"
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{
                        duration: 0.6,
                        delay: i * 0.2,
                        repeat: Infinity,
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              suggestions.map((suggestion, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => onSuggestionSelect(suggestion)}
                  className="w-full text-left p-3 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 transition-all duration-200 group haptic-tap"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300" />
                    <span className="text-sm text-gray-300 group-hover:text-white">
                      {suggestion}
                    </span>
                  </div>
                </motion.button>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
