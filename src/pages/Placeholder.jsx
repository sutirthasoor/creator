import { Link } from "react-router-dom";

export default function Placeholder({ title, note }) {
  return (
    <div className="public-shell mx-auto px-4 sm:px-6">
      <div className="cm-stub">
        <h1 className="cm-h2">{title}</h1>
        <p className="cm-lead">{note || "This page is part of the next build phase."}</p>
        <Link className="cm-btn cm-btn-primary" to="/">Back to home</Link>
      </div>
    </div>
  );
}
