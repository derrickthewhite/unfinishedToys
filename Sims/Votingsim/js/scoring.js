export function getIssueScore(voterOpinion, candidatePolicy, issue, candidatePoliciesForIssue) {
  if (!candidatePolicy) {
    return 0;
  }

  const voterModeId = voterOpinion.modeId;
  const candidateModeId = candidatePolicy.modeId;
  const issueModes = issue.modes;
  const voterIndex = issueModes.findIndex((mode) => mode.id === voterModeId);
  const candidateIndex = issueModes.findIndex((mode) => mode.id === candidateModeId);

  if (candidateModeId === voterModeId) {
    return voterOpinion.weight;
  }

  if (voterIndex === -1 || candidateIndex === -1) {
    return 0;
  }

  if (issueModes.length === 2) {
    return -voterOpinion.weight;
  }

  const distance = Math.abs(voterIndex - candidateIndex);
  const distances = (candidatePoliciesForIssue ?? []).map((policy) => {
    const index = issueModes.findIndex((mode) => mode.id === policy.modeId);
    return Math.abs(voterIndex - index);
  });
  const uniqueDistances = Array.from(new Set(distances));

  if (uniqueDistances.length === 1) {
    const half = issueModes.length / 2;
    if (distance < half) {
      return voterOpinion.weight;
    }
    if (distance > half) {
      return -voterOpinion.weight;
    }
    return 0;
  }

  const nearestDistance = Math.min(...uniqueDistances);
  const farthestDistance = Math.max(...uniqueDistances);
  if (nearestDistance === farthestDistance) {
    return 0;
  }

  const normalized = (distance - nearestDistance) / (farthestDistance - nearestDistance);
  return voterOpinion.weight * (1 - (2 * normalized));
}

export function scoreCandidateForVoter(voter, candidate, issuesById, allCandidates) {
  const candidatePolicies = Object.fromEntries((candidate.policies ?? []).map((policy) => [policy.issueId, policy]));
  const policyGroups = new Map();

  (allCandidates ?? []).forEach((candidateEntry) => {
    const policies = (candidateEntry.policies ?? []).filter((policy) => Boolean(policy.issueId));
    policies.forEach((policy) => {
      if (!policyGroups.has(policy.issueId)) {
        policyGroups.set(policy.issueId, []);
      }
      policyGroups.get(policy.issueId).push(policy);
    });
  });

  return voter.opinions.reduce((total, opinion) => {
    const issue = issuesById[opinion.issueId];
    const candidatePolicy = candidatePolicies[opinion.issueId];
    if (!issue || !candidatePolicy) {
      return total;
    }

    return total + getIssueScore(opinion, candidatePolicy, issue, policyGroups.get(opinion.issueId));
  }, 0);
}

export function computeFavoredCandidates(state) {
  const issuesById = Object.fromEntries(state.issues.map((issue) => [issue.id, issue]));
  const favoredCandidates = [];

  state.voters.forEach((voter) => {
    let bestCandidate = null;
    let bestScore = null;
    let hasTie = false;

    state.candidates.forEach((candidate) => {
      const score = scoreCandidateForVoter(voter, candidate, issuesById, state.candidates);
      if (bestCandidate === null || score > bestScore) {
        bestCandidate = candidate;
        bestScore = score;
        hasTie = false;
      } else if (score === bestScore) {
        hasTie = true;
      }
    });

    favoredCandidates.push({
      voterId: voter.id,
      candidateId: hasTie || state.candidates.length === 0 ? null : bestCandidate.id,
      score: bestScore
    });
  });

  return favoredCandidates;
}
