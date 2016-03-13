import sleep from 'es7-sleep';

import usb from 'usb';
import promisify from 'es6-promisify';
usb.InEndpoint.prototype.transfer         = promisify(usb.InEndpoint.prototype.transfer);
usb.OutEndpoint.prototype.transfer        = promisify(usb.OutEndpoint.prototype.transfer);
usb.OutEndpoint.prototype.transferWithZLP = promisify(usb.OutEndpoint.prototype.transferWithZLP);
usb.Device.prototype.setConfiguration     = promisify(usb.Device.prototype.setConfiguration);
//usb.Interface.prototype.release           = promisify(usb.Interface.prototype.release);
//usb.Interface.prototype.setAltSetting     = promisify(usb.Interface.prototype.setAltSetting);


async function main(){
  //const device = usb.findByIds(0x8087, 0x0020);
  const device = usb.findByIds(0x0905, 0x0020);
  if(!device) throw Error("Device not found")
  device.open();

  const interruptIface = device.interface(0);
  if(interruptIface.isKernelDriverActive()){
    interruptIface.detachKernelDriver();
  }
  const bulkIface = device.interface(1);

  interruptIface.claim();
  bulkIface.claim();

  console.log("Testing LCD");
  //LCD
  const lcd = bulkIface.endpoint(0x08);
  await lcd.transfer([0x01, 0x08, 0x01, 0x06, 0x0D]);
  await sleep(20);
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
  await led.transfer(new Buffer([0x07, 0xFF]));

  //KBD
  console.log("Testing KBD");
  const kbd = interruptIface.endpoint(0x81);
  console.log("Press keys on device, Ctrl-C to cancel");
  while(true) {
    var kbState = await kbd.transfer(3);
    console.log("KB:", kbState);
  }
}

main().catch(e=>console.error(e.stack))
