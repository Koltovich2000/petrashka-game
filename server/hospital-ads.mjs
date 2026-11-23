import {randomUUID,timingSafeEqual} from 'node:crypto';
import {dischargeHospitalWithoutLosses,hospitalRules} from '../src/hospital.ts';

const viewingWindow=180_000;

export function hospitalAdsConfig(blockId,secret){
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(blockId??'')||!/^[a-zA-Z0-9_-]{32,128}$/.test(secret??''))return null;
 return {blockId,secret:Buffer.from(secret)};
}

export function matchesRewardSecret(config,key){
 const received=Buffer.from(key??'');
 return received.length===config.secret.length&&timingSafeEqual(received,config.secret);
}

function progressForStay(state){
 const progress=state.hospitalAdProgress;
 return state.hospital&&progress?.startedAt===state.hospital.startedAt?progress:null;
}

export function hospitalAdsStatus(state,config,now){
 if(!config||!state.hospital?.cost)return undefined;
 const progress=progressForStay(state);
 return {blockId:config.blockId,watched:progress?.watched??0,pending:Boolean(progress?.attempt&&progress.attempt.expiresAt>now)};
}

export function startHospitalAd(state,startedAt,now){
 const hospital=state.hospital;
 if(!hospital?.cost||hospital.startedAt!==startedAt)return {state};
 const progress=progressForStay(state);
 if(progress?.attempt&&progress.attempt.expiresAt>now)return {state};
 const attempt={id:randomUUID(),issuedAt:now,expiresAt:now+viewingWindow};
 return {state:{...state,hospitalAdProgress:{startedAt,watched:progress?.watched??0,attempt}},attempt:attempt.id};
}

export function cancelHospitalAd(state,attemptId){
 const progress=progressForStay(state);
 if(!progress?.attempt||progress.attempt.id!==attemptId)return state;
 const {attempt,...confirmed}=progress;
 return {...state,hospitalAdProgress:confirmed};
}

export function recordHospitalAd(state,now,timestamp){
 const progress=progressForStay(state);
 const attempt=progress?.attempt;
 if(!attempt||timestamp<Math.floor(attempt.issuedAt/1000)||timestamp>Math.floor(attempt.expiresAt/1000)||
  timestamp>Math.floor(now/1000)+5||timestamp<=(state.lastHospitalAdReward??0))return state;
 const watched=progress.watched+1;
 if(watched<hospitalRules.ads){
  return {...state,lastHospitalAdReward:timestamp,hospitalAdProgress:{startedAt:progress.startedAt,watched}};
 }
 const recovered={...dischargeHospitalWithoutLosses(state,progress.startedAt),lastHospitalAdReward:timestamp};
 delete recovered.hospitalAdProgress;
 return recovered;
}
