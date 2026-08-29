import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, toAnkiField } from './anki-field.mjs';

test('escapeHtml escapes the three characters that would be read as markup', () => {
  assert.equal(escapeHtml('a & b < c > d'), 'a &amp; b &lt; c &gt; d');
  assert.equal(escapeHtml("quotes ' \" stay"), "quotes ' \" stay");
});

test('plain prose is escaped and otherwise untouched', () => {
  assert.equal(
    toAnkiField('Reach it at <service>.<namespace> & retry.'),
    'Reach it at &lt;service&gt;.&lt;namespace&gt; &amp; retry.',
  );
});

test('a bullet run becomes a ul', () => {
  assert.equal(toAnkiField('- Alpha\n- Beta'), '<ul><li>Alpha</li><li>Beta</li></ul>');
});

test('bullet markers -, * and + are all accepted', () => {
  assert.equal(toAnkiField('* One\n+ Two\n- Three'),
    '<ul><li>One</li><li>Two</li><li>Three</li></ul>');
});

test('a numbered run becomes an ol with the markers stripped', () => {
  assert.equal(toAnkiField('1. Physical\n2) Data Link'),
    '<ol><li>Physical</li><li>Data Link</li></ol>');
});

test('prose before a list stays outside it', () => {
  assert.equal(toAnkiField('The six pillars:\n\n- Security\n- Reliability'),
    'The six pillars:<ul><li>Security</li><li>Reliability</li></ul>');
});

test('prose after a list stays outside it and needs no break', () => {
  assert.equal(toAnkiField('- Security\n- Reliability\n\nBoth matter.'),
    '<ul><li>Security</li><li>Reliability</li></ul>Both matter.');
});

test('two prose paragraphs are separated by a single br', () => {
  assert.equal(toAnkiField('First.\n\nSecond.'), 'First.<br>Second.');
});

test('wrapped prose lines rejoin into one run with single spaces', () => {
  assert.equal(toAnkiField('One line\nand its continuation.'), 'One line and its continuation.');
});

test('list item text is escaped like any other text', () => {
  assert.equal(toAnkiField('- kubectl get pod <name>'),
    '<ul><li>kubectl get pod &lt;name&gt;</li></ul>');
});

test('a number that is not a list marker stays prose', () => {
  assert.equal(toAnkiField('1990s hardware was slower.'), '1990s hardware was slower.');
});

test('the output never contains a tab, CR, or LF', () => {
  const out = toAnkiField('a\tb\r\nc\n\n- d\n- e');
  assert.equal(/[\t\r\n]/.test(out), false);
});

test('a field starting with a double quote is prefixed with a space', () => {
  // Anki's importer would otherwise read the row as csv-quoted and eat separators.
  assert.equal(toAnkiField('"Good intentions never work."'), ' "Good intentions never work."');
});

test('an empty field stays empty', () => {
  assert.equal(toAnkiField(''), '');
});
