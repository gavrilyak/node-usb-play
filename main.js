import sleep from 'es7-sleep';
import usb from './usb-async';

process.stdin.setEncoding('utf-8');

function readStream(stream) {
  let promise  = new Promise((resolve, reject)=> {
    function remove() {
      stream.removeListener('data', onData);
      stream.removeListener('error', onError);
      stream.removeListener('end', onEnd);
    }

    function onData(data) {
      remove();
      if (data != null) {
        resolve(data);
      } else {
        reject(new Error('Unexpected enpty data in stream'));
      }
    }

    function onError(error) {
      remove();
      reject(error);
    }

    function onEnd() {
      remove();
      resolve(null);
    }

    stream.on('data', onData);
    stream.on('error', onError);
    stream.on('end', onEnd);
  });
  return promise;
}

async function main() {
  const device = usb.findByIds(0x0905, 0x0020);
  if (!device) throw Error('Device not found');
  device.open();

  const bulkIface = device.interface(1);
  const interruptIface = device.interface(0);

  let   bulkClaimed = false;
  let   interruptClaimed = false;
  let   reattachInterupt = false;
  try {
    bulkIface.claim();
    bulkClaimed = true;
    if (interruptIface.isKernelDriverActive()) {
      interruptIface.detachKernelDriver();
      reattachInterupt = true;
    }

    interruptIface.claim();
    interruptClaimed = true;

    console.log('Testing LCD');
    const lcd = bulkIface.endpoint(0x08);
    await lcd.transfer([0x01, 0x08, 0x01, 0x06, 0x0D]);
    await lcd.transfer('\x00Hello, world!');

    //LED
    console.log('Testing LED');
    const led = interruptIface.endpoint(0x01);
    await led.transfer([0x07, 0x00]);
    await sleep(1000);
    await led.transfer([0x07, 0x55]);
    await sleep(1000);
    await led.transfer([0x07, 0xAA]);
    await sleep(1000);
    await led.transfer([0x07, 0xFF]);

    //KBD
    console.log('Testing KBD');
    const kbd = interruptIface.endpoint(0x81);
    console.log('Press keys on device, Ctrl-D to exit');
    let kbdTransferPromise = kbd.transfer(3);
    let readStdinPromise   = readStream(process.stdin);

    loop:
    while (true) {
      let [source, data] =  await Promise.race([
        Promise.all(['kb', kbdTransferPromise]),
        Promise.all(['in', readStdinPromise]),
      ]);

      //console.log(code, data);

      switch (source) {
        case 'kb':
          console.log('KB:', data);
          kbdTransferPromise = kbd.transfer(3);
          break;

        case 'in':
          if (!data) {
            process.stdin.end();
            break loop;
          }

          //console.log("You entered:", data);
          await lcd.transfer([0x01, 0x08, 0x01, 0x06, 0x0D]);
          await lcd.transfer('\0'  + data.slice(0, -1));
          readStdinPromise = readStream(process.stdin);
          break;
      }
    }
  } finally {
    //console.log("Cleanup");
    if (interruptClaimed) {
      await interruptIface.release();
    }

    if (bulkClaimed) {
      await bulkIface.release();
    }

    if (reattachInterupt) {
      interruptIface.attachKernelDriver();
    }
  }
}

main().catch(e => console.error(e.stack));
