import {
  Contribution,
  type ContributionListInput,
  type OrchestrationProjectShell,
} from "@supacode/contracts";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Hex from "effect/encoding/Hex";

import * as ServerConfig from "../config.ts";
import * as ProjectService from "../project/ProjectService.ts";
import * as PullRequestService from "../pullRequest/PullRequestService.ts";
import * as GitVcsDriver from "../vcs/GitVcsDriver.ts";

const LEDGER_FILE = "contributions.jsonl";
const HARVEST_MS = 14 * 24 * 60 * 60 * 1000;
const HARVEST_TTL = "30 seconds";
const PULL_REQUESTS_PER_REPOSITORY = 20;

const ContributionLine = Schema.fromJsonString(Contribution);
const decodeLine = Schema.decodeUnknownOption(ContributionLine);
const encodeLine = Schema.encodeSync(ContributionLine);
const isoOf = (instant: string) => DateTime.formatIso(DateTime.makeUnsafe(instant));

export class ContributionLedger extends Context.Service<
  ContributionLedger,
  {
    readonly list: (input: ContributionListInput) => Effect.Effect<ReadonlyArray<Contribution>>;
  }
>()("supacode/contributions/ContributionLedger") {}

const make = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const config = yield* ServerConfig.ServerConfig;
  const projects = yield* ProjectService.ProjectService;
  const pullRequests = yield* PullRequestService.PullRequestService;
  const git = yield* GitVcsDriver.GitVcsDriver;
  const crypto = yield* Crypto.Crypto;
  const file = path.join(config.stateDir, LEDGER_FILE);

  const ledger = yield* fileSystem.readFileString(file).pipe(
    Effect.orElseSucceed(() => ""),
    Effect.map(
      (text) =>
        new Map(
          text
            .split("\n")
            .flatMap((line) => Option.toArray(decodeLine(line)))
            .map((contribution) => [contribution.key, contribution] as const),
        ),
    ),
    Effect.flatMap(Ref.make<ReadonlyMap<string, Contribution>>),
  );

  const commitsIn = (project: OrchestrationProjectShell, since: number) =>
    git.readConfigValue(project.workspaceRoot, "user.email").pipe(
      Effect.flatMap((email) =>
        email === null
          ? Effect.succeed([])
          : git
              .execute({
                operation: "ContributionLedger.commits",
                cwd: project.workspaceRoot,
                args: [
                  "log",
                  "--branches",
                  "--remotes",
                  "--no-merges",
                  "--fixed-strings",
                  `--author=<${email}>`,
                  `--since=@${Math.floor(since / 1000)}`,
                  "--format=%aI%x00%s",
                ],
              })
              .pipe(
                Effect.flatMap((result) =>
                  Effect.forEach(
                    result.stdout.split("\n").filter((line) => line !== ""),
                    (line) =>
                      crypto.digest("SHA-256", new TextEncoder().encode(line)).pipe(
                        Effect.map((digest): Contribution => ({
                          kind: "commit",
                          key: Hex.encode(digest),
                          at: isoOf(line.slice(0, line.indexOf("\0"))),
                          projectId: project.id,
                        })),
                      ),
                  ),
                ),
              ),
      ),
      Effect.orElseSucceed(() => []),
    );

  const pullRequestsOpened = (since: number) =>
    pullRequests
      .list({ state: "all", involvement: "authored", limit: PULL_REQUESTS_PER_REPOSITORY })
      .pipe(
        Effect.map((result) =>
          result.entries.flatMap((entry): ReadonlyArray<Contribution> =>
            Date.parse(entry.createdAt) < since
              ? []
              : [
                  {
                    kind: "pullRequest",
                    key: entry.url,
                    at: isoOf(entry.createdAt),
                    projectId: entry.projectId,
                  },
                ],
          ),
        ),
        Effect.orElseSucceed(() => []),
      );

  const commitsSince = (since: number) =>
    projects.listShells().pipe(
      Effect.orElseSucceed(() => []),
      Effect.flatMap((shells) =>
        Effect.forEach(shells, (project) => commitsIn(project, since), { concurrency: 4 }),
      ),
      Effect.map((commits) => commits.flat()),
    );

  const writes = yield* Semaphore.make(1);
  const recorded = (harvest: (since: number) => Effect.Effect<ReadonlyArray<Contribution>>) =>
    Effect.gen(function* () {
      const found = yield* harvest((yield* Clock.currentTimeMillis) - HARVEST_MS);
      yield* writes.withPermits(1)(
        Effect.gen(function* () {
          const known = yield* Ref.get(ledger);
          const fresh = new Map<string, Contribution>();
          for (const contribution of found)
            if (!known.has(contribution.key) && !fresh.has(contribution.key))
              fresh.set(contribution.key, contribution);
          if (fresh.size === 0) return;
          yield* Ref.set(ledger, new Map([...known, ...fresh]));
          yield* fileSystem
            .writeFileString(
              file,
              [...fresh.values()].map((line) => `${encodeLine(line)}\n`).join(""),
              { flag: "a" },
            )
            .pipe(
              Effect.catch((cause) =>
                Effect.logWarning("Could not record contributions.", { cause }),
              ),
            );
        }),
      );
    }).pipe(Effect.cachedWithTTL(HARVEST_TTL));
  const commitsRecorded = yield* recorded(commitsSince);
  const pullRequestsRecorded = yield* recorded(pullRequestsOpened);

  return ContributionLedger.of({
    list: Effect.fn("ContributionLedger.list")(function* (input) {
      yield* commitsRecorded;
      if (input.awaitPullRequests === true) yield* pullRequestsRecorded;
      const since = Date.parse(input.since);
      const until = Date.parse(input.until);
      return [...(yield* Ref.get(ledger)).values()].filter((contribution) => {
        const at = Date.parse(contribution.at);
        return at >= since && at < until;
      });
    }),
  });
});

export const layer = Layer.effect(ContributionLedger, make);
