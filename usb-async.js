import usb from 'usb';
import promisify from 'es6-promisify';

usb.InEndpoint.prototype.transfer         = promisify(usb.InEndpoint.prototype.transfer);
usb.OutEndpoint.prototype.transfer        = promisify(usb.OutEndpoint.prototype.transfer);
usb.OutEndpoint.prototype.transferWithZLP = promisify(usb.OutEndpoint.prototype.transferWithZLP);
usb.Device.prototype.setConfiguration     = promisify(usb.Device.prototype.setConfiguration);
usb.Device.prototype.getStringDescriptor  = promisify(usb.Device.prototype.getStringDescriptor);

//FIXME: Interface is not exported, so a little hack to get access to it
usb.Device.prototype.open = (function wrapOpen(oldOpen) {
  return function open(...args) {
    var res = oldOpen.apply(this, args);
    var InterfacePrototype = this.interfaces[0].constructor.prototype;
    InterfacePrototype.release           = promisify(InterfacePrototype.release);
    InterfacePrototype.setAltSetting     = promisify(InterfacePrototype.setAltSetting);
    return res;
  };
})(usb.Device.prototype.open);
export default usb;

