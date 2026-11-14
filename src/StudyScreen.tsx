import {useState} from 'react';
import type {Game} from './game';
import {courses, skills, skillValue, studyDuration, studyReason, type Course, type Skill} from './study';

const skillKeys = Object.keys(skills) as Skill[];
const courseKeys = Object.keys(courses) as Course[];

export function StudyScreen({game, onStart}: {game: Game; onStart: (course: Course, skill: Skill) => void}) {
 const [skill, setSkill] = useState<Skill>('intelligence');
 const active = game.study;
 const remaining = active ? Math.max(0, Math.ceil((active.ends - game.updated) / 1000)) : 0;
 return <section className="study-screen" aria-labelledby="study-title">
  <h1 id="study-title">Обучение</h1>
  {active && <section className="activity-status">
   <strong>{courses[active.course].name} · {skills[active.skill]}</strong>
   <p role="status">До конца {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</p>
   <progress aria-label="Ход занятия" value={Math.max(0, game.updated - active.started)} max={active.ends - active.started}/>
  </section>}
  <fieldset>
   <legend>Какой навык развиваем?</legend>
   <div className="study-skills">
    {skillKeys.map(key => <button key={key} aria-pressed={skill === key} onClick={() => setSkill(key)}>
     {skills[key]} <strong>{skillValue(game, key)} / 100</strong>
    </button>)}
   </div>
  </fieldset>
  {game.mood > 0 && game.mood < 30 && <p className="muted">При низком настроении урок длится на 20% дольше.</p>}
  <div className="study-courses">
   {courseKeys.map(key => {
    const course = courses[key];
    const reason = studyReason(game, key, skill);
    const points = Math.min(course.skill, 100 - skillValue(game, skill));
    return <article key={key}>
     <h2>{course.name}</h2>
     <p>{studyDuration(game) / 60_000} мин. · +{points} к навыку · +{course.xp} XP</p>
     <p>−{course.energy} энергии · −{course.food} сытости · −{course.mood} настроения</p>
     <button className="gold-button" disabled={Boolean(reason)} onClick={() => onStart(key, skill)}>Начать занятие</button>
     {reason && <small>{reason}</small>}
    </article>;
   })}
  </div>
 </section>;
}
