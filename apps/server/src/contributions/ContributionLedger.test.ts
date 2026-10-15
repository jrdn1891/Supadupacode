import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";

import {
  type OrchestrationProjectShell,
  ProjectId,
  type PullRequestListResult,
} from "@supacode/contracts";

import * as ServerConfig from "../config.ts";
import * as ProjectService from "../project/ProjectService.ts";
import * as PullRequestService from "../pullRequest/PullRequestService.ts";
import * as GitVcsDriver from "../vcs/GitVcsDriver.ts";
import * as VcsProcess from "../vcs/VcsProcess.ts";
import * as ContributionLedger from "./ContributionLedger.ts";

const projectId = ProjectId.make("project-1");

const layerGit = GitVcsDriver.layer.pipe(
  Layer.provideMerge(ServerConfig.layerTest(process.cwd(), { prefix: "supacode-contributions-" })),
  Layer.provideMerge(VcsProcess.layer),
  Layer.provideMerge(NodeServices.layer),
);

const git = (cwd: string, ...args: ReadonlyArray<string>) =>
  Effect.flatMap(GitVcsDriver.GitVcsDriver, (driver) =>
    driver.execute({ operation: "test", cwd, args }),
  );

const ledgerOver = (
  stateDir: string,
  repo: string,
  opened: Effect.Effect<
    ReadonlyArray<{ readonly url: string; readonly createdAt: string }>
  > = Effect.succeed([]),
) =>
  ContributionLedger.layer.pipe(
    Layer.provide(
      Layer.effect(
        ServerConfig.ServerConfig,
        Effect.map(ServerConfig.ServerConfig, (config) => ({ ...config, stateDir })),
      ),
    ),
    Layer.provide(
      Layer.mock(ProjectService.ProjectService)({
        listShells: () =>
          Effect.succeed([
            { id: projectId, workspaceRoot: repo },
          ] as unknown as ReadonlyArray<OrchestrationProjectShell>),
      }),
    ),
    Layer.provide(
      Layer.mock(PullRequestService.PullRequestService)({
        list: () =>
          Effect.map(
            opened,
            (entries) =>
              ({
                entries: entries.map((entry) => ({ ...entry, projectId })),
              }) as unknown as PullRequestListResult,
          ),
      }),
    ),
  );

const listAll = (awaitPullRequests?: boolean) =>
  Effect.flatMap(ContributionLedger.ContributionLedger, (ledger) =>
    ledger.list({
      since: "2000-01-01T00:00:00.000Z",
      until: "2100-01-01T00:00:00.000Z",
      ...(awaitPullRequests === undefined ? {} : { awaitPullRequests }),
    }),
  );

const tempDirectory = Effect.flatMap(FileSystem.FileSystem, (fileSystem) =>
  fileSystem.makeTempDirectoryScoped({ prefix: "supacode-seabed-" }),
);

const makeRepo = Effect.gen(function* () {
  const repo = yield* tempDirectory;
  yield* git(repo, "init", "--initial-branch=main");
  yield* git(repo, "config", "user.email", "me@example.com");
  yield* git(repo, "config", "user.name", "Me");
  yield* git(repo, "commit", "--allow-empty", "-m", "first");
  yield* git(
    repo,
    "-c",
    "user.email=them@example.com",
    "-c",
    "user.name=Them",
    "commit",
    "--allow-empty",
    "-m",
    "theirs",
  );
  yield* git(repo, "switch", "-c", "feature");
  yield* git(repo, "commit", "--allow-empty", "-m", "feature work");
  yield* git(repo, "switch", "main");
  return repo;
});

describe("ContributionLedger", () => {
  describe("list", () => {
    it.live("records the user's commits and the pull requests they opened in the window", () =>
      Effect.gen(function* () {
        const repo = yield* makeRepo;
        const now = DateTime.formatIso(yield* DateTime.now);
        const contributions = yield* listAll(true).pipe(
          Effect.provide(
            ledgerOver(
              yield* tempDirectory,
              repo,
              Effect.succeed([
                { url: "https://example.com/pr/1", createdAt: now },
                { url: "https://example.com/pr/0", createdAt: "2001-01-01T00:00:00.000Z" },
              ]),
            ),
          ),
        );

        expect(contributions.map(({ kind, key }) => (kind === "commit" ? kind : key))).toEqual([
          "commit",
          "commit",
          "https://example.com/pr/1",
        ]);
      }).pipe(Effect.provide(layerGit)),
    );

    it.live("answers with commits without waiting on pull request hosts", () =>
      Effect.gen(function* () {
        const repo = yield* makeRepo;
        const contributions = yield* listAll().pipe(
          Effect.provide(ledgerOver(yield* tempDirectory, repo, Effect.never)),
        );

        expect(contributions.map(({ kind }) => kind)).toEqual(["commit", "commit"]);
      }).pipe(Effect.provide(layerGit)),
    );

    it.live("keeps a commit after its branch is deleted", () =>
      Effect.gen(function* () {
        const repo = yield* makeRepo;
        const stateDir = yield* tempDirectory;
        const before = yield* listAll().pipe(Effect.provide(ledgerOver(stateDir, repo)));
        yield* git(repo, "branch", "-D", "feature");
        const after = yield* listAll().pipe(Effect.provide(ledgerOver(stateDir, repo)));

        expect(before).toHaveLength(2);
        expect(after).toEqual(before);
      }).pipe(Effect.provide(layerGit)),
    );

    it.live("counts a cherry-picked commit once", () =>
      Effect.gen(function* () {
        const repo = yield* makeRepo;
        yield* git(repo, "cherry-pick", "--allow-empty", "feature");
        const contributions = yield* listAll().pipe(
          Effect.provide(ledgerOver(yield* tempDirectory, repo)),
        );

        expect(contributions).toHaveLength(2);
      }).pipe(Effect.provide(layerGit)),
    );
  });
});
