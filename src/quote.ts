import { diffDays, localDay } from './day'

const QUOTES: string[] = [
  'Small steps still move you forward.',
  'You do not have to do it all today.',
  'Begin again, as many times as you need.',
  'Rest is part of the work.',
  'Be as kind to yourself as you are to others.',
  'Progress is quiet. Keep showing up.',
  'One honest line is enough.',
  'Today is a fresh page.',
  'Slow is still going somewhere.',
  'You are allowed to start small.',
  'A good day is made of ordinary things.',
  'Notice what went well. Start there.',
  'You showed up. That counts.',
  'Let the hard days be hard, then let them go.',
  'Tomorrow does not need you to be perfect.',
  'Breathe first. Then the next small thing.',
  'What you repeat, you become.',
  'Look up. The sky is doing its best.',
  'Your pace is the right pace.',
  'Gentle and steady wins the long game.',
  'Done is better than flawless.',
  'Every day you try is a day that matters.',
  'Be here for the small moments.',
  'Let today be enough.',
  'Courage is just one more try.',
  'Take what you need from today.',
  'You have come further than you think.',
  'Quiet effort adds up.',
  'Choose the next kind thing for yourself.',
  'The view is better when you pause.'
]

export const quoteOfDay = (day = localDay()) => QUOTES[diffDays(day, '1970-01-01') % QUOTES.length]
