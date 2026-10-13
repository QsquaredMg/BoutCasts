import { cond } from "./font";
import "./pred-theme.css";

export default function PredictionsLayout({ children }: { children: React.ReactNode }) {
  return <div className={`pt ${cond.variable}`}>{children}</div>;
}
