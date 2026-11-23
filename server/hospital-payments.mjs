import {dischargeHospitalWithoutLosses} from '../src/hospital.ts';

const invoiceId=/^hospital:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const checkoutHold=3*60_000;
const legacyStarsPrice=25;

export const isHospitalInvoice=value=>typeof value==='string'&&invoiceId.test(value);

export function hospitalCheckoutActive(state,now){
 const invoice=state.hospitalInvoice;
 return Boolean(state.hospital&&invoice?.startedAt===state.hospital.startedAt&&invoice.checkout&&now<invoice.checkout.at+checkoutHold);
}

const playerId=id=>Number.isSafeInteger(id)&&id>0?String(id):null;

const paymentMatches=(payload,amount,currency)=>isHospitalInvoice(payload)&&amount===legacyStarsPrice&&currency==='XTR';

// Each operation updates a single locked player save, including its payment receipts.
export function hospitalPayments(change){
 return {
  async checkout(query){
   const {id:queryId,invoice_payload:payload,total_amount:amount,currency,from}=query;
   const id=playerId(from?.id);
   if(!id||typeof queryId!=='string'||!queryId||!paymentMatches(payload,amount,currency))return false;
   return change(id,(state,now)=>{
    const invoice=state.hospitalInvoice;
    return {state,value:invoice?.id===payload&&invoice.checkout?.id===queryId&&hospitalCheckoutActive(state,now)};
   });
  },
  async complete(payment,sender){
   const {invoice_payload:payload,total_amount:amount,currency,telegram_payment_charge_id:charge}=payment;
   const id=playerId(sender);
   if(!id||typeof charge!=='string'||!charge||!paymentMatches(payload,amount,currency))return 'invalid';
   return change(id,state=>{
    const receipts=state.hospitalReceipts??[];
    const seen=receipts.find(receipt=>receipt.charge===charge);
    if(seen)return {state,value:seen.result};
    const invoice=state.hospitalInvoice;
    const recovered=invoice?.id===payload&&invoice.checkout?dischargeHospitalWithoutLosses(state,invoice.startedAt):state;
    const result=recovered===state?'refund':'paid';
    const next={...recovered,hospitalReceipts:[...receipts,{charge,payload,result}]};
    if(result==='paid')delete next.hospitalInvoice;
    return {state:next,value:result};
   });
  },
  recordRefund(payment,sender){
   const {invoice_payload:payload,total_amount:amount,currency,telegram_payment_charge_id:charge}=payment;
   const id=playerId(sender);
   if(!id||typeof charge!=='string'||!charge||!paymentMatches(payload,amount,currency))return;
   return change(id,state=>{
    const receipt=state.hospitalReceipts?.find(entry=>entry.charge===charge&&entry.payload===payload&&entry.result==='refund');
    if(!receipt)return {state};
    return {state:{...state,hospitalReceipts:state.hospitalReceipts.map(entry=>entry===receipt?{...entry,result:'refunded'}:entry)}};
   });
  },
 };
}
