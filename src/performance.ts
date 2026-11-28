// Device hints only reduce decorative rendering. Physics and game clocks keep their cadence.
const device=(typeof navigator==='undefined'?{}:navigator) as Partial<Navigator>&{deviceMemory?:number};
export const lightweightEffects=(device.deviceMemory!==undefined&&device.deviceMemory<=4)
 || (device.hardwareConcurrency!==undefined&&device.hardwareConcurrency>0&&device.hardwareConcurrency<=4);
