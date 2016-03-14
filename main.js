import sleep from 'es7-sleep';
import usb from './usb-async';

process.stdin.setEncoding('utf-8');

function readStdin(){
  let promise  = new Promise((resolve, reject)=>{
    process.stdin.once("data", data => {
      console.log("stdin:", data);
      resolve(data)
    });
    process.stdin.once("end", resolve);
  })
  return promise;
}

async function main(){
  //process.once('SIGINT', () => { console.log('Got SIGINT..'); });
  //const device = usb.findByIds(0x8087, 0x0020);
  const device = usb.findByIds(0x0905, 0x0020);
  if (!device) throw Error("Device not found")
  device.open();

  const bulkIface = device.interface(1);
  let   bulkClaimed = false;
  const interruptIface = device.interface(0);
  let   interruptClaimed = false;
  let   reattachInterupt = false;
  try {
    bulkIface.claim();
    bulkClaimed = true;
    if(interruptIface.isKernelDriverActive()){
      interruptIface.detachKernelDriver();
      reattachInterupt = true;
    }
    interruptIface.claim();
    interruptClaimed = true;

    console.log("Testing LCD");
    const lcd = bulkIface.endpoint(0x08);
    await lcd.transfer([0x01, 0x08, 0x01, 0x06, 0x0D]);
    await lcd.transfer("\x00Hello, world!");

   //LED
    console.log("Testing LED");
    const led= interruptIface.endpoint(0x01);
    await led.transfer([0x07, 0x00]);
    await sleep(1000);
    await led.transfer([0x07, 0x55]);
    await sleep(1000);
    await led.transfer([0x07, 0xAA]);
    await sleep(1000);
    await led.transfer([0x07, 0xFF]);

    //KBD
    console.log("Testing KBD");
    const kbd = interruptIface.endpoint(0x81);
    console.log("Press keys on device, Ctrl-D to exit");
    let kbdTransferPromise = kbd.transfer(3);
    let readStdinPromise   = readStdin();

    loop:
    while (true) {
      let [code, data] =  await Promise.race([
        Promise.all([0, kbdTransferPromise]), 
	Promise.all([1, readStdinPromise])
      ]);
      //console.log(code, data);

      switch (code) {
	case 0:
	  console.log("KB:", data);
	  kbdTransferPromise = kbd.transfer(3);
	  break;

 	case 1:
	  if (!data) {
	    process.stdin.end();
	    break loop;
	  }
	  //console.log("You entered:", data);
	  await lcd.transfer([0x01, 0x08, 0x01, 0x06, 0x0D]);
	  await lcd.transfer("\0"  + data.slice(0, -1));
	  readStdinPromise = readStdin();
	  break;
      }
    }
  } finally {
    console.log("Cleanup");
    if (interruptClaimed) {
      await interruptIface.release();
    }

    if (bulkClaimed ) {
      await bulkIface.release();
    }

    if (reattachInterupt) {
      interruptIface.attachKernelDriver();
    }
  }
}

main().catch( e => console.error(e.stack))
