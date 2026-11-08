export function toCents(value: string): string {
 if(!/^\\d{1,10}$/.test(value)) throw new Error("Ingresá un importe entero en pesos, sin decimales ni separadores de miles.");
 const cents=BigInt(value)*100n;
 if(cents<1n||cents>100000000000n)throw new Error("Importe fuera de rango.");
 return cents.toString();
}
export function pesos(cents: string): string {
 const amount=BigInt(cents);const whole=amount/100n;const fraction=amount%100n;
 const formatted=whole.toLocaleString("es-AR");
 return fraction===0n? `$ ${formatted}`:`$ ${formatted},${fraction.toString().padStart(2,"0")}`;
}
export type Movement={id:string;cents:string;paid_on:string;method:string;actor:string;recorded_at:string;reversal:null|{reason:string;actor:string;recorded_at:string}};
export type Period={id:string;month:string;due_on:string;cents:string;paid:string;payments:Movement[]};
export type Snapshot={prices:{month:string;cents:string}[];periods:Period[]};
