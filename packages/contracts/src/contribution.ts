import * as Schema from "effect/Schema";

import { IsoDateTime, ProjectId, TrimmedNonEmptyString } from "./baseSchemas.ts";

export const Contribution = Schema.Struct({
  kind: Schema.Literals(["commit", "pullRequest"]),
  key: TrimmedNonEmptyString,
  at: IsoDateTime,
  projectId: ProjectId,
});
export type Contribution = typeof Contribution.Type;

export const ContributionListInput = Schema.Struct({
  since: IsoDateTime,
  until: IsoDateTime,
  awaitPullRequests: Schema.optional(Schema.Boolean),
});
export type ContributionListInput = typeof ContributionListInput.Type;
