import sleep from 'es7-sleep';
import usb from './usb-async';

process.stdin.setEncoding('utf-8');

function readStdin(){
  return new Promise(resolve=>{
    process.stdin.once("data",resolve);
    process.stdin.once("end",resolve);
  })
}

async function main(){
  //process.once('SIGINT', () => { console.log('Got SIGINT..'); });
  //const device = usb.findByIds(0x8087, 0x0020);
  const device = usb.findByIds(0x0905, 0x0020);
  if(!device) throw Error("Device not found")
  device.open();

  const bulkIface = device.interface(1);
  bulkIface.claim();
  try{
    console.log("Testing LCD");
    const lcd = bulkIface.endpoint(0x08);
    await lcd.transfer([0x01, 0x08, 0x01, 0x06, 0x0D]);
    await sleep(20);
    await lcd.transfer("\x00Hello, world!");
  }finally{
    await bulkIface.release();
  }

  const interruptIface = device.interface(0);
  let reattach = false;
  if(interruptIface.isKernelDriverActive()){
    interruptIface.detachKernelDriver();
    reattach = true;
  }
  interruptIface.claim();
  try{
    //LED
    console.log("Testing LED");
    const led= interruptIface.endpoint(0x01);
    await led.transfer([0x07, 0x00]);
    await sleep(1000);
    await led.transfer([0x07, 0x55]);
    await sleep(1000);
    await led.transfer([0x07, 0xAA]);
    await sleep(1000);
    await led.transfer(new Buffer([0x07, 0xFF]));

    //KBD
    console.log("Testing KBD");
    const kbd = interruptIface.endpoint(0x81);
    console.log("Press keys on device, Ctrl-C to cancel");
    while(true) {
      let result =  await Promise.race([
        Promise.all([0, kbd.transfer(3)]), 
	Promise.all([1, readStdin()])
      ]);
      console.log("Result:", result);
      let [code, data] = result;
      if(code == 1){
	console.log("Str:", data)
	break;
      }
      console.log("KB:", data);
    }
  }finally{
    console.log("Cleanup");
    await interruptIface.release();
    console.log("released");
    if(reattach){
       interruptIface.attachKernelDriver();
    }
    process.stdin.end();
  }
}

main().catch(e=>console.error(e.stack))
