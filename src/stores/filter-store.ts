import { create } from "zustand";
import type { Platform } from "@/types/platform";

interface FilterState {
  platforms: Platform[];
  minFollowers: number | null;
  maxFollowers: number | null;
  hasEmail: boolean | null;
  country: string | null;
  keyword: string | null;
  status: string | null;
  searchQuery: string;
  setPlatforms: (platforms: Platform[]) => void;
  setMinFollowers: (min: number | null) => void;
  setMaxFollowers: (max: number | null) => void;
  setHasEmail: (hasEmail: boolean | null) => void;
  setCountry: (country: string | null) => void;
  setKeyword: (keyword: string | null) => void;
  setStatus: (status: string | null) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;
}

const initialState = {
  platforms: [] as Platform[],
  minFollowers: null,
  maxFollowers: null,
  hasEmail: null,
  country: null,
  keyword: null,
  status: null,
  searchQuery: "",
};

export const useFilterStore = create<FilterState>((set) => ({
  ...initialState,
  setPlatforms: (platforms) => set({ platforms }),
  setMinFollowers: (minFollowers) => set({ minFollowers }),
  setMaxFollowers: (maxFollowers) => set({ maxFollowers }),
  setHasEmail: (hasEmail) => set({ hasEmail }),
  setCountry: (country) => set({ country }),
  setKeyword: (keyword) => set({ keyword }),
  setStatus: (status) => set({ status }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  resetFilters: () => set(initialState),
}));
