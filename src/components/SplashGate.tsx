import SplashScreen from "@/components/SplashScreen";

// Launch splash for the installed app (Add to Home Screen / standalone mode).
//
// The inline script runs before the rest of <body> is parsed, so the splash is
// on screen from the very first paint — no flash of the page underneath. It
// only turns the splash on when the site is running as an installed app and the
// splash hasn't played yet this session. Append ?splash=1 to any URL to preview
// it in a normal browser tab.
const BOOT_SCRIPT = `try{var q=/[?&]splash=1(&|$)/.test(location.search);var s=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;if(q||(s&&!sessionStorage.getItem('bc_splash_seen'))){document.documentElement.setAttribute('data-splash','on')}}catch(e){}`;

export default function SplashGate() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      <SplashScreen />
    </>
  );
}
