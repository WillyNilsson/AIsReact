import { motion } from "framer-motion";
import {
  TrendingUp,
  Users,
  MessageSquare,
  BarChart3,
  Activity,
  Sparkles,
  Brain,
  Zap,
} from "lucide-react";

const stats = [
  {
    title: "Total Posts",
    value: "1,234",
    change: "+12.3%",
    icon: <BarChart3 className="w-5 h-5" />,
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    title: "Active Users",
    value: "567",
    change: "+5.7%",
    icon: <Users className="w-5 h-5" />,
    gradient: "from-purple-500 to-pink-500",
  },
  {
    title: "AI Responses",
    value: "8,901",
    change: "+23.1%",
    icon: <Brain className="w-5 h-5" />,
    gradient: "from-orange-500 to-red-500",
  },
  {
    title: "Verifications",
    value: "3,456",
    change: "+18.9%",
    icon: <MessageSquare className="w-5 h-5" />,
    gradient: "from-green-500 to-emerald-500",
  },
];

export function StatsGrid() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold holographic">Platform Overview</h2>
          <p className="text-gray-400 mt-1">
            Real-time statistics and insights
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full neumorph-glass">
          <Activity className="w-4 h-4 text-green-400 animate-pulse" />
          <span className="text-sm text-gray-300">Live</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative overflow-hidden rounded-3xl neumorph-glass p-6 card-3d group"
          >
            {/* Background gradient */}
            <div
              className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-br ${stat.gradient}`}
            />

            {/* Floating particles */}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className={`absolute w-1 h-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000 bg-gradient-to-br ${stat.gradient}`}
                  style={{
                    left: `${Math.random() * 100}%`,
                    animation: `float ${3 + i}s ease-in-out infinite`,
                    animationDelay: `${i * 0.5}s`,
                  }}
                />
              ))}
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`p-2 rounded-xl bg-gradient-to-br ${stat.gradient} text-white`}
                >
                  {stat.icon}
                </div>
                <div className="flex items-center gap-1 text-green-400 text-sm font-medium">
                  <TrendingUp className="w-4 h-4" />
                  {stat.change}
                </div>
              </div>

              <h3 className="text-gray-400 text-sm font-medium mb-1">
                {stat.title}
              </h3>
              <p className="text-3xl font-bold text-white font-variable">
                {stat.value}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* AI Activity Monitor */}
      <div className="rounded-3xl neumorph-glass p-8 mesh-gradient">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 float-ui">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">
              AI Activity Monitor
            </h3>
            <p className="text-gray-400 text-sm">
              Real-time AI model performance
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {["OpenAI", "Anthropic", "Google"].map((provider, index) => (
            <div key={provider} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">
                  {provider}
                </span>
                <span className="text-xs text-gray-500">98.5% uptime</span>
              </div>
              <div className="h-2 bg-gray-800/50 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${85 + index * 5}%` }}
                  transition={{ duration: 1, delay: index * 0.2 }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-yellow-400" />
                <span className="text-xs text-gray-400">
                  {Math.floor(Math.random() * 50 + 100)}ms avg response
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
