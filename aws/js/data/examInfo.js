export const DOMAINS = [
  { id: 'secure', name: 'Design Secure Architectures', weight: 30, mockExamCount: 20 },
  { id: 'resilient', name: 'Design Resilient Architectures', weight: 26, mockExamCount: 16 },
  { id: 'performant', name: 'Design High-Performing Architectures', weight: 24, mockExamCount: 16 },
  { id: 'cost', name: 'Design Cost-Optimized Architectures', weight: 20, mockExamCount: 13 },
];

export const EXAM_FORMAT = {
  totalQuestions: 65,
  scoredQuestions: 50,
  unscoredQuestions: 15,
  durationMinutes: 130,
  passingScore: 720,
  minScore: 100,
  maxScore: 1000,
};

export const EXAM_UI = {
  examLabel: 'Mock Exam',
  startBlurb: `${EXAM_FORMAT.totalQuestions} questions, ${EXAM_FORMAT.durationMinutes} minutes, drawn and weighted like the real exam.`,
  startNote: null,
  resultsNote: `This is an estimate based on percent correct; AWS's real scaling formula is not public. Passing score is ${EXAM_FORMAT.passingScore}.`,
};
