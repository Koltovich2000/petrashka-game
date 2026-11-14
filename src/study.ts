import {xpProgress} from './balance';
import {advance, type Game} from './game';

export const skills = {
 intelligence: 'Интеллект',
 communication: 'Общение',
 fitness: 'Физподготовка',
 creativity: 'Творчество',
 business: 'Бизнес',
 home: 'Быт',
} as const;

export type Skill = keyof typeof skills;
type LearnedSkills = Record<Exclude<Skill, 'fitness'>, number>;
export const emptySkills = (): LearnedSkills => ({
 intelligence: 0, communication: 0, creativity: 0, business: 0, home: 0,
});

export const courses = {
 book: {name: 'Книга', energy: 5, food: 2, mood: 1, skill: 2, xp: 12},
 online: {name: 'Онлайн-курс', energy: 8, food: 3, mood: 3, skill: 4, xp: 18},
 practice: {name: 'Практическое занятие', energy: 12, food: 5, mood: 4, skill: 6, xp: 25},
} as const;

export type Course = keyof typeof courses;
export type StudySession = {course: Course; skill: Skill; started: number; ends: number};
const studyMinutes = 10;

export function studyDuration(g: Game) {
 return studyMinutes * (g.mood < 30 ? 72_000 : 60_000);
}

export function skillValue(g: Game, skill: Skill): number {
 return Math.min(100, skill === 'fitness' ? g.fitnessXP : g.learnedSkills[skill]);
}

export function studyReason(g: Game, course: Course, skill: Skill): string {
 const cost = courses[course];
 if (g.tutorial < 5 || xpProgress(g.economy.xp).level < 2) return 'Доступно после обучения на 2-м уровне';
 if (g.health === 0) return 'Петрашка погиб';
 if (g.sleepUntil !== null) return 'Сначала разбуди Петрашку';
 if (g.study || g.roomAction || g.economy.shift || g.restUntil !== null) return 'Дождись окончания текущего занятия';
 if (skillValue(g, skill) >= 100) return 'Этот навык уже на максимуме';
 if (g.energy < cost.energy) return `Нужно ${cost.energy} энергии`;
 if (g.food < cost.food) return `Нужно ${cost.food} сытости`;
 if (g.mood < cost.mood) return `Нужно ${cost.mood} настроения`;
 return '';
}

export function startStudy(game: Game, course: Course, skill: Skill, now = Date.now()): Game {
 const g = advance(game, now);
 if (studyReason(g, course, skill)) return g;
 const cost = courses[course];
 return {
  ...g, energy: g.energy - cost.energy, food: g.food - cost.food, mood: g.mood - cost.mood,
  study: {course, skill, started: g.updated, ends: g.updated + studyDuration(g)},
 };
}

export function finishStudy(g: Game, study: StudySession): Game {
 const course = courses[study.course];
 const skill = Math.min(100, skillValue(g, study.skill) + course.skill);
 return {
  ...g, study: null,
  economy: {...g.economy, xp: g.economy.xp + course.xp},
  ...(study.skill === 'fitness'
   ? {fitnessXP: skill}
   : {learnedSkills: {...g.learnedSkills, [study.skill]: skill}}),
 };
}

export function parseStudy(value: unknown, updated: number): StudySession | null {
 if (!value || typeof value !== 'object') return null;
 const s = value as StudySession;
 const duration = s.ends - s.started;
 return Object.hasOwn(courses, s.course) && Object.hasOwn(skills, s.skill)
  && Number.isFinite(s.started) && s.started >= 0 && s.started <= updated
  && (duration === 600_000 || duration === 720_000) ? s : null;
}

export function parseSkills(value: unknown): LearnedSkills {
 const parsed = emptySkills();
 if (!value || typeof value !== 'object') return parsed;
 for (const skill of Object.keys(parsed) as (keyof LearnedSkills)[]) {
  const amount = (value as LearnedSkills)[skill];
  if (Number.isFinite(amount)) parsed[skill] = Math.max(0, Math.min(100, amount));
 }
 return parsed;
}
