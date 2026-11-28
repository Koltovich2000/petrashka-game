import {useEffect,useRef,useState} from 'react';
import {PixelAvatar} from './PixelAvatar';
import {defaultOutfit} from './wardrobe';
import {defaultCharacterName,maxCharacterNameLength,parseCharacterName} from './characterName';

import farewell from './assets/intro/farewell.webp';
import train from './assets/intro/train.webp';
import apartment from './assets/intro/apartment.webp';

const scenes = [
  {
    image:farewell,
    description:'Перед отъездом. Мама: «Ты едешь в Москву. Вот тебе деньги на первое время». Петрашка: «Спасибо, мам. Я справлюсь». +65 000 ₽.',
    buttonTop:'89.7%',
  },
  {
    image:train,
    description:'В поезде. Петрашка: «Я еду в Москву начинать новую жизнь…»',
    buttonTop:'89.2%',
  },
  {
    image:apartment,
    description:'Новая квартира. Арендодатель: «Квартира — 65 000 ₽. Оплата сразу». Петрашка: «Ну всё… теперь реально начинаю с нуля». Баланс: 65 000 ₽ → 0 ₽.',
    buttonTop:'89.6%',
  },
] as const;

const sceneCount=scenes.length+1;

export function Intro({index,onNext,onFinish,error,requireName,renaming,nameError,onNameChange}:{
  index:number;onNext:()=>void;onFinish:(name:string)=>Promise<void>;error:string;
  requireName:boolean;renaming:boolean;nameError:string;onNameChange:()=>void;
}) {
  const heading=useRef<HTMLHeadingElement>(null);
  const scene=scenes[index];
  const [loadedImage,setLoadedImage]=useState('');
  const [name,setName]=useState('');
  const [saving,setSaving]=useState(false);
  const illustrated=Boolean(scene && loadedImage===scene.image);
  const chosenName=parseCharacterName(name.trim()||(requireName?'':defaultCharacterName));

  useEffect(()=>{
    if(index>0)heading.current?.focus();
  },[index]);

  if(scene)return <main className="intro-illustrated">
    <h1 className="intro-sr-only" ref={heading} tabIndex={-1}>Переезд в Москву. Сцена {index+1} из {sceneCount}</h1>
    <div className="intro-slide">
      <img key={scene.image} src={scene.image} width={941} height={1672}
        className={illustrated?undefined:'intro-image-pending'} alt={illustrated?scene.description:''}
        onLoad={()=>setLoadedImage(scene.image)} onError={()=>setLoadedImage('')} draggable={false}/>
      {!illustrated&&<section className="intro-fallback intro-dialog">
        <h2>Переезд в Москву</h2>
        <p>{scene.description}</p>
      </section>}
      <button className={illustrated?'intro-image-next':'intro-fallback-next'} style={{top:scene.buttonTop}}
        onClick={onNext} aria-label="Далее">{illustrated?null:'Далее'}</button>
    </div>
    {error&&<p role="alert">{error}</p>}
  </main>;

  return <main className="app intro">
    <h1 ref={heading} tabIndex={-1}>{renaming?'Имя персонажа':'Переезд в Москву'}</h1>
    {!renaming&&<p className="intro-step">Сцена {sceneCount} из {sceneCount}</p>}
    <div className="intro-art intro-start" aria-hidden="true">
      <div className="intro-room-art"/>
      <div className="intro-petrashka"><PixelAvatar outfit={defaultOutfit}/></div>
    </div>
    <form className="intro-name-form" onSubmit={async event=>{
      event.preventDefault();
      if(saving||!chosenName)return;
      setSaving(true);
      try{await onFinish(chosenName);}
      finally{setSaving(false);}
    }}>
      <section className="intro-dialog">
        <h2>{renaming?'Выбери уникальное имя':'Первый день в Москве'}</h2>
        <label className="intro-name-label">Имя персонажа
          <input type="text" value={name} onChange={event=>{setName(event.target.value);onNameChange();}} maxLength={maxCharacterNameLength}
            placeholder={requireName?'Введи имя':defaultCharacterName} autoComplete="off" disabled={saving} dir="auto"
            required={requireName} aria-invalid={Boolean(nameError)} aria-describedby={nameError?'character-name-error':undefined}/>
        </label>
        {nameError&&<p id="character-name-error" role="alert">{nameError}</p>}
        {!chosenName&&name.trim()&&<p role="alert">Проверь имя и убери непечатаемые символы.</p>}
        {renaming?<p>После выбора имени ты продолжишь с того же места.</p>:<>
          <p>«Пора обживаться.»</p>
          <p>Баланс: <strong>0 ₽</strong></p>
        </>}
      </section>
      <button type="submit" className="open-wardrobe intro-next" disabled={saving||!chosenName}>
        {renaming?'Сохранить имя':'Начать жизнь в Москве'}
      </button>
    </form>
    {error&&<p role="alert">{error}</p>}
  </main>;
}
