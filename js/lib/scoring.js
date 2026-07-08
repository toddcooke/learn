export function isCorrect(question, selectedIndexes) {
  const a = [...selectedIndexes].sort((x, y) => x - y);
  const b = [...question.correctIndexes].sort((x, y) => x - y);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function estimateScaledScore(correctCount, totalCount, { minScore = 100, maxScore = 1000 } = {}) {
  if (totalCount === 0) return minScore;
  const fraction = correctCount / totalCount;
  return Math.round(minScore + fraction * (maxScore - minScore));
}

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function drawMockExam(questions, domains) {
  const drawn = [];
  for (const domain of domains) {
    const pool = shuffle(questions.filter((q) => q.domain === domain.id));
    drawn.push(...pool.slice(0, domain.mockExamCount));
  }
  return shuffle(drawn);
}
