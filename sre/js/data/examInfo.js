export const DOMAINS = [
  { id: 'slos', name: 'SLIs, SLOs & Error Budgets', weight: 20, mockExamCount: 10 },
  { id: 'monitoring', name: 'Monitoring, Observability & Alerting', weight: 20, mockExamCount: 10 },
  { id: 'incidents', name: 'Incident Response, On-Call & Postmortems', weight: 20, mockExamCount: 10 },
  { id: 'capacity', name: 'Capacity Planning & Managing Load', weight: 15, mockExamCount: 8 },
  { id: 'release', name: 'Release Engineering & Change Management', weight: 15, mockExamCount: 7 },
  { id: 'reliability', name: 'Reliability Patterns & Toil Reduction', weight: 10, mockExamCount: 5 },
];

export const EXAM_FORMAT = {
  totalQuestions: 50,
  durationMinutes: 75,
  passingScore: 70,
  minScore: 0,
  maxScore: 100,
};
