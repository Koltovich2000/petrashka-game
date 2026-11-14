import {useState} from 'react';
import {savePreset,wearPreset,renamePreset,deletePreset,type Closet} from './wardrobe';
export function PresetPanel({closet,onChange}:{closet:Closet;onChange:(c:Closet)=>void}){
 const [name,setName]=useState('Мой образ'),[message,setMessage]=useState('');
 function save(id?:string){if(!id&&closet.presets.length>=3){setMessage('Можно сохранить не более 3 образов');return;}if(!name.trim()){setMessage('Придумай название образа');return;}onChange(savePreset(closet,name,id));setMessage('Образ сохранён');}
 return <section className="preset-panel" aria-label="Сохранённые образы"><h2>Мои образы · {closet.presets.length} / 3</h2><p>Все три слота бесплатны. Для редактирования надень образ, поменяй одежду и нажми «Обновить».</p><label>Название образа<input maxLength={32} value={name} onChange={e=>setName(e.target.value)}/></label><div className="preset-actions"><button onClick={()=>save()}>Сохранить новый</button>{closet.activePreset&&<button onClick={()=>save(closet.activePreset!)}>Обновить текущий</button>}</div>{message&&<p role="status">{message}</p>}
 {closet.presets.map(p=><article key={p.id}><strong>{p.name}{closet.activePreset===p.id?' · выбран':''}</strong><div><button onClick={()=>{onChange(wearPreset(closet,p.id));setName(p.name);setMessage('Образ надет. Можно редактировать.');}}>Надеть / редактировать</button><button onClick={()=>{if(name.trim()){onChange(renamePreset(closet,p.id,name));setMessage('Название изменено');}}}>Переименовать</button><button onClick={()=>onChange(deletePreset(closet,p.id))}>Удалить</button></div></article>)}
 </section>;
}
