import { storedInterviewSchema } from "@preptalk/shared";
import type { StoredInterview } from "@preptalk/shared";

const storageKey = "preptalk.currentInterview";

export const loadStoredInterview = (): StoredInterview | null => {
  const rawValue = window.localStorage.getItem(storageKey);

  if (rawValue === null) {
    return null;
  }

  const parsedValue: unknown = JSON.parse(rawValue);
  const validation = storedInterviewSchema.safeParse(parsedValue);

  if (!validation.success) {
    window.localStorage.removeItem(storageKey);
    return null;
  }

  return validation.data;
};

export const saveStoredInterview = (interview: StoredInterview): void => {
  window.localStorage.setItem(storageKey, JSON.stringify(interview));
};

export const clearStoredInterview = (): void => {
  window.localStorage.removeItem(storageKey);
};
