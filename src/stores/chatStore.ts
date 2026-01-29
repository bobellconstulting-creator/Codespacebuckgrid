'use client'

import { create } from 'zustand'

export type ChatMessage = {
  role: 'user' | 'tony'
  text: string
}

type ChatState = {
  messages: ChatMessage[]
  loading: boolean
  isOpen: boolean
  addMessage: (msg: ChatMessage) => void
  setLoading: (loading: boolean) => void
  toggleOpen: () => void
  setOpen: (open: boolean) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [{ role: 'tony', text: "Lock a boundary and let's build something that makes deer move where you want 'em." }],
  loading: false,
  isOpen: true,

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setLoading: (loading) => set({ loading }),
  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (isOpen) => set({ isOpen }),
  clearMessages: () => set({ messages: [{ role: 'tony', text: "Clean slate. Lock a boundary and send your notes." }] }),
}))
