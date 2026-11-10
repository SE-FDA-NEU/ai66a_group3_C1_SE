import { createContext, useContext } from "react";

export type FeedbackMessage = {
  kind: "info" | "pending" | "success" | "error";
  title: string;
  message?: string;
};

type FeedbackActions = {
  announce: (message: FeedbackMessage) => number;
  update: (id: number, message: FeedbackMessage) => void;
  dismiss: (id?: number) => void;
};

export const FeedbackContext = createContext<FeedbackActions>({
  // Widgets retain their inline messages when embedded without the app shell.
  announce: () => 0,
  update: () => {},
  dismiss: () => {},
});

export function useFeedback() {
  return useContext(FeedbackContext);
}
