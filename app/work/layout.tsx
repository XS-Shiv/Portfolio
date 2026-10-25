import "./work.css";

/** The Work pages scroll normally and load no 3D or voice code: nothing here imports the hero. */
export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return <div className="work-root">{children}</div>;
}
