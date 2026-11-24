// Exercise the installed PeerJS serializers. Only the RTC transport/signaling
// boundary is stubbed; packing, chunking, reassembly and limits are real PeerJS.
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {Peer}=await import(pathToFileURL(join(dirname(require.resolve('peerjs')),'bundler.mjs')));
const peer=new Peer('serializer-test');peer.on('error',()=>{});
const serializers=peer._serializers;peer.destroy();
export function codec(serialization='binary'){
 const previous=globalThis.RTCPeerConnection;
 globalThis.RTCPeerConnection=class {
  createDataChannel(){return {bufferedAmount:0,addEventListener(){},send(){}};}
  createOffer(){return new Promise(()=>{});}
  close(){}
 };
 try{const c=new serializers[serialization]('fixture',{options:{config:{}},_removeConnection(){}},{reliable:true});c.dataChannel.onopen();return c;}
 finally{globalThis.RTCPeerConnection=previous;}
}
