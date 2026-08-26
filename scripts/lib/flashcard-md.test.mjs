import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFlashcardMarkdown } from './flashcard-md.mjs';

const CARD = [
  '# Example — flashcards',
  '',
  '2 cards.',
  '',
  '## Storage',
  '',
  '### `s3` · Amazon S3',
  '',
  '**What is it for?**',
  '',
  '<details><summary>Answer</summary>',
  '',
  'Object storage.',
  '',
  '</details>',
  '',
  '### `ebs` · Amazon EBS',
  '',
  '**What is it for?**',
  '',
  '<details><summary>Answer</summary>',
  '',
  'Block storage.',
  '',
  '</details>',
  '',
].join('\n');

test('parses cards with id, service, domain, front and back', () => {
  const cards = parseFlashcardMarkdown(CARD, 'example');
  assert.equal(cards.length, 2);
  assert.deepEqual(cards[0], {
    id: 's3',
    service: 'Amazon S3',
    domain: 'Storage',
    front: 'What is it for?',
    back: 'Object storage.',
  });
  assert.equal(cards[1].id, 'ebs');
});

test('preserves blank lines inside a back', () => {
  const text = CARD.replace('Object storage.', 'First para.\n\nSecond para.');
  const cards = parseFlashcardMarkdown(text, 'example');
  assert.equal(cards[0].back, 'First para.\n\nSecond para.');
});

test('unwraps backticked tag-like placeholders back to bare text', () => {
  const text = CARD.replace('Object storage.', 'Run `kubectl get svc `<name>`` to check.')
    .replace('**What is it for?**', '**What does `<pod>` mean?**');
  const cards = parseFlashcardMarkdown(text, 'example');
  assert.equal(cards[0].back, 'Run `kubectl get svc <name>` to check.');
  assert.equal(cards[0].front, 'What does <pod> mean?');
});

test('leaves genuinely backticked prose alone', () => {
  const text = CARD.replace('Object storage.', 'Run `kubectl get pods` first.');
  const cards = parseFlashcardMarkdown(text, 'example');
  assert.equal(cards[0].back, 'Run `kubectl get pods` first.');
});

test('throws on a card heading that is not `id` · service', () => {
  const text = CARD.replace('### `s3` · Amazon S3', '### Amazon S3');
  assert.throws(() => parseFlashcardMarkdown(text, 'example'), /unparseable card heading/);
});

test('throws on a card with no front', () => {
  const text = CARD.replace('**What is it for?**\n\n<details>', '<details>');
  assert.throws(() => parseFlashcardMarkdown(text, 'example'), /missing a front/);
});

test('throws on a card with an empty back', () => {
  const text = CARD.replace('Object storage.', '');
  assert.throws(() => parseFlashcardMarkdown(text, 'example'), /missing a back/);
});

test('throws on a card before any domain heading', () => {
  const text = CARD.replace('## Storage\n\n', '');
  assert.throws(() => parseFlashcardMarkdown(text, 'example'), /before any domain heading/);
});

test('throws on a duplicate id within a module', () => {
  const text = CARD.replace('### `ebs` · Amazon EBS', '### `s3` · Amazon EBS');
  assert.throws(() => parseFlashcardMarkdown(text, 'example'), /duplicate card id/);
});

test('names the module in its errors', () => {
  const text = CARD.replace('### `s3` · Amazon S3', '### broken');
  assert.throws(() => parseFlashcardMarkdown(text, 'example'), (err) => {
    assert.match(err.message, /^example\/flashcards\.md: /);
    return true;
  });
});

test('throws on a paragraph appended after </details>', () => {
  const text = CARD.replace(
    'Object storage.\n\n</details>',
    'Object storage.\n\n</details>\n\nOops, extra paragraph.'
  );
  assert.throws(() => parseFlashcardMarkdown(text, 'example'), /card "s3" has content after its answer/);
});

test('throws on a domain heading appearing inside an answer', () => {
  const text = CARD.replace(
    'Object storage.\n\n</details>',
    'Object storage.\n\n## Compute\n\n</details>'
  );
  assert.throws(() => parseFlashcardMarkdown(text, 'example'), /card "s3" has content after its answer/);
});

test('throws on a second <details> block within one card', () => {
  const text = CARD.replace(
    'Object storage.\n\n</details>',
    'Object storage.\n\n</details>\n\n<details><summary>Answer</summary>\n\nMore.\n\n</details>'
  );
  assert.throws(() => parseFlashcardMarkdown(text, 'example'), /card "s3" has content after its answer/);
});

test('throws on an empty front', () => {
  const text = CARD.replace('**What is it for?**', '****');
  assert.throws(() => parseFlashcardMarkdown(text, 'example'), /missing a front/);
});

test('throws on a card id containing a tab, CR, or LF', () => {
  const withTab = CARD.replace('### `s3` · Amazon S3', '### `s\t3` · Amazon S3');
  assert.throws(() => parseFlashcardMarkdown(withTab, 'example'), /card id .* contains/);

  const withCR = CARD.replace('### `s3` · Amazon S3', '### `s\r3` · Amazon S3');
  assert.throws(() => parseFlashcardMarkdown(withCR, 'example'), /card id .* contains/s);
});

test('carries the correct domain across a second domain heading', () => {
  const text = [
    '# Example — flashcards',
    '',
    '4 cards.',
    '',
    '## Storage',
    '',
    '### `s3` · Amazon S3',
    '',
    '**What is it for?**',
    '',
    '<details><summary>Answer</summary>',
    '',
    'Object storage.',
    '',
    '</details>',
    '',
    '### `ebs` · Amazon EBS',
    '',
    '**What is it for?**',
    '',
    '<details><summary>Answer</summary>',
    '',
    'Block storage.',
    '',
    '</details>',
    '',
    '## Compute',
    '',
    '### `ec2` · Amazon EC2',
    '',
    '**What is it for?**',
    '',
    '<details><summary>Answer</summary>',
    '',
    'Virtual machines.',
    '',
    '</details>',
    '',
    '### `lambda` · AWS Lambda',
    '',
    '**What is it for?**',
    '',
    '<details><summary>Answer</summary>',
    '',
    'Serverless functions.',
    '',
    '</details>',
    '',
  ].join('\n');
  const cards = parseFlashcardMarkdown(text, 'example');
  assert.equal(cards.length, 4);
  assert.equal(cards[0].domain, 'Storage');
  assert.equal(cards[1].domain, 'Storage');
  assert.equal(cards[2].domain, 'Compute');
  assert.equal(cards[3].domain, 'Compute');
  assert.equal(cards[0].id, 's3');
  assert.equal(cards[3].id, 'lambda');
});
