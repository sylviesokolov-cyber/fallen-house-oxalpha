import { gradeOf } from '../sim/stats.js';
import { el } from './dom.js';

// A little portrait matching the map sprite: hair, face and tunic, framed in
// the colour of their grade.
export function portrait(look, who, stage, alive, data) {
  const frame = el('div', `portrait-frame${alive ? '' : ' dead'}${stage === 'child' ? ' child' : ''}`);
  const grade = gradeOf(data, who.grade).color;
  frame.style.borderColor = grade === '#1b1b1b' ? '#5c6878' : grade;
  const body = el('div', 'p-body');
  body.style.background = look.tunic;
  const back = el('div', `p-hair-back${look.longHair ? '' : ' hidden'}`);
  back.style.background = look.hair;
  const head = el('div', 'p-head');
  head.style.background = look.skin;
  const hair = el('div', 'p-hair');
  hair.style.background = look.hair;
  frame.append(body, back, head, hair);
  return frame;
}
