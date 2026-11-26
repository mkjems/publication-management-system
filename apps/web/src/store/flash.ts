import { create } from 'zustand'

/** A single transient message, e.g. when a command is refused. */
export const useFlash = create<{
  message: string | null
  show: (m: string) => void
  clear: () => void
}>()((set) => ({
  message: null,
  show: (message) => set({ message }),
  clear: () => set({ message: null }),
}))
