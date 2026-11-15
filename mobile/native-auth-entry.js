import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";

const capacitor = window.Capacitor;

window.MemingoNativeAuth = {
  isNative: () => Boolean(capacitor?.isNativePlatform?.()),
  open: (url) => Browser.open({ url, presentationStyle: "fullscreen" }),
  close: () => Browser.close(),
  addListener: (eventName, callback) => App.addListener(eventName, callback),
  getLaunchUrl: () => App.getLaunchUrl(),
};
