export const DOMAINS = [
  { id: 'architecture', name: 'Architecture & Data Types', weight: 15, mockExamCount: 8 },
  { id: 'querying', name: 'Querying & SQL', weight: 20, mockExamCount: 10 },
  { id: 'indexing', name: 'Indexing & Performance', weight: 20, mockExamCount: 10 },
  { id: 'transactions', name: 'Transactions & Concurrency (MVCC)', weight: 15, mockExamCount: 7 },
  { id: 'administration', name: 'Administration & Maintenance', weight: 20, mockExamCount: 10 },
  { id: 'replication', name: 'Replication & High Availability', weight: 10, mockExamCount: 5 },
];

export const EXAM_FORMAT = {
  totalQuestions: 50,
  durationMinutes: 75,
  passingScore: 70,
  minScore: 0,
  maxScore: 100,
};
