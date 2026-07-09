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
