import { createFileRoute } from "@tanstack/react-router";

import { SceneHome } from "../scene/SceneHome";

export const Route = createFileRoute("/_chat/home")({
  component: SceneHome,
});
