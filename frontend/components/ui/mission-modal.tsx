"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Shield,
  Users,
  Eye,
  Brain,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

interface MissionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const slidesData = [
  {
    title: "Welcome to AIsReact",
    subtitle: "Understanding AI Through Transparency",
    content: "See how AI models interpret current events.",
    icon: Sparkles,
    visualType: "models",
  },
  {
    title: "Community-Driven Content",
    subtitle: "You Submit What Matters",
    content: "Submit news for AI analysis.",
    icon: Users,
    visualType: "community",
  },
  {
    title: "Transparent Verification",
    subtitle: "Building Trust Through Openness",
    content: "Multi-step verification with full transparency.",
    icon: Shield,
    visualType: "process",
  },
  {
    title: "AI Analysis",
    subtitle: "One Prompt, Multiple Perspectives",
    content: "Aiming for replicability.",
    icon: Brain,
    visualType: "analysis",
  },
  {
    title: "Open Source",
    subtitle: "Apache 2.0 License",
    content: "Open source. Public prompt.",
    icon: Eye,
    visualType: "opensource",
  },
];

export function MissionModal({ isOpen, onClose }: MissionModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (isOpen && !hasInteracted) {
      const timer = setTimeout(() => {
        if (currentSlide < slidesData.length - 1) {
          setCurrentSlide((prev) => prev + 1);
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [currentSlide, isOpen, hasInteracted]);

  useEffect(() => {
    if (isOpen) {
      setCurrentSlide(0);
      setHasInteracted(false);
    }
  }, [isOpen]);

  const nextSlide = () => {
    setHasInteracted(true);
    if (currentSlide < slidesData.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    }
  };

  const prevSlide = () => {
    setHasInteracted(true);
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const goToSlide = (index: number) => {
    setHasInteracted(true);
    setCurrentSlide(index);
  };

  const handleGetStarted = () => {
    onClose();
    // If user is not authenticated, redirect to register
    if (!isAuthenticated) {
      router.push("/auth/register");
    }
  };

  const renderVisual = (type: string) => {
    switch (type) {
      case "models":
        return (
          <div className="relative w-full h-32 sm:h-40 md:h-48">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 sm:gap-3">
              {/* First row - 3 models */}
              <div className="flex gap-3">
                {[
                  { name: "GPT", color: "from-emerald-500 to-teal-600" },
                  { name: "Claude", color: "from-orange-500 to-amber-600" },
                  { name: "Gemini", color: "from-blue-500 to-indigo-600" },
                ].map((model) => (
                  <div
                    key={model.name}
                    className={`
                    w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center
                    bg-gradient-to-br ${model.color}
                  `}
                  >
                    <span className="text-white font-bold text-[10px] sm:text-xs">
                      {model.name}
                    </span>
                  </div>
                ))}
              </div>
              {/* Second row - 2 models centered */}
              <div className="flex gap-3">
                {[
                  { name: "Grok", color: "from-purple-500 to-pink-600" },
                  { name: "DeepSeek", color: "from-cyan-500 to-blue-600" },
                ].map((model) => (
                  <div
                    key={model.name}
                    className={`
                    w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center
                    bg-gradient-to-br ${model.color}
                  `}
                  >
                    <span className="text-white font-bold text-[10px] sm:text-xs">
                      {model.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case "community":
        return (
          <div className="relative w-full h-32 sm:h-40 md:h-48">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full border-4 border-indigo-500/30 flex items-center justify-center">
                  <Users className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-indigo-400" />
                </div>
                {[0, 60, 120, 180, 240, 300].map((angle) => (
                  <div
                    key={angle}
                    className="absolute w-8 h-8 rounded-full bg-indigo-500/20"
                    style={{
                      top: "50%",
                      left: "50%",
                      transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(60px)`,
                    }}
                  >
                    <div className="w-full h-full rounded-full bg-indigo-400 scale-50" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case "process":
        return (
          <div className="relative w-full h-32 sm:h-40 md:h-48 flex items-center justify-center px-2">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <div className="text-center">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl bg-blue-500/20 flex items-center justify-center mb-1 sm:mb-2">
                  <ArrowRight className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-blue-400" />
                </div>
                <span className="text-[10px] sm:text-xs text-gray-400">
                  Submit
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500" />
              <div className="text-center">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl bg-yellow-500/20 flex items-center justify-center mb-1 sm:mb-2">
                  <Shield className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-yellow-400" />
                </div>
                <span className="text-[10px] sm:text-xs text-gray-400">
                  Moderate
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500" />
              <div className="text-center">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl bg-green-500/20 flex items-center justify-center mb-1 sm:mb-2">
                  <Users className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-green-400" />
                </div>
                <span className="text-[10px] sm:text-xs text-gray-400">
                  Verify
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500" />
              <div className="text-center">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl bg-purple-500/20 flex items-center justify-center mb-1 sm:mb-2">
                  <Brain className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-purple-400" />
                </div>
                <span className="text-[10px] sm:text-xs text-gray-400">
                  Analyze
                </span>
              </div>
            </div>
          </div>
        );
      case "analysis":
        return (
          <div className="relative w-full h-32 sm:h-40 md:h-48">
            <div className="absolute inset-0 flex items-center justify-center px-2 sm:px-4">
              <div className="p-2 sm:p-3 md:p-4 rounded-xl bg-gray-800/50 border border-gray-700 backdrop-blur-sm max-w-lg w-full">
                <p className="text-[10px] sm:text-xs text-gray-400 font-mono leading-relaxed">
                  <span className="hidden sm:block">
                    Please answer the following questions about the provided
                    content. If the content doesn't exist in your training data
                    or seems to be from a future date/hypothetical scenario,
                    still assume that it is a real event that has actually
                    occurred and answer accordingly. Be direct and provide your
                    own perspective.
                    <br />
                    <br />
                  </span>
                  1. What is your summary of this?
                  <br />
                  2. How do you view this in a historical context?
                  <br />
                  3. How do you see this developing in the future?
                  <br />
                  4. What are your overall opinions and thoughts on this?
                </p>
              </div>
            </div>
          </div>
        );
      case "opensource":
        return (
          <div className="relative w-full h-32 sm:h-40 md:h-48 flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl" />
              <div className="relative bg-gray-900/50 backdrop-blur rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 border border-gray-700">
                <div className="flex items-center gap-2 sm:gap-3 md:gap-4 mb-2 sm:mb-3">
                  <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full bg-red-500" />
                  <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full bg-yellow-500" />
                  <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full bg-green-500" />
                </div>
                <pre className="text-[10px] sm:text-xs text-gray-400">
                  <code>{`{
  "license": "apache-2.0",
  "source": "github",
  "contributions": "appreciated"
}`}</code>
                </pre>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const currentSlideData = slidesData[currentSlide];
  const CurrentIcon = currentSlideData.icon;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-2xl max-h-[80vh] bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-800/50 hover:bg-gray-800 transition-colors group"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-400 group-hover:text-white" />
          </button>

          {/* Content */}
          <div className="h-full flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.3 }}
                className="flex-1 p-4 sm:p-6 md:p-8 lg:p-12"
              >
                <div className="h-full flex flex-col">
                  {/* Icon */}
                  <div className="mb-4 sm:mb-6">
                    <div className="inline-flex p-2 sm:p-3 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
                      <CurrentIcon className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-400" />
                    </div>
                  </div>

                  {/* Text content */}
                  <div className="mb-4 sm:mb-8">
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">
                      {currentSlideData.title}
                    </h2>
                    <h3 className="text-base sm:text-lg md:text-xl text-indigo-400 mb-2 sm:mb-4">
                      {currentSlideData.subtitle}
                    </h3>
                    <p className="text-gray-400 text-sm sm:text-base md:text-lg leading-relaxed">
                      {currentSlideData.content}
                    </p>
                  </div>

                  {/* Visual */}
                  <div className="flex-1 flex items-center justify-center">
                    {renderVisual(currentSlideData.visualType)}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="p-6 border-t border-gray-800">
              <div className="flex items-center justify-between">
                {/* Progress dots */}
                <div className="flex gap-2">
                  {slidesData.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => goToSlide(index)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentSlide
                          ? "w-8 bg-indigo-500"
                          : "bg-gray-600 hover:bg-gray-500"
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>

                {/* Navigation buttons */}
                <div className="flex gap-2">
                  {currentSlide > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={prevSlide}
                      className="gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </Button>
                  )}

                  {currentSlide < slidesData.length - 1 ? (
                    <Button
                      size="sm"
                      onClick={nextSlide}
                      className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleGetStarted}
                      className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                    >
                      Go
                      <Sparkles className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
