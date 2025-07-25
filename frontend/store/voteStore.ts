import { create } from "zustand";
import { persist } from "zustand/middleware";

interface VoteRecord {
  postId: number;
  vote: boolean;
  timestamp: number;
}

interface VoteStore {
  votes: Map<number, VoteRecord>;
  setVote: (postId: number, vote: boolean | null) => void;
  getVote: (postId: number) => boolean | null;
  clearVotes: () => void;
  syncVotesFromApi: (votes: Array<{ postId: number; vote: boolean }>) => void;
}

// Storage configuration for persistence
const storageConfig = {
  getItem: (name: string) => {
    const str = localStorage.getItem(name);
    if (!str) {
      return null;
    }
    const { state } = JSON.parse(str);
    return {
      state: {
        ...state,
        votes: new Map(state.votes),
      },
    };
  },
  setItem: (name: string, value: any) => {
    const { state } = value;
    localStorage.setItem(
      name,
      JSON.stringify({
        state: {
          ...state,
          votes: Array.from(state.votes.entries()),
        },
      }),
    );
  },
  removeItem: (name: string) => localStorage.removeItem(name),
};

// Store user votes with local persistence for immediate UI updates
export const useVoteStore = create<VoteStore>()(
  persist(
    (set, get) => ({
      votes: new Map(),

      setVote: (postId: number, vote: boolean | null) => {
        set((state) => {
          const newVotes = new Map(state.votes);
          if (vote === null) {
            // Remove the vote
            newVotes.delete(postId);
          } else {
            // Set or update the vote
            newVotes.set(postId, {
              postId,
              vote,
              timestamp: Date.now(),
            });
          }
          return { votes: newVotes };
        });
      },

      getVote: (postId: number) => {
        const voteRecord = get().votes.get(postId);
        return voteRecord ? voteRecord.vote : null;
      },

      clearVotes: () => {
        set({ votes: new Map() });
      },

      syncVotesFromApi: (votes: Array<{ postId: number; vote: boolean }>) => {
        set((state) => {
          const newVotes = new Map(state.votes);
          votes.forEach(({ postId, vote }) => {
            newVotes.set(postId, {
              postId,
              vote,
              timestamp: Date.now(),
            });
          });
          return { votes: newVotes };
        });
      },
    }),
    {
      name: "user-votes",
      storage: storageConfig,
    },
  ),
);

// Export storage config for testing
export { storageConfig };
