import {useEffect,useRef} from 'react';
import {PixelAvatar} from './PixelAvatar';
import {defaultOutfit} from './wardrobe';

const scenes = [
  {
    image:'farewell',
    description:'Перед отъездом. Мама: «Ты едешь в Москву. Вот тебе деньги на первое время». Петрашка: «Спасибо, мам. Я справлюсь». +65 000 ₽.',
    buttonTop:'89.7%',
  },
  {
    image:'train',
    description:'В поезде. Петрашка: «Я еду в Москву начинать новую жизнь…»',
    buttonTop:'89.2%',
  },
  {
    image:'apartment',
    description:'Новая квартира. Арендодатель: «Квартира — 65 000 ₽. Оплата сразу». Петрашка: «Ну всё… теперь реально начинаю с нуля». Баланс: 65 000 ₽ → 0 ₽.',
    buttonTop:'89.6%',
  },
] as const;

const sceneCount=scenes.length+1;

export function Intro({index,onNext,onFinish,error}:{index:number;onNext:()=>void;onFinish:()=>void;error:string}) {
  const heading=useRef<HTMLHeadingElement>(null);
  const scene=scenes[index];

  useEffect(()=>{
    const next=scenes[index+1];
    if(next)new Image().src=`/assets/intro/${next.image}.png`;
    if(index>0)heading.current?.focus();
  },[index]);

  if(scene)return <main className="intro-illustrated">
    <h1 className="intro-sr-only" ref={heading} tabIndex={-1}>Переезд в Москву. Сцена {index+1} из {sceneCount}</h1>
    <div className="intro-slide">
      <img src={`/assets/intro/${scene.image}.png`} width={941} height={1672} alt={scene.description} draggable={false}/>
      <button className="intro-image-next" style={{top:scene.buttonTop}} onClick={onNext} aria-label="Далее"/>
    </div>
    {error&&<p role="alert">{error}</p>}
  </main>;

  return <main className="app intro">
    <h1 ref={heading} tabIndex={-1}>Переезд в Москву</h1>
    <p className="intro-step">Сцена {sceneCount} из {sceneCount}</p>
    <div className="intro-art intro-start" aria-hidden="true">
      <div className="intro-room-art"/>
      <div className="intro-petrashka"><PixelAvatar outfit={defaultOutfit}/></div>
    </div>
    <section className="intro-dialog">
      <h2>Первый день в Москве</h2>
      <strong>Петрашка</strong>
      <p>«Пора обживаться.»</p>
      <p>Баланс: <strong>0 ₽</strong></p>
    </section>
    <button className="open-wardrobe intro-next" onClick={onFinish}>Начать жизнь в Москве</button>
    {error&&<p role="alert">{error}</p>}
  </main>;
}
