"use client";
import * as React from "react";

type ToastVariant = "default" | "destructive";

interface ToastState {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  open: boolean;
}

type Action =
  | { type: "ADD"; toast: Omit<ToastState, "open"> }
  | { type: "DISMISS"; id: string }
  | { type: "REMOVE"; id: string };

let listeners: Array<(state: ToastState[]) => void> = [];
let memoryState: ToastState[] = [];

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((l) => l(memoryState));
}

function reducer(state: ToastState[], action: Action): ToastState[] {
  switch (action.type) {
    case "ADD":
      return [...state, { ...action.toast, open: true }];
    case "DISMISS":
      return state.map((t) => (t.id === action.id ? { ...t, open: false } : t));
    case "REMOVE":
      return state.filter((t) => t.id !== action.id);
  }
}

let count = 0;
function genId() {
  return String(++count);
}

export function toast(props: { title?: string; description?: string; variant?: ToastVariant }) {
  const id = genId();
  dispatch({ type: "ADD", toast: { id, ...props } });
  setTimeout(() => dispatch({ type: "DISMISS", id }), 4000);
  setTimeout(() => dispatch({ type: "REMOVE", id }), 4500);
}

export function useToast() {
  const [state, setState] = React.useState<ToastState[]>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      listeners = listeners.filter((l) => l !== setState);
    };
  }, []);

  return { toasts: state };
}
