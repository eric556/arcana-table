import type {CardData} from './game';
export type SealedCard={iv:string;body:string};
const encode=(b:ArrayBuffer|Uint8Array)=>btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer)));
const decode=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export async function viewKeyPair(){return crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},false,['deriveKey']);}
async function sharedKey(privateKey:CryptoKey,publicJwk:JsonWebKey){const publicKey=await crypto.subtle.importKey('jwk',publicJwk,{name:'ECDH',namedCurve:'P-256'},false,[]);return crypto.subtle.deriveKey({name:'ECDH',public:publicKey},privateKey,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
export async function sealCard(privateKey:CryptoKey,recipient:JsonWebKey,data:CardData,context:string):Promise<SealedCard>{const key=await sharedKey(privateKey,recipient),iv=crypto.getRandomValues(new Uint8Array(12));const body=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(context)},key,new TextEncoder().encode(JSON.stringify(data)));return {iv:encode(iv),body:encode(body)};}
export async function openCard(privateKey:CryptoKey,sender:JsonWebKey,sealed:SealedCard,context:string):Promise<CardData>{const key=await sharedKey(privateKey,sender);const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(sealed.iv),additionalData:new TextEncoder().encode(context)},key,decode(sealed.body));return JSON.parse(new TextDecoder().decode(data));}
