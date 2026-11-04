export function toCents(value: string): string {
 if(!/^\d{1,10}([.,]\d{1,2})?$/.test(value)) throw new Error("Ingresá un importe positivo con hasta dos decimales, sin separadores de miles.");
 const [whole,fraction=""]=value.replace(",",".").split(".");
 const cents=BigInt(whole!)*100n+BigInt(fraction.padEnd(2,"0"));
 if(cents<1n||cents>100000000000n)throw new Error("Importe fuera de rango.");
 return cents.toString();
}
export function pesos(cents: string): string {
 const amount=BigInt(cents);return `$ ${(amount/100n).toLocaleString("es-AR")},${(amount%100n).toString().padStart(2,"0")}`;
}
export type Movement={id:string;cents:string;paid_on:string;method:string;actor:string;recorded_at:string;reversal:null|{reason:string;actor:string;recorded_at:string}};
export type Period={id:string;month:string;due_on:string;cents:string;paid:string;payments:Movement[]};
export type Snapshot={prices:{month:string;cents:string}[];periods:Period[]};
