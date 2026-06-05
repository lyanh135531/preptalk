import type { InterviewTurn, Score } from "@preptalk/shared";

export type InterviewSummary = {
  readonly averageScore: Score;
  readonly strengths: readonly string[];
  readonly improvements: readonly string[];
};

export const buildInterviewSummary = (history: readonly InterviewTurn[]): InterviewSummary => {
  if (history.length === 0) {
    return {
      averageScore: {
        communication: 0,
        roleRelevance: 0,
        structure: 0,
        languageAccuracy: 0,
        confidence: 0
      },
      strengths: [],
      improvements: []
    };
  }

  const totals = history.reduce<Score>((score: Score, turn: InterviewTurn): Score => ({
    communication: score.communication + turn.feedback.score.communication,
    roleRelevance: score.roleRelevance + turn.feedback.score.roleRelevance,
    structure: score.structure + turn.feedback.score.structure,
    languageAccuracy: score.languageAccuracy + turn.feedback.score.languageAccuracy,
    confidence: score.confidence + turn.feedback.score.confidence
  }), {
    communication: 0,
    roleRelevance: 0,
    structure: 0,
    languageAccuracy: 0,
    confidence: 0
  });

  const divisor = history.length;

  return {
    averageScore: {
      communication: Math.round(totals.communication / divisor),
      roleRelevance: Math.round(totals.roleRelevance / divisor),
      structure: Math.round(totals.structure / divisor),
      languageAccuracy: Math.round(totals.languageAccuracy / divisor),
      confidence: Math.round(totals.confidence / divisor)
    },
    strengths: uniqueValues(history.flatMap((turn: InterviewTurn): readonly string[] => turn.feedback.strengths)).slice(0, 6),
    improvements: uniqueValues(history.flatMap((turn: InterviewTurn): readonly string[] => turn.feedback.improvements)).slice(0, 6)
  };
};

const uniqueValues = (values: readonly string[]): string[] => {
  return Array.from(new Set(values));
};
