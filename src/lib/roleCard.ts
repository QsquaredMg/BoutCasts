import type { RoleDef } from "@/lib/electionRoles";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** Opens a print-ready role card in a new window: the code, the mini lesson and a checklist. Browser-only. */
export function printRoleCard(o: { role: RoleDef; name: string; code: string; electionTitle: string; school: string | null; url: string }) {
  const { role, name, code, electionTitle, school, url } = o;
  const steps = [...role.can.map((c) => `I know I can: ${c.toLowerCase()}`), `I know I cannot: ${(role.cannot[0] ?? "go beyond my role").toLowerCase()}`, "I will keep every vote private", "I will tell my teacher about anything that seems wrong"];
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(role.label)} role card</title>
<style>
 body{font-family:system-ui,sans-serif;color:#0a0e1a;margin:0;padding:24px}
 .card{max-width:640px;margin:0 auto;border:3px solid #1b4fe4;border-radius:16px;padding:24px}
 .kicker{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#555}
 h1{margin:4px 0 0;font-size:30px} h2{margin:18px 0 6px;font-size:15px}
 .code{margin:12px 0;padding:12px;border-radius:12px;background:#f4f6fb;text-align:center;font-size:34px;font-weight:900;letter-spacing:.2em}
 p,li{font-size:14px;line-height:1.45} ul{margin:4px 0;padding-left:20px} .box{display:inline-block;width:12px;height:12px;border:2px solid #0a0e1a;margin-right:8px;vertical-align:-2px}
 .foot{margin-top:18px;font-size:12px;color:#555} ul.check{list-style:none;padding:0}
 @media print{body{padding:0}}
</style></head><body><div class="card">
 <div class="kicker">${esc(school ?? "School election")} · ${esc(electionTitle)}</div>
 <h1>${esc(role.label)}</h1><p>${esc(name)}</p>
 <div class="code">${esc(code)}</div>
 <p>Open <b>${esc(url)}</b> and enter your code.</p>
 <h2>Mini lesson</h2>
 <p><b>Why it matters.</b> ${esc(role.lesson.why)}</p>
 <p><b>Your job.</b> ${esc(role.lesson.job)}</p>
 <p><b>Try it.</b> ${esc(role.lesson.tryIt)}</p>
 <h2>What you can do</h2><ul>${role.can.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
 <h2>What you cannot do</h2><ul>${role.cannot.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
 <h2>Checklist</h2><ul class="check">${steps.map((s) => `<li><span class="box"></span>${esc(s)}</li>`).join("")}</ul>
 <div class="foot">Keep this code private. Need help? Support@boutcasts.com · BoutCasts School Elections</div>
</div><script>window.onload=function(){window.print()}</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
