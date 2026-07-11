export const DOMAINS = [
  { id: 'cluster', name: 'Cluster Architecture, Installation and Configuration', weight: 25, mockExamCount: 15 },
  { id: 'services', name: 'Services and Networking', weight: 20, mockExamCount: 12 },
  { id: 'workloads', name: 'Workloads and Scheduling', weight: 15, mockExamCount: 9 },
  { id: 'storage', name: 'Storage', weight: 10, mockExamCount: 6 },
  { id: 'troubleshooting', name: 'Troubleshooting', weight: 30, mockExamCount: 18 },
];

export const EXAM_FORMAT = {
  totalQuestions: 60,
  durationMinutes: 90,
  passingScore: 66,
  minScore: 0,
  maxScore: 100,
};

export const EXAM_UI = {
  examLabel: 'Mock Exam',
  startBlurb: `${EXAM_FORMAT.totalQuestions} questions, ${EXAM_FORMAT.durationMinutes} minutes, drawn and weighted like the real exam's domains.`,
  startNote: `The real CKA exam is 100% hands-on (command-line tasks in a live cluster), not multiple-choice. This mock exam reinforces the same knowledge but isn't a replica of the real exam experience — pair it with hands-on practice (kind, minikube, killer.sh).`,
  resultsNote: `This is an estimate based on percent correct against a simplified 0–100 scale; the real CKA exam is pass/fail on hands-on tasks, not scored this way. Passing score is ${EXAM_FORMAT.passingScore}.`,
};
