import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<ReactNavigation.RootParamList>();

export function onScreenThreadKey(): string | null {
  const route = navigationRef.isReady() ? navigationRef.getCurrentRoute() : undefined;
  const params = route?.name === "Thread" ? route.params : undefined;
  return params && "environmentId" in params && "threadId" in params
    ? `${String(params.environmentId)}:${String(params.threadId)}`
    : null;
}
