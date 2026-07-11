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

export const EXAM_UI = {
  examLabel: 'Practice Exam',
  startBlurb: `${EXAM_FORMAT.totalQuestions} questions, ${EXAM_FORMAT.durationMinutes} minutes, weighted by domain.`,
  startNote: null,
  resultsNote: `This is an estimate based on percent correct on a simplified 0–${EXAM_FORMAT.maxScore} scale — there's no official SRE exam or scaling formula behind it, since this module isn't tied to a certification. Passing score is ${EXAM_FORMAT.passingScore}.`,
};
