import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, Search, FileQuestion } from "lucide-react";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <Card className="max-w-2xl w-full p-8 md:p-12">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Icon */}
          <div className="p-6 rounded-full bg-gray-100 dark:bg-gray-800">
            <FileQuestion className="w-16 h-16 text-gray-600 dark:text-gray-400" />
          </div>

          {/* Error Code */}
          <div className="space-y-2">
            <h1 className="text-8xl font-bold text-gray-900 dark:text-gray-100">
              404
            </h1>
            <h2 className="text-2xl font-semibold">Page Not Found</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Sorry, we couldn't find the page you're looking for.
            </p>
          </div>

          {/* Helpful Suggestions */}
          <div className="w-full max-w-md space-y-4 pt-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Here are some helpful links:
            </h3>

            <div className="grid gap-3">
              <Link href="/">
                <Button variant="primary" className="w-full gap-2">
                  <Home className="w-4 h-4" />
                  Back to Home
                </Button>
              </Link>

              <Link href="/verify">
                <Button variant="outline" className="w-full gap-2">
                  <Search className="w-4 h-4" />
                  Browse Posts to Verify
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
