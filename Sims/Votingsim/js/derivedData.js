export function computeIssueModePercentages(state) {
  const percentages = [];
  state.issues.forEach((issue) => {
    const counts = issue.modes.map(() => 0);
    state.voters.forEach((voter) => {
      const opinion = voter.opinions.find((entry) => entry.issueId === issue.id);
      if (!opinion) {
        return;
      }
      const modeIndex = issue.modes.findIndex((mode) => mode.id === opinion.modeId);
      if (modeIndex !== -1) {
        counts[modeIndex] += 1;
      }
    });
    percentages.push({
      issueId: issue.id,
      values: counts.map((count) => (state.voters.length ? (count / state.voters.length) * 100 : 0))
    });
  });
  return percentages;
}

export function computeCandidateBaseRatings(state) {
  return state.candidates.map((candidate) => {
    const matchedVoters = state.voters.filter((voter) => {
      return voter.opinions.some((opinion) => {
        const matchingPolicy = (candidate.policies ?? []).find((policy) => policy.issueId === opinion.issueId);
        return Boolean(matchingPolicy && matchingPolicy.modeId === opinion.modeId);
      });
    });
    return {
      candidateId: candidate.id,
      rating: matchedVoters.length
    };
  });
}

export function computeElectionResults(state) {
  const totalVoters = state.voters.length || 0;
  const favoredCandidates = state.derived?.favoredCandidates ?? [];
  const voteCounts = new Map(state.candidates.map((candidate) => [candidate.id, 0]));

  favoredCandidates.forEach((entry) => {
    if (!entry.candidateId) {
      return;
    }
    voteCounts.set(entry.candidateId, (voteCounts.get(entry.candidateId) || 0) + 1);
  });

  const undecidedVotes = favoredCandidates.filter((entry) => !entry.candidateId).length;

  return {
    results: state.candidates.map((candidate) => ({
      candidateId: candidate.id,
      votes: voteCounts.get(candidate.id) || 0,
      percentage: totalVoters ? ((voteCounts.get(candidate.id) || 0) / totalVoters) * 100 : 0
    })),
    undecidedVotes,
    undecidedPercentage: totalVoters ? (undecidedVotes / totalVoters) * 100 : 0
  };
}
