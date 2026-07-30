export const DOMAINS = [
  { id: 'architecture', name: 'Architecture & Data Types', weight: 13, mockExamCount: 7 },
  { id: 'schema-design', name: 'Schema Design & Constraints', weight: 15, mockExamCount: 7 },
  { id: 'querying', name: 'Querying & SQL', weight: 17, mockExamCount: 9 },
  { id: 'indexing', name: 'Indexing & Performance', weight: 17, mockExamCount: 9 },
  { id: 'transactions', name: 'Transactions & Concurrency (MVCC)', weight: 13, mockExamCount: 6 },
  { id: 'administration', name: 'Administration & Maintenance', weight: 17, mockExamCount: 8 },
  { id: 'replication', name: 'Replication & High Availability', weight: 8, mockExamCount: 4 },
];

export const EXAM_FORMAT = {
  totalQuestions: 50,
  durationMinutes: 75,
  passingScore: 70,
  minScore: 0,
  maxScore: 100,
};

export const EXAM_UI = {
  examLabel: 'Practice Exam',
  startBlurb: `${EXAM_FORMAT.totalQuestions} questions, ${EXAM_FORMAT.durationMinutes} minutes, weighted by domain.`,
  startNote: null,
  resultsNote: `This is an estimate based on percent correct on a simplified 0–${EXAM_FORMAT.maxScore} scale — there's no official PostgreSQL exam or scaling formula behind it, since this module isn't tied to a certification. Passing score is ${EXAM_FORMAT.passingScore}.`,
};
