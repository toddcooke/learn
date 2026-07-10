export const DOMAINS = [
  { id: 'concepts', name: 'Networking Concepts', weight: 23, mockExamCount: 21 },
  { id: 'implementation', name: 'Network Implementation', weight: 20, mockExamCount: 18 },
  { id: 'operations', name: 'Network Operations', weight: 19, mockExamCount: 17 },
  { id: 'security', name: 'Network Security', weight: 14, mockExamCount: 12 },
  { id: 'troubleshooting', name: 'Network Troubleshooting', weight: 24, mockExamCount: 22 },
];

export const EXAM_FORMAT = {
  totalQuestions: 90, // matches the real N10-009's max question count
  durationMinutes: 90, // matches the real exam's time limit
  passingScore: 720, // matches the real exam's passing score
  minScore: 100,
  maxScore: 900, // matches the real exam's 100-900 scale
};
