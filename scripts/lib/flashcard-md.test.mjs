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
  assert.throws(() => parseFlashcardMarkdown(text, 'example'), /example/);
});
