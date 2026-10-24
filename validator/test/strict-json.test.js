import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRecordText } from '../src/strict-json.js';

const codes = (r) => r.issues.map((i) => i.code);
test('clean LF JSON has no issues', () => assert.deepEqual(parseRecordText(Buffer.from('{"a":1}\n'), 'f').issues, []));
test('BOM rejected', () => assert.ok(codes(parseRecordText(Buffer.from('﻿{"a":1}\n'), 'f')).includes('ENCODING_BOM')));
test('CRLF rejected', () => assert.ok(codes(parseRecordText(Buffer.from('{"a":1}\r\n'), 'f')).includes('LINE_ENDING_NOT_LF')));
test('duplicate key rejected without echoing key or value', () => {
  const r = parseRecordText(Buffer.from('{"x":{"secretKey":"v1","secretKey":"SECRET-VALUE"}}\n'), 'f');
  assert.deepEqual(codes(r), ['DUPLICATE_JSON_KEY']);
  assert.equal(r.issues[0].path, '/x');
  assert.ok(!JSON.stringify(r.issues).includes('secretKey') && !JSON.stringify(r.issues).includes('SECRET-VALUE'));
});
test('keys inside string values are not duplicates', () => assert.deepEqual(parseRecordText(Buffer.from('{"a":"{\\"b\\":1,\\"b\\":2}","c":[{"d":1},{"d":2}]}\n'), 'f').issues, []));
test('parse error is reported, not thrown', () => assert.deepEqual(codes(parseRecordText(Buffer.from('{bad'), 'f')), ['JSON_PARSE_ERROR']));
