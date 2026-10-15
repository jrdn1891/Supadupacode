import type { Contribution, ContributionListInput } from "@supacode/contracts";
import { useMemo } from "react";

import { useEnvironmentIds } from "./environments";
import { createMergedEnvironmentQuery } from "./query";
import { serverEnvironment } from "./server";

const useContributionsQuery = createMergedEnvironmentQuery(
  "web-contributions:list",
  serverEnvironment.contributions,
);

export function useContributions(input: ContributionListInput): ReadonlyArray<Contribution> | null {
  const environmentIds = useEnvironmentIds();
  const { values } = useContributionsQuery(
    environmentIds.map((environmentId) => ({ environmentId, input })),
  );
  return useMemo(
    () =>
      values.length === 0
        ? null
        : [
            ...new Map(
              values.flatMap(([, contributions]) =>
                contributions.map((contribution) => [contribution.key, contribution] as const),
              ),
            ).values(),
          ],
    [values],
  );
}
