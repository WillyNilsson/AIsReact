"use client";

import { motion } from "framer-motion";
import { ArrowRight, Upload, Shield, Users, Brain, Globe } from "lucide-react";

export function ProcessFlow() {
  const steps = [
    {
      icon: Upload,
      title: "Submit",
      description: "Share news that matters",
      color: "from-blue-500 to-cyan-500",
      delay: 0,
    },
    {
      icon: Shield,
      title: "Moderate",
      description: "Automated safety checks",
      color: "from-yellow-500 to-orange-500",
      delay: 0.1,
    },
    {
      icon: Users,
      title: "Verify",
      description: "Community validation",
      color: "from-green-500 to-emerald-500",
      delay: 0.2,
    },
    {
      icon: Brain,
      title: "Analyze",
      description: "AI models respond",
      color: "from-purple-500 to-pink-500",
      delay: 0.3,
    },
    {
      icon: Globe,
      title: "Publish",
      description: "Share with the world",
      color: "from-indigo-500 to-blue-500",
      delay: 0.4,
    },
  ];

  return (
    <div className="relative py-8 px-4 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 rounded-2xl" />

      <div className="relative">
        <h3 className="text-lg font-semibold text-center mb-8">
          How AIsReact Works
        </h3>

        <div className="flex items-center justify-center gap-2 md:gap-4 flex-wrap md:flex-nowrap">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: step.delay, duration: 0.5 }}
              className="flex items-center"
            >
              <div className="flex flex-col items-center group">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className={`
                    w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color}
                    flex items-center justify-center shadow-lg
                    group-hover:shadow-2xl transition-all duration-300
                    relative overflow-hidden
                  `}
                >
                  {/* Shimmer effect */}
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
                                -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                  />
                  <step.icon className="w-8 h-8 text-white relative z-10" />
                </motion.div>
                <div className="mt-3 text-center">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 max-w-[100px]">
                    {step.description}
                  </p>
                </div>
              </div>

              {index < steps.length - 1 && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: step.delay + 0.2, duration: 0.3 }}
                  className="hidden md:block"
                >
                  <ArrowRight className="w-5 h-5 text-gray-400 mx-2" />
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-sm text-gray-500 mt-6"
        >
          Every step is transparent and publicly auditable
        </motion.p>
      </div>
    </div>
  );
}
