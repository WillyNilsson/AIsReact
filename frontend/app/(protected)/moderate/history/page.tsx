"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import {
  CheckCircle,
  XCircle,
  Trash2,
  Calendar,
  User,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";

interface ModerationHistoryItem {
  id: number;
  title: string;
  status: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  moderated_at: string;
  moderated_by: number;
  moderator_username: string;
}

interface PaginatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ModerationHistoryItem[];
}

export default function ModerationHistory() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [filters, setFilters] = useState({
    moderator: "",
    status: "",
    start_date: "",
    end_date: "",
  });
  const [currentPage, setCurrentPage] = useState(1);

  // Build query string
  const queryParams = new URLSearchParams();
  queryParams.append("page", currentPage.toString());
  if (filters.moderator) {
    queryParams.append("moderator", filters.moderator);
  }
  if (filters.status) {
    queryParams.append("status", filters.status);
  }
  if (filters.start_date) {
    queryParams.append("start_date", filters.start_date);
  }
  if (filters.end_date) {
    queryParams.append("end_date", filters.end_date);
  }

  // useQuery must be called before any conditional returns
  const { data, error, isLoading } = useQuery<PaginatedResponse>({
    queryKey: ["moderation-history", queryParams.toString()],
    queryFn: () =>
      api.get(`/api/moderation/history/?${queryParams.toString()}`),
    enabled: !!user && (user.role === "moderator" || user.role === "admin"),
  });

  // Check permissions in useEffect to avoid SSR issues
  useEffect(() => {
    if (!user || (user.role !== "moderator" && user.role !== "admin")) {
      router.push("/");
    }
  }, [user, router]);

  // Show loading state while checking permissions
  if (!user || (user.role !== "moderator" && user.role !== "admin")) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  const items = data?.results || [];
  const totalPages = data ? Math.ceil(data.count / 20) : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_verification":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle className="h-3 w-3" />
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
            <XCircle className="h-3 w-3" />
            Rejected
          </span>
        );
      case "removed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
            <Trash2 className="h-3 w-3" />
            Removed
          </span>
        );
      default:
        return <span className="text-xs">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Moderation History</h1>
            <p className="text-muted-foreground">
              View past moderation actions and activity
            </p>
          </div>
          {/* <Link href="/moderate">
            <Button variant="outline">Back to Queue</Button>
          </Link> */}
        </div>

        {/* Filters */}
        <Card className="p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Moderator
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Username..."
                  className="pl-10"
                  value={filters.moderator}
                  onChange={(e) =>
                    setFilters({ ...filters, moderator: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                className="w-full px-3 py-2 border rounded-md bg-background"
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
              >
                <option value="">All statuses</option>
                <option value="pending_verification">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="removed">Removed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Start Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="date"
                  className="pl-10"
                  value={filters.start_date}
                  onChange={(e) =>
                    setFilters({ ...filters, start_date: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="date"
                  className="pl-10"
                  value={filters.end_date}
                  onChange={(e) =>
                    setFilters({ ...filters, end_date: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setFilters({
                  moderator: "",
                  status: "",
                  start_date: "",
                  end_date: "",
                });
                setCurrentPage(1);
              }}
            >
              Clear Filters
            </Button>
          </div>
        </Card>

        {/* History Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Post
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Moderator
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center">
                      Loading history...
                    </td>
                  </tr>
                )}

                {error && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4">
                      <Alert variant="error">
                        Error loading moderation history
                      </Alert>
                    </td>
                  </tr>
                )}

                {items.length === 0 && !isLoading && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-4 text-center text-muted-foreground"
                    >
                      No moderation history found
                    </td>
                  </tr>
                )}

                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/posts/${item.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {item.title}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-1">
                        ID: {item.id}
                      </p>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                    <td className="px-6 py-4 text-sm">
                      {item.moderator_username}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {format(new Date(item.moderated_at), "PPp")}
                    </td>
                    <td className="px-6 py-4 text-sm max-w-xs truncate">
                      {item.rejection_reason || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-center items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
