import type { ProjectContext } from "@supacode/contracts";
import { PlusIcon, XIcon } from "lucide-react";

import { PROJECT_ICON_COLORS } from "~/projectIconColors";
import { cn, randomUUID } from "~/lib/utils";

import { Button } from "../ui/button";
import { DraftInput } from "../ui/draft-input";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import {
  useScopedSettings,
  useScopedSettingsMixed,
  useUpdateScopedSettings,
} from "./useScopedSettings";

const NO_CONTEXT = "none";

function swatchClassName(color: ProjectContext["color"]): string | undefined {
  return PROJECT_ICON_COLORS.find((option) => option.value === color)?.swatchClassName;
}

export function ProjectContextSettingsRows() {
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  const mixedProjectContext = useScopedSettingsMixed(["projectContext"]);
  const contexts = settings.projectContexts;
  const writeContexts = (next: ReadonlyArray<ProjectContext>) =>
    updateSettings({ projectContexts: next });
  const editContext = (id: string, change: Partial<ProjectContext>) =>
    writeContexts(
      contexts.map((context) => (context.id === id ? { ...context, ...change } : context)),
    );
  const unusedColor =
    PROJECT_ICON_COLORS.find(
      (option) => !contexts.some((context) => context.color === option.value),
    )?.value ?? "gray";

  return (
    <>
      <SettingsRow
        serverScoped
        settingKeys={["projectContexts"]}
        {...searchableSetting("project-contexts")}
        description="Name what you work on, like Work and Side, so each project's threads carry its color."
        control={
          <Button
            size="compact"
            variant="outline"
            onClick={() =>
              writeContexts([
                ...contexts,
                { id: randomUUID(), name: "New context", color: unusedColor },
              ])
            }
          >
            <PlusIcon aria-hidden />
            Add context
          </Button>
        }
      >
        {contexts.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1.5 pb-1.5">
            {contexts.map((context) => (
              <li key={context.id} className="flex items-center gap-2">
                <Menu>
                  <MenuTrigger
                    render={
                      <button
                        type="button"
                        aria-label={`Color for ${context.name}`}
                        className="flex size-7 shrink-0 items-center justify-center rounded-md outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      />
                    }
                  >
                    <span className={cn("size-3.5 rounded-full", swatchClassName(context.color))} />
                  </MenuTrigger>
                  <MenuPopup align="start">
                    {PROJECT_ICON_COLORS.map((option) => (
                      <MenuItem
                        key={option.value}
                        onClick={() => editContext(context.id, { color: option.value })}
                      >
                        <span className={cn("size-3 rounded-full", option.swatchClassName)} />
                        {option.label}
                      </MenuItem>
                    ))}
                  </MenuPopup>
                </Menu>
                <DraftInput
                  size="sm"
                  className="w-full sm:w-56"
                  value={context.name}
                  maxLength={40}
                  aria-label="Context name"
                  onCommit={(next) => {
                    const name = next.trim();
                    if (name.length > 0 && name !== context.name) editContext(context.id, { name });
                  }}
                />
                <Button
                  size="icon-xs"
                  variant="ghost-destructive"
                  aria-label={`Remove ${context.name}`}
                  onClick={() => writeContexts(contexts.filter((item) => item.id !== context.id))}
                >
                  <XIcon aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </SettingsRow>
      {contexts.length > 0 ? (
        <SettingsRow
          serverScoped
          settingKeys={["projectContext"]}
          {...searchableSetting("project-context")}
          description="Which context a project belongs to. Set it for one project, or as this environment's default."
          control={
            <Select
              value={mixedProjectContext ? null : (settings.projectContext ?? NO_CONTEXT)}
              onValueChange={(value) => {
                if (typeof value === "string") {
                  updateSettings({ projectContext: value === NO_CONTEXT ? null : value });
                }
              }}
            >
              <SelectTrigger size="sm" className="w-full sm:w-44" aria-label="Project context">
                <SelectValue>
                  {(value: string | null) =>
                    value === null
                      ? "Mixed"
                      : (contexts.find((context) => context.id === value)?.name ?? "No context")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                {contexts.map((context) => (
                  <SelectItem hideIndicator key={context.id} value={context.id}>
                    <span className={cn("size-2.5 rounded-full", swatchClassName(context.color))} />
                    {context.name}
                  </SelectItem>
                ))}
                <SelectItem hideIndicator value={NO_CONTEXT}>
                  No context
                </SelectItem>
              </SelectPopup>
            </Select>
          }
        />
      ) : null}
    </>
  );
}
