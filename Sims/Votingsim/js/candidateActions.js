import { createId } from './utils.js';

export function addCandidate(state) {
  state.candidates.push({
    id: createId('candidate'),
    name: `Candidate ${state.candidates.length + 1}`,
    policies: []
  });
}

export function deleteCandidate(state, candidateId) {
  state.candidates = state.candidates.filter((candidate) => candidate.id !== candidateId);
}

export function addCandidatePolicy(state, candidateId, issueId, modeId) {
  const candidate = state.candidates.find((entry) => entry.id === candidateId);
  if (!candidate) {
    return false;
  }

  if (candidate.policies.some((policy) => policy.issueId === issueId)) {
    return false;
  }

  candidate.policies.push({ id: createId('policy'), issueId, modeId });
  return true;
}

export function editCandidatePolicy(state, candidateId, policyId, modeId) {
  const candidate = state.candidates.find((entry) => entry.id === candidateId);
  if (!candidate) {
    return false;
  }

  const policy = candidate.policies.find((entry) => entry.id === policyId);
  if (!policy) {
    return false;
  }

  policy.modeId = modeId;
  return true;
}

export function deleteCandidatePolicy(state, candidateId, policyId) {
  const candidate = state.candidates.find((entry) => entry.id === candidateId);
  if (!candidate) {
    return false;
  }

  candidate.policies = candidate.policies.filter((policy) => policy.id !== policyId);
  return true;
}

export function createCandidateFromVoter(state, voterId) {
  const voter = state.voters.find((entry) => entry.id === voterId);
  if (!voter) {
    return false;
  }

  state.candidates.push({
    id: createId('candidate'),
    name: `Candidate ${state.candidates.length + 1}`,
    policies: voter.opinions.map((opinion) => ({
      id: createId('policy'),
      issueId: opinion.issueId,
      modeId: opinion.modeId
    }))
  });

  return true;
}

export function createOpinionatedCandidate(state) {
  if (!state.issues.length) {
    return false;
  }

  const policies = state.issues.map((issue) => {
    const mode = issue.modes[Math.floor(Math.random() * issue.modes.length)];
    return {
      id: createId('policy'),
      issueId: issue.id,
      modeId: mode.id
    };
  });

  state.candidates.push({
    id: createId('candidate'),
    name: `Opinionated Candidate ${state.candidates.length + 1}`,
    policies
  });

  return true;
}
