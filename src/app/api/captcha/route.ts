import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomInt, createHmac } from 'crypto';

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty',
];

const OPERATION_WORDS: Record<string, string[]> = {
  plus: ['plus', 'added to', 'and'],
  minus: ['minus', 'subtract', 'take away'],
  times: ['times', 'multiplied by'],
};

function signAnswer(answer: string, scope: string): string {
  const secret = process.env.CAPTCHA_SECRET || process.env.ENCRYPTION_KEY || 'portalrr-captcha-dev-only';
  return createHmac('sha256', secret).update(`${scope}:${answer}`).digest('hex');
}

export function verifyCaptchaSignature(answer: string, scope: string, signature: string): boolean {
  return signAnswer(answer, scope) === signature;
}

export async function GET(request: NextRequest) {
  const scope = new URL(request.url).searchParams.get('scope') || 'register';

  // Pick a random operation type
  const ops = ['plus', 'minus', 'times'] as const;
  const op = ops[randomInt(0, ops.length)];

  let a: number, b: number, answer: number;

  if (op === 'plus') {
    a = randomInt(1, 21);
    b = randomInt(1, 21);
    answer = a + b;
  } else if (op === 'minus') {
    // Ensure non-negative result
    a = randomInt(5, 21);
    b = randomInt(1, a + 1);
    answer = a - b;
  } else {
    // Multiplication with small numbers
    a = randomInt(2, 11);
    b = randomInt(2, 11);
    answer = a * b;
  }

  // Convert numbers to words when possible, otherwise use digits
  const aWord = a <= 20 ? NUMBER_WORDS[a] : String(a);
  const bWord = b <= 20 ? NUMBER_WORDS[b] : String(b);

  // Pick a random synonym for the operation
  const opSynonyms = OPERATION_WORDS[op];
  const opWord = opSynonyms[randomInt(0, opSynonyms.length)];

  const question = `What is ${aWord} ${opWord} ${bWord}?`;

  // Store a signed hash of the answer in the cookie (not the answer itself)
  const signature = signAnswer(String(answer), scope);

  const response = NextResponse.json({
    question,
    scope,
  });

  response.cookies.set(`portalrr_captcha_${scope}`, signature, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIES !== 'true',
    path: '/',
    maxAge: 10 * 60,
  });

  return response;
}
